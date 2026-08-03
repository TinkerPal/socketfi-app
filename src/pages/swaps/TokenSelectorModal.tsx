import { CloseCircle } from "iconsax-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type SyntheticEvent,
} from "react";
import { Asset, Networks, StrKey } from "@stellar/stellar-sdk";

import { useStates } from "../../context/StatesContext";

type SocketFiNetwork = "PUBLIC" | "TESTNET";

export interface TokenSelectorToken {
  id?: string;
  address?: string;
  contract?: string;
  symbol?: string;
  code?: string;
  name?: string;
  icon?: string | null;
  decimals?: number;
  balance?: string | number | null;
  issuer?: string;
  domain?: string;
  org?: string;
  custom?: boolean;
  verified?: boolean;
  assetType?: "native" | "classic" | "sac" | "contract";
}

export type SelectableToken = {
  code: string;
  issuer?: string;
  contract: string;
  address: string;
  name: string;
  org?: string;
  domain?: string;
  icon?: string;
  decimals?: number;
  custom?: boolean;
  verified?: boolean;
  assetType?: "native" | "classic" | "sac" | "contract";
};

type TokenSelectorModalProps = {
  onClose?: () => void;
  onSelect?: (token: SelectableToken) => void;
};

type ParsedCustomAsset =
  | {
      valid: true;
      token: SelectableToken;
    }
  | {
      valid: false;
      error: string;
    };

const SEARCH_FIELDS: Array<keyof SelectableToken> = [
  "code",
  "issuer",
  "contract",
  "address",
  "name",
  "org",
  "domain",
];

function normalizeNetwork(value: unknown): SocketFiNetwork {
  return value === "PUBLIC" ? "PUBLIC" : "TESTNET";
}

function networkPassphrase(network: SocketFiNetwork): string {
  return network === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET;
}

