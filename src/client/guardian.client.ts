// Production client for the account-security guardian index.
// The smart-account trait supplied by the user does not expose get_guardians(),
// so the frontend requires an indexed API for guardian discovery and removal timing.

const BASE_URL = (
  import.meta.env.VITE_SOCKETFI_DIRECT_API_URL ||
  import.meta.env.VITE_SERVER_DIRECT_URL ||
  "http://localhost:3200"
).replace(/\/$/, "");

async function readJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      body?.error || body?.message || `Request failed (${response.status})`
    );
  }
  return body;
}

function headers(accessToken: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

export const guardianApi = {
  async list({ network, walletAddress, accessToken }) {
    const params = new URLSearchParams({ network, walletAddress });
    return readJson(
      await fetch(`${BASE_URL}/api/account-guardians?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    );
  },

  async confirmAdd(input) {
    return readJson(
      await fetch(`${BASE_URL}/api/account-guardians/confirm-add`, {
        method: "POST",
        headers: headers(input.accessToken),
        body: JSON.stringify({
          network: input.network,
          walletAddress: input.walletAddress,
          guardianAddress: input.guardianAddress,
          transactionHash: input.transactionHash,
        }),
      })
    );
  },

  async confirmScheduleRemoval(input) {
    return readJson(
      await fetch(
        `${BASE_URL}/api/account-guardians/confirm-schedule-removal`,
        {
          method: "POST",
          headers: headers(input.accessToken),
          body: JSON.stringify({
            network: input.network,
            walletAddress: input.walletAddress,
            guardianAddress: input.guardianAddress,
            transactionHash: input.transactionHash,
          }),
        }
      )
    );
  },

  async confirmFinalizeRemoval(input) {
    return readJson(
      await fetch(
        `${BASE_URL}/api/account-guardians/confirm-finalize-removal`,
        {
          method: "POST",
          headers: headers(input.accessToken),
          body: JSON.stringify({
            network: input.network,
            walletAddress: input.walletAddress,
            guardianAddress: input.guardianAddress,
            transactionHash: input.transactionHash,
          }),
        }
      )
    );
  },
};
