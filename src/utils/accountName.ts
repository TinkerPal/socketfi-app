// @ts-nocheck
const SOCKETFI_ACCOUNT_COUNT_KEY = "socketfi_account_count";

export function getSocketFiAccountPreviewName() {
  const count = getSocketFiAccountCount();
  return `SocketFi Account ${count + 1}`;
}

export function confirmSocketFiAccountCreated() {
  const count = getSocketFiAccountCount();

  try {
    localStorage.setItem(SOCKETFI_ACCOUNT_COUNT_KEY, String(count + 1));
  } catch {
    // ignore storage failures
  }
}

function getSocketFiAccountCount() {
  try {
    const raw = localStorage.getItem(SOCKETFI_ACCOUNT_COUNT_KEY);

    const parsed = Number(raw);

    if (!Number.isInteger(parsed) || parsed < 0) {
      return 0;
    }

    return parsed;
  } catch {
    return 0;
  }
}