function normalizeContractAddress(value: string): string | null {
  const normalized = value.trim().toUpperCase();

  if (!StrKey.isValidContract(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeIssuer(value: string): string | null {
  const normalized = value.trim().toUpperCase();

  if (!StrKey.isValidEd25519PublicKey(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeAssetCode(value: string): string | null {
  const normalized = value.trim().toUpperCase();

  /*
   * Classic Stellar asset codes are 1–12 alphanumeric characters.
   */
  if (!/^[A-Z0-9]{1,12}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function contractIdToAddress(contractId: string): string {
  /*
   * Some SDK versions return the StrKey C-address directly.
   */
  if (StrKey.isValidContract(contractId)) {
    return contractId;
  }

  /*
   * Other SDK versions return the underlying 32-byte hash as hex.
   */
  const normalized = contractId.replace(/^0x/i, "");

  if (!/^[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new Error("Unable to derive the Stellar Asset Contract address.");
  }

  return StrKey.encodeContract(Buffer.from(normalized, "hex"));
}

function assetContractAddress(asset: Asset, network: SocketFiNetwork): string {
  const contractId = asset.contractId(networkPassphrase(network));

  return contractIdToAddress(contractId);
}

function createNativeAsset(network: SocketFiNetwork): SelectableToken {
  const contract = assetContractAddress(Asset.native(), network);

  return {
    code: "XLM",
    issuer: "",
    contract,
    address: contract,
    name: "Stellar Lumens",
    domain: "Native Stellar asset",
    icon: "",
    decimals: 7,
    custom: true,
    verified: true,
    assetType: "native",
  };
}

function createClassicAsset(
  code: string,
  issuer: string,
  network: SocketFiNetwork
): SelectableToken {
  const asset = new Asset(code, issuer);
  const contract = assetContractAddress(asset, network);

  return {
    code,
    issuer,
    contract,
    address: contract,
    name: code,
    domain: "Custom classic asset",
    icon: "",
    decimals: 7,
    custom: true,
    verified: false,
    assetType: "classic",
  };
}

function createContractToken(contract: string): SelectableToken {
  return {
    code: "TOKEN",
    issuer: "",
    contract,
    address: contract,
    name: "Custom token contract",
    domain: "Soroban token or SAC",
    icon: "",
    custom: true,
    verified: false,
    assetType: "contract",
  };
}

function parseCustomAsset(
  rawValue: string,
  network: SocketFiNetwork
): ParsedCustomAsset {
  const value = rawValue.trim();

  if (!value) {
    return {
      valid: false,
      error: "Enter an asset or token contract.",
    };
  }

  if (/^(XLM|NATIVE)$/i.test(value)) {
    try {
      return {
        valid: true,
        token: createNativeAsset(network),
      };
    } catch {
      return {
        valid: false,
        error: "Unable to derive the native XLM contract address.",
      };
    }
  }

  const contract = normalizeContractAddress(value);

  if (contract) {
    return {
      valid: true,
      token: createContractToken(contract),
    };
  }

  const separatorIndex = value.indexOf(":");

  if (separatorIndex !== -1) {
    /*
     * Reject inputs containing more than one separator.
     */
    if (separatorIndex !== value.lastIndexOf(":")) {
      return {
        valid: false,
        error: "Use the format CODE:GISSUER.",
      };
    }

    const rawCode = value.slice(0, separatorIndex);
    const rawIssuer = value.slice(separatorIndex + 1);

    const code = normalizeAssetCode(rawCode);
    const issuer = normalizeIssuer(rawIssuer);

    if (!code) {
      return {
        valid: false,
        error: "Asset code must contain 1–12 letters or numbers.",
      };
    }

    if (!issuer) {
      return {
        valid: false,
        error: "Enter a valid Stellar G... issuer address.",
      };
    }

    try {
      return {
        valid: true,
        token: createClassicAsset(code, issuer, network),
      };
    } catch {
      return {
        valid: false,
        error: "Unable to derive the Stellar Asset Contract address.",
      };
    }
  }

  if (/^G/i.test(value)) {
    return {
      valid: false,
      error:
        "An issuer address must include an asset code, for example USDC:GISSUER.",
    };
  }

  if (/^C/i.test(value)) {
    return {
      valid: false,
      error: "Enter a valid Stellar C... contract address.",
    };
  }

  return {
    valid: false,
    error: "Enter XLM, a C... token contract, or CODE:GISSUER.",
  };
}

function tokenIdentity(
  token: Partial<SelectableToken> | null | undefined
): string {
  return String(
    token?.contract ||
      token?.address ||
      (token?.code && token?.issuer
        ? `${token.code}:${token.issuer}`
        : token?.code) ||
      ""
  )
    .trim()
    .toUpperCase();
}

function normalizeToken(
  token: Partial<SelectableToken>
): SelectableToken | null {
  const contract = String(token.contract || token.address || "").trim();

  const code = String(token.code || "TOKEN")
    .trim()
    .toUpperCase();

  if (!contract && !token.issuer) {
    return null;
  }

  return {
    code,
    issuer: token.issuer ? String(token.issuer).trim().toUpperCase() : "",
    contract,
    address: String(token.address || contract).trim(),
    name: String(token.name || code).trim(),
    org: token.org ? String(token.org).trim() : "",
    domain: token.domain ? String(token.domain).trim() : "",
    icon: token.icon ? String(token.icon).trim() : "",
    decimals: typeof token.decimals === "number" ? token.decimals : undefined,
    custom: Boolean(token.custom),
    verified: Boolean(token.verified),
    assetType: token.assetType,
  };
}

function matchesSearch(
  token: SelectableToken,
  normalizedSearch: string
): boolean {
  if (!normalizedSearch) {
    return true;
  }

  return SEARCH_FIELDS.some((field) => {
    const value = token[field];

    return (
      typeof value === "string" &&
      value.toLowerCase().includes(normalizedSearch)
    );
  });
}

function shortAddress(value: string): string {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 9)}…${value.slice(-7)}`;
}

function CustomAssetCard({
  value,
  error,
  token,
  disabled,
  onChange,
  onSubmit,
}: {
  value: string;
  error: string;
  token: SelectableToken | null;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && token && !disabled) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">Add a custom asset</p>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        Enter a Soroban token/SAC address, a classic asset in{" "}
        <span className="font-semibold text-slate-700">CODE:GISSUER</span>{" "}
        format, or <span className="font-semibold text-slate-700">XLM</span>.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
          placeholder="C... or USDC:G... or XLM"
          aria-invalid={Boolean(value.trim() && error)}
          aria-describedby="custom-asset-message"
          className="h-12 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 font-mono text-sm text-slate-900 outline-none transition placeholder:font-sans placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
        />

        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !token}
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Use asset
        </button>
      </div>

      <div id="custom-asset-message" className="mt-3 min-h-5 text-xs">
        {value.trim() && error ? (
          <p className="text-rose-600">{error}</p>
        ) : token ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
            <p className="font-semibold">
              Valid{" "}
              {token.assetType === "classic"
                ? "classic asset"
                : token.assetType === "native"
                ? "native asset"
                : "contract address"}
            </p>

            <p className="mt-1 break-all font-mono">{token.contract}</p>

            {token.custom && !token.verified ? (
              <p className="mt-1 font-sans text-amber-700">
                Custom assets are unverified. Confirm the contract and issuer
                before continuing.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-slate-400">
            Classic asset inputs are converted to their network-specific SAC
            address.
          </p>
        )}
      </div>
    </div>
  );
}

export default function TokenSelectorModal({
  onClose = () => undefined,
  onSelect = () => undefined,
}: TokenSelectorModalProps) {
  const [search, setSearch] = useState("");
  const [customAsset, setCustomAsset] = useState("");
  const [selectionError, setSelectionError] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    swapDappTokenSelectorIsOpen,
    setSwapDappTokenSelectorIsOpen,
    dappTokenIn,
    setDappTokenIn,
    dappTokenOut,
    setDappTokenOut,
    toOrFrom,
    setSelectedTransactToken,
    filteredTokens,
    selectedNetwork,
  } = useStates();

  const network = normalizeNetwork(selectedNetwork);

  const tokens = useMemo<SelectableToken[]>(() => {
    if (!Array.isArray(filteredTokens)) {
      return [];
    }

    const seen = new Set<string>();
    const normalized: SelectableToken[] = [];

    for (const rawToken of filteredTokens) {
      const token = normalizeToken(rawToken as any);

      if (!token) {
        continue;
      }

      const identity = tokenIdentity(token);

      if (!identity || seen.has(identity)) {
        continue;
      }

      seen.add(identity);
      normalized.push(token);
    }

    return normalized;
  }, [filteredTokens]);

  const normalizedSearch = search.trim().toLowerCase();

  const displayTokenList = useMemo(
    () => tokens.filter((token) => matchesSearch(token, normalizedSearch)),
    [tokens, normalizedSearch]
  );

  const customAssetResult = useMemo(
    () => parseCustomAsset(customAsset, network),
    [customAsset, network]
  );

  const customToken = customAssetResult.valid ? customAssetResult.token : null;

  const customAssetError =
    customAsset.trim() &&
    !customAssetResult.valid &&
    "error" in customAssetResult
      ? customAssetResult.error
      : "";

  const oppositeToken = toOrFrom === "from" ? dappTokenOut : dappTokenIn;

  const oppositeIdentity = tokenIdentity(oppositeToken as any);

  function closeModal() {
    setSwapDappTokenSelectorIsOpen(false);
    setSearch("");
    setCustomAsset("");
    setSelectionError("");
    onClose();
  }

  function applyTokenSelection(selectedToken: SelectableToken) {
    const identity = tokenIdentity(selectedToken);

    if (!identity) {
      setSelectionError("The selected asset does not have a valid identifier.");
      return;
    }

    if (oppositeIdentity && identity === oppositeIdentity) {
      setSelectionError(
        "Select a different asset for the other side of the swap."
      );
      return;
    }

    if (toOrFrom === "from") {
      setDappTokenIn(selectedToken);
      setSelectedTransactToken(selectedToken);
    } else if (toOrFrom === "to") {
      setDappTokenOut(selectedToken);
    } else {
      setSelectionError(
        "Unable to determine which token field is being updated."
      );
      return;
    }

    setSwapDappTokenSelectorIsOpen(false);
    setSearch("");
    setCustomAsset("");
    setSelectionError("");

    onSelect(selectedToken);
  }

  function handleTokenSelection(token: SelectableToken) {
    applyTokenSelection(token);
  }

  function handleCustomAssetSelection() {
    if (!customAssetResult.valid && "error" in customAssetResult) {
      setSelectionError(customAssetResult.error);
      return;
    }

    applyTokenSelection(customAssetResult.token);
  }

  // function handleBackdropClick() {
  //   closeModal();
  // }

  function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    closeModal();
  }
  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
    }
  }

  function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
    event.currentTarget.style.display = "none";
  }

  useEffect(() => {
    if (!swapDappTokenSelectorIsOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [swapDappTokenSelectorIsOpen]);

  useEffect(() => {
    setSelectionError("");
  }, [search, customAsset, toOrFrom]);

  if (!swapDappTokenSelectorIsOpen) {
    return null;
  }

  const featuredTokens = displayTokenList.slice(0, 4);

  const remainingTokens = displayTokenList.slice(4);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/35 px-0 backdrop-blur-[6px] sm:items-center sm:px-4"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="token-selector-title"
        aria-describedby="token-selector-description"
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        onClick={(event) => event.stopPropagation()}
        className="relative max-h-[92svh] w-full overflow-hidden rounded-t-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)] sm:max-w-lg sm:rounded-[28px]"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-6">
          <div>
            <p
              id="token-selector-title"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600"
            >
              Select asset
            </p>

            <p
              id="token-selector-description"
              className="mt-1 text-xs text-slate-500"
            >
              {network === "PUBLIC" ? "Stellar Mainnet" : "Stellar Testnet"}
            </p>
          </div>

          <button
            type="button"
            onClick={closeModal}
            aria-label="Close asset selector"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-100"
          >
            <CloseCircle className="h-6 w-6" />
          </button>
        </div>

        <div className="max-h-[calc(92svh-81px)] overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <label htmlFor="asset-search" className="sr-only">
            Search assets
          </label>

          <input
            ref={searchInputRef}
            id="asset-search"
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search name, code, issuer, domain, or contract"
            value={search}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setSearch(event.target.value)
            }
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
          />

          {selectionError ? (
            <div
              role="alert"
              className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {selectionError}
            </div>
          ) : null}

          {featuredTokens.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {featuredTokens.map((token) => {
                const identity = tokenIdentity(token);

                const disabled =
                  Boolean(oppositeIdentity) && identity === oppositeIdentity;

                return (
                  <button
                    key={identity}
                    type="button"
                    disabled={disabled}
                    title={
                      disabled
                        ? "Already selected as the other swap asset"
                        : token.name
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => handleTokenSelection(token)}
                  >
                    {token.icon ? (
                      <img
                        src={token.icon}
                        alt=""
                        loading="lazy"
                        onError={handleImageError}
                        className="h-5 w-5 rounded-full"
                      />
                    ) : null}

                    <span>{token.name}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {remainingTokens.length > 0 ? (
            <div className="mt-5 max-h-72 space-y-2 overflow-y-auto pr-1">
              {remainingTokens.map((token) => {
                const identity = tokenIdentity(token);

                const disabled =
                  Boolean(oppositeIdentity) && identity === oppositeIdentity;

                return (
                  <button
                    key={identity}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleTokenSelection(token)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-transparent p-3 text-left transition hover:border-slate-200 hover:bg-slate-50 focus:border-slate-200 focus:bg-slate-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {token.icon ? (
                      <img
                        src={token.icon}
                        alt=""
                        loading="lazy"
                        onError={handleImageError}
                        className="h-9 w-9 rounded-full border border-slate-200 bg-white"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-500">
                        {token.code.slice(0, 2) || "T"}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">
                          {token.name}
                        </span>

                        {token.verified ? (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            Verified
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        {token.domain || shortAddress(token.contract)}
                      </div>
                    </div>

                    <div className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {token.code}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {displayTokenList.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                No curated asset found
              </p>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Add the asset manually below.
              </p>
            </div>
          ) : null}

          <CustomAssetCard
            value={customAsset}
            error={customAssetError}
            token={customToken}
            disabled={Boolean(
              customToken &&
                oppositeIdentity &&
                tokenIdentity(customToken) === oppositeIdentity
            )}
            onChange={setCustomAsset}
            onSubmit={handleCustomAssetSelection}
          />
        </div>
      </div>
    </div>
  );
}
