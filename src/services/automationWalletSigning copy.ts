// @ts-nocheck
import { Address, TransactionBuilder, rpc, xdr } from "@stellar/stellar-sdk";

import { WalletKitService } from "../wallet-kit/services/global-service";

export type Network = "PUBLIC" | "TESTNET";
export type WalletConnectionMethod = "passkey" | "stellar" | "evm";

interface SocketFiSession {
  accessToken?: string;
  socketfiAccessToken?: string;

  connectionMethod?: WalletConnectionMethod;
  authMethod?: WalletConnectionMethod;
  walletType?: WalletConnectionMethod;

  stellarSigner?: string;
  stellarPublicKey?: string;
  evmAddress?: `0x${string}`;

  userProfile?: {
    userId?: string;

    connectionMethod?: WalletConnectionMethod;
    authMethod?: WalletConnectionMethod;
    walletType?: WalletConnectionMethod;

    stellarSigner?: string;
    stellarPublicKey?: string;
    evmAddress?: `0x${string}`;

    stellarAccount?: {
      publicKey?: string;
    };

    evmAccount?: {
      address?: `0x${string}`;
    };

    address?: Partial<Record<Network, string>>;
  };

  [key: string]: unknown;
}

interface DirectTransactionPreparation {
  sessionId: string;
  transactionXdr: string;
  unsignedAuthEntryXdr: string;
  authPreimageXdr: string;
  signatureExpirationLedger: number;
  networkPassphrase: string;
  rpcUrl: string;
}

interface EvmTransactionPreparation {
  sessionId: string;
  signaturePayloadHex: `0x${string}`;
  evmAddress?: `0x${string}`;
  walletAddress?: string;
  network?: Network;
  signatureExpirationLedger?: number;
  networkPassphrase?: string;
  feePayer?: string;
  expiresInMs?: number;
}

interface WalletAuthEntryResult {
  signedAuthEntry?: string;
  signature?: string;
  signerAddress?: string;
  data?: {
    signedAuthEntry?: string;
    signature?: string;
  };
}

interface SmartAccountInvocationInput {
  authMethod: WalletConnectionMethod;
  network: Network;
  walletAddress: string;
  contractId: string;
  callFunction: {
    name: string;
  };
  argsXdr: string[];

  accessToken?: string;

  stellarSigner?: string;

  evmSigner?: `0x${string}` | "";
  connectedEvmAddress?: `0x${string}`;
  isEvmConnected?: boolean;
  signMessageAsync?: (input: {
    account: `0x${string}`;
    message: {
      raw: `0x${string}`;
    };
  }) => Promise<`0x${string}`>;

  socketfi: {
    signAndSubmitTx: (input: Record<string, unknown>) => Promise<unknown>;
  };

  display?: {
    description?: string;
    values?: unknown[];
  };

  txDetails?: Record<string, unknown>;
}

interface SmartAccountAuthorizationInput {
  authMethod: WalletConnectionMethod;
  network: Network;
  walletAddress: string;
  contractId: string;
  callFunction: {
    name: string;
  };
  argsXdr: string[];

  accessToken?: string;
  stellarSigner?: string;

  evmSigner?: `0x${string}` | "";
  connectedEvmAddress?: `0x${string}`;
  isEvmConnected?: boolean;
  signMessageAsync?: (input: {
    account: `0x${string}`;
    message: {
      raw: `0x${string}`;
    };
  }) => Promise<`0x${string}`>;

  socketfi: {
    signTx: (input: Record<string, unknown>) => Promise<unknown>;
  };

  display?: {
    description?: string;
    values?: unknown[];
  };
}

interface AuthorizationPreparation {
  sessionId: string;
  unsignedAuthEntryXdr?: string;
  authPreimageXdr?: string;
  signaturePayloadHex?: `0x${string}`;
  signatureExpirationLedger: number;
  evmAddress?: `0x${string}`;
  walletAddress?: string;
  network?: Network;
}

interface AuthorizationCompletion {
  signedAuthEntriesXdr?: string[];
  data?: {
    signedAuthEntriesXdr?: string[];
  };
}

