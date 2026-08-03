// @ts-nocheck
const CONTRACT_BASE_URL = "/wasm";
const CODE_BASE_URL = "https://github.com/stellar/soroban-examples";

export const contracts = [
  {
    title: "Token Contract",
    description: "Soroban token contract template",
    wasmfile: `${CONTRACT_BASE_URL}/soroban_token_contract.wasm`,
    codeLink: `${CODE_BASE_URL}/tree/main/token`,
  },

  {
    title: "Single Offer Contract",
    description: "Soroban token sale offer contract template",
    wasmfile: `${CONTRACT_BASE_URL}/soroban_single_offer_contract.wasm`,
    codeLink: `${CODE_BASE_URL}/tree/main/single_offer`,
  },

  {
    title: "Mint Lock Contract",
    description: "Soroban mint lock contract template",
    wasmfile: `${CONTRACT_BASE_URL}/soroban_mint_lock_contract.wasm`,
    codeLink: `${CODE_BASE_URL}/tree/main/mint-lock`,
  },
  {
    title: "Smart sub-account",
    description: "Smart account",
    wasmfile: `${CONTRACT_BASE_URL}/socketfi_smart_subaccount.wasm`,
    codeLink: `${CODE_BASE_URL}`,
  },
];
