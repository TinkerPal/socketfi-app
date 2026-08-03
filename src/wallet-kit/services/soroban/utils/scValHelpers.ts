// @ts-nocheck
import * as StellarSdk from "@stellar/stellar-sdk";
import { Asset, StrKey, xdr } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";

// import { getAssetContractId } from "services/soroban/contracts/tokenContract";

export function contractIdToScVal(contractId) {
  return StellarSdk.Address.contract(
    StrKey.decodeContract(contractId)
  ).toScVal();
}

export function scValToArray(array) {
  return xdr.ScVal.scvVec(array);
}

export function assetToScVal(asset) {
  return xdr.ScVal.scvAddress(
    StellarSdk.Address.contract(
      StrKey.decodeContract(getAssetContractId(asset))
    ).toScAddress()
  );
}

export function publicKeyToScVal(pubkey) {
  return xdr.ScVal.scvAddress(
    StellarSdk.Address.fromString(pubkey).toScAddress()
  );
}

export function amountToUint32(amount) {
  return xdr.ScVal.scvU32(Math.floor(amount));
}

export function amountToInt128(amount, decimals = 7) {
  return new StellarSdk.XdrLargeInt(
    "i128",
    new BigNumber(amount).times(Math.pow(10, decimals)).toFixed()
  ).toI128();
}

export function amountToUint128(amount, decimals = 7) {
  return new StellarSdk.XdrLargeInt(
    "u128",
    new BigNumber(amount).times(Math.pow(10, decimals)).toFixed()
  ).toU128();
}

export function scValToNative(value) {
  return StellarSdk.scValToNative(value);
}

export function i128ToInt(val, decimals = 7) {
  return new BigNumber(StellarSdk.scValToNative(val))
    .div(Math.pow(10, decimals))
    .toString();
}
