// @ts-nocheck
import { useMemo } from "react";
import { useSocketFi } from "@socketfi/react";
import {
  useAccount,
  useConnectors,
  useReconnect,
  useSignMessage,
} from "wagmi";
import {
  Address,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";

import { useStates } from "../context/StatesContext";
import { WalletKitService } from "../wallet-kit/services/global-service";

type Network = "TESTNET" | "PUBLIC";
type WalletConnectionMethod = "passkey" | "stellar" | "evm";

interface ExecuteInput {
  contractId: string;
  functionName: string;
  argsXdr: string[];
  description: string;
  values?: Array<{ key: string; value: string }>;
  txDetails?: Record<string, unknown>;
}

const SERVER_URL = (
  import.meta.env.VITE_SERVER_DIRECT_URL ||
  import.meta.env.VITE_SOCKETFI_DIRECT_API_URL ||
  "http://localhost:3200"
).replace(/\/$/, "");

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload?.error || payload?.message || `Request failed (${response.status})`
    );
  }
  return payload;
}

function getConnectionMethod(session: any, stellarSigner: string): WalletConnectionMethod {
  const method =
    session?.connectionMethod ??
    session?.authMethod ??
    session?.walletType ??
    session?.userProfile?.connectionMethod ??
    session?.userProfile?.authMethod ??
    session?.userProfile?.walletType;
  if (["passkey", "stellar", "evm"].includes(method)) return method;
  return stellarSigner ? "stellar" : "passkey";
}

function decodeBase64(value: string): Uint8Array {
  const normalized = value.trim().replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
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
    throw new Error("The Stellar wallet returned no authorization signature.");
  }
  if (/^[0-9a-fA-F]{128}$/.test(value)) {
    return Uint8Array.from(value.match(/.{2}/g)!.map((pair) => parseInt(pair, 16)));
  }
  const first = decodeBase64(value);
  if (first.length === 64) return first;
  const nested = new TextDecoder().decode(first).trim();
  const second = decodeBase64(nested);
  if (second.length !== 64) {
    throw new Error("Invalid Stellar authorization signature length.");
  }
  return second;
}

function walletAuthScVal(signature: Uint8Array): xdr.ScVal {
  const inner = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("signature"),
      val: xdr.ScVal.scvBytes(signature),
    }),
  ]);
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Stellar"), inner]);
}

function buildSignedAuthEntry(prepared: any, signature: Uint8Array) {
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
        signature: walletAuthScVal(signature),
      })
    ),
    rootInvocation: unsigned.rootInvocation(),
  });
}

