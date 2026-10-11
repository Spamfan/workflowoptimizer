// Prototype Crimson - generator.js (v0.1.1)
// Customer Quote & 2-Up Take Home Sheet Generator Engine

export const GENERATOR_VERSION = "v0.1.1";

const STATE_TAX_DEFAULTS = {
  NH: 8.00,
  ME: 9.00,
  VT: 10.00,
  MA: 10.00,
  NY: 15.00,
  OTHER: 8.00
};

const CARRIER_PROFILES = {
  att: { name: 'AT&T', planCost: 50.00, term: '3', autopay: 'CHECKING ACCT', dueDate: 20, maskNotices: false },
  vzw: { name: 'VZW', planCost: 25.00, term: '3', autopay: 'CHECKING ACCT', dueDate: 14, maskNotices: true },
  tmo: { name: 'T-Mobile', planCost: 25.00, term: '2', autopay: 'DEBIT', dueDate: 20, maskNotices: true }
};

export const genState = {
  carrier: 'att',
  customerName: '',
  phoneNumber: '',
  planCost: 50.00,
  deviceRetailMonthly: 0.00,
  deviceMonthlyCredit: 0.00,
  term: '3',
  state: 'NH',
  taxes: 8.00,
  autopayMethod: 'CHECKING ACCT',
  dueDateDays: 20,
  maskNotices: false,
  autopayCredit: 10.00,
  actFeeReturned: true,
  nonReimbursed: 0.00
};

export function calculateBill() {
  const deviceNet = Math.max(0, genState.deviceRetailMonthly - genState.deviceMonthlyCredit);
  const deviceDiscount = Math.max(0, genState.deviceMonthlyCredit);
  const monthlyTotal = Math.ceil(genState.planCost + deviceNet + genState.taxes);

  const reimbursedActual = (genState.autopayCredit || 0) +
    (genState.actFeeReturned ? 35.00 : 0.00) +
    deviceDiscount;
  const reimbursedDisplay = Math.floor(reimbursedActual);

  const nonReimbursedActual = Math.max(0, genState.nonReimbursed || 0);
  const bill1Actual = Math.ceil(monthlyTotal + reimbursedActual + nonReimbursedActual);
  const carrierBill1 = bill1Actual;
  const carrierSubsequent = Math.ceil(monthlyTotal + (genState.autopayCredit || 0) + deviceDiscount);

  return {
    deviceNet,
    deviceDiscount,
    monthlyTotal,
    reimbursedActual,
    reimbursedDisplay,
    nonReimbursedActual,
    bill1Actual,
    carrierBill1,
    carrierSubsequent
  };
}

export function updatePreview() {
  const calc = calculateBill();

  // Carrier pills sync
  const carrierPills = document.querySelectorAll('.gen-carrier-pill');
  carrierPills.forEach(pill => {
    pill.classList.toggle('active', pill.dataset.carrier === genState.carrier);
  });

  // Section visibility (ATT shows notices; non-ATT shows mask toggle)
  const attSections = document.querySelectorAll('.gen-att-only');
  attSections.forEach(el => {
    el.style.display = genState.carrier === 'att' ? 'flex' : 'none';
  });

  const nonAttSections = document.querySelectorAll('.gen-non-att-only');
  nonAttSections.forEach(el => {
    el.style.display = genState.carrier === 'att' ? 'none' : 'flex';
  });

  const previewMask = document.getElementById('gen-preview-mask');
  if (previewMask) {
    previewMask.style.display = (genState.carrier !== 'att' && genState.maskNotices) ? 'block' : 'none';
  }

  // Coordinate overlay text updates
  const setEl = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = text;
  };

  const carrierProfile = CARRIER_PROFILES[genState.carrier] || CARRIER_PROFILES.att;
  setEl('ov-carrier', carrierProfile.name);
  setEl('ov-name', genState.customerName || '');

  const digits = (genState.phoneNumber || '').replace(/\D/g, '');
  setEl('ov-num-area', digits.length >= 3 ? digits.slice(0, 3) : digits);
  setEl('ov-num-prefix', digits.length > 3 ? digits.slice(3, 6) : '');
  setEl('ov-num-line', digits.length > 6 ? digits.slice(6, 10) : '');

  setEl('ov-plan', genState.planCost > 0 ? genState.planCost.toFixed(0) : '0');

  const devNetText = calc.deviceNet > 0 ? calc.deviceNet.toFixed(2) : 'N/A';
  setEl('ov-device', devNetText);
  setEl('ov-taxes', genState.taxes.toFixed(2));
  setEl('ov-monthly', `${calc.monthlyTotal}`);
  setEl('ov-term', `${genState.term || '3'}`);
  setEl('ov-autopay', genState.autopayMethod);
  setEl('ov-duedate', `${genState.dueDateDays}`);

  // ATT notices overlays
  if (genState.carrier === 'att') {
    setEl('ov-reimbursed', `${calc.reimbursedDisplay}`);
    setEl('ov-nonreimbursed', calc.nonReimbursedActual > 0 ? calc.nonReimbursedActual.toFixed(0) : 'N/A');
    setEl('ov-bill1-actual', `${calc.bill1Actual}`);
    setEl('ov-bill2-actual', `${calc.monthlyTotal}<sup>-X</sup>`);
    setEl('ov-bill3-actual', `${calc.monthlyTotal}<sup>-X</sup>`);
    setEl('ov-bill4-actual', `${calc.monthlyTotal}<sup>-X</sup>`);
    setEl('ov-bill1-carrier', `${calc.carrierBill1} ✓`);
    setEl('ov-bill2-carrier', `${calc.carrierSubsequent}`);
    setEl('ov-bill3-carrier', `${calc.carrierSubsequent}`);
    setEl('ov-bill4-carrier', `${calc.carrierSubsequent}`);
  }
}

