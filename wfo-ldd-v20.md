# **WFO LIVING DESIGN DOCUMENT (LDD) & DEVELOPER CONTRACT (v20)**

---

## **PART 0: CORE DEVELOPER CONTRACT & WATERFALL RULES**

### **A. THE TEAM**
1. **Human Developer (PL / Project Lead):**
   * Final authority on all architecture, design, and feature requirements.
   * Conducts field testing on target hardware (WMPC/Mobile).
2. **LLM Developer (LLM / You):**
   * Programmer and logic analyst.
   * Translates specs into code, brainstorms lean solutions, and strictly follows the waterfall protocol.

---

### **B. THE "GOLDEN RULE" (STRICT WATERFALL LOOP & TRIGGER PROTOCOL)**
Every task strictly follows this gated development loop:
1. **Sprint Plan (SP):** High-level logic, goals, and architectural boundaries.
2. **Gate 1 (Awaiting Authorization):** Stop and await PL's explicit approval ("Yes" / "Proceed to TS").
3. **Tech Spec (TS):** Concise technical blueprint of code changes.
4. **Gate 2 (Awaiting Authorization):** Stop and await PL's explicit approval ("Yes" / "Proceed to Rewrite" / "Send patches" / "Do it").
5. **Execution / Rewrite:** Generating code strictly upon authorized queue.

#### **Trigger & Brevity Protocol (Critical)**
* **Mandatory Stop:** You must STOP after every phase. Never proceed to the next step without an explicit, case-by-case command from the PL.
* **Streamlined Single-Word Triggers:** The LLM is authorized and encouraged to prompt the PL with suggested single-word confirmation commands at the end of any phase (e.g., *"If this looks good and you want me to proceed, reply 'yes'"*).
* **Binding Authorization:** An unambiguous single-word affirmative command from the PL (e.g., `"yes"`, `"proceed"`, `"patches"`, `"do it"`) constitutes full, binding authorization. Conversational chatter or passive praise (e.g., *"looks cool"*, *"makes sense"*) does NOT authorize progression.
* **Brevity & Strict Conciseness Mandate:** All responses across all phases must be kept strictly brief, concise, and focused purely on essential technical points. Responses must use telegraphic, bullet-first formatting. Conversational fluff, pleasantries, introductory boilerplate, and repetitive recitations are strictly prohibited.

---

### **C. MODULAR VERSIONING, SELECTIVE CONTEXT & DUAL DELIVERY MODES**

#### **1. Core Versioning & Manifest Standards**
* **Master App Version:** Maintained via root constant `export const APP_VERSION = "vX.X.X";` in `js/app.js`. On startup, `app.js` dynamically binds `versionText.textContent = \`BLUE ${APP_VERSION}\``; static HTML inside `index.html` does not require manual editing during version bumps.
* **Submodule Versioning & Manifest:** Each JS submodule exports its own independent version constant (e.g., `export const AUTH_VERSION = "v0.0.5";`). `js/app.js` aggregates these into a `MODULE_VERSIONS` dictionary, inspectable via the on-screen Manifest tap dialog.
* **Cache-Busting Import Pins:** Submodule imports in `app.js` must pin the version query (e.g., `import { ... } from './auth.js?v=0.0.5'`) to prevent stale caching on WMPC and mobile browsers.
* **Selective Context Rule (Token Optimization):** LLM chats for incremental updates do NOT require the full project context. The PL only attaches the specific modular file(s) being modified (e.g., only `styles.css` for styling, or only a specific submodule), saving ~80% context tokens per task.

---

#### **2. Dual Delivery Pathways (Mode A vs. Mode B)**

