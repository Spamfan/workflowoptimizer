// Prototype Blue - js/auth.js (v0.0.5)
// Gatekeeper & Strict Store PIN Validation (Master PIN Retired)

export const AUTH_VERSION = "v0.0.5";

const SECRET_SUFFIX = atob('MTAyMA=='); // "1020"
const SESSION_PIN_KEY = "wfo_session_pin";

let currentSessionPin = '';

/**
 * Validates store authentication.
 * Enforces strictly: PIN must equal store number + "1020".
 * Master PIN 102030 is permanently retired.
 * @param {string} store 
 * @param {string} pin 
 * @returns {boolean}
 */
export function isValidAuth(store, pin) {
  if (!store || !pin) return false;
  return pin === (store + SECRET_SUFFIX);
}

export function getSessionPin() {
  if (currentSessionPin) return currentSessionPin;
  try {
    return sessionStorage.getItem(SESSION_PIN_KEY) || '';
  } catch (_) {
    return '';
  }
}

export function setSessionPin(pinVal) {
  currentSessionPin = pinVal;
  try {
    if (pinVal) {
      sessionStorage.setItem(SESSION_PIN_KEY, pinVal);
    } else {
      sessionStorage.removeItem(SESSION_PIN_KEY);
    }
  } catch (_) {}
}

export function getSavedStore() {
  return localStorage.getItem('wfo_store') || '';
}

export function saveStore(storeVal) {
  localStorage.setItem('wfo_store', storeVal);
}

export function logout() {
  setSessionPin('');
  window.location.reload();
}

export function initAuth({ onSuccess }) {
  const storeInput = document.getElementById('store-input');
  const pinInput = document.getElementById('pin-input');
  const pinError = document.getElementById('pin-error');
  const btnEnter = document.getElementById('btn-enter');

  const saved = getSavedStore();
  if (saved) {
    storeInput.value = saved;
    pinInput.focus();
  }

  function handleAuthSubmit() {
    const storeVal = storeInput.value.trim();
    const pinVal = pinInput.value.trim();

    if (isValidAuth(storeVal, pinVal)) {
      pinError.style.display = 'none';
      saveStore(storeVal);
      setSessionPin(pinVal);
      if (typeof onSuccess === 'function') onSuccess(storeVal, pinVal);
    } else {
      pinError.style.display = 'block';
      pinInput.value = '';
      pinInput.focus();
    }
  }

  btnEnter.addEventListener('click', handleAuthSubmit);

  storeInput.addEventListener('input', (e) => {
    if (e.target.value.trim().length >= 4) pinInput.focus();
  });

  storeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') pinInput.focus();
  });

  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAuthSubmit();
  });

  pinInput.addEventListener('input', (e) => {
    const storeVal = storeInput.value.trim();
    const pinVal = e.target.value.trim();
    if (isValidAuth(storeVal, pinVal)) {
      e.target.blur();
      pinError.style.display = 'none';
      saveStore(storeVal);
      setSessionPin(pinVal);
      if (typeof onSuccess === 'function') onSuccess(storeVal, pinVal);
    }
  });
}
