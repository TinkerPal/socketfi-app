// @ts-nocheck
const SAVED_ACCOUNTS_KEY = "socketfi_savedAccounts";
const AUTH_SESSION_KEY = "socketfi_authSession";

export const getAccounts = () => {
  try {
    const data = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    if (!data) return [];
    const accounts = JSON.parse(data);
    return Array.isArray(accounts) ? accounts : [];
  } catch {
    return [];
  }
};

export const addAccountStore = (account) => {
  if (!account || !account.username) return null;

  const accounts = getAccounts();
  const exists = accounts.find(
    (acc) =>
      acc.username === account.username && acc.platform === account.platform
  );

  if (exists) return null;

  const newAccount = {
    ...account,
    id: Date.now(),
  };

  accounts.unshift(newAccount);

  if (accounts.length > 5) {
    accounts.pop();
  }

  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
  return newAccount.id;
};

export const deleteAccountStore = (id) => {
  const accounts = getAccounts();
  const filtered = accounts.filter((acc) => acc.id !== id);
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(filtered));
};

export const clearAccountStore = () => {
  localStorage.removeItem(SAVED_ACCOUNTS_KEY);
};

// ==================== Auth Session ====================

export const saveAuthSession = (userProfile, accessToken) => {
  if (!userProfile || !accessToken) return;

  const session = {
    id: "session",
    userProfile,
    accessToken,
    dateExpire: (Date.now() + 23 * 60 * 60 * 1000).toString(),
  };

  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
};

export const getAuthSession = () => {
  try {
    const data = localStorage.getItem(AUTH_SESSION_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
};

export const removeAuthSession = () => {
  localStorage.removeItem(AUTH_SESSION_KEY);

  clearAccountStore();
};
