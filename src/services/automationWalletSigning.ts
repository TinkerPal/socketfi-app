// @ts-nocheck
import { Address, TransactionBuilder, rpc, xdr } from "@stellar/stellar-sdk";
import type { Connector } from "wagmi";

import { WalletKitService } from "../wallet-kit/services/global-service";

type Network = "PUBLIC" | "TESTNET";
type AuthMethod = "passkey" | "stellar" | "evm";

type DisplayValue = Record<string, unknown> | { key: string; value: unknown };

type SigningContext = {
  authMethod: AuthMethod;
  network: Network;
  walletAddress: string;
  contractId: string;
  callFunction: { name: string };
  argsXdr: string[];
  accessToken?: string;
  stellarSigner?: string;
  evmSigner?: string;
  connectedEvmAddress?: `0x${string}`;
  isEvmConnected?: boolean;
  signMessageAsync: (input: any) => Promise<`0x${string}`>;
  evmConnectors?: readonly Connector[];
  connectedEvmConnector?: Connector;
  reconnectEvmAsync?: (input?: any) => Promise<any>;
  evmConnectorId?: string;
  evmConnectorType?: string;
  evmConnectorName?: string;
  socketfi: any;
  display?: {
    description?: string;
    values?: DisplayValue[];
  };
};

type DirectPreparation = {
  sessionId: string;
  transactionXdr: string;
  unsignedAuthEntryXdr: string;
  authPreimageXdr: string;
  signatureExpirationLedger: number;
  networkPassphrase: string;
  rpcUrl: string;
};

type EvmPreparation = {
  sessionId: string;
  signaturePayloadHex: `0x${string}`;
  evmAddress?: `0x${string}`;
  walletAddress?: string;
  network?: Network;
};

const SERVER_URL = (
  import.meta.env.VITE_SERVER_DIRECT_URL ||
  import.meta.env.VITE_SOCKETFI_DIRECT_API_URL ||
  "http://localhost:3200"
).replace(/\/$/, "");

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Wallet authorization failed";
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        payload?.message ||
        `Request failed (${response.status})`
    );
  }

  return payload as T;
}

function normalizeAuthMethod(value: unknown): AuthMethod {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "stellar" || normalized === "evm") return normalized;
  return "passkey";
}

export function getSocketFiAuthMethod(session: any): AuthMethod {
  return normalizeAuthMethod(
    session?.connectionMethod ||
      session?.authMethod ||
      session?.walletType ||
      session?.userProfile?.connectionMethod ||
      session?.userProfile?.authMethod ||
      session?.userProfile?.walletType
  );
}

export function getSocketFiStellarSigner(session: any): string {
  return String(
    session?.stellarSigner ||
      session?.stellarPublicKey ||
      session?.userProfile?.stellarSigner ||
      session?.userProfile?.stellarPublicKey ||
      session?.userProfile?.stellarAccount?.publicKey ||
      ""
  ).trim();
}

export function getSocketFiEvmSigner(session: any): string {
  return String(
    session?.evmAddress ||
      session?.evmSigner ||
      session?.userProfile?.evmAddress ||
      session?.userProfile?.evmSigner ||
      session?.userProfile?.evmAccount?.address ||
      ""
  ).trim();
}

function decodeBase64(value: string): Uint8Array {
  const normalized = value.trim().replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(
    normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
  );
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeHex(value: string): Uint8Array {
  const normalized = value.replace(/^0x/i, "");
  if (!/^[0-9a-f]+$/i.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("Wallet returned an invalid hexadecimal signature");
  }
  return Uint8Array.from(
    normalized.match(/.{2}/g)!.map((pair) => Number.parseInt(pair, 16))
  );
}

function decodeStellarSignature(result: unknown): Uint8Array {
  if (result instanceof Uint8Array && result.length === 64) return result;

  let value: unknown = result;
  if (result && typeof result === "object") {
    const object = result as any;
    value =
      object.signedAuthEntry ??
      object.signature ??
      object.data?.signedAuthEntry ??
      object.data?.signature;
  }

  if (typeof value !== "string") {
    throw new Error("Stellar wallet returned no authorization signature");
  }

  if (/^(?:0x)?[0-9a-fA-F]{128}$/.test(value)) {
    return decodeHex(value);
  }

  const first = decodeBase64(value);
  if (first.length === 64) return first;

  const nested = new TextDecoder().decode(first).trim();
  const second = decodeBase64(nested);
  if (second.length !== 64) {
    throw new Error("Invalid Stellar authorization signature length");
  }

  return second;
}

function walletAuthScVal(
  variant: "Stellar" | "Evm",
  signature: Uint8Array
): xdr.ScVal {
  const inner = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("signature"),
      val: xdr.ScVal.scvBytes(signature),
    }),
  ]);

  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(variant), inner]);
}

