// Prototype Crimson - docs.js (v0.1.1)
// Static Document & Guide Print Engine

export const DOCS_VERSION = "v0.1.1";

const DOC_REGISTRY = [
  {
    id: 'takehome',
    title: 'Take Home Sheet',
    img: 'ths3-1.png',
    hasTutorial: true,
    locked: false
  },
  {
    id: 'intake',
    title: 'Postpaid Intake Sheet',
    img: 'postpaid-IS.png',
    hasTutorial: false,
    locked: false
  },
  {
    id: 'prepaidintake',
    title: 'Prepaid Intake Sheet',
    img: 'prepaid-IS.png',
    hasTutorial: false,
    locked: false
  },
  {
    id: 'warpcalls',
    title: 'Guide for WARP calls',
    img: 'https://i.imgur.com/0YAC03J.png',
    hasTutorial: false,
    locked: false
  },
  {
    id: 'vzwtrade',
    title: 'Verizon Trade in Guide',
    img: 'https://i.imgur.com/1vBTDLU.png',
    hasTutorial: false,
    locked: true,
    modalId: 'vzw-trade-warning-modal'
  },
  {
    id: 'iphonetransfer',
    title: 'iPhone transfer guide',
    img: 'https://i.imgur.com/TVFeWTr.png',
    hasTutorial: false,
    locked: true,
    modalId: 'iphone-transfer-warning-modal'
  },
  {
    id: 'scrappaper',
    title: 'Scrap Paper (cutting guide)',
    img: 'scrap-paper.png',
    hasTutorial: false,
    locked: false
  }
];

const TUTORIAL_IMAGES = {
  att: 'https://i.imgur.com/BnLTk4j.png',
  vzw: 'https://i.imgur.com/cmEg0MT.png',
  tmo: 'https://i.imgur.com/5DQ22AB.png'
};

export function cleanupPrint() {
  document.body.className = document.body.className.replace(/\bprinting-\S+/g, '').trim();
  window.removeEventListener('click', cleanupPrint, true);
  window.removeEventListener('touchstart', cleanupPrint, true);
}

export function openDocModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.display = 'flex';
  history.pushState({ modalId: modalEl.id }, '', '');
}

export function closeDocModal(modalEl) {
  if (!modalEl || modalEl.style.display === 'none') return;
  modalEl.style.display = 'none';
  if (history.state && history.state.modalId === modalEl.id) {
    history.back();
  }
}

export function printDoc(docId) {
  cleanupPrint();
  document.body.classList.add(`printing-${docId}`);
  setTimeout(() => {
    window.print();
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.addEventListener('click', cleanupPrint, true);
        window.addEventListener('touchstart', cleanupPrint, true);
      }, 500);
    });
  }, 100);
}

export function renderDocsGrid() {
  const container = document.getElementById('docs-cards-container');
  if (!container) return;

  container.innerHTML = DOC_REGISTRY.map(doc => `
    <div class="doc-card-wrapper">
      <div class="doc-action-card ${doc.locked ? 'is-locked' : ''}" data-doc-id="${doc.id}" tabindex="0" role="button" aria-label="Print ${doc.title}">
        <div class="doc-preview-stage">
          <img src="${doc.img}" alt="${doc.title}" class="doc-preview-img" loading="lazy">
        </div>
        <div class="doc-card-overlay">
          <div class="doc-card-title">${doc.title}</div>
        </div>
        ${doc.locked ? '<div class="doc-lock-indicator" title="Unfinished document caution">⚠️</div>' : ''}
      </div>
      ${doc.hasTutorial ? '<button type="button" class="pill-btn btn-doc-tutorial" id="btn-tut-ths">How to use this sheet</button>' : ''}
    </div>
  `).join('');

  container.querySelectorAll('.doc-action-card').forEach(card => {
    card.addEventListener('click', () => {
      const docId = card.getAttribute('data-doc-id');
      handleDocSelection(docId);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });

  const btnTut = document.getElementById('btn-tut-ths');
  if (btnTut) {
    btnTut.addEventListener('click', () => {
      openTutorialModal();
    });
  }
}

function handleDocSelection(docId) {
  const item = DOC_REGISTRY.find(d => d.id === docId);
  if (!item) return;

  if (item.locked && item.modalId) {
    const modal = document.getElementById(item.modalId);
    if (modal) {
      openDocModal(modal);
    }
    return;
  }

  printDoc(docId);
}

function initDocContainers() {
  DOC_REGISTRY.forEach(doc => {
    const container = document.getElementById(`doc-${doc.id}`);
    if (container) {
      container.innerHTML = `<div class="doc-page"><img src="${doc.img}" alt="${doc.title}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; z-index: 1;"></div>`;
    }
  });
}

function openTutorialModal() {
  const tutModal = document.getElementById('doc-tutorial-modal');
  if (!tutModal) return;
  setTutorialCarrier('att');
  openDocModal(tutModal);
}

function setTutorialCarrier(carrier) {
  const tutImg = document.getElementById('tut-example-img');
  if (tutImg && TUTORIAL_IMAGES[carrier]) {
    tutImg.src = TUTORIAL_IMAGES[carrier];
  }
  const tabs = document.querySelectorAll('.tut-tab-btn');
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-carrier') === carrier);
  });
}