const DIRECT_SERVER_URL = (
  import.meta.env.VITE_SERVER_DIRECT_URL || "http://localhost:3200"
).replace(/\/+$/, "");

function getReadableError(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Something went wrong.";
}

async function readJsonResponse(response: Response): Promise<any> {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      typeof data?.error === "string"
        ? data.error
        : typeof data?.message === "string"
        ? data.message
        : `Request failed with status ${response.status}`;

    throw new Error(errorMessage);
  }

  return data;
}

function decodeBase64Bytes(value: string): Uint8Array {
  const normalized = value.trim().replace(/-/g, "+").replace(/_/g, "/");

  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new Error("Invalid base64 authorization signature.");
  }

  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = window.atob(padded);

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeStellarAuthSignature(result: unknown): Uint8Array {
  if (result == null) {
    throw new Error(
      "The Stellar wallet did not return an authorization signature."
    );
  }

  if (result instanceof Uint8Array) {
    if (result.length !== 64) {
      throw new Error(
        `Expected a 64-byte Stellar signature; received ${result.length}.`
      );
    }

    return result;
  }

  if (Array.isArray(result)) {
    return decodeStellarAuthSignature(Uint8Array.from(result));
  }

  let encodedValue: unknown = result;

  if (typeof result === "object") {
    const walletResult = result as WalletAuthEntryResult;

    encodedValue =
      walletResult.signedAuthEntry ??
      walletResult.signature ??
      walletResult.data?.signedAuthEntry ??
      walletResult.data?.signature;
  }

  if (typeof encodedValue !== "string" || !encodedValue.trim()) {
    throw new Error(
      "The Stellar wallet returned an unsupported authorization signature."
    );
  }

  const clean = encodedValue.trim();

  if (/^[0-9a-fA-F]{128}$/.test(clean)) {
    const pairs = clean.match(/.{2}/g);

    if (!pairs) {
      throw new Error(
        "Unable to decode the hexadecimal authorization signature."
      );
    }

    return Uint8Array.from(pairs.map((pair) => Number.parseInt(pair, 16)));
  }

  const firstDecoded = decodeBase64Bytes(clean);

  if (firstDecoded.length === 64) {
    return firstDecoded;
  }

  let nestedBase64: string;

  try {
    nestedBase64 = new TextDecoder("utf-8", {
      fatal: true,
    })
      .decode(firstDecoded)
      .trim();
  } catch {
    throw new Error(
      `Expected a 64-byte Stellar signature; received ${firstDecoded.length} bytes.`
    );
  }

  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(nestedBase64)) {
    throw new Error(
      `Expected a 64-byte signature; the first decoded value contained ${firstDecoded.length} bytes.`
    );
  }

  const rawSignature = decodeBase64Bytes(nestedBase64);

  if (rawSignature.length !== 64) {
    throw new Error(
      `Expected a 64-byte Stellar signature; received ${rawSignature.length}.`
    );
  }

  return rawSignature;
}

function buildWalletAuthStellarScVal(rawSignature: Uint8Array): xdr.ScVal {
  const stellarSignature = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("signature"),
      val: xdr.ScVal.scvBytes(rawSignature),
    }),
  ]);

  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Stellar"), stellarSignature]);
}

function buildSignedSocketFiAuthEntry({
  unsignedAuthEntryXdr,
  rawSignature,
  signatureExpirationLedger,
}: {
  unsignedAuthEntryXdr: string;
  rawSignature: Uint8Array;
  signatureExpirationLedger: number;
}): xdr.SorobanAuthorizationEntry {
  const unsignedEntry = xdr.SorobanAuthorizationEntry.fromXDR(
    unsignedAuthEntryXdr,
    "base64"
  );

  if (
    unsignedEntry.credentials().switch() !==
    xdr.SorobanCredentialsType.sorobanCredentialsAddress()
  ) {
    throw new Error(
      "The prepared SocketFi authorization entry is not address-based."
    );
  }

  const credentials = unsignedEntry.credentials().address();

  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: credentials.address(),
        nonce: credentials.nonce(),
        signatureExpirationLedger,
        signature: buildWalletAuthStellarScVal(rawSignature),
      })
    ),
    rootInvocation: unsignedEntry.rootInvocation(),
  });
}