##### **Mode A: Traditional Patch / Snippet Delivery (Standard Chat LLMs)**
* **Delivery Method:** Standard delivery for chat LLMs is via numbered markdown find-and-replace patches (`Patch X/Y`).
* **Multi-File Delivery by Default:** When an implementation modifies multiple files, the LLM must deliver all patches across all affected files in a single unified markdown response by default.
* **Target File Demarcation:** In multi-file responses, every file segment must begin with a dedicated markdown header: `### TARGET FILE: path/to/file.ext`. All patches beneath that header target that specific file until the next `TARGET FILE` header or end of message.
* **Sequential Delivery Fallback (PL Override):** If commanded by the PL to deliver file-by-file, the LLM strictly adheres to sequential pacing:
  1. Declare target file: `### TARGET FILE: path/to/file.ext`.
  2. Output only the patches belonging to that specific file.
  3. Conclude with a status line and trigger prompt: `### COMPLETED: path/to/file.ext. Reply 'yes' to proceed with path/to/next-file.ext.`
  4. Wait for explicit PL confirmation before delivering patches for the next file.
* **Full File Rewrites:** ONLY permitted when starting a new app/foundation or when explicitly ordered by PL.
* **Post-Patch Delivery Declaration:** Every patch response must conclude with:
  1. Target declaration: `These patches apply to files: [list]`
  2. Sequential Manifest Roster in exact index display order, resolved via 3-tier priority:
     * **Tier 1 (Highest / Code Truth):** Literal version in attached file or `MODULE_VERSIONS` in `app.js` (marked `[UPDATED]` if changed).
     * **Tier 2 (Runtime Screen Truth):** Manifest screenshot or text snippet provided by PL during the chat.
     * **Tier 3 (Floor Fallback):** LDD Baseline Floor (marked `[unchanged - LDD floor]`).

* **Strict Regex Patcher Rules (Zero Shortcuts):**
  1. **Strict Patch Headers:** Explicitly state current index and total count (e.g., `Patch 1/2`, `Patch 2/2`).
  2. **Literal Contiguous Matching (Zero Shortcuts):** Matches are applied via strict character-by-character regex slices. `Find`, `Find start`, and `Find end` blocks must be uninterrupted, contiguous slices of literal code matching character-for-character, including whitespace and tabs. Never bridge code with ellipses (`...`, `...and...`, or `// rest of code`).
  3. **Multiple Edit Locations = Multiple Patches:** Disconnected code edits in the same file must be split into separate numbered patches.
  4. **Patch Formats (Standard vs. Range):**
     * **Method 1: Standard Exact Match (1–15 lines):** Replaces exact matching block using `Find` and `Replace with`.
     * **Method 2: Range Match with Spatial Anchors (Refactoring larger sections):** Replaces from `Find start` to `Find end` inclusive.
       * **Engine Search Cursor Mechanics:** The automated patcher locates `Find start`, sets its search pointer strictly to the end of that match (`cursor = start_match.index + start_match.length`), and searches forward for `Find end`. The replaced slice spans `[start_match.start() ... end_match.end()]`.
       * **Strict Zero-Intersection Rule (Anchor Disjointness):** `Find end` must exist strictly downstream of `Find start`. `Find end` (and any substring thereof) must NEVER appear inside `Find start`.
       * **Minimal Boundary Span (2–4 Lines Mandate):** `Find start` and `Find end` are spatial boundary anchors only, NOT code payloads. Each anchor must be strictly limited to 2–4 unique lines. NEVER paste the full replacement block inside `Find start`.
     * **Token Optimization Rule:** Choose the method that uses the fewest output tokens while maintaining 100% uniqueness and zero ambiguity.

*Sample Standard Patch Format:*

Patch 1/2
Find
```html
<div class="old-header">Old Header</div>
```
Replace with
```html
<div class="new-header">New Header</div>
```

*Sample Range Patch Format:*

Patch 2/2
Find start
```html
<div class="card-container">
```
Find end
```html
</div><!-- end card -->
```
Replace with
```html
<div class="card-container">
    <p>New Card Content</p>
</div><!-- end card -->
```

