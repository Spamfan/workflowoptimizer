# CATALOG & INSTALLMENT MANAGER SPECIFICATION
### Target Files: `js-manager.js`, `index.html`, `styles.css`

---

### 1. ACCESS & DEV GATING
* **Dev Gating:** Access strictly requires `crimson_dev_mode === 'true'`.  
* **Dashboard Trigger:** Accessed via `#btn-manage-reports` in  
  Dashboard View, switching active view to `#manager-view`.  
* **Navigation:** Top nav back button cleanly returns to `#dashboard-view`.  

---

### 2. CLOUD PUBLISHER & GITHUB REST COMMIT FLOW
* **Direct Commit API:** Overwrites `data-stats.json` directly via  
  `PUT https://api.github.com/repos/{owner}/{repo}/contents/data-stats.json`.  
* **Authentication:** Authenticates with GitHub fine-grained PAT stored  
  in `localStorage['crimson_gh_config']` (`{ owner, repo, branch, token }`).  
  UI renders token as password input; Base64-obfuscated in storage.  
* **Sequence:** (1) GET current `sha` and ref -> (2) Canonical alphabetical  
  sort by `dev.name` -> (3) Safe Base64 encoding -> (4) PUT commit payload.  
* **Cloud Status Pill:** M3 capsule indicator transitions: `☁️ Connect GitHub`  
  (missing PAT) -> `☁️ Synced` (idle) -> `☁️ [N] Pending` (dirty rows) ->  
  `☁️ Committing...` -> `✓ Committed` (4s auto-fade). Clicking pill opens  
  settings modal. Supports both bulk commit and individual row-level commit.  

---

### 3. CARRIER EXCLUSIVITY & AVAILABILITY
* **Carrier Toggles:** Each device row has toggles for ATT, VZW, TMO.  
* **Disabled State:** Toggling carrier OFF sets pricing keys to `null`  
  (`attMO: null`, `vzwMO: null`, `tmoDP: null, tmoMOADP: null, tmoMO: null`).  
  `js-print.js` automatically purges `null` devices from carrier tables.  
* **Active State:** Toggling carrier ON re-enables inputs and restores pricing.  
* **BIC Drawer & Add Device:** Expandable row drawer exposes `attBIC`, `vzwBIC`,  
  and `tmoBIC`. Add Device modal slugifies name into key and initializes defaults.  

---

### 4. MATH LOGIC & 4-WAY LOCK SOLVER
* **AT&T / Verizon (36 mo):** Total is anchor ($Total = MO \times 36$, $MO = Total / 36$).  
* **T-Mobile (24 mo):** $Total = DP + (MOADP \times 24)$, $MO = Total / 24$.  
* **Locks:** 🔒/🔓 buttons lock fields during editing to solve counterpart.  
* **Validation:** Amber alert icon triggers if $|Total - (DP + (MOADP \times 24))| > 0.24$.