function injectSocketFiAuthEntry({
  transactionXdr,
  networkPassphrase,
  walletAddress,
  signedAuthEntry,
}: {
  transactionXdr: string;
  networkPassphrase: string;
  walletAddress: string;
  signedAuthEntry: xdr.SorobanAuthorizationEntry;
}) {
  const transaction = TransactionBuilder.fromXDR(
    transactionXdr,
    networkPassphrase
  );

  const envelope = transaction.toEnvelope();
  const operations = envelope.value().tx().operations();

  if (operations.length !== 1) {
    throw new Error("Expected exactly one Soroban operation.");
  }

  const operationBody = operations[0].body();

  if (operationBody.switch() !== xdr.OperationType.invokeHostFunction()) {
    throw new Error("Expected an invokeHostFunction operation.");
  }

  const invokeOperation = operationBody.invokeHostFunctionOp();
  const currentAuthEntries = invokeOperation.auth() || [];

  let replaced = false;

  const nextAuthEntries = currentAuthEntries.map((entry) => {
    try {
      if (
        entry.credentials().switch() !==
        xdr.SorobanCredentialsType.sorobanCredentialsAddress()
      ) {
        return entry;
      }

      const entryAddress = Address.fromScAddress(
        entry.credentials().address().address()
      ).toString();

      if (entryAddress !== walletAddress) {
        return entry;
      }

      replaced = true;
      return signedAuthEntry;
    } catch {
      return entry;
    }
  });

  if (!replaced) {
    nextAuthEntries.push(signedAuthEntry);
  }

  invokeOperation.auth(nextAuthEntries);

  return TransactionBuilder.fromXDR(
    envelope.toXDR("base64"),
    networkPassphrase
  );
}

export function getSocketFiAuthMethod(
  session: SocketFiSession | undefined
): WalletConnectionMethod {
  const configuredMethod =
    session?.connectionMethod ??
    session?.authMethod ??
    session?.walletType ??
    session?.userProfile?.connectionMethod ??
    session?.userProfile?.authMethod ??
    session?.userProfile?.walletType;

  if (
    configuredMethod === "evm" ||
    configuredMethod === "stellar" ||
    configuredMethod === "passkey"
  ) {
    return configuredMethod;
  }

  if (
    session?.evmAddress ||
    session?.userProfile?.evmAddress ||
    session?.userProfile?.evmAccount?.address
  ) {
    return "evm";
  }

  if (
    session?.stellarSigner ||
    session?.stellarPublicKey ||
    session?.userProfile?.stellarSigner ||
    session?.userProfile?.stellarPublicKey ||
    session?.userProfile?.stellarAccount?.publicKey
  ) {
    return "stellar";
  }

  return "passkey";
}

export function getSocketFiStellarSigner(
  session: SocketFiSession | undefined
): string {
  return String(
    session?.stellarSigner ??
      session?.stellarPublicKey ??
      session?.userProfile?.stellarSigner ??
      session?.userProfile?.stellarPublicKey ??
      session?.userProfile?.stellarAccount?.publicKey ??
      ""
  )
    .trim()
    .toUpperCase();
}

export function getSocketFiEvmSigner(
  session: SocketFiSession | undefined
): `0x${string}` | "" {
  const value = String(
    session?.evmAddress ??
      session?.userProfile?.evmAddress ??
      session?.userProfile?.evmAccount?.address ??
      ""
  )
    .trim()
    .toLowerCase();

  return /^0x[a-f0-9]{40}$/.test(value) ? (value as `0x${string}`) : "";
}

async function signAndSubmitWithPasskey(
  input: SmartAccountInvocationInput
): Promise<unknown> {
  if (!input.accessToken) {
    throw new Error("Your SocketFi session has expired. Please sign in again.");
  }

  return input.socketfi.signAndSubmitTx({
    contractId: input.contractId,
    callFunction: input.callFunction,
    argsXdr: input.argsXdr,
    accessToken: input.accessToken,
    displayMode: "full",
    description: input.display?.description,
    values: input.display?.values,
  });
}

