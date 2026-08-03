// @ts-nocheck
// import { LOBSTR_CONNECTION_KEY } from "constants/session-storage";

import { LS_LAST_AUTH_DATA } from "./local-storage";

export function saveAuthData(
  pubKey,
  loginType,
  walletKitId = "",
  bipPath = null
) {
  const savedAuthData = JSON.parse(localStorage.getItem(LS_LAST_AUTH_DATA));

  if (savedAuthData && savedAuthData.pubKey === pubKey) return;

  //   const lobstrConnectionKey = sessionStorage.getItem(LOBSTR_CONNECTION_KEY);
  const stringified = JSON.stringify({
    pubKey,
    loginType,
    walletKitId,
    lobstrConnectionKey,
    bipPath,
  });
  localStorage.setItem(LS_LAST_AUTH_DATA, stringified);
}

export function clearSavedAuthData() {
  localStorage.removeItem(LS_LAST_AUTH_DATA);
}

export function getSavedAuthData() {
  return JSON.parse(localStorage.getItem(LS_LAST_AUTH_DATA)) || {};
}