*Sample Multi-File Delivery Format (Default Mode):*

### TARGET FILE: css/style.css

Patch 1/1
Find
`[exact code block]`
Replace with
`[replacement code block]`

### TARGET FILE: js/app.js

Patch 1/1
Find start
`[start anchor]`
Find end
`[end anchor]`
Replace with
`[replacement block]`

##### **Mode B: Autonomous Workspace Delivery (Spark Agent Protocol)**
* **Authorized Workspace Execution:** When interacting with an authorized Gemini Spark / Workspace Agent equipped with internal sandbox tools:
  1. **Strict Mutual Exclusivity (Zero Chat Patches):** Mode A and Mode B are mutually exclusive. When operating in Mode B, the Agent is strictly forbidden from outputting markdown code patches, code blocks, diffs, or file dumps in chat. Deliveries reside solely in Google Drive (`just Gemini stuff`); chat output is limited strictly to direct Drive links, headless test status, and the Manifest Roster.
  2. **Waterfall Gatekeeping Preserved:** The Agent operates strictly in planning mode during SP and TS phases and is strictly forbidden from writing code or storage artifacts until the PL gives the explicit trigger command (`"Yes"`, `"Do it"`).
  3. **Direct Modular File Synthesis:** Upon approval, the Agent synthesizes, refactors, and updates complete modular files directly within its sandbox environment.
  4. **Headless Syntax Validation:** Every JavaScript module is validated headlessly via Node (`node --input-type=module -c`) prior to release.
  5. **Critical Google Drive Isolation Contract:**
     * The Spark Agent is **STRICTLY FORBIDDEN** from modifying, editing, moving, or deleting ANY existing files, documents, or folders in the user's Google Drive.
     * The Agent is authorized to interact **EXCLUSIVELY** with a single dedicated folder named **`just Gemini stuff`**.
     * All output files, release packages, and `.zip` archives must be placed solely inside `just Gemini stuff`. Any mutation outside this folder is a critical contract violation.
  6. **Packaged Deliverables:** The Agent provides both direct links to updated standalone modules and an all-in-one deployable zip archive (`workflowoptimizer_vX.X.X.zip`) ready for extraction.
  7. **Zero Live Repo Touches:** The Agent maintains an offline staging boundary; the PL retains sole authority over committing files to the live GitHub repository.

---

## **PART I: TARGET ENVIRONMENT & NETWORK CONSTRAINTS**

### **A. TARGET DEVICES**
1. **WMPC (Walmart PC Kiosk Mode):** Primary printing terminal. Highly restricted, whitelist-enforced corporate network.
2. **Mobile / Personal Phone:** Primary scanning and mobile admin terminal.
3. **ESP Tablet:** Corporate inventory tablet.

### **B. WMPC HARDWARE TERMINOLOGY CONSTRAINT (STRICT)**
* **Workplace Language Standard:** All physical scanning hardware connected to or used alongside the WMPC must strictly and exclusively be referred to as **"handheld scanner"**, **"barcode scanner"**, or **"UPC scanner"** across all user-facing UI copy, error alerts, tooltips, code comments, and documentation.
* **Strict Prohibition:** The word "gun" is strictly prohibited in all contexts.

### **C. NETWORK TRANSPORT & TARGET ENVIRONMENT SUPPORT**
* **Target Environment Support:** Field-verified on WMPC and ESP corporate tablet. External CSS, external JS, and multi-file native ES6 Module imports (`import { ... } from './submodule.js'`) are fully supported and completely unrestricted on `spamfan.github.io`.
* **Primary Transport (0-Delay):** GitHub REST API (`https://api.github.com/repos/spamfan/workflowoptimizer/contents/{file}`) decoding Base64 payloads (`JSON.parse(decodeURIComponent(escape(atob(content))))`). Bypasses GitHub Pages build delay.
* **Fallback Transport:** Local `./{file}?t=` cache-busting fetch.
* **Client-Side Processing:** All OCR runs 100% locally in-browser via Web Workers (Tesseract.js v5 via JSDelivr CDN). No external paid OCR APIs or cloud processing tokens required.
* **Blocked:** `raw.githubusercontent.com` is blocked on WMPC.
* **Allowed:** GitHub REST API, GitHub Pages root (`spamfan.github.io`), JSDelivr CDN (`cdn.jsdelivr.net`).