async function signAndSubmitWithStellarWallet(
  input: SmartAccountInvocationInput
): Promise<unknown> {
  if (!input.stellarSigner) {
    throw new Error(
      "Reconnect the Stellar wallet used to create this SocketFi account."
    );
  }

  const prepareResponse = await fetch(
    `${DIRECT_SERVER_URL}/api/stellar-transactions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "prepare",
        network: input.network,
        stellarPublicKey: input.stellarSigner,
        walletAddress: input.walletAddress,
        contractId: input.contractId,
        callFunction: input.callFunction,
        argsXdr: input.argsXdr,
      }),
    }
  );

  const prepared = (await readJsonResponse(
    prepareResponse
  )) as DirectTransactionPreparation;

  const requiredFields: Array<keyof DirectTransactionPreparation> = [
    "sessionId",
    "transactionXdr",
    "unsignedAuthEntryXdr",
    "authPreimageXdr",
    "signatureExpirationLedger",
    "networkPassphrase",
    "rpcUrl",
  ];

  for (const field of requiredFields) {
    if (prepared?.[field] == null) {
      throw new Error(
        `Direct Stellar transaction preparation did not return ${field}.`
      );
    }
  }

  const authSignatureResult = await WalletKitService.signAuthEntry(
    prepared.authPreimageXdr,
    input.network,
    input.stellarSigner
  );

  const rawSignature = decodeStellarAuthSignature(authSignatureResult);

  const signedAuthEntry = buildSignedSocketFiAuthEntry({
    unsignedAuthEntryXdr: prepared.unsignedAuthEntryXdr,
    rawSignature,
    signatureExpirationLedger: prepared.signatureExpirationLedger,
  });

  let transactionWithAuth = injectSocketFiAuthEntry({
    transactionXdr: prepared.transactionXdr,
    networkPassphrase: prepared.networkPassphrase,
    walletAddress: input.walletAddress,
    signedAuthEntry,
  });

  const rpcServer = new rpc.Server(prepared.rpcUrl);
  const finalSimulation = await rpcServer.simulateTransaction(
    transactionWithAuth
  );

  if (rpc.Api.isSimulationError(finalSimulation)) {
    throw new Error(
      `SocketFi authorization simulation failed: ${finalSimulation.error}`
    );
  }

  let finalTransaction = rpc
    .assembleTransaction(transactionWithAuth, finalSimulation)
    .build();

  /*
   * Assembly can rebuild the authorization entries. Reinject the exact
   * Stellar-wallet signature before the outer fee transaction is signed.
   */
  finalTransaction = injectSocketFiAuthEntry({
    transactionXdr: finalTransaction.toXDR(),
    networkPassphrase: prepared.networkPassphrase,
    walletAddress: input.walletAddress,
    signedAuthEntry,
  });

  const signedTransactionXdr = await WalletKitService.signTx(
    finalTransaction.toXDR(),
    input.network
  );

  if (typeof signedTransactionXdr !== "string" || !signedTransactionXdr) {
    throw new Error("The Stellar wallet did not return a signed transaction.");
  }

  const submitResponse = await fetch(
    `${DIRECT_SERVER_URL}/api/stellar-transactions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "submit",
        sessionId: prepared.sessionId,
        signedTransactionXdr,
        txDetails: input.txDetails,
      }),
    }
  );

  return readJsonResponse(submitResponse);
}

