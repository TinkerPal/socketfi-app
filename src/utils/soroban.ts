// @ts-nocheck
import BigNumber from "bignumber.js";
import {
  isConnected,
  getPublicKey,
  signTransaction,
  signBlob,
  isAllowed,
  setAllowed,
  requestAccess,
  getUserInfo,
  getNetwork,
} from "@stellar/freighter-api";

import {
  TransactionBuilder,
  xdr,
  SorobanRpc,
  Soroban,
  Networks,
  Contract,
  TimeoutInfinite,
  Address,
  Operation,
  scValToNative,
  Memo,
  nativeToScVal,
  ScInt,
} from "@stellar/stellar-sdk";
import axios from "axios";
import { toast } from "sonner";

export const BASE_FEE = "100";
export const FUTURENET_DETAILS = {
  network: "FUTURENET",
  networkUrl: "https://horizon-futurenet.stellar.org",
  networkPassphrase: "Test SDF Future Network ; October 2022",
};

export const RPC_URLS = {
  FUTURENET: "https://rpc-futurenet.stellar.org/",
};
// export const RPC_URLS = {
//   TESTNET: "https://soroban-testnet.stellar.org/",
// };

// const test = xdr.ScVal.toXDR([2, 3, 4, 5]);

export const accountToScVal = (account) => new Address(account).toScVal();

export const numberToI128 = (value) => nativeToScVal(value);

export const xlmToStroop = (lumens) => {
  // round to nearest stroop
  return new BigNumber(Math.round(Number(lumens) * 1e7));
};

export const stroopToXlm = (stroops) => {
  return new BigNumber(Number(stroops) / 1e7);
};

export const bStroopToXlm = (stroops) => {
  const value = typeof stroops === "bigint" ? stroops.toString() : stroops;
  return new BigNumber(value).dividedBy(1e7).decimalPlaces(4).toFixed(5);
};

const getServer = (networkDetails) =>
  new SorobanRpc.Server(RPC_URLS[networkDetails.network], {
    allowHttp: networkDetails.networkUrl.startsWith("http://"),
  });

export const server = getServer(FUTURENET_DETAILS);

export const getTxBuilder = async (pubKey, fee, server, networkPassphrase) => {
  const source = await server.getAccount(pubKey);
  return new TransactionBuilder(source, {
    fee,
    networkPassphrase,
  });
};

export const simulateTx = async (tx, server) => {
  const response = await server.simulateTransaction(tx);

  if (
    SorobanRpc.Api.isSimulationSuccess(response) &&
    response.result !== undefined
  ) {
    return scValToNative(response.result.retval);
  }

  throw new Error("cannot simulate transaction");
};

export const getAccount = async ({
  walletId,
  userPubKey,
  txBuilderAccount,
  server,
}) => {
  const contract = new Contract(walletId);

  const tx = txBuilderAccount
    .addOperation(
      contract.call(
        "get_account_addr",
        ...[
          accountToScVal(userPubKey), // to
        ]
      )
    )
    .setTimeout(TimeoutInfinite);

  const builtRes = tx.build();
  try {
    const walletAccount = await simulateTx(builtRes, server);

    // console.log("the account is", walletBal);
    return walletAccount;
  } catch (e) {
    return null;
  }

  // return stroopToXlm(walletBal).c.at(0);
};

export const getAccountProfile = async ({
  walletId,
  profileId,
  txBuilderAccount,
  server,
}) => {
  const contract = new Contract(walletId);

  const tx = txBuilderAccount
    .addOperation(
      contract.call(
        "get_account_profile",
        ...[
          nativeToScVal(profileId), // to
        ]
      )
    )
    .setTimeout(TimeoutInfinite);

  const builtRes = tx.build();
  try {
    const walletAccount = await simulateTx(builtRes, server);

    // console.log("the account is", walletBal);
    return walletAccount;
  } catch (e) {
    return null;
  }
};

