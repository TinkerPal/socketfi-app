// @ts-nocheck
import {
  StellarWalletsKit,
  FreighterModule,
  FREIGHTER_ID,
  xBullModule,
  AlbedoModule,
  HanaModule,
  RabetModule,
  HotWalletModule,
} from "@creit.tech/stellar-wallets-kit";
import { WatchWalletChanges } from "@stellar/freighter-api";

import { TransactionBuilder, Networks } from "@stellar/stellar-sdk";
import { toast } from "sonner";
import EventService from "./event.service";

// import { getNetworkPassphrase } from "helpers/env";

// import { ModalService, ToastService } from "services/globalServices";

// import ChooseLoginMethodModal from "components/ChooseLoginMethodModal";
// import WalletKitModal from "components/WalletKitModal";

export const WalletKitEvents = {
  login: "login",
  logout: "logout",
  accountChanged: "accountChanged",
};

export default class WalletKitServiceClass {
  walletKit;
  event = new EventService();
  watcher = null;

  constructor() {
    this.walletKit = new StellarWalletsKit({
      // network: getNetworkPassphrase(),
      network: Networks.PUBLIC,
      modules: [
        new FreighterModule(),
        new HotWalletModule(),
        new xBullModule(),
        new AlbedoModule(),
        new HanaModule(),
        new RabetModule(),
      ],
      selectedWalletId: FREIGHTER_ID,
    });
  }

  async startFreighterWatching(publicKey, setUserKey, setNetwork) {
    if (!this.watcher) {
      this.watcher = new WatchWalletChanges(1000);
    }
    this.watcher.watch(async ({ address }) => {
      if (publicKey === address || !address) {
        return;
      }

      const network = await this.walletKit.getNetwork();

      setNetwork(network);
      setUserKey(address);

      this.event.trigger({
        type: WalletKitEvents.accountChanged,
        publicKey: address,
      });
    });
  }

  stopFreighterWatching() {
    this.watcher?.stop();
    this.watcher = null;
  }

  showWalletKitModal() {
    ModalService.closeAllModals();
    ModalService.openModal(
      WalletKitModal,
      { modules: this.walletKit.modules },
      false,
      null,
      false,
      () => ModalService.openModal(ChooseLoginMethodModal)
    );
  }

  async login(id, setUserKey, setNetwork) {
    try {
      this.walletKit.setWallet(id);

      const { address } = await this.walletKit.getAddress();

      let network;

      if (id === FREIGHTER_ID) {
        network = await this.walletKit.getNetwork();
      } else {
        network = { network: "TESTNET", networkPassphrase: Networks.TESTNET };
      }

      setNetwork(network);
      setUserKey(address);

      if (id === FREIGHTER_ID) {
        this.startFreighterWatching(address, setUserKey, setNetwork);
      }

      this.event.trigger({
        type: WalletKitEvents.login,
        publicKey: address,
        id,
      });
    } catch (e) {
      console.log("the error is", e);
      toast.error(e?.message);
    }
  }

  restoreLogin(id, publicKey) {
    this.walletKit.setWallet(id);

    if (id === FREIGHTER_ID) {
      this.startFreighterWatching(publicKey);
    }
  }

  async signTx(xdrRaw, network) {
    // const tx = TransactionBuilder.fromXDR(xdrRaw, network?.networkPassphrase);

    // const xdr = tx.toEnvelope().toXDR("base64");
    const { signedTxXdr } = await this.walletKit.signTransaction(xdrRaw, {
      networkPassphrase: Networks[network],
    });

    return signedTxXdr;
  }

  async signAuthEntry(authPreimageXdr, network, address) {
    if (!authPreimageXdr) {
      throw new Error("Authorization preimage XDR is required.");
    }

    const networkPassphrase = Networks[network];

    if (!networkPassphrase) {
      throw new Error(`Unsupported Stellar network: ${network}`);
    }

    /*
     * Return the complete result rather than extracting only `signature`.
     * Wallet modules may return:
     *
     * - a base64 signature string
     * - { signature }
     * - { signedAuthEntry }
     * - another wallet-specific result shape
     *
     * decodeStellarAuthSignature() in SendModal handles these shapes.
     */
    const result = await this.walletKit.signAuthEntry(authPreimageXdr, {
      networkPassphrase,
      ...(address ? { address } : {}),
    });

    if (result == null) {
      throw new Error(
        "The Stellar wallet did not return an authorization signature."
      );
    }

    return result;
  }
}