async function signAndSubmitWithEvmWallet(
  input: SmartAccountInvocationInput
): Promise<unknown> {
  if (!input.evmSigner) {
    throw new Error(
      "The EVM wallet linked to this SocketFi account was not found."
    );
  }

  if (
    !input.isEvmConnected ||
    !input.connectedEvmAddress ||
    !input.signMessageAsync
  ) {
    throw new Error(
      "Reconnect the EVM wallet used to create this SocketFi account."
    );
  }

  const normalizedConnectedAddress =
    input.connectedEvmAddress.toLowerCase() as `0x${string}`;
  const normalizedStoredAddress =
    input.evmSigner.toLowerCase() as `0x${string}`;

  if (normalizedConnectedAddress !== normalizedStoredAddress) {
    throw new Error(
      "The connected EVM wallet does not match this SocketFi account."
    );
  }

  const prepareResponse = await fetch(
    `${DIRECT_SERVER_URL}/api/evm-transactions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "prepare",
        network: input.network,
        evmAddress: normalizedStoredAddress,
        walletAddress: input.walletAddress,
        contractId: input.contractId,
        callFunction: input.callFunction,
        argsXdr: input.argsXdr,
      }),
    }
  );

  const prepared = (await readJsonResponse(
    prepareResponse
  )) as EvmTransactionPreparation;

  if (!prepared.sessionId) {
    throw new Error("EVM transaction preparation did not return a session ID.");
  }

  if (
    !prepared.signaturePayloadHex ||
    !/^0x[0-9a-fA-F]{64}$/.test(prepared.signaturePayloadHex)
  ) {
    throw new Error(
      "EVM transaction preparation returned an invalid signing payload."
    );
  }

  if (
    prepared.evmAddress &&
    prepared.evmAddress.toLowerCase() !== normalizedStoredAddress
  ) {
    throw new Error(
      "The prepared EVM transaction does not match the connected wallet."
    );
  }

  if (
    prepared.walletAddress &&
    prepared.walletAddress !== input.walletAddress
  ) {
    throw new Error(
      "The prepared EVM transaction does not match this SocketFi account."
    );
  }

  if (prepared.network && prepared.network !== input.network) {
    throw new Error(
      "The prepared EVM transaction does not match the selected Stellar network."
    );
  }

  /*
   * Sign the exact 32-byte Soroban authorization payload. `raw` prevents
   * wagmi from signing the visible hexadecimal text.
   */
  const signature = await input.signMessageAsync({
    account: input.connectedEvmAddress,
    message: {
      raw: prepared.signaturePayloadHex,
    },
  });

  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    throw new Error("The EVM wallet returned an invalid signature.");
  }

  const submitResponse = await fetch(
    `${DIRECT_SERVER_URL}/api/evm-transactions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "submit",
        sessionId: prepared.sessionId,
        signature,
        txDetails: input.txDetails,
      }),
    }
  );

  return readJsonResponse(submitResponse);
}

function extractSignedAuthEntries(result: unknown): string[] {
  const value = result as AuthorizationCompletion | undefined;
  const entries =
    value?.signedAuthEntriesXdr ?? value?.data?.signedAuthEntriesXdr;

  if (
    !Array.isArray(entries) ||
    entries.length !== 1 ||
    typeof entries[0] !== "string" ||
    !entries[0]
  ) {
    throw new Error(
      "The wallet did not return exactly one signed authorization entry."
    );
  }

  return entries;
}

async function approveWithPasskey(
  input: SmartAccountAuthorizationInput
): Promise<string[]> {
  if (!input.accessToken) {
    throw new Error("Your SocketFi session has expired. Please sign in again.");
  }

  const result = await input.socketfi.signTx({
    contractId: input.contractId,
    callFunction: input.callFunction,
    argsXdr: input.argsXdr,
    accessToken: input.accessToken,
    clientPaymaster: "SERVER_SIDE_PAYMASTER",
    displayMode: "full",
    description: input.display?.description,
    values: input.display?.values,
  });

  return extractSignedAuthEntries(result);
}