function signedAuthEntry(
  prepared: Pick<
    DirectPreparation,
    "unsignedAuthEntryXdr" | "signatureExpirationLedger"
  >,
  variant: "Stellar" | "Evm",
  signature: Uint8Array
): xdr.SorobanAuthorizationEntry {
  const unsigned = xdr.SorobanAuthorizationEntry.fromXDR(
    prepared.unsignedAuthEntryXdr,
    "base64"
  );
  const credentials = unsigned.credentials().address();

  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: credentials.address(),
        nonce: credentials.nonce(),
        signatureExpirationLedger: prepared.signatureExpirationLedger,
        signature: walletAuthScVal(variant, signature),
      })
    ),
    rootInvocation: unsigned.rootInvocation(),
  });
}

function injectAuth(
  transactionXdr: string,
  networkPassphrase: string,
  walletAddress: string,
  authEntry: xdr.SorobanAuthorizationEntry
) {
  const transaction = TransactionBuilder.fromXDR(
    transactionXdr,
    networkPassphrase
  );
  const envelope = transaction.toEnvelope();
  const operations = envelope.value().tx().operations();

  if (operations.length !== 1) {
    throw new Error("Expected one Soroban operation");
  }

  const invoke = operations[0].body().invokeHostFunctionOp();
  let replaced = false;
  const entries = (invoke.auth() || []).map((entry) => {
    try {
      const address = Address.fromScAddress(
        entry.credentials().address().address()
      ).toString();

      if (address !== walletAddress) return entry;
      replaced = true;
      return authEntry;
    } catch {
      return entry;
    }
  });

  if (!replaced) entries.push(authEntry);
  invoke.auth(entries);

  return TransactionBuilder.fromXDR(
    envelope.toXDR("base64"),
    networkPassphrase
  );
}

function normalizedEvmAddress(value?: string | null): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function connectorMatches(
  connector: Connector,
  expectedId?: string,
  expectedType?: string,
  expectedName?: string
): boolean {
  return Boolean(
    (expectedId && connector.id.toLowerCase() === expectedId.toLowerCase()) ||
      (expectedType &&
        String(connector.type || "").toLowerCase() ===
          expectedType.toLowerCase()) ||
      (expectedName &&
        connector.name.toLowerCase() === expectedName.toLowerCase())
  );
}

async function resolveEvmSigningAddress(context: SigningContext) {
  const expected = normalizedEvmAddress(context.evmSigner);
  if (!expected) {
    throw new Error("This SocketFi account has no linked EVM address");
  }

  if (
    context.isEvmConnected &&
    context.connectedEvmAddress &&
    normalizedEvmAddress(context.connectedEvmAddress) === expected
  ) {
    return context.connectedEvmAddress;
  }

  if (!context.reconnectEvmAsync) {
    throw new Error("Reconnect the EVM wallet linked to this SocketFi account");
  }

  const connectors = context.evmConnectors || [];
  const preferred = connectors.find((connector) =>
    connectorMatches(
      connector,
      context.evmConnectorId,
      context.evmConnectorType,
      context.evmConnectorName
    )
  );

  let reconnectResult: any;
  try {
    reconnectResult = preferred
      ? await context.reconnectEvmAsync({ connectors: [preferred] })
      : await context.reconnectEvmAsync();
  } catch (error) {
    throw new Error(
      `Unable to reconnect the linked EVM wallet: ${asErrorMessage(error)}`
    );
  }

  const connections = Array.isArray(reconnectResult)
    ? reconnectResult
    : [reconnectResult];

  for (const connection of connections) {
    const accounts = connection?.accounts || [];
    const matching = accounts.find(
      (account: string) => normalizedEvmAddress(account) === expected
    );
    if (matching) return matching as `0x${string}`;
  }

  const active = connections.flatMap((item) => item?.accounts || [])[0];
  throw new Error(
    active
      ? `Wrong EVM account active. Switch to ${context.evmSigner!.slice(
          0,
          6
        )}…${context.evmSigner!.slice(-4)} and try again.`
      : "The linked EVM wallet did not return an account"
  );
}

