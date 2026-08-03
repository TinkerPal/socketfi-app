// @ts-nocheck
import axios from "axios";

import BigNumber from "bignumber.js";
import { BASE_URL } from "../context/StatesContext";
import { toast } from "sonner";

export async function getRequest(resource, query = "", accessToken = null) {
  try {
    const queryString = query ? `?${query}` : "";
    let res;
    if (accessToken) {
      res = await axios.get(`${BASE_URL}/${resource}${queryString}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`, // Add the token in the Authorization header
        },
        withCredentials: true,
      });
    } else {
      res = await axios.get(`${BASE_URL}/auth/${resource}${queryString}`, {
        headers: {},
        withCredentials: true,
      });
    }

    return res?.data;
  } catch (error) {
    console.error("Get Request Error", error);
    throw error; // Re-throw for error handling upstream
  }
}

export async function postRequest(resource, body, accessToken = null) {
  let headers = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  try {
    const res = await axios.post(`${BASE_URL}/${resource}`, body, {
      headers,
      withCredentials: true,
    });

    if (res) {
      return res.data;
    }
  } catch (e) {
    toast.error(e?.response?.data?.error);
    return;
  }
}

const baseApi = "https://amm-api.aqua.network/api/external/v1";

export async function findSwapPath(tokenInAddress, tokenOutAddress, amount) {
  const headers = { "Content-Type": "application/json" };
  const body = JSON.stringify({
    token_in_address: tokenInAddress,
    token_out_address: tokenOutAddress,
    amount: amount.toString(),
  });

  const estimateResponse = await fetch(`${baseApi}/find-path/`, {
    method: "POST",
    body,
    headers,
  });
  const estimateResult = await estimateResponse.json();

  console.log(estimateResult);

  if (!estimateResult.success) {
    throw new Error("Estimate failed");
  }

  return estimateResult;
}

export const toBaseUnits = (amount, decimals = 7) => {
  if (!amount || isNaN(Number(amount))) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  const conversion = new BigNumber(amount)
    .multipliedBy(new BigNumber(10).pow(decimals))
    .integerValue(BigNumber.ROUND_HALF_UP);

  return conversion.toFixed(0); // Return it as a clean string
};

export const fromBaseUnits = (amount, decimals = 7) => {
  if (!amount || isNaN(Number(amount))) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  const readable = new BigNumber(amount).dividedBy(
    new BigNumber(10).pow(decimals)
  );

  return readable.toFixed(decimals); // keep the correct number of decimals
};
