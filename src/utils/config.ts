// @ts-nocheck
import axios from "axios";
import { toast } from "sonner";

// Function to convert ArrayBuffer to hex string
const bufferToHex = (buffer) => {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// Function to generate a salt of a specified length
export const generateSalt = async (length = 16) => {
  // Generate random bytes
  const randomValues = new Uint8Array(length);
  window.crypto.getRandomValues(randomValues);

  // Convert to hex string
  const salt = Array.from(randomValues)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return salt;
};

// Hash password with SHA-256 and a salt: for creating an account
export const hashPassword = async (password, salt, keyString, algo) => {
  const encoder = new TextEncoder();
  const saltBuffer = encoder.encode(salt);
  const passwordBuffer = encoder.encode(password);

  // Concatenate salt and password
  const data = new Uint8Array([...saltBuffer, ...passwordBuffer]);

  // Generate hash
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Convert hash to hex string
  const hashedPassword = bufferToHex(hashBuffer);
  const encryptedSalt = await encrypt(salt, keyString, algo);

  return { hashedPassword, ...encryptedSalt };
};

//return password hash for transaction verification

export const returnPasswordhash = async (password, salt) => {
  const encoder = new TextEncoder();
  const saltBuffer = encoder.encode(salt);
  const passwordBuffer = encoder.encode(password);

  // Concatenate salt and password
  const data = new Uint8Array([...saltBuffer, ...passwordBuffer]);

  // Generate hash
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Convert hash to hex string
  const hashedPassword = bufferToHex(hashBuffer);

  return hashedPassword;
};

export const encrypt = async (text, keyString, algo) => {
  const enc = new TextEncoder();
  const encodedText = enc.encode(text);

  const keyBuffer = base64ToArrayBuffer(keyString);
  const iv = crypto.getRandomValues(new Uint8Array(16)); // Initialization Vector

  const algorithm = { name: algo, iv };
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    algorithm,
    false,
    ["encrypt"]
  );

  const encryptedBuffer = await crypto.subtle.encrypt(
    algorithm,
    cryptoKey,
    encodedText
  );
  const encryptedArray = Array.from(new Uint8Array(encryptedBuffer));
  const encryptedHex = encryptedArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return {
    encryptedHex,
    iv: Array.from(iv)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  };
};

export const decrypt = async (encryptedHex, ivHex, keyString, algo) => {
  const encryptedArray = new Uint8Array(
    encryptedHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
  );
  const iv = new Uint8Array(
    ivHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
  );

  const keyBuffer = base64ToArrayBuffer(keyString);
  const algorithm = { name: algo, iv };
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    algorithm,
    false,
    ["decrypt"]
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    algorithm,
    cryptoKey,
    encryptedArray
  );
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
};

// Generate a key and return it as a base64 string
export const generateKey = async (algo) => {
  const key = await crypto.subtle.generateKey(
    {
      name: algo,
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
  const keyBuffer = await crypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(keyBuffer);
};

// Helper function to convert ArrayBuffer to base64 string
const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Convert base64 string to ArrayBuffer
const base64ToArrayBuffer = (base64) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export const randomKeySelect = (arr) => {
  const selectedIndex = Math.floor(Math.random() * arr.length);
  const selectedKey = arr[selectedIndex];
  return { index: selectedIndex, key: selectedKey };
};

export function validatePassword(password, confirmPassword) {
  const minLength = 6;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  let errors = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long.`);
  }
  if (!hasUpperCase) {
    errors.push("Password must contain at least one uppercase letter.");
  }
  if (!hasLowerCase) {
    errors.push("Password must contain at least one lowercase letter.");
  }
  if (!hasNumbers) {
    errors.push("Password must contain at least one number.");
  }
  if (!hasSpecialChar) {
    errors.push("Password must contain at least one special character.");
  }

  if (confirmPassword !== password) {
    errors.push(`Passwords entered do not match`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, message: "Password is valid." };
}

export function convertToUnixTimestamp(dateString) {
  const date = new Date(dateString); // Create a Date object from the input string
  const unixTimestamp = Math.floor(date.getTime() / 1000); // Convert to Unix timestamp (in seconds)
  return unixTimestamp;
}
