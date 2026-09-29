# AUTH & SESSION SPECIFICATION
### Target Files: `js/auth.js`, `index.html`

---

### 1. CREDENTIAL LOGIC
* **Passcode Rule:** Valid authentication strictly requires  
  passcode `102030` obfuscated via base64 (`atob('MTAyMDMw')`).  
* **Store Number:** Store entry is deprecated and no longer  
  required for login.  
* **Validation:** Immediate client-side verification  
  against entered passcode.  

---

### 2. SESSION STORAGE
* **Store Prefill:** `localStorage['wfo_store']` retained  
  for legacy compatibility only.  
* **Session Persistence:** Authenticated passcode saves in  
  `sessionStorage['wfo_session_pin']`.  
* **Session Lifecycle:** Refreshes maintain login;  
  closing the tab or clicking "Log Out" clears session.  

---

### 3. UI ARCHITECTURE
* **Login Shell:** Centered elevated card (`#login-view`)  
  declared statically inside `index.html`.  
* **Card Copy:** Title prompts "Please enter your optimizer  
  passcode to proceed." followed by non-bold terms disclaimer.  
* **Input & Feedback:** Single 6-digit passcode field;  
  inline error alert if invalid; auto-submit on 6 digits.  
* **Terms of Use Modal:** Centered overlay card  
  (`#terms-modal`) informing that terms are pending,  
  with standard acknowledgement button.  
* **Universal 4-Way Dismissal:** All modals dismiss  
  via close button, backdrop click, Escape key,  
  and browser history back gesture.  