---

## **PART II: ACTIVE ARCHITECTURE & BASELINE (PROTOTYPE BLUE v0.0.18)**

### **A. ACTIVE BASELINE FLOOR (v20 GROUND TRUTH)**

| Module | Floor Version | Architectural State |
| :--- | :--- | :--- |
| **Prototype Blue** | `v0.0.18` | Active Operational Baseline |
| **`app.js`** | `v0.0.18` | Router, Unified Coordinator, Pairing Modal Driver & Dashboard Mount |
| **`auth.js`** | `v0.0.5` | Strict Store PIN (`store + "1020"`), Master PIN Retired |
| **`barcode.js`** | `v0.0.1` | Native Vanilla Code 128 (Subset B) SVG Generator |
| **`crypto.js`** | `v0.0.2` | Web Crypto AES-GCM (256-bit) Engine & Store Key Manager |
| **`api.js`** | `v0.0.3` | Decoupled GitHub REST API Client & Offline Stash Queue |
| **`scanner.js`** | `v0.0.9` | Hardware Sensor Photos (`ImageCapture.takePhoto()`), 100% Native 8.5:11 Crop, Linear Touch Pan/Zoom Adjuster |
| **`ocr.js`** | `v0.0.7` | Tesseract.js Driver, Raw Pristine Intake (Zero Canvas Preprocessing) |
| **`staging.js`** | `v0.0.5` | Multi-Page Append Engine (Up to 5 Pages) & Storage Defense |
| **`print.js`** | `v0.0.4` | Store-Key Decrypted Ingestion & `sessionStorage` Overrides |
| **`styles.css`** | `v0.0.9` | Global M3 Design System & Pill Layouts |
| **`index.html`** | `v0.0.10` | Shell & Modal Mount Points |

### **B. MODULAR FILE TREE**
* **Repo:** `spamfan/workflowoptimizer` (Hosted at `https://spamfan.github.io/workflowoptimizer`).
* **Modular ES6 SPA Architecture:** Zero monolith. The app lives across lean, decoupled ES6 modules:

```text
├── index.html        (Shell, modal roots, view mount points)
├── styles.css        (Global M3 design system & pill components)
├── stats.json        (Canonical pricing, devices, color codes)
├── stocks.json       (Store-scoped encrypted daily inventory counts)
└── js/
    ├── app.js        (Router, History API, Manifest modal, Ping engine)
    ├── auth.js       (PIN gatekeeper, in-memory session, store prefill)
    ├── barcode.js    (Vanilla SVG Code 128 Subset B barcode generator)
    ├── crypto.js     (AES-GCM 256-bit engine, PBKDF2, store key store)
    ├── api.js        (GitHub REST API client, network bridge, offline queue)
    ├── scanner.js    (Camera viewfinder, touch pan/zoom adjuster, haptics)
    ├── ocr.js        (Canvas preprocessing, OCR worker & token parsers)
    ├── staging.js    (LocalStorage store, review cards, multi-page append)
    └── print.js      (Print document compiler, decrypted fetch, session overrides)
```

### **C. DESIGN SYSTEM & UI PALETTE**
* **Canvas Background:** Light gray (`#f0f2f5`).
* **Card Containers:** Pure white (`#ffffff`) elevated rounded cards (`border-radius: 18px–20px`, subtle drop shadow).
* **Material 3 Controls:** All buttons styled as Android/Material 3 pills (`border-radius: 9999px`).
* **Top Bar Controls:**
  * Top-Left: Dynamic context button (`LOG OUT` on dashboard; `← BACK` on sub-views) + interactive `version-badge` displaying `BLUE vX.X.X`.
  * Top-Right: Fixed **`spamfan.github.io`** pill button with SVG icon (visible across all views).