async function prepareDirectAuthorization(
  input: SmartAccountAuthorizationInput,
  signer: string
): Promise<AuthorizationPreparation> {
  const response = await fetch(
    `${DIRECT_SERVER_URL}/api/smart-account-authorizations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "prepare",
        authMethod: input.authMethod,
        network: input.network,
        signer,
        walletAddress: input.walletAddress,
        contractId: input.contractId,
        callFunction: input.callFunction,
        argsXdr: input.argsXdr,
      }),
    }
  );

  const prepared = (await readJsonResponse(
    response
  )) as AuthorizationPreparation;

  if (!prepared?.sessionId) {
    throw new Error("Authorization preparation did not return a session ID.");
  }

  if (
    !Number.isInteger(prepared.signatureExpirationLedger) ||
    prepared.signatureExpirationLedger <= 0
  ) {
    throw new Error(
      "Authorization preparation returned an invalid expiration ledger."
    );
  }

  return prepared;
}

async function approveWithStellarWallet(
  input: SmartAccountAuthorizationInput
): Promise<string[]> {
  if (!input.stellarSigner) {
    throw new Error(
      "Reconnect the Stellar wallet used to create this SocketFi account."
    );
  }

  const prepared = await prepareDirectAuthorization(input, input.stellarSigner);

  if (!prepared.unsignedAuthEntryXdr || !prepared.authPreimageXdr) {
    throw new Error("Stellar authorization preparation was incomplete.");
  }

  const result = await WalletKitService.signAuthEntry(
    prepared.authPreimageXdr,
    input.network,
    input.stellarSigner
  );

  const rawSignature = decodeStellarAuthSignature(result);

  const signedEntry = buildSignedSocketFiAuthEntry({
    unsignedAuthEntryXdr: prepared.unsignedAuthEntryXdr,
    rawSignature,
    signatureExpirationLedger: prepared.signatureExpirationLedger,
  });

  return [signedEntry.toXDR("base64")];
}

// async function approveWithEvmWallet(
//   input: SmartAccountAuthorizationInput
// ): Promise<string[]> {
//   if (!input.evmSigner) {
//     throw new Error(
//       "The EVM wallet linked to this SocketFi account was not found."
//     );
//   }

//   if (
//     !input.isEvmConnected ||
//     !input.connectedEvmAddress ||
//     !input.signMessageAsync
//   ) {
//     throw new Error(
//       "Reconnect the EVM wallet used to create this SocketFi account."
//     );
//   }

//   const connected = input.connectedEvmAddress.toLowerCase() as `0x${string}`;
//   const stored = input.evmSigner.toLowerCase() as `0x${string}`;

//   if (connected !== stored) {
//     throw new Error(
//       "The connected EVM wallet does not match this SocketFi account."
//     );
//   }

//   const prepared = await prepareDirectAuthorization(input, stored);

//   if (
//     !prepared.signaturePayloadHex ||
//     !/^0x[0-9a-fA-F]{64}$/.test(prepared.signaturePayloadHex)
//   ) {
//     throw new Error(
//       "EVM authorization preparation returned an invalid signing payload."
//     );
//   }

//   if (prepared.evmAddress && prepared.evmAddress.toLowerCase() !== stored) {
//     throw new Error(
//       "The prepared authorization does not match the connected EVM wallet."
//     );
//   }

//   if (
//     prepared.walletAddress &&
//     prepared.walletAddress !== input.walletAddress
//   ) {
//     throw new Error(
//       "The prepared authorization does not match this SocketFi account."
//     );
//   }

//   if (prepared.network && prepared.network !== input.network) {
//     throw new Error(
//       "The prepared authorization does not match the selected Stellar network."
//     );
//   }

//   const signature = await input.signMessageAsync({
//     account: input.connectedEvmAddress,
//     message: {
//       raw: prepared.signaturePayloadHex,
//     },
//   });

//   if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
//     throw new Error("The EVM wallet returned an invalid signature.");
//   }

//   /*
//    * The SocketFi server constructs the custom EVM Soroban-auth ScVal and
//    * returns the signed authorization entry. It does not submit a transaction.
//    */
//   const response = await fetch(
//     `${DIRECT_SERVER_URL}/api/smart-account-authorizations`,
//     {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         action: "complete",
//         sessionId: prepared.sessionId,
//         signature,
//       }),
//     }
//   );

//   return extractSignedAuthEntries(await readJsonResponse(response));
// }

async function approveWithEvmWallet(
  input: SmartAccountAuthorizationInput
): Promise<string[]> {
  if (!input.evmSigner) {
    throw new Error(
      "The EVM wallet linked to this SocketFi account was not found."
    );
  }

  if (
    !input.isEvmConnected ||
    !input.connectedEvmAddress ||
    !input.signMessageAsync
  ) {
    throw new Error(
      "Reconnect the EVM wallet used to create this SocketFi account."
    );
  }

  const connectedAddress =
    input.connectedEvmAddress.toLowerCase() as `0x${string}`;
  const storedAddress = input.evmSigner.toLowerCase() as `0x${string}`;

  if (connectedAddress !== storedAddress) {
    throw new Error(
      "The connected EVM wallet does not match this SocketFi account."
    );
  }

  /*
   * Reuse the existing prepare action. It already simulates the exact
   * transfer, extracts the SocketFi wallet auth entry, stores the session,
   * and returns the 32-byte EVM signing payload.
   */
  const prepareResponse = await fetch(
    `${DIRECT_SERVER_URL}/api/evm-transactions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "prepare",
        network: input.network,
        evmAddress: storedAddress,
        walletAddress: input.walletAddress,
        contractId: input.contractId,
        callFunction: input.callFunction,
        argsXdr: input.argsXdr,
      }),
    }
  );

  const prepared = await readJsonResponse(prepareResponse);

  if (!prepared?.sessionId) {
    throw new Error(
      "EVM authorization preparation did not return a session ID."
    );
  }

  if (
    typeof prepared.signaturePayloadHex !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(prepared.signaturePayloadHex)
  ) {
    throw new Error(
      "EVM authorization preparation returned an invalid signing payload."
    );
  }

  if (
    prepared.evmAddress &&
    prepared.evmAddress.toLowerCase() !== storedAddress
  ) {
    throw new Error(
      "The prepared authorization does not match the connected EVM wallet."
    );
  }

  if (
    prepared.walletAddress &&
    prepared.walletAddress !== input.walletAddress
  ) {
    throw new Error(
      "The prepared authorization does not match this SocketFi account."
    );
  }

  if (prepared.network && prepared.network !== input.network) {
    throw new Error(
      "The prepared authorization does not match the selected Stellar network."
    );
  }

  const signature = await input.signMessageAsync({
    account: input.connectedEvmAddress,
    message: {
      raw: prepared.signaturePayloadHex,
    },
  });

  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    throw new Error("The EVM wallet returned an invalid signature.");
  }

  /*
   * Same URL, different action. The server verifies the signature and returns
   * the signed auth entry, but does not sign or submit an outer transaction.
   */
  const completeResponse = await fetch(
    `${DIRECT_SERVER_URL}/api/evm-transactions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "complete-authorization",
        sessionId: prepared.sessionId,
        signature,
      }),
    }
  );

  const completed = await readJsonResponse(completeResponse);
  const entries = completed?.signedAuthEntriesXdr;

  if (!Array.isArray(entries) || entries.length !== 1) {
    throw new Error(
      "EVM authorization completion did not return exactly one signed auth entry."
    );
  }

  if (typeof entries[0] !== "string" || !entries[0]) {
    throw new Error(
      "EVM authorization completion returned invalid auth-entry XDR."
    );
  }

  return entries;
}

export async function approveSmartAccountAuthorization(
  input: SmartAccountAuthorizationInput
): Promise<string[]> {
  try {
    switch (input.authMethod) {
      case "passkey":
        return await approveWithPasskey(input);

      case "stellar":
        return await approveWithStellarWallet(input);

      case "evm":
        return await approveWithEvmWallet(input);

      default:
        throw new Error("Unsupported SocketFi wallet connection method.");
    }
  } catch (error) {
    throw new Error(getReadableError(error));
  }
}

export async function signAndSubmitSmartAccountInvocation(
  input: SmartAccountInvocationInput
): Promise<unknown> {
  try {
    switch (input.authMethod) {
      case "stellar":
        return await signAndSubmitWithStellarWallet(input);

      case "evm":
        return await signAndSubmitWithEvmWallet(input);

      case "passkey":
        return await signAndSubmitWithPasskey(input);

      default:
        throw new Error("Unsupported SocketFi wallet connection method.");
    }
  } catch (error) {
    throw new Error(getReadableError(error));
  }
}