function normalizeDisplayValues(values: DisplayValue[] = []) {
  return values.map((item) => {
    if ("key" in item && "value" in item) return item;
    const [key, value] = Object.entries(item)[0] || ["Detail", ""];
    return { key, value: String(value ?? "") };
  });
}

function extractAuthEntries(result: any, walletAddress: string): string[] {
  const direct =
    result?.signedAuthEntriesXdr ||
    result?.authEntriesXdr ||
    result?.data?.signedAuthEntriesXdr ||
    result?.data?.authEntriesXdr;

  if (Array.isArray(direct) && direct.length) return direct;

  const single =
    result?.signedAuthEntryXdr ||
    result?.authEntryXdr ||
    result?.data?.signedAuthEntryXdr ||
    result?.data?.authEntryXdr;
  if (typeof single === "string" && single) return [single];

  const transactionXdr =
    result?.signedTransactionXdr ||
    result?.transactionXdr ||
    result?.data?.signedTransactionXdr ||
    result?.data?.transactionXdr;

  const passphrase =
    result?.networkPassphrase || result?.data?.networkPassphrase;

  if (transactionXdr && passphrase) {
    const transaction = TransactionBuilder.fromXDR(transactionXdr, passphrase);
    const operation = transaction.toEnvelope().value().tx().operations()[0];
    const entries = operation.body().invokeHostFunctionOp().auth() || [];
    const ownerEntries = entries.filter((entry) => {
      try {
        return (
          Address.fromScAddress(
            entry.credentials().address().address()
          ).toString() === walletAddress
        );
      } catch {
        return false;
      }
    });

    if (ownerEntries.length) {
      return ownerEntries.map((entry) => entry.toXDR("base64"));
    }
  }

  throw new Error("SocketFi returned no signed authorization entry");
}

async function prepareStellar(
  context: SigningContext
): Promise<DirectPreparation> {
  if (!context.stellarSigner) {
    throw new Error("Reconnect the Stellar wallet linked to this account");
  }

  return readJson<DirectPreparation>(
    await fetch(`${SERVER_URL}/api/stellar-transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "prepare",
        network: context.network,
        stellarPublicKey: context.stellarSigner,
        walletAddress: context.walletAddress,
        contractId: context.contractId,
        callFunction: context.callFunction,
        argsXdr: context.argsXdr,
      }),
    })
  );
}

async function prepareEvm(context: SigningContext): Promise<EvmPreparation> {
  if (!context.evmSigner) {
    throw new Error("This SocketFi account has no linked EVM address");
  }

  const prepared = await readJson<EvmPreparation>(
    await fetch(`${SERVER_URL}/api/evm-transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "prepare",
        network: context.network,
        evmAddress: context.evmSigner.toLowerCase(),
        walletAddress: context.walletAddress,
        contractId: context.contractId,
        callFunction: context.callFunction,
        argsXdr: context.argsXdr,
      }),
    })
  );

  if (!prepared?.sessionId) {
    throw new Error("EVM preparation returned no session ID");
  }

  if (
    typeof prepared.signaturePayloadHex !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(prepared.signaturePayloadHex)
  ) {
    throw new Error("EVM preparation returned an invalid signing payload");
  }

  if (
    prepared.evmAddress &&
    normalizedEvmAddress(prepared.evmAddress) !==
      normalizedEvmAddress(context.evmSigner)
  ) {
    throw new Error(
      "The prepared EVM authorization does not match the linked wallet"
    );
  }

  if (
    prepared.walletAddress &&
    prepared.walletAddress !== context.walletAddress
  ) {
    throw new Error(
      "The prepared EVM authorization does not match this SocketFi account"
    );
  }

  if (prepared.network && prepared.network !== context.network) {
    throw new Error(
      "The prepared EVM authorization does not match the selected network"
    );
  }

  return prepared;
}