export function initDocsEngine() {
  initDocContainers();
  renderDocsGrid();

  const vzwModal = document.getElementById('vzw-trade-warning-modal');
  const btnVzwCancel = document.getElementById('btn-vzwtrade-cancel');
  const btnVzwShow = document.getElementById('btn-vzwtrade-show');

  if (btnVzwCancel && vzwModal) {
    btnVzwCancel.addEventListener('click', () => {
      closeDocModal(vzwModal);
    });
  }
  if (btnVzwShow && vzwModal) {
    btnVzwShow.addEventListener('click', () => {
      closeDocModal(vzwModal);
      const item = DOC_REGISTRY.find(d => d.id === 'vzwtrade');
      if (item) item.locked = false;
      const card = document.querySelector('.doc-action-card[data-doc-id="vzwtrade"]');
      if (card) {
        card.classList.remove('is-locked');
        const ind = card.querySelector('.doc-lock-indicator');
        if (ind) ind.remove();
      }
      printDoc('vzwtrade');
    });
  }
  if (vzwModal) {
    vzwModal.addEventListener('click', (e) => {
      if (e.target === vzwModal) closeDocModal(vzwModal);
    });
  }

  const iphoneModal = document.getElementById('iphone-transfer-warning-modal');
  const btnIphoneCancel = document.getElementById('btn-iphonetransfer-cancel');
  const btnIphoneShow = document.getElementById('btn-iphonetransfer-show');

  if (btnIphoneCancel && iphoneModal) {
    btnIphoneCancel.addEventListener('click', () => {
      closeDocModal(iphoneModal);
    });
  }
  if (btnIphoneShow && iphoneModal) {
    btnIphoneShow.addEventListener('click', () => {
      closeDocModal(iphoneModal);
      const item = DOC_REGISTRY.find(d => d.id === 'iphonetransfer');
      if (item) item.locked = false;
      const card = document.querySelector('.doc-action-card[data-doc-id="iphonetransfer"]');
      if (card) {
        card.classList.remove('is-locked');
        const ind = card.querySelector('.doc-lock-indicator');
        if (ind) ind.remove();
      }
      printDoc('iphonetransfer');
    });
  }
  if (iphoneModal) {
    iphoneModal.addEventListener('click', (e) => {
      if (e.target === iphoneModal) closeDocModal(iphoneModal);
    });
  }

  const tutModal = document.getElementById('doc-tutorial-modal');
  const btnTutClose = document.getElementById('btn-tut-close');
  const btnTutPrint = document.getElementById('btn-tut-print');

  if (btnTutClose && tutModal) {
    btnTutClose.addEventListener('click', () => {
      closeDocModal(tutModal);
    });
  }
  if (btnTutPrint && tutModal) {
    btnTutPrint.addEventListener('click', () => {
      closeDocModal(tutModal);
      printDoc('takehome');
    });
  }
  if (tutModal) {
    tutModal.addEventListener('click', (e) => {
      if (e.target === tutModal) closeDocModal(tutModal);
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDocModal(vzwModal);
      closeDocModal(iphoneModal);
      closeDocModal(tutModal);
    }
  });

  const tabs = document.querySelectorAll('.tut-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const carrier = tab.getAttribute('data-carrier');
      if (carrier) setTutorialCarrier(carrier);
    });
  });
}