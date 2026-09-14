// Prototype Blue - js/auth.js (v0.0.1)

export const AUTH_VERSION = "v0.0.1";

const SECRET_SUFFIX = atob('MTAyMA=='); // "1020"
const MASTER_PIN = atob('MTAyMDMw');   // "102030"

export function isValidAuth(store, pin) {
  if (!store) return false;
  return pin === (store + SECRET_SUFFIX) || pin === MASTER_PIN;
}

export function getSavedStore() {
  return localStorage.getItem('wfo_store') || '';
}

export function saveStore(storeVal) {
  localStorage.setItem('wfo_store', storeVal);
}

export function logout() {
  localStorage.removeItem('wfo_store');
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
      if (typeof onSuccess === 'function') onSuccess(storeVal);
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
      if (typeof onSuccess === 'function') onSuccess(storeVal);
    }
  });
}