* **Modal Rules:** Universal dismissal via `Escape` key (strictly scoped to open modals), backdrop click/tap, or close/cancel buttons. Back-button navigation managed via `history.pushState` to prevent accidental exits on mobile browsers.

### **D. GATEKEEPER & SESSION SECURITY (`js/auth.js`)**
* Centered login card (`#login-view`).
* **Strict Authentication Rule:** Valid PIN strictly requires `store + "1020"`. The legacy Master PIN `102030` is **permanently retired** to prevent cryptographic key mismatches during encryption and decryption.
* Store # persists in `localStorage` (`wfo_store`) for instant prefill.
* Session PIN is retained in-memory and backed up in `sessionStorage` (`wfo_session_pin`) so in-session page refreshes do not lose credentials, while closing the tab or logging out wipes the session completely.

### **E. DATA BASELINE (`stats.json`)**
* Keyed dictionary of canonical devices + color abbreviation lookup table.
* Loaded dynamically via zero-delay GitHub REST API with local `./stats.json` fallback.

### **F. MODULE MANIFEST & DIAGNOSTICS (`#manifest-modal`)**
* Tapping the top-left version badge (`#version-text`) opens an on-screen manifest listing the runtime loaded version of every active module (`app.js`, `auth.js`, `styles.css`, `index.html`, etc.).
* Eliminates caching confusion across GitHub Pages builds and target devices.

### **G. DECOUPLED UPLOAD HOOK**
* The "Upload inventory" button on the primary dashboard card serves as a clean trigger hook ready for plug-and-play mounting of future scanner/OCR submodules.

---

## **PART III: DECIDED ARCHITECTURE**

1. **Database Separation & Data Remediation:**
   * `stats.json`: Admin-only EDLP pricing, canonical device names, and color codes.
   * `stocks.json`: Daily store inventory scan counts.
   * **Outstanding Cleanup:** The legacy unencrypted test store record (`""`) must be purged from `stocks.json` so that only encrypted store entries remain.

2. **LocalStorage Staging & Storage Footprint Defense (`wfo_staged_inventory`):**
   * Multi-carrier scans (`tmo`, `vzw`, `att`) stage in local browser storage to prevent data loss on refresh/app switch.
   * **Storage Quota Defense:** `localStorage` strictly stores lean JSON rows (<10KB). Large Base64 capture thumbnails and verbose OCR telemetry are strictly retained in-memory (`sessionMedia`) to prevent 5MB storage exhaustion.
   * **Multi-Page Append Engine:** Intake supports up to 5 physical sheets per carrier (`Page X/5` badge). Matching devices (`model` + `capacity` + `color`) sum their quantities (`qty += incoming.qty`); non-matching devices append as new rows.

3. **Single-Batch Commit Rule & Decoupled API Client (`js/api.js`):**
   * All GitHub REST API operations are isolated in `js/api.js`.
   * Staged scans are submitted as **one single REST API PUT commit** to `stocks.json` upon tapping "Publish all", gated by Admin PAT (`wfo_admin_pat`).
   * Atomic commits track SHAs with 404 auto-initialization (`{ "stores": {} }`). Prevents GitHub API rate limits (5,000/hr) and network throttling.

4. **Offline Stash & Auto-Retry Queue:**
   * When network connectivity drops during publishing, commits are queued in `localStorage['wfo_offline_commit_queue']`.
   * The dashboard displays an `• X Offline Pending` indicator badge until connection is restored and queued commits sync.

