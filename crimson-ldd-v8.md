# WORKFLOW OPTIMIZER (WFO)
### Prototype Crimson
### Living Design Document (LDD) V8

---

### 1. WATERFALL PROTOCOL & DUAL DELIVERY

#### The Loop
1. **Sprint Plan (SP):** Scope & target files.  
   *End prompt:* "Reply 'yes' to proceed to Tech Spec."  
2. **Tech Spec (TS):** Functions & logic diffs.  
   *End prompt:* "Reply 'yes' to proceed to Execution."  
3. **Execution:** Authorized delivery via Mode A or Mode B.  

#### Gate Rules
* **Prompted Handshake:** Gates advance *only*  
  in response to an active LLM gate prompt.  
  Unprompted "yes" never advances a gate.  
* **Triggers:** `yes`, `proceed`, `do it`, `patches`.  
* **Hard Stop:** Halt after every phase.  
  Never combine phases in one turn.  
* **Scope & Tone:** Bullets only. No fluff.  
  Declare file paths. No unasked refactors.  
* **Mobile Wrap (Mode B Only):**  
  In Mode B planning & chat turns, break  
  lines manually (<35-40 chars) to prevent  
  mobile clipping. Mode A (chat planning  
  and patch code blocks) is exempt.  
* **Version Ceiling Guard:** Submodules must  
  remain within pre-1.0 (`v0.x.x`). LLMs are  
  strictly barred from bumping any version  
  to `v1.0.0+` without explicit PL sign-off.  

#### Delivery Pathways (Mode A vs Mode B)

##### Mode A: Traditional Patch Delivery (Chat LLM)
* **Automated Regex Engine Target:** Patches are parsed directly by an automated software patcher. Byte-for-byte fidelity is mandatory. Any whitespace, indentation, or character hallucination causes catastrophic failure.
* **Unified Multi-File Delivery:** Deliver all patches across all modified files in a single unified markdown response.
* **Target File Demarcation:** Every file segment MUST begin with:
  `### TARGET FILE: path/to/file.ext`
* **Strict Sequential Patch Headers:** Explicitly state patch index and total count: `Patch X/Y`.
* **Literal Contiguous Matching (Zero Shortcuts):** Matches are strictly applied via character-by-character regex slices. `Find`, `Find start`, and `Find end` blocks must be uninterrupted, contiguous slices of literal code. Never bridge code with ellipses (`...`, `...and...`, or `// rest of code`).
* **Patch Methods (Standard vs. Range):**
  * **Method 1: Standard Exact Match (1–15 lines):** Replaces exact matching block using `Find` and `Replace with`.
  * **Method 2: Range Match with Spatial Anchors (Refactoring large blocks):**
    * **Engine Cursor Mechanics:** The patcher locates `Find start`, sets search pointer to `cursor = start_match.index + start_match.length`, and searches forward for `Find end`. Replaces `[start_match.start() ... end_match.end()]` inclusive.
    * **Zero-Intersection Rule:** `Find end` must exist strictly downstream of `Find start`. `Find end` (and any substring thereof) must NEVER appear inside `Find start`.
    * **Minimal Boundary Span (2–4 Lines Mandate):** `Find start` and `Find end` are spatial boundary anchors only, NOT code payloads. Each anchor must be strictly 2–4 unique lines. NEVER paste the replacement body inside `Find start`.
* **Post-Patch Manifest Declaration:** Every delivery must conclude with:
  1. Target declaration: `These edits apply to: [list]`
  2. Updated files & versions list.
  3. Active Manifest Roster marked `[UPDATED]` or `[unchanged]`.

###### Mode A Template Reference

*Sample Standard Patch Format:*
```
Patch 1/2
Find
` ` `html
<div class="old-header">Old Header</div>
` ` `
Replace with
` ` `html
<div class="new-header">New Header</div>
` ` `
```

*Sample Range Patch Format:*
```
Patch 2/2
Find start
` ` `html
<div class="card-container">
` ` `
Find end
` ` `html
</div><!-- end card -->
` ` `
Replace with
` ` `html
<div class="card-container">
    <p>New Card Content</p>
</div><!-- end card -->
```

*Sample Multi-File Demarcation:*
```
### TARGET FILE: styles.css

Patch 1/1
Find
...
Replace with
...

### TARGET FILE: js/app.js

Patch 1/1
Find start
...
Find end
...
Replace with
...
```

##### Mode B: Spark Agent (Workspace & Drive)
* **Zero Chat Patches:** Mode A and Mode B are mutually exclusive. Zero code patches, blocks, or full file dumps in chat.
* **Workspace Execution:** Synthesize files directly in sandbox; validate headlessly (`node --input-type=module -c`).
* **Google Drive Isolation Boundary:** Restricted **strictly** to folder `just Gemini stuff`. Never mutate anything outside.
* **Zip Deliverable:** Package modified files into `just Gemini stuff/update_vX.X.X.zip`.
* **Chat Output Limits:** Restricted strictly to direct Drive link, test status, and Manifest Roster.

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

### 3. WORKSPACE, DRIVE & EXECUTION SIGN-OFF

* **Drive Isolation (Mode B Only):** The agent  
  is authorized **exclusively** to create files  
  inside the Google Drive folder: `just Gemini stuff`.  
  Touching or modifying anything outside is forbidden.  
* **Surgical Edits:** Targeted lines only.  
  Unchanged lines must remain byte-for-byte  
  identical across both delivery modes.  
* **Execution Sign-Off Requirements:**  
  * Every delivery turn must conclude with:  
    1. Target file declaration: `These edits apply to: [list]`  
    2. List of updated files & bumped versions.  
    3. Mode A: Applied patches ready for extraction.  
       Mode B: Direct Drive link to `update_vX.X.X.zip`.  
    4. Active Manifest Roster showing all modules marked:  
       `[UPDATED]`, `[unchanged]`, or `[unchanged - floor]`.  

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
* **Cache-Busting & Downstream Ripple Mandate:**  
  Submodule imports in `app.js` must pin version  
  query strings (`import { ... } from './sub.js?v=X.X.X'`).  
  Any version bump to a submodule (`auth.js`, `print.js`)  
  or stylesheet (`styles.css`) strictly mandates  
  updating downstream query strings in `js/app.js`  
  and `index.html`. Both downstream consumers  
  must be included in the sprint whenever any  
  submodule or stylesheet bumps.  
* **WMPC Kiosk:** Optimized for restricted  
  browser kiosk display (1024x768 minimum).  
* **Store Auth:** Passcode is strictly "102030"  
  obfuscated via base64 (atob('MTAyMDMw')).  
  Store number input is deprecated; report  
  state and overrides persist via unified storage.  
* **Data Ordering:** Catalog devices in `stats.json`,  
  print engine tables, and inventory editing tools  
  must maintain strict alphabetical ordering by  
  full intake `name` (not display abbreviations).  

---

### 6. BASELINE FLOOR & FILE TREE

#### Version Floor
* **App (Prototype Crimson):** `v0.1.6`  
* **`app.js`:** `v0.1.6`  
* **`auth.js`:** `v0.1.0`  
* **`print.js`:** `v0.1.8`  
* **`styles.css`:** `v0.1.4`  
* **`index.html`:** `v0.1.6`  

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

* **Context Guard & Consumer Intake:** If a task  
  touches these files and the spec is unattached,  
  the LLM must ask the user to attach it before starting.  
  Furthermore, whenever a sub-spoke bump occurs,  
  the LLM must explicitly mandate the intake upload of  
  `js/app.js` and `index.html` during the intake turn  
  to guarantee end-to-end cache busting.  
