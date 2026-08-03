// @ts-nocheck
import {
  isConnected,
  getPublicKey,
  signTransaction,
} from "@lobstrco/signer-extension-api";
import * as StellarSdk from "@stellar/stellar-sdk";

// import { LOBSTR_CONNECTION_KEY } from "constants/session-storage";

// import { getNetworkPassphrase } from "helpers/env";

// import { getSavedAuthData } from "store/authStore/auth-helpers";

// import EventService from "./event.service";

export const LobstrExtensionEvents = {
  login: "login",
};

export default class LobstrExtensionServiceClass {
  //   event = new EventService();
  get isConnected() {
    return isConnected();
  }

  async login() {
    const publicKey = await getPublicKey();

    this.event.trigger({
      type: LobstrExtensionEvents.login,
      publicKey,
    });
  }

  async signTx(tx) {
    if (!sessionStorage.getItem(LOBSTR_CONNECTION_KEY)) {
      const { lobstrConnectionKey } = getSavedAuthData();
      sessionStorage.setItem(LOBSTR_CONNECTION_KEY, lobstrConnectionKey);
    }

    const signedXDR = await signTransaction(tx.toEnvelope().toXDR("base64"));

    return new StellarSdk.Transaction(signedXDR, getNetworkPassphrase());
  }
}
