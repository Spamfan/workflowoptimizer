// Workflow Optimizer - js/crypto.js (v0.0.2)
// Client-side Web Crypto AES-GCM (256-bit) Store Inventory Encryption Engine

export const CRYPTO_VERSION = "v0.0.2";

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH_BITS = 256;
const IV_LENGTH_BYTES = 12;
const SALT_LENGTH_BYTES = 16;

/**
 * Retrieves the local high-entropy Store Key for a store.
 * @param {string} storeNum 
 * @returns {string}
 */
export function getStoreKey(storeNum = "") {
  try {
    return localStorage.getItem(`wfo_store_key_${storeNum || 'default'}`) || '';
  } catch (_) {
    return '';
  }
}

/**
 * Persists the local high-entropy Store Key for a store.
 * @param {string} storeNum 
 * @param {string} key 
 */
export function setStoreKey(storeNum = "", key = "") {
  try {
    const cleanKey = key.trim();
    if (cleanKey) {
      localStorage.setItem(`wfo_store_key_${storeNum || 'default'}`, cleanKey);
    } else {
      localStorage.removeItem(`wfo_store_key_${storeNum || 'default'}`);
    }
  } catch (_) {}
}

/**
 * Checks if a store key is enrolled locally.
 * @param {string} storeNum 
 * @returns {boolean}
 */
export function hasStoreKey(storeNum = "") {
  return Boolean(getStoreKey(storeNum));
}

/**
 * Generates a high-entropy 16-character alphanumeric store token.
 * Formatted with hyphens for visual readability: XXXX-XXXX-XXXX-XXXX.
 * @returns {string}
 */
export function generateStoreKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  let raw = "";
  for (let i = 0; i < bytes.length; i++) {
    raw += chars[bytes[i] % chars.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

/**
 * Encodes Uint8Array or ArrayBuffer into Base64 string.
 * @param {ArrayBuffer|Uint8Array} buffer 
 * @returns {string}
 */
export function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes Base64 string into Uint8Array.
 * @param {string} base64 
 * @returns {Uint8Array}
 */
export function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives an AES-GCM CryptoKey using PBKDF2 from a store number and secret key.
 * @param {string} storeNum 
 * @param {string} secret Explicit secret or local store key
 * @param {Uint8Array} salt 
 * @returns {Promise<CryptoKey>}
 */
export async function deriveStoreKey(storeNum, secret, salt) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error("Web Crypto API (crypto.subtle) is not supported in this browser environment.");
  }

  const effectiveSecret = secret || getStoreKey(storeNum);
  if (!effectiveSecret) {
    throw new Error(`Store Key not found for Store ${storeNum || '--'}. Please pair this device using the Store Key barcode.`);
  }

  const encoder = new TextEncoder();
  const rawKeyData = encoder.encode(`wfo-store:${storeNum || 'default'}:${effectiveSecret}`);

  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    rawKeyData,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: KEY_LENGTH_BITS },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a plain store inventory object using AES-GCM.
 * @param {Object} inventoryObj e.g. { tmo: [...], vzw: [...], att: [...] }
 * @param {string} storeNum 
 * @param {string} [secret] Optional explicit secret (defaults to local store key)
 * @returns {Promise<{ encrypted: true, lastUpdated: string, salt: string, iv: string, data: string }>}
 */
export async function encryptStoreData(inventoryObj, storeNum, secret = '') {
  if (!window.crypto || !window.crypto.subtle) {
    console.warn("Crypto not supported; falling back to unencrypted record");
    return {
      encrypted: false,
      lastUpdated: new Date().toISOString(),
      inventory: inventoryObj
    };
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const key = await deriveStoreKey(storeNum, secret, salt);

  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(JSON.stringify(inventoryObj));

  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    plaintextBytes
  );

  return {
    encrypted: true,
    lastUpdated: new Date().toISOString(),
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    data: bufferToBase64(cipherBuffer)
  };
}

/**
 * Decrypts a store payload using AES-GCM. If unencrypted, transparently returns inventory data.
 * @param {Object} storeRecord Record from stocks.json
 * @param {string} storeNum 
 * @param {string} [secret] Optional explicit secret (defaults to local store key)
 * @returns {Promise<{ lastUpdated: string, inventory: Object }>}
 */
export async function decryptStoreData(storeRecord, storeNum, secret = '') {
  if (!storeRecord) return null;

  // Transparent passthrough for legacy or unencrypted store records
  if (!storeRecord.encrypted || !storeRecord.data) {
    return {
      lastUpdated: storeRecord.lastUpdated || '',
      inventory: storeRecord.inventory || { tmo: [], vzw: [], att: [] }
    };
  }

  if (!window.crypto || !window.crypto.subtle) {
    throw new Error("Cannot decrypt store data: Web Crypto API not available.");
  }

  try {
    const salt = base64ToBuffer(storeRecord.salt);
    const iv = base64ToBuffer(storeRecord.iv);
    const cipherBytes = base64ToBuffer(storeRecord.data);

    const key = await deriveStoreKey(storeNum, secret, salt);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      cipherBytes
    );

    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(decryptedBuffer);
    const parsedInventory = JSON.parse(jsonStr);

    return {
      lastUpdated: storeRecord.lastUpdated || '',
      inventory: parsedInventory
    };
  } catch (err) {
    console.error(`Failed to decrypt store ${storeNum} inventory:`, err);
    throw new Error(`Unable to decrypt inventory for Store ${storeNum}. Ensure this device is paired with the Store Key barcode.`);
  }
}
