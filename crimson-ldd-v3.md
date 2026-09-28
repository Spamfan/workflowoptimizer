# WORKFLOW OPTIMIZER (WFO)
### Prototype Crimson
### Living Design Document (LDD) V3

---

### 1. WATERFALL PROTOCOL

#### The Loop
1. **Sprint Plan (SP):** Scope & target files.  
   *End prompt:* "Reply 'yes' to proceed to Tech Spec."  
2. **Tech Spec (TS):** Functions & logic diffs.  
   *End prompt:* "Reply 'yes' to proceed to Execution."  
3. **Execution:** Code generation to Drive zip.  
   Zero code printed in chat.  

#### Gate Rules
* **Prompted Handshake:** Gates advance *only*  
  in response to an active LLM gate prompt.  
  Unprompted "yes" never advances a gate.  
* **Triggers:** `yes`, `proceed`, `do it`.  
* **Hard Stop:** Halt after every phase.  
  Never combine phases in one turn.  
* **Mobile Wrap:** Break lines manually.  
  Keep lines under 35-40 chars to prevent  
  horizontal clipping.  
* **Scope & Tone:** Bullets only. No fluff.  
  Declare file paths. No unasked refactors.  

---

### 2. INBOUND CHECKS & MEDIA RULES

* **Universal Inbound Check:** Trigger on  
  *any* upload at *any* turn. Inspect file  
  header/version *before* planning/diagnosing.  
* **Stacked Status Tags:** Emoji first:  
  `✅ [MATCH] file.ext`  
  `↳ vX.X.X verified`  
  `⚠️ [STALE] file.ext`  
  `↳ found vX.X.X`  
  `⚠️ [UNKNOWN] file.ext`  
  `↳ not in baseline`  
* **Missing Media Rule:** If PL mentions media  
  ("see attached", "screenshot") and it is  
  not attached, reply ONLY with:  
  `error: you didn't attach media!`  

---

### 3. WORKSPACE & DRIVE ISOLATION

* **Drive Isolation:** The agent is authorized  
  **exclusively** to create files inside the  
  Google Drive folder: `just Gemini stuff`.  
  Touching or modifying anything outside  
  that folder is strictly forbidden.  
* **Zip Delivery:** In Execution, bundle *only*  
  the modified file(s) into a clean zip  
  (`just Gemini stuff/update_vX.X.X.zip`).  
* **Surgical Edits:** Targeted lines only.  
  Unchanged lines must remain byte-for-byte  
  identical.  
* **Execution Sign-Off:** Every delivery turn  
  must conclude with:  
  1. Direct Drive link to the zip.  
  2. List of updated files & new versions.  
  3. Active Manifest Roster showing all modules  
     marked `[UPDATED]` or `[unchanged]`.  

---

### 4. GLOBAL UI & NAVIGATION

* **Palette:** Corporate minimalist.  
  Walmart Blue (`#0071dc`), canvas gray  
  (`#f0f2f5`), white cards (`#ffffff`).  
* **Buttons:** Material 3 pill tokens  
  (`.pill-btn`, `border-radius: 9999px`).  
* **Icons & Feedback:** Inline SVGs only.  
  CSS keyframe spinners on async actions.  
* **4-Way Modal Dismissal:** Close button,  
  backdrop click, `Escape` key, and  
  browser back button/gesture.  
* **History Trapping:** Use `pushState()` on  
  modals and sub-views. `popstate` steps back  
  cleanly without exiting the website.  

---

### 5. HARDWARE & SYSTEM CONSTRAINTS

* **Terminology:** Refer to scanning hardware  
  strictly as "handheld scanner" or  
  "barcode scanner." The word "gun" is  
  prohibited in all UI, comments, and copy.  
* **Cache-Busting Imports:** Submodule imports  
  in `app.js` must pin version query strings:  
  `import { ... } from './sub.js?v=X.X.X'`  
* **WMPC Kiosk:** Optimized for restricted  
  browser kiosk display (1024x768 minimum).  
* **Store Auth:** Passcode is strictly "102030"  
  obfuscated via base64 (atob('MTAyMDMw')).  
  Store number input is deprecated.  

---

### 6. BASELINE FLOOR & FILE TREE

#### Version Floor
* **App (Prototype Crimson):** `v0.1.0`  
* **`app.js`:** `v0.1.0`  
* **`auth.js`:** `v0.1.0`  
* **`print.js`:** `v0.0.4`  
* **`styles.css`:** `v0.1.0`  
* **`index.html`:** `v0.1.0`  

#### File Tree
```text
├── index.html
├── styles.css
├── stats.json
└── js/
    ├── app.js
    ├── auth.js
    └── print.js
```

---

### 7. SUB-SPOKE DIRECTORY & CONTEXT GUARD

When modifying specific subsystems, attach  
the corresponding spec from `docs/`:  
* `docs/auth-spec.md` -> `js/auth.js`, `index.html`  
* `docs/print-spec.md` -> `js/print.js`, `styles.css`  
* `docs/data-spec.md` -> `stats.json`, `js/app.js`  

* **Context Guard:** If a task touches these  
  files and the spec is unattached, the LLM  
  must ask the user to attach it before starting.