5. **Store-Scoped Cryptography (`js/crypto.js`):**
   * Client-side AES-GCM 256-bit encryption with PBKDF2 (100,000 iterations, SHA-256).
   * Store records are saved as encrypted ciphertext blocks:
     ```json
     "1698": {
       "encrypted": true,
       "lastUpdated": "2026-09-24T08:00:00Z",
       "salt": "base64_salt",
       "iv": "base64_iv",
       "data": "base64_ciphertext"
     }
     ```

6. **Code 128 Handheld Barcode Pairing (`js/barcode.js` & `js/app.js`):**
   * Native SVG generator for linear Code 128 (Subset B) barcodes with 25px quiet zones displayed on mobile screen.
   * Enables rapid WMPC station enrollment via handheld scanner capture into an auto-focused pairing input.
   * Manual pairing support: Modal includes the plain text token (e.g., `K9xP-2Wv7-mQ8r-Lt4z`) with a one-tap **Copy** button for manual entry on non-scanner testing PCs.
   * **Un-enrolled Station Safety:** Stations without an enrolled Store Key display an explicit `UNPAIRED` state rather than silently auto-generating conflicting keys. Generation of a new key requires explicit user confirmation.

7. **Pricing & BIC Credit Logic:**
   * `null`: Not offered / skipped / ignored (displays `N/A` or `-`).
   * `0`: Free / $0 promo credit.
   * `> 0`: Active monthly dollar promo credit.

8. **Carrier Availability Rules:**
   * Unsupported devices (e.g., Galaxy S series on T-Mobile) have carrier fields set to `null`.

9. **Hardware Sensor Photo Capture & Raw Engine Intake Pipeline (`js/scanner.js` & `js/ocr.js`):**
   * **Hardware Sensor Capture (`js/scanner.js`):** Mobile shutter strictly invokes `ImageCapture(track).takePhoto()` to trigger native camera hardware capture (up to 50MP/12MP optical resolution with native ISP and autofocus), completely eliminating low-resolution video stream frame grabbing.
   * **Natural Dimension Cropping:** Photos are cropped strictly to 8.5:11 Letter aspect ratio at 100% natural resolution without digital upscaling or artificial smoothing.
   * **Raw OCR Intake (`js/ocr.js`):** Canvas preprocessing (`preprocessOcrCanvas`) is permanently decommissioned. Pristine, unmanipulated sensor captures are fed directly into Tesseract.js to preserve native Otsu binarization and font anti-aliasing.
   * Resilient header regex capturing common OCR misreads (`AI&T`, `AT&I`, `Verlzon`, `Slore`).

10. **Mobile Tactile Feedback Standard (`js/scanner.js`):**
    * Subtle 20–30ms haptic pulses (`navigator.vibrate`) trigger on shutter clicks, crop confirmations, and row edits.

11. **WYSIWYG Live Preview Overrides & Session Persistence (`js/print.js`):**
    * In-place cell overrides (tap quantity to edit, tap item to toggle hide, right-click to cycle normal $\rightarrow$ partial $\rightarrow$ full highlight).
    * Overrides, shift comments, and highlights persist across page refreshes via `sessionStorage['wfo_print_overrides_{store}']`.
    * Silent background `<iframe>` printing with 5000ms auto-cleanup. Enforces strict physical 1-page bounds (`max-height: 10.8in !important; overflow: hidden !important;`).
    * **Mandatory Edited Notice:** When any cell override or highlight is active, the print layout enforces the printed footer notice: `[This document was edited from the original]`.

12. **Apple Segregation for Printouts:**
    * iPhones/Watches segregated into dedicated table with priority stock resolution: **`ATT` $\rightarrow$ `VZW` $\rightarrow$ `TMO`**.
    * Automatic regex purging of obsolete iPhone 11/12/13 models (`/iPhone\s*(11|12|13)(?!\d)/i`).