export async function approveAutomationPaymentAuthorization(
  context: SigningContext
): Promise<string[]> {
  if (context.authMethod === "passkey") {
    if (!context.accessToken) {
      throw new Error("Your SocketFi session expired. Sign in again");
    }

    const result = await context.socketfi.signTx({
      contractId: context.contractId,
      clientPaymaster:
        "GD2MDJZBVINQRAFJMCNNS6CLMHOCFWONFNCCB74QGRBR3D5DLLUMHVCO",
      callFunction: context.callFunction,
      argsXdr: context.argsXdr,
      accessToken: context.accessToken,
      displayMode: "full",
      description:
        context.display?.description || "Authorize automation payment",
      values: normalizeDisplayValues(context.display?.values),
      authorizationOnly: true,
    });

    return extractAuthEntries(result, context.walletAddress);
  }

  if (context.authMethod === "stellar") {
    const prepared = await prepareStellar(context);
    const rawSignature = decodeStellarSignature(
      await WalletKitService.signAuthEntry(
        prepared.authPreimageXdr,
        context.network,
        context.stellarSigner!
      )
    );

    return [signedAuthEntry(prepared, "Stellar", rawSignature).toXDR("base64")];
  }

  const signingAddress = await resolveEvmSigningAddress(context);
  const prepared = await prepareEvm(context);

  const signature = await context.signMessageAsync({
    account: signingAddress,
    message: {
      raw: prepared.signaturePayloadHex,
    },
  });

  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    throw new Error("The EVM wallet returned an invalid signature");
  }

  const completed = await readJson<any>(
    await fetch(`${SERVER_URL}/api/evm-transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "complete-authorization",
        sessionId: prepared.sessionId,
        signature,
      }),
    })
  );

  const entries =
    completed?.signedAuthEntriesXdr ?? completed?.data?.signedAuthEntriesXdr;

  if (
    !Array.isArray(entries) ||
    entries.length !== 1 ||
    typeof entries[0] !== "string" ||
    !entries[0]
  ) {
    throw new Error(
      "EVM authorization completion returned no signed authorization entry"
    );
  }

  return entries;
}

export async function signAndSubmitSmartAccountInvocation(
  context: SigningContext
): Promise<any> {
  if (context.authMethod === "passkey") {
    if (!context.accessToken) {
      throw new Error("Your SocketFi session expired. Sign in again");
    }

    return context.socketfi.signAndSubmitTx({
      contractId: context.contractId,
      callFunction: context.callFunction,
      argsXdr: context.argsXdr,
      accessToken: context.accessToken,
      displayMode: "full",
      description:
        context.display?.description || "Approve smart-account transaction",
      values: normalizeDisplayValues(context.display?.values),
    });
  }

  if (context.authMethod === "stellar") {
    const prepared = await prepareStellar(context);
    const rawSignature = decodeStellarSignature(
      await WalletKitService.signAuthEntry(
        prepared.authPreimageXdr,
        context.network,
        context.stellarSigner!
      )
    );
    const authEntry = signedAuthEntry(prepared, "Stellar", rawSignature);

    let transaction = injectAuth(
      prepared.transactionXdr,
      prepared.networkPassphrase,
      context.walletAddress,
      authEntry
    );

    const server = new rpc.Server(prepared.rpcUrl);
    const simulation = await server.simulateTransaction(transaction);
    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(`Transaction simulation failed: ${simulation.error}`);
    }

    transaction = rpc.assembleTransaction(transaction, simulation).build();
    transaction = injectAuth(
      transaction.toXDR(),
      prepared.networkPassphrase,
      context.walletAddress,
      authEntry
    );

    const signedTransactionXdr = await WalletKitService.signTx(
      transaction.toXDR(),
      context.network
    );

    return readJson<any>(
      await fetch(`${SERVER_URL}/api/stellar-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          sessionId: prepared.sessionId,
          signedTransactionXdr,
          txDetails: {
            type: "automation_authorization",
            walletContractId: context.walletAddress,
            network: context.network,
            contractId: context.contractId,
            functionName: context.callFunction.name,
          },
        }),
      })
    );
  }

  const signingAddress = await resolveEvmSigningAddress(context);
  const prepared = await prepareEvm(context);
  const signature = await context.signMessageAsync({
    account: signingAddress,
    message: { raw: prepared.signaturePayloadHex },
  });

  return readJson<any>(
    await fetch(`${SERVER_URL}/api/evm-transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "submit",
        sessionId: prepared.sessionId,
        signature,
        txDetails: {
          type: "automation_authorization",
          walletContractId: context.walletAddress,
          network: context.network,
          contractId: context.contractId,
          functionName: context.callFunction.name,
        },
      }),
    })
  );
}