export const getAccountKeysProfile = async ({
  smartAccountId,
  profileId,
  txBuilderAccount,
  server,
}) => {
  const contract = new Contract(smartAccountId);

  const tx = txBuilderAccount
    .addOperation(
      contract.call(
        "get_encrypted_keys",
        ...[
          nativeToScVal(profileId), // to
        ]
      )
    )
    .setTimeout(TimeoutInfinite);

  const builtRes = tx.build();
  try {
    const accountKeys = await simulateTx(builtRes, server);

    // console.log("the account is", walletBal);
    return accountKeys;
  } catch (e) {
    return null;
  }
};

export const getSerialNonce = async ({
  smartAccountId,
  txBuilderAccount,
  server,
}) => {
  const contract = new Contract(smartAccountId);

  const tx = txBuilderAccount
    .addOperation(contract.call("get_nonce"))
    .setTimeout(TimeoutInfinite);

  const builtRes = tx.build();
  try {
    const serialNonce = await simulateTx(builtRes, server);

    // console.log("the account is", walletBal);
    return serialNonce;
  } catch (e) {
    return null;
  }
};

export const setNones = async ({
  smartAccountId,
  signerIndex,
  signer,
  enteredPasswordHash,
  spender,
  token,
  amount,
  txBuilderNonce,
  server,
}) => {
  try {
    const contract = new Contract(smartAccountId);

    const createOperation = "create_tx_nonce";
    const executorIndex = signerIndex;

    const quantity = Soroban.parseTokenAmount(amount, 7);
    const quantitySc = new ScInt(quantity).toI128();

    const invokeArgs = [createOperation];
    invokeArgs.push(nativeToScVal(Number(executorIndex), { type: "u32" }));
    invokeArgs.push(nativeToScVal(enteredPasswordHash));
    invokeArgs.push(accountToScVal(spender));
    invokeArgs.push(accountToScVal(token));
    invokeArgs.push(nativeToScVal(quantitySc));

    const memo = "approve transaction";

    const tx = txBuilderNonce
      .addOperation(contract.call(...invokeArgs))
      .setTimeout(TimeoutInfinite);

    if (memo?.length > 0) {
      tx.addMemo(Memo.text(memo));
    }

    const built = tx.build();

    const preparedTransaction = await server.prepareTransaction(built);

    preparedTransaction.sign(signer);
    const sendResponse = await server.sendTransaction(preparedTransaction);

    if (sendResponse.status === "PENDING") {
      let txResponse = await server.getTransaction(sendResponse.hash);

      // Poll this until the status is not "NOT_FOUND"
      while (
        txResponse.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND
      ) {
        // See if the transaction is complete
        // eslint-disable-next-line no-await-in-loop
        txResponse = await server.getTransaction(sendResponse.hash);
        // Wait a second
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (txResponse.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        const restx = await server.getTransaction(sendResponse.hash);

        return restx;
      }
    }
  } catch (e) {
    console.log(e);
    toast.error(e?.response?.data?.error);
    return;
  }
};

export const setAllowance = async ({
  smartAccountId,
  signerIndex,
  signer,
  enteredPasswordHash,
  allowance,
  txBuilderAllowance,
  server,
}) => {
  try {
    const contract = new Contract(smartAccountId);

    const allowanceOperation = "set_allowance_pkey";
    const executorIndex = signerIndex;

    const invokeArgs = [allowanceOperation];
    invokeArgs.push(nativeToScVal(Number(executorIndex), { type: "u32" }));
    invokeArgs.push(nativeToScVal(enteredPasswordHash));

    const allowanceInt = Soroban.parseTokenAmount(allowance, 7);
    const allowanceScVal = new ScInt(allowanceInt).toI128();
    invokeArgs.push(nativeToScVal(allowanceScVal));

    const memo = "set allowance value";

    const tx = txBuilderAllowance
      .addOperation(contract.call(...invokeArgs))
      .setTimeout(TimeoutInfinite);

    if (memo?.length > 0) {
      tx.addMemo(Memo.text(memo));
    }

    const built = tx.build();

    const preparedTransaction = await server.prepareTransaction(built);

    preparedTransaction.sign(signer);
    const sendResponse = await server.sendTransaction(preparedTransaction);

    if (sendResponse.status === "PENDING") {
      let txResponse = await server.getTransaction(sendResponse.hash);

      // Poll this until the status is not "NOT_FOUND"
      while (
        txResponse.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND
      ) {
        // See if the transaction is complete
        // eslint-disable-next-line no-await-in-loop
        txResponse = await server.getTransaction(sendResponse.hash);
        // Wait a second
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (txResponse.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        const restx = await server.getTransaction(sendResponse.hash);

        return restx;
      }
    }
  } catch (e) {
    console.log(e);
    toast.error(e?.response?.data?.error);
  }
};

export const setOwner = async ({
  smartAccountId,
  signerIndex,
  signer,
  enteredPasswordHash,
  owner,
  txBuilderOwner,
  server,
}) => {
  try {
    const contract = new Contract(smartAccountId);

    const ownerOperation = "set_owner_pkey";
    const executorIndex = signerIndex;

    const invokeArgs = [ownerOperation];
    invokeArgs.push(nativeToScVal(Number(executorIndex), { type: "u32" }));
    invokeArgs.push(nativeToScVal(enteredPasswordHash));
    invokeArgs.push(accountToScVal(owner));

    // console.log("arguments and contract are", invokeArgs, contract);

    const memo = "set owner";

    const tx = txBuilderOwner
      .addOperation(contract.call(...invokeArgs))
      .setTimeout(TimeoutInfinite);

    if (memo?.length > 0) {
      tx.addMemo(Memo.text(memo));
    }

    const built = tx.build();

    const preparedTransaction = await server.prepareTransaction(built);

    preparedTransaction.sign(signer);
    const sendResponse = await server.sendTransaction(preparedTransaction);

    if (sendResponse.status === "PENDING") {
      let txResponse = await server.getTransaction(sendResponse.hash);

      // Poll this until the status is not "NOT_FOUND"
      while (
        txResponse.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND
      ) {
        // See if the transaction is complete
        // eslint-disable-next-line no-await-in-loop
        txResponse = await server.getTransaction(sendResponse.hash);
        // Wait a second
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (txResponse.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        const restx = await server.getTransaction(sendResponse.hash);

        return restx;
      }
    }
  } catch (e) {
    console.log(e);
    toast.error(e?.response?.data?.error);
  }
};

export const sendTokensPasskey = async ({
  walletId,
  signer,
  txBuilderSend,
  server,
  signerIndex,
  profileId,
  enteredPasswordHash,
  to,
  token,
  amount,
}) => {
  // try {
  const contract = new Contract(walletId);

  const createOperation = "send_token_pkey";
  const executorIndex = signerIndex;

  const quantity = Soroban.parseTokenAmount(amount, 7);
  const quantitySc = new ScInt(quantity).toI128();

  const invokeArgs = [createOperation];
  invokeArgs.push(nativeToScVal(Number(executorIndex), { type: "u32" }));
  invokeArgs.push(nativeToScVal(profileId));
  invokeArgs.push(nativeToScVal(enteredPasswordHash));
  invokeArgs.push(accountToScVal(to));
  invokeArgs.push(accountToScVal(token));
  invokeArgs.push(nativeToScVal(quantitySc));

  const memo = "send tokens";

  const tx = txBuilderSend
    .addOperation(contract.call(...invokeArgs))
    .setTimeout(TimeoutInfinite);

  if (memo?.length > 0) {
    tx.addMemo(Memo.text(memo));
  }

  const built = tx.build();

  const preparedTransaction = await server.prepareTransaction(built);

  preparedTransaction.sign(signer);
  const sendResponse = await server.sendTransaction(preparedTransaction);

  if (sendResponse.status === "PENDING") {
    let txResponse = await server.getTransaction(sendResponse.hash);

    // Poll this until the status is not "NOT_FOUND"
    while (
      txResponse.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND
    ) {
      // See if the transaction is complete
      // eslint-disable-next-line no-await-in-loop
      txResponse = await server.getTransaction(sendResponse.hash);
      // Wait a second
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (txResponse.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      const restx = await server.getTransaction(sendResponse.hash);

      return restx;
    }
  }
};

export const getTokens = async ({
  smartAccountId,
  txBuilderAccount,
  server,
}) => {
  const contract = new Contract(smartAccountId);

  const tx = txBuilderAccount
    .addOperation(contract.call("get_tokens"))
    .setTimeout(TimeoutInfinite);

  const builtRes = tx.build();
  try {
    const tokens = await simulateTx(builtRes, server);

    // console.log("the account is", walletBal);
    return tokens;
  } catch (e) {
    return null;
  }
};

export const getTransactionCount = async ({
  smartAccountId,
  txBuilderAccount,
  server,
}) => {
  const contract = new Contract(smartAccountId);

  const tx = txBuilderAccount
    .addOperation(contract.call("get_tx_count"))
    .setTimeout(TimeoutInfinite);

  const builtRes = tx.build();
  try {
    const count = await simulateTx(builtRes, server);

    // console.log("the account is", walletBal);
    return count;
  } catch (e) {
    console.log(e);
    toast.error(e?.response?.data?.error);
  }
};

export const getOwnerAddress = async ({
  smartAccountId,
  txBuilderAccount,
  server,
}) => {
  const contract = new Contract(smartAccountId);

  const tx = txBuilderAccount
    .addOperation(contract.call("get_owner"))
    .setTimeout(TimeoutInfinite);

  const builtRes = tx.build();
  try {
    const owner = await simulateTx(builtRes, server);

    // console.log("the account is", walletBal);
    return owner;
  } catch (e) {
    null;
  }
};

export const getAllowance = async ({
  smartAccountId,
  txBuilderAccount,
  server,
}) => {
  const contract = new Contract(smartAccountId);

  const tx = txBuilderAccount
    .addOperation(contract.call("get_allowance"))
    .setTimeout(TimeoutInfinite);

  const builtRes = tx.build();
  try {
    const allowance = await simulateTx(builtRes, server);

    // console.log("the account is", walletBal);
    return allowance;
  } catch (e) {
    return null;
  }
};

export const getWalletBalance = async ({
  tokenId,
  walletId,
  txBuilderBalance,
  server,
}) => {
  const contract = new Contract(tokenId);

  const tx = txBuilderBalance
    .addOperation(
      contract.call(
        "balance",
        ...[
          accountToScVal(walletId), // to
        ]
      )
    )
    .setTimeout(TimeoutInfinite);

  const builtRes = tx.build();
  const walletBal = await simulateTx(builtRes, server);

  // console.log("the balance is", stroopToXlm(walletBal).c.at(0));

  // return stroopToXlm(walletBal).c.at(0);
  return walletBal;
};

export const getContractInfo = async ({
  contractId,
  arg,
  txBuilder,
  server,
}) => {
  // console.log("the received contract id is", contractId);
  try {
    const contract = new Contract(contractId);

    const tx = txBuilder
      .addOperation(contract.call(arg))
      .setTimeout(TimeoutInfinite)
      .build();

    const result = await simulateTx(tx, server);
    return result;
  } catch (e) {
    return null;
  }
};

export const anyInvoke = async (
  contractId,
  args,
  memo,
  txBuilderAny,
  server
) => {
  try {
    const contract = new Contract(contractId);

    const tx = txBuilderAny
      .addOperation(contract.call(...args))
      .setTimeout(TimeoutInfinite);

    if (memo?.length > 0) {
      tx.addMemo(Memo.text(memo));
    }

    const built = tx.build();

    const sim = await server.simulateTransaction(built);

    const preparedTransaction = await server.prepareTransaction(built);

    // console.log("built transaction", sim);

    return preparedTransaction.toXDR();
  } catch (e) {
    console.log(e);
    toast.error(e?.response?.data?.error);
  }
};

export async function loadContract(wasm, txBuilderUpload) {
  try {
    const wasmFile = wasm;

    const uploadTx = txBuilderUpload
      .setTimeout(TimeoutInfinite)
      .addOperation(
        Operation.uploadContractWasm({
          wasm: wasmFile,
        })
      )
      .build();

    const preparedTransaction = await server.prepareTransaction(uploadTx);

    const xdr = preparedTransaction.toXDR();
    return await signTransaction(xdr, { network: "FUTURENET" });
  } catch (e) {
    console.log(e);
    toast.error(e?.response?.data?.error);
  }
}

export async function createContract(
  senderAddr,
  loadedWasmHash,
  txBuilderCreate
) {
  const createTx = txBuilderCreate
    .setTimeout(TimeoutInfinite)
    .addOperation(
      Operation.createCustomContract({
        address: senderAddr,
        wasmHash: loadedWasmHash,
      })
    )
    .build();
  const preparedTransactionCreate = await server.prepareTransaction(createTx);

  const xdrCreate = preparedTransactionCreate.toXDR();
  const signedTx2 = await signTransaction(xdrCreate, {
    network: "FUTURENET",
  });
  return signedTx2;
}

export async function uploadWasmSigner(txBuilderUpload, loadedWasm, signer) {
  const uploadTx = txBuilderUpload
    .setTimeout(TimeoutInfinite)
    .addOperation(
      Operation.uploadContractWasm({
        wasm: loadedWasm,
      })
    )
    .build();

  const preparedTransaction = await server.prepareTransaction(uploadTx);

  preparedTransaction.sign(signer);
  const sendResponse = await server.sendTransaction(preparedTransaction);

  if (sendResponse.status === "PENDING") {
    let txResponse = await server.getTransaction(sendResponse.hash);

    // Poll this until the status is not "NOT_FOUND"
    while (
      txResponse.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND
    ) {
      // See if the transaction is complete
      // eslint-disable-next-line no-await-in-loop
      txResponse = await server.getTransaction(sendResponse.hash);
      // Wait a second
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (txResponse.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      const restx = await server.getTransaction(sendResponse.hash);

      return restx.returnValue._value;
    }
  }
}

export const mintTokens = async ({
  tokenId,
  quantity,
  destinationPubKey,
  memo,
  txBuilderAdmin,
  server,
}) => {
  const contract = new Contract(tokenId);

  const tx = txBuilderAdmin
    .addOperation(
      contract.call(
        "mint",
        ...[
          accountToScVal(destinationPubKey), // to
          new ScInt(quantity).toI128(), // quantity
        ]
      )
    )
    .setTimeout(TimeoutInfinite);

  if (memo?.length > 0) {
    tx.addMemo(Memo.text(memo));
  }

  const built = tx.build();
  const sim = await server.simulateTransaction(built);

  const preparedTransaction = await server.prepareTransaction(built);
  // console.log("built transaction", sim);

  return preparedTransaction.toXDR();
};

export const getEstimatedFee = async (
  tokenId,
  quantity,
  destinationPubKey,
  memo,
  txBuilder,
  server
) => {
  const contract = new Contract(tokenId);

  const tx = txBuilder
    .addOperation(
      contract.call(
        "mint",
        ...[
          accountToScVal(destinationPubKey), // to
          numberToI128(quantity), // quantity
        ]
      )
    )
    .setTimeout(TimeoutInfinite);

  if (memo.length > 0) {
    tx.addMemo(Memo.text(memo));
  }

  const raw = tx.build();

  const simResponse = await server.simulateTransaction(raw);

  // console.log("sim response", simResponse);

  if (SorobanRpc.Api.isSimulationError(simResponse)) {
    throw simResponse.error;
  }
};

export const submitTx = async (signedXDR, networkPassphrase, server) => {
  const tx = TransactionBuilder.fromXDR(signedXDR, networkPassphrase);

  const sendResponse = await server.sendTransaction(tx);

  // console.log("transaction result", sendResponse);

  if (sendResponse.status === "PENDING") {
    let txResponse = await server.getTransaction(sendResponse.hash);

    // Poll this until the status is not "NOT_FOUND"
    while (
      txResponse.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND
    ) {
      // See if the transaction is complete
      // eslint-disable-next-line no-await-in-loop
      txResponse = await server.getTransaction(sendResponse.hash);
      // Wait a second
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (txResponse.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      const restx = await server.getTransaction(sendResponse.hash);

      return restx;
    }
  }
  throw new Error(`Unabled to submit transaction, status: ${sendResponse}`);
};

export const ConnectWallet = async (setUserKey, setNetwork) => {
  let error = "";

  try {
    const isAllowed = await setAllowed();
    await requestAccess();
    const publicKey = await getPublicKey();

    const nt = await getNetwork();

    setUserKey(() => publicKey);
    setNetwork(() => nt);
    return publicKey;
  } catch (e) {
    error = e;
  }

  if (error) {
    return error;
  }
};

const STELLAR_SDK_SERVER_URL = "https://stellar-sdk-server.sorobuild.io";

export async function getQuestXLM(questId) {
  const argsArr = [{ value: questId, type: "u32" }];
  const body = {
    pubKey: "GC5FG3BFW5VL24GJRKI7QJYLAUR4REVYBWFPRWCZTAK7JMZOQ74YXRJG",
    fee: "100",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    contractId: "CD56K3BOQRG7FRKQ4LLJX72V2UMLDGQKTIEJJYP4EBHTJO4UUPWFNJCU",
    operation: "get_quest",
    args: argsArr,
  };

  try {
    const response = await axios.post(
      `${STELLAR_SDK_SERVER_URL}/simulateTransaction`,
      body,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // return scValToNative(response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Error sending transaction:",
      error.response ? error.response.data : error.message
    );
  }
}

export async function getIsWinner(questId, user) {
  const argsArr = [
    { value: questId, type: "u32" },
    { value: user, type: "Address" },
  ];
  const body = {
    pubKey: "GC5FG3BFW5VL24GJRKI7QJYLAUR4REVYBWFPRWCZTAK7JMZOQ74YXRJG",
    fee: "100",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    contractId: "CD56K3BOQRG7FRKQ4LLJX72V2UMLDGQKTIEJJYP4EBHTJO4UUPWFNJCU",
    operation: "check_is_winner",
    args: argsArr,
  };

  try {
    const response = await axios.post(
      `${STELLAR_SDK_SERVER_URL}/check-is-winner`,
      body,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // return scValToNative(response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Error sending transaction:",
      error.response ? error.response.data : error.message
    );
  }
}

export async function getSelectionOpen(questId) {
  const argsArr = [{ value: questId, type: "u32" }];
  const body = {
    pubKey: "GC5FG3BFW5VL24GJRKI7QJYLAUR4REVYBWFPRWCZTAK7JMZOQ74YXRJG",
    fee: "100",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    contractId: "CD56K3BOQRG7FRKQ4LLJX72V2UMLDGQKTIEJJYP4EBHTJO4UUPWFNJCU",
    operation: "selection_open",
    args: argsArr,
  };

  try {
    const response = await axios.post(
      `${STELLAR_SDK_SERVER_URL}/check-selection-open`,
      body,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // return scValToNative(response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Error sending transaction:",
      error.response ? error.response.data : error.message
    );
  }
}

export async function getHasClaimed(questId, winner) {
  const argsArr = [
    { value: questId, type: "u32" },
    { value: winner, type: "Address" },
  ];
  const body = {
    pubKey: "GC5FG3BFW5VL24GJRKI7QJYLAUR4REVYBWFPRWCZTAK7JMZOQ74YXRJG",
    fee: "100",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    contractId: "CD56K3BOQRG7FRKQ4LLJX72V2UMLDGQKTIEJJYP4EBHTJO4UUPWFNJCU",
    operation: "get_has_claimed",
    args: argsArr,
  };

  try {
    const response = await axios.post(
      `${STELLAR_SDK_SERVER_URL}/check-selection-open`,
      body,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // return scValToNative(response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Error sending transaction:",
      error.response ? error.response.data : error.message
    );
  }
}

export async function invokeQuest(operation, args) {
  const body = {
    operation: operation,
    args: args,
  };

  try {
    const response = await axios.post(
      // `${STELLAR_SDK_SERVER_URL}/anyInvoke`,
      `${STELLAR_SDK_SERVER_URL}/invoke-quest`,
      body,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const res = response.data.data;

    return res;
  } catch (error) {
    console.error(
      "Error sending transaction:",
      error.response ? error.response.data : error.message
    );
  }
}