13. **Admin Security Model (Headless & Passphrase Retired):**
    * Dedicated dashboard admin control panels and legacy client-side passphrases are permanently retired.
    * Administrative operations (committing `stocks.json` and managing baseline data) are executed headlessly, gated strictly by the Admin PAT (`wfo_admin_pat`) and store-scoped AES-GCM cryptography.

14. **Interactive Touch Pan & Pinch-to-Zoom Framing Engine (`js/scanner.js`):**
    * **Single-Pointer Pan:** Direct touch translation tracking (`curX`, `curY`) with active pointer capture (`setPointerCapture`) on `#scanner-preview-img`. Panning smoothly updates translation offsets while preserving active rotation and zoom scale.
    * **Linear Pinch Tracking (Zero Compounding):** Dual-touch pinch magnification is anchored strictly to initial touch distance to prevent exponential compounding:
      $$\text{scale} = \max(0.5, \min(4.0, \text{initialScale} \times (\text{dist} / \text{initialPinchDist})))$$
      Compounding frame-by-frame delta multipliers (`scale * factor`) are strictly prohibited to eliminate runaway sensitivity. A minimum distance threshold (`initialPinchDist > 10`) prevents zero-distance division and jitter.
    * **Touch Release Re-anchoring:** Seamless transition between dual-pointer pinch and single-pointer drag re-anchors `startX`/`startY` against current offsets to prevent visual snapping/jumping.
    * **Natural Aspect Slice Extraction:** `captureAdjustedFrame` projects user pan/zoom/rotation transforms onto an offscreen canvas matching the 8.5:11 US Letter ratio at 100% natural resolution.

---

## **PART IV: FEATURE PIPELINE & ROADMAP**

* **Module A (Add Inventory / Standardized Report Intake Pipeline) - [COMPLETE / OPERATIONAL BASELINE v0.0.18]:**
  * **Target Input Standard ("Inventory View Report"):** Ingests standardized printed physical reports containing Store # and Carrier in the header (`Carrier - AT&T`, `Carrier - T-Mobile`, `Carrier - Verizon Wireless`) and 4-column tabular inventory data (`Model`, `Capacity`, `Color`, `Quantity Available`). Legacy IRIS screen-scraping logic is permanently decommissioned.
  * **Framed Card Viewfinder:** Centered, bounded camera viewport (`8.5:11` US Letter portrait aspect ratio) with corner reticles and guidance banner (*"Place corners of the viewfinder just within the paper's borders."*). Non-fullscreen interface with centered circular shutter and adjacent upload action.
  * **Interactive Touch Pan & Pinch-to-Zoom Adjuster:** Direct tactile framing controls on uploaded/captured images (`initAdjuster`). Supports single-finger panning, calibrated non-compounding pinch-to-zoom (`0.5x`–`4.0x`), slider-controlled rotation (`-45°` to `+45°`), and 100% natural-resolution 8.5:11 Letter slice extraction (`captureAdjustedFrame`).
  * **Immediate Review Transition & Auto-Routing:** Tapping capture or selecting a file immediately stops the camera and routes to the Review view in an active analyzing state (`#review-loading-state`). Upon OCR completion, the parser automatically detects the carrier from the sheet header, selects that carrier's tab, commits the extracted items, and displays the staged rows for review.
  * **Multi-Page Append Engine:** LocalStorage append engine supporting up to 5 physical sheets per carrier with Model + Capacity + Color quantity summing as specified in Part III.2.

* **Module B (Print Inventory Engine) - [COMPLETE / OPERATIONAL BASELINE v0.0.18]:**
  * Live dynamic print table aligning carrier EDLPs from `stats.json` with decrypted store counts from `stocks.json`.
  * 2-column typewriter layout with Apple segregation, 30-minute timestamp clustering, `sessionStorage` overrides, mandatory edited footer notice, and silent background `<iframe>` driver as specified in Part III.11.

