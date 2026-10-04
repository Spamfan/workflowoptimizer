// Prototype Crimson - js/auth.js (v0.1.1)
// Gatekeeper Passcode Validation

export const AUTH_VERSION = "v0.1.1";

const PASSCODE_SECRET = atob('MTAyMDMw'); // "102030"
const SESSION_PIN_KEY = "wfo_session_pin";

let currentSessionPin = '';

/**
 * Validates optimizer passcode.
 * Enforces strictly: Passcode must match 102030.
 * @param {string} pin 
 * @returns {boolean}
 */
export function isValidAuth(arg1, arg2) {
  const pin = arg2 !== undefined ? arg2 : arg1;
  if (!pin) return false;
  return pin === PASSCODE_SECRET;
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
  const pinInput = document.getElementById('pin-input');
  const pinError = document.getElementById('pin-error');
  const btnEnter = document.getElementById('btn-enter');

  if (pinInput) pinInput.focus();

  function handleAuthSubmit() {
    const pinVal = pinInput ? pinInput.value.trim() : '';

    if (isValidAuth(pinVal)) {
      if (pinError) pinError.style.display = 'none';
      setSessionPin(pinVal);
      if (typeof onSuccess === 'function') onSuccess(pinVal);
    } else {
      if (pinError) pinError.style.display = 'block';
      if (pinInput) {
        pinInput.value = '';
        pinInput.focus();
      }
    }
  }

  if (btnEnter) btnEnter.addEventListener('click', handleAuthSubmit);

  if (pinInput) {
    pinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAuthSubmit();
    });

    pinInput.addEventListener('input', (e) => {
      const pinVal = e.target.value.trim();
      if (pinVal.length >= 6 && isValidAuth(pinVal)) {
        e.target.blur();
        if (pinError) pinError.style.display = 'none';
        setSessionPin(pinVal);
        if (typeof onSuccess === 'function') onSuccess(pinVal);
      }
    });
  }
}
