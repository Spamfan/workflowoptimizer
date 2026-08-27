/**
 * Workflow Optimizer (WFO) - Orchestrator
 * Version: 0.1.0
 * Architecture: 100% Vanilla ES6 Decoupled Slot Mounting
 */

import { printsModule } from './prints.js';

class WorkspaceOrchestrator {
  constructor() {
    this.modules = [
      printsModule,
      this.createPlaceholderModule('optimizer', 'slot-optimizer', 'Optimizer Engine', 'Data merge, inventory parser & carrier pricing.'),
      this.createPlaceholderModule('scanner', 'slot-scanner', 'IRIS Scanner', 'Camera OCR, homography crop & direct encryption.'),
      this.createPlaceholderModule('im', 'slot-im', 'Installment Manager', 'Bill calculation anchor engine & customer take-home sheets.')
    ];
  }

  /**
   * Initializes workspace, mounts modules, and binds global events
   */
  init() {
    console.log('[WFO Orchestrator] Initializing workspace modules...');
    this.mountModules();
    this.bindGlobalEvents();
  }

  /**
   * Safely mounts registered modules into their respective DOM slots
   */
  mountModules() {
    this.modules.forEach(module => {
      const slotElement = document.getElementById(module.slotId);
      if (!slotElement) {
        console.warn(`[WFO Orchestrator] Target slot "${module.slotId}" not found for module "${module.id}".`);
        return;
      }

      try {
        module.mount(slotElement);
      } catch (err) {
        console.error(`[WFO Orchestrator] Failed to mount module "${module.id}":`, err);
        slotElement.innerHTML = `
          <div class="wfo-card">
            <div class="wfo-card-body">
              <span style="color: var(--md-sys-color-error); font-weight: 600;">
                ❌ Error mounting ${module.id} module.
              </span>
            </div>
          </div>
        `;
      }
    });
  }

  /**
   * Global event bindings (Settings, Global Shortcuts)
   */
  bindGlobalEvents() {
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => {
        this.showToast('⚙️ Settings & Token configuration coming in next sprint.', 'info');
      });
    }
  }

  /**
   * Generates a placeholder module definition for upcoming sprint features
   */
  createPlaceholderModule(id, slotId, title, description) {
    return {
      id,
      slotId,
      mount: (container) => {
        container.innerHTML = `
          <div class="wfo-placeholder-card">
            <div style="font-size: 1.75rem; opacity: 0.7;">📦</div>
            <h3>${title}</h3>
            <p>${description}</p>
            <span class="wfo-badge" style="background: #E2E8F0; color: #475569; margin-top: 0.25rem;">
              Upcoming Phase
            </span>
          </div>
        `;
      }
    };
  }

  /**
   * Non-blocking Material 3 toast notification service
   */
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('wfo-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'wfo-toast';
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }
}

// Instantiate and expose orchestrator instance
export const app = new WorkspaceOrchestrator();

// Bootstrap application on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}