function injectAuth(
  transactionXdr: string,
  passphrase: string,
  walletAddress: string,
  authEntry: xdr.SorobanAuthorizationEntry
) {
  const transaction = TransactionBuilder.fromXDR(transactionXdr, passphrase);
  const envelope = transaction.toEnvelope();
  const operations = envelope.value().tx().operations();
  if (operations.length !== 1) throw new Error("Expected one Soroban operation.");
  const body = operations[0].body();
  if (body.switch() !== xdr.OperationType.invokeHostFunction()) {
    throw new Error("Expected an invokeHostFunction operation.");
  }
  const invoke = body.invokeHostFunctionOp();
  let replaced = false;
  const entries = (invoke.auth() || []).map((entry) => {
    try {
      if (
        entry.credentials().switch() !==
        xdr.SorobanCredentialsType.sorobanCredentialsAddress()
      ) return entry;
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
  return TransactionBuilder.fromXDR(envelope.toXDR("base64"), passphrase);
}

function extractHash(value: any): string {
  return (
    value?.txHash ||
    value?.hash ||
    value?.transactionHash ||
    value?.data?.txHash ||
    value?.data?.hash ||
    value?.data?.transactionHash ||
    ""
  );
}

export function useSocketFiSorobanExecutor() {
  const socketfi = useSocketFi();
  const {
    address: connectedEvmAddress,
    connector: connectedEvmConnector,
    isConnected: isEvmConnected,
  } = useAccount();
  const connectors = useConnectors();
  const { reconnectAsync } = useReconnect();
  const { signMessageAsync } = useSignMessage();
  const {
    selectedNetwork,
    activeSession,
    userKey,
    setSessionId,
    triggerUpdate,
  } = useStates();

  const network = String(selectedNetwork).toUpperCase() === "PUBLIC" ? "PUBLIC" : "TESTNET";
  const walletAddress = activeSession?.userProfile?.address?.[network] || "";
  const stellarSigner =
    activeSession?.stellarSigner ||
    activeSession?.stellarPublicKey ||
    activeSession?.userProfile?.stellarSigner ||
    activeSession?.userProfile?.stellarPublicKey ||
    userKey ||
    "";
  const storedEvmAddress =
    activeSession?.evmAddress || activeSession?.userProfile?.evmAddress || "";
  const accessToken =
    activeSession?.accessToken || activeSession?.socketfiAccessToken || "";
  const connectionMethod = useMemo(
    () => getConnectionMethod(activeSession, stellarSigner),
    [activeSession, stellarSigner]
  );

  async function reconnectExpectedEvmAddress(): Promise<`0x${string}`> {
    const expected = String(storedEvmAddress).toLowerCase();
    if (!expected) throw new Error("This SocketFi account has no linked EVM wallet.");
    if (
      isEvmConnected &&
      connectedEvmAddress &&
      connectedEvmAddress.toLowerCase() === expected
    ) return connectedEvmAddress;

    const results = await reconnectAsync();
    for (const result of results) {
      const match = result.accounts.find((account) => account.toLowerCase() === expected);
      if (match) return match;
    }
    throw new Error("Reconnect the EVM wallet linked to this SocketFi account and select the correct account.");
  }

  async function execute(input: ExecuteInput): Promise<{ hash: string; response: any }> {
    if (!walletAddress) throw new Error("SocketFi smart account not found.");
    if (!input.contractId) throw new Error("Target contract is missing.");
    const localSessionId = crypto.randomUUID();
    setSessionId(localSessionId);

    try {
      let response: any;
      if (connectionMethod === "passkey") {
        if (!accessToken) throw new Error("Your SocketFi session expired. Sign in again.");
        response = await socketfi.signAndSubmitTx({
          contractId: input.contractId,
          callFunction: { name: input.functionName },
          argsXdr: input.argsXdr,
          accessToken,
          displayMode: "full",
          description: input.description,
          values: input.values || [],
        });
      } else if (connectionMethod === "stellar") {
        if (!stellarSigner) throw new Error("Reconnect the Stellar wallet linked to this account.");
        const prepared = await readJson(
          await fetch(`${SERVER_URL}/api/stellar-transactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "prepare",
              network,
              stellarPublicKey: stellarSigner,
              walletAddress,
              contractId: input.contractId,
              callFunction: { name: input.functionName },
              argsXdr: input.argsXdr,
            }),
          })
        );
        const raw = decodeStellarSignature(
          await WalletKitService.signAuthEntry(
            prepared.authPreimageXdr,
            network,
            stellarSigner
          )
        );
        const authEntry = buildSignedAuthEntry(prepared, raw);
        let transaction = injectAuth(
          prepared.transactionXdr,
          prepared.networkPassphrase,
          walletAddress,
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
          walletAddress,
          authEntry
        );
        const signedTransactionXdr = await WalletKitService.signTx(
          transaction.toXDR(),
          network
        );
        response = await readJson(
          await fetch(`${SERVER_URL}/api/stellar-transactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "submit",
              sessionId: prepared.sessionId,
              signedTransactionXdr,
              txDetails: input.txDetails,
            }),
          })
        );
      } else {
        const signingAddress = await reconnectExpectedEvmAddress();
        const prepared = await readJson(
          await fetch(`${SERVER_URL}/api/evm-transactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "prepare",
              network,
              evmAddress: storedEvmAddress.toLowerCase(),
              walletAddress,
              contractId: input.contractId,
              callFunction: { name: input.functionName },
              argsXdr: input.argsXdr,
            }),
          })
        );
        const signature = await signMessageAsync({
          account: signingAddress,
          message: { raw: prepared.signaturePayloadHex },
        });
        response = await readJson(
          await fetch(`${SERVER_URL}/api/evm-transactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "submit",
              sessionId: prepared.sessionId,
              signature,
              txDetails: input.txDetails,
            }),
          })
        );
      }

      const hash = extractHash(response);
      if (!hash) throw new Error("Transaction submitted but no transaction hash was returned.");
      triggerUpdate();
      return { hash, response };
    } finally {
      setSessionId("");
    }
  }

  return {
    execute,
    network: network as Network,
    walletAddress,
    connectionMethod,
    SERVER_URL,
  };
}
