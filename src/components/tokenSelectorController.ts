import type { SelectableToken } from "../pages/swaps/TokenSelectorModal";

export type TokenSelectorPurpose =
  | "swap-input"
  | "swap-output"
  | "withdraw"
  | "watchlist";

export type TokenSelectorTarget = "from" | "to";

export interface TokenSelectorRequest {
  purpose: TokenSelectorPurpose;
  target: TokenSelectorTarget;
  preserveExistingSelection?: boolean;
}

export interface TokenSelectorOpenEventDetail extends TokenSelectorRequest {
  requestId: string;
}

export interface TokenSelectorResolveEventDetail {
  requestId: string;
  token: SelectableToken | null;
}

const OPEN_EVENT = "socketfi:token-selector:open";
const RESOLVE_EVENT = "socketfi:token-selector:resolve";

function createRequestId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function requestTokenSelection(
  request: TokenSelectorRequest
): Promise<SelectableToken | null> {
  const requestId = createRequestId();

  return new Promise((resolve) => {
    function handleResolve(event: Event) {
      const detail = (event as CustomEvent<TokenSelectorResolveEventDetail>)
        .detail;

      if (!detail || detail.requestId !== requestId) {
        return;
      }

      window.removeEventListener(RESOLVE_EVENT, handleResolve);
      resolve(detail.token ?? null);
    }

    window.addEventListener(RESOLVE_EVENT, handleResolve);

    window.dispatchEvent(
      new CustomEvent<TokenSelectorOpenEventDetail>(OPEN_EVENT, {
        detail: {
          ...request,
          requestId,
        },
      })
    );
  });
}

export function subscribeToTokenSelectorRequests(
  listener: (request: TokenSelectorOpenEventDetail) => void
): () => void {
  function handleOpen(event: Event) {
    const detail = (event as CustomEvent<TokenSelectorOpenEventDetail>).detail;

    if (detail) {
      listener(detail);
    }
  }

  window.addEventListener(OPEN_EVENT, handleOpen);

  return () => {
    window.removeEventListener(OPEN_EVENT, handleOpen);
  };
}

export function resolveTokenSelection(
  requestId: string,
  token: SelectableToken | null
): void {
  window.dispatchEvent(
    new CustomEvent<TokenSelectorResolveEventDetail>(RESOLVE_EVENT, {
      detail: {
        requestId,
        token,
      },
    })
  );
}