export function resetGenerator() {
  const profile = CARRIER_PROFILES.att;
  genState.carrier = 'att';
  genState.customerName = '';
  genState.phoneNumber = '';
  genState.planCost = profile.planCost;
  genState.deviceRetailMonthly = 0.00;
  genState.deviceMonthlyCredit = 0.00;
  genState.term = profile.term;
  genState.state = 'NH';
  genState.taxes = STATE_TAX_DEFAULTS.NH;
  genState.autopayMethod = profile.autopay;
  genState.dueDateDays = profile.dueDate;
  genState.maskNotices = profile.maskNotices;
  genState.autopayCredit = 10.00;
  genState.actFeeReturned = true;
  genState.nonReimbursed = 0.00;

  syncInputsFromState();
  updatePreview();
}

function syncInputsFromState() {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  const setChecked = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = val;
  };

  setVal('gen-input-name', genState.customerName);
  setVal('gen-input-phone', genState.phoneNumber);
  setVal('gen-input-plan', genState.planCost);
  setVal('gen-input-dev-retail', genState.deviceRetailMonthly || '');
  setVal('gen-input-dev-credit', genState.deviceMonthlyCredit || '');
  setVal('gen-input-term', genState.term);
  setVal('gen-select-state', genState.state);
  setVal('gen-input-taxes', genState.taxes);
  setVal('gen-input-autopay', genState.autopayMethod);
  setVal('gen-input-duedate', genState.dueDateDays);
  setChecked('gen-check-mask-notices', genState.maskNotices);
  setChecked('gen-check-actfee', genState.actFeeReturned);
  setVal('gen-input-nonreimbursed', genState.nonReimbursed || '');
}

export function printGeneratorSheet() {
  document.body.classList.add('printing-generator');
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-generator');
    }, 500);
  }, 100);
}

export function initGeneratorEngine() {
  const bindInput = (id, eventName, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(eventName, handler);
  };

  document.querySelectorAll('.gen-carrier-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const carrier = btn.dataset.carrier;
      if (!carrier) return;
      genState.carrier = carrier;
      const profile = CARRIER_PROFILES[carrier] || CARRIER_PROFILES.att;
      genState.planCost = profile.planCost;
      genState.term = profile.term;
      genState.autopayMethod = profile.autopay;
      genState.dueDateDays = profile.dueDate;
      genState.maskNotices = profile.maskNotices;
      syncInputsFromState();
      updatePreview();
    });
  });

  bindInput('gen-input-name', 'input', (e) => {
    genState.customerName = e.target.value;
    updatePreview();
  });

  bindInput('gen-input-phone', 'input', (e) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    if (raw.length > 6) {
      e.target.value = `${raw.slice(0, 3)} - ${raw.slice(3, 6)} - ${raw.slice(6)}`;
    } else if (raw.length > 3) {
      e.target.value = `${raw.slice(0, 3)} - ${raw.slice(3)}`;
    } else {
      e.target.value = raw;
    }
    genState.phoneNumber = e.target.value;
    updatePreview();
  });

  bindInput('gen-input-plan', 'input', (e) => {
    genState.planCost = parseFloat(e.target.value) || 0;
    updatePreview();
  });

  bindInput('gen-input-dev-retail', 'input', (e) => {
    genState.deviceRetailMonthly = parseFloat(e.target.value) || 0;
    updatePreview();
  });

  bindInput('gen-input-dev-credit', 'input', (e) => {
    genState.deviceMonthlyCredit = parseFloat(e.target.value) || 0;
    updatePreview();
  });

  bindInput('gen-input-term', 'input', (e) => {
    genState.term = e.target.value;
    updatePreview();
  });

  bindInput('gen-check-mask-notices', 'change', (e) => {
    genState.maskNotices = e.target.checked;
    updatePreview();
  });

  bindInput('gen-select-state', 'change', (e) => {
    genState.state = e.target.value;
    genState.taxes = STATE_TAX_DEFAULTS[genState.state] || 8.00;
    const taxesInput = document.getElementById('gen-input-taxes');
    if (taxesInput) taxesInput.value = genState.taxes;
    updatePreview();
  });

  bindInput('gen-input-taxes', 'input', (e) => {
    genState.taxes = parseFloat(e.target.value) || 0;
    updatePreview();
  });

  bindInput('gen-input-autopay', 'input', (e) => {
    genState.autopayMethod = e.target.value;
    updatePreview();
  });

  bindInput('gen-input-duedate', 'input', (e) => {
    genState.dueDateDays = parseInt(e.target.value, 10) || 20;
    updatePreview();
  });

  bindInput('gen-check-actfee', 'change', (e) => {
    genState.actFeeReturned = e.target.checked;
    updatePreview();
  });

  bindInput('gen-input-nonreimbursed', 'input', (e) => {
    genState.nonReimbursed = parseFloat(e.target.value) || 0;
    updatePreview();
  });

  const btnPrint = document.getElementById('btn-gen-print');
  if (btnPrint) btnPrint.addEventListener('click', printGeneratorSheet);

  const btnReset = document.getElementById('btn-gen-reset');
  if (btnReset) btnReset.addEventListener('click', resetGenerator);

  syncInputsFromState();
  updatePreview();
}