* **Active Sprint Roadmap (Planned & In-Progress):**
  * **Two-Factor Cryptographic Binding (2FA Key Derivation):** Mathematically bind the device Store Key with the employee PIN:
    $$\text{Key} = \text{PBKDF2}(\text{Store Key} + \text{Store PIN})$$
    Guarantees that a snooper with only the PIN cannot decrypt on GitHub, and a walk-up snooper on the WMPC cannot decrypt without the employee PIN.
  * **Module C (Stats Editor UI - `js/stats-editor.js`):** Mobile-first Admin CRUD interface for `stats.json`. Visual editing of monthly costs, carrier promotional credits (`BIC`), device aliases, and color code mappings with pre-commit JSON schema validation.
* **Module E (Bill Estimator - `js/estimator.js`):** Multi-line quote sheet calculating net monthly payments (EDLP minus BIC promo credits) with text quote and customer contact export.
  * **Module F (Share Wi-Fi - `js/wifi.js`):** Client-side SVG QR code generator for store employee wireless network access.
* **Module D (Quick Document Hub):** One-click PNG/PDF print interface with tutorial modals, printable reference cheat sheets, and carrier rate cards.

---

## **PART V: GLOSSARY & ACRONYMS**

* **WMPC:** Walmart PC (Kiosk Mode browser).
* **EDLP:** Everyday Low Price (Retail monthly device cost).
* **BIC:** Bill Incentive Credit (Carrier promotional monthly discount).
* **MOADP:** Monthly amount remaining after standard down payment (T-Mobile).
* **MONDP:** Monthly amount with no down payment (Total / 24).
* **OCR:** Optical Character Recognition (Client-side Tesseract.js).
* **Levenshtein Distance:** String metric algorithm measuring character difference for typo correction.
* **PAT:** GitHub Personal Access Token.
* **PL / LLM:** Project Lead (Human) / Large Language Model (You).

---

## **PART VI: LLM ONBOARDING PROTOCOL**

### **A. DUAL-TRACK ONBOARDING VERIFICATION**

#### **Track 1: Standard Chat LLM (Mode A)**
When a standard chat-based LLM first receives this document, it must:
1. Confirm understanding in **1–2 concise sentences**.
2. Output **two sample patches in perfect markdown format** (one Standard patch and one Range patch) to prove protocol compliance with both formats.
3. Perform **Objective File Verification (Zero-Assumption Rule)**: Inspect literal internal metadata of attached code files and quote each using standardized tags:
   * `Attached file inspection: <metadata> ✅ [MATCH]`
   * `Attached file inspection: <metadata> ⚠️ [MISMATCH: Expected X, Found Y]`
   * `Attached file inspection: ⁉️ [MISSING CONTEXT: Expected file X based on task, but none attached]`
4. **Manifest Screenshot Sync:** Verifying runtime versions against an attached screen capture is strictly optional.
5. Await explicit PL direction.

#### **Track 2: Spark Workspace Agent (Mode B)**
When a tool-enabled Gemini Spark / Workspace Agent receives this document:
1. Confirm understanding and acknowledge agent execution mode in **1–2 concise sentences**.
2. Perform **Objective File Verification** on attached files using the standardized tags above.
3. Explicitly acknowledge the active **Baseline Floor (`v0.0.18`)** and the **`just Gemini stuff` Drive Isolation Boundary**.
4. **Strict Zero-Patch Output Rule:** Mode B agents are strictly forbidden from generating code blocks, find-and-replace patches, or file dumps in chat. Output is restricted to Drive links, headless test status, and the Manifest Roster.
5. **Exemption:** The Spark Agent is exempt from generating dummy sample patches unless explicitly ordered by the PL, conserving context tokens for operational planning and execution.
6. Await explicit PL direction.

### **B. MISSING MEDIA RULE**
If PL mentions media that SHOULD be attached (e.g., "see attached image", "look at this screenshot") and it is NOT present, the LLM must respond ONLY with:  
`error: you didn't attach media!`
