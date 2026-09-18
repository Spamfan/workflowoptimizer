# **WFO LIVING DESIGN DOCUMENT (LDD) & DEVELOPER CONTRACT (v9)**

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

### **B. THE "GOLDEN RULE" (STRICT WATERFALL LOOP)**
You must strictly adhere to this development loop for every task:
1. **Sprint Plan (SP):** High-level logic, goals, and architectural boundaries.
2. **Approval:** Wait for PL's explicit approval ("Yes" / "Proceed to TS").
3. **Tech Spec (TS):** Concise technical blueprint of code changes.
4. **Approval:** Wait for PL's explicit approval ("Yes" / "Send patches" / "Output full file").
5. **Rewrite / Patch:** Outputting the actual code.

---

### **C. THE TRIGGER PROTOCOL (CRITICAL)**
* **MANDATORY STOP:** You must STOP after every single phase.
* **NEVER** proceed to the next step without an explicit, case-by-case command from the PL.
* **Streamlined Single-Word Triggers:** The LLM is explicitly authorized and encouraged to prompt the PL with suggested single-word confirmation commands at the conclusion of any waterfall step (e.g., *"If this looks good and you want me to send the patches, reply 'yes'"*).
* **Binding Authorization:** An unambiguous single-word affirmative command from the PL (e.g., `"yes"`, `"proceed"`, `"patches"`) in response to an LLM prompt constitutes full, binding authorization.
* **No Casual Triggers:** Conversational chatter or passive praise (e.g., *"looks cool"*, *"nice"*, *"makes sense"*) does NOT authorize phase progression.
* **Brevity Mandate:** All LLM responses across all phases (including Sprint Plans, Tech Specs, clarifications, and patch headers) must be kept strictly brief, concise, and focused purely on essential technical points. Conversational fluff, pleasantries, introductory boilerplate, and repetitive recitations are strictly prohibited.

---

### **D. MODULAR VERSIONING, SELECTIVE CONTEXT & DELIVERY STANDARDS**
* **Master App Version:** Maintained via root constant `export const APP_VERSION = "vX.X.X";` in `js/app.js`. On startup, `app.js` dynamically binds `versionText.textContent = `BLUE ${APP_VERSION}`, so static HTML text inside `index.html` does not require manual editing during version bumps.
* **Submodule Versioning & Manifest:** Each JS submodule exports its own independent version constant (e.g., `export const AUTH_VERSION = "v0.0.1";`). `js/app.js` aggregates these into a `MODULE_VERSIONS` dictionary, inspectable via the on-screen Manifest tap dialog.
* **Cache-Busting Import Pins:** Submodule imports in `app.js` must pin the version query (e.g., `import { ... } from './auth.js?v=0.0.1'`) to prevent stale caching on WMPC and mobile browsers.
* **Selective Context Rule (Token Optimization):** LLM chats for incremental updates do NOT require the full project context. The PL only attaches the specific modular file(s) being modified (e.g., only `styles.css` for styling, or only a specific submodule), saving ~80% context tokens per task.
* **Delivery Method:** Standard delivery is via numbered markdown find-and-replace patches (`Patch X/Y`).
* **Multi-File Sequential Delivery Protocol:** When a task involves edits across multiple files, the LLM must deliver patches for **one file at a time**:
  1. Declare target file at the very start of the response: `### TARGET FILE: path/to/file.ext`.
  2. Output only the patches belonging to that specific file.
  3. Conclude the response with a status line and trigger prompt: `### COMPLETED: path/to/file.ext. Reply 'yes' to proceed with path/to/next-file.ext.`
  4. Wait for explicit PL confirmation before delivering patches for the next file.
* **Full File Rewrites:** ONLY permitted when starting a new app/foundation or when explicitly ordered by PL.

* **STRICT PATCH RULES (ZERO SHORTCUTS):**
  0. **Automated Strict Regex Patcher Notice:** The PL applies all patches directly using a strict automated regex application tool. The regex engine matches exact character slices and will fail on any whitespace, tab, or newline mismatch. Every line inside `Find`, `Replace with`, `Find start`, and `Find end` blocks must be a 100% literal, character-for-character slice of the target file.
  1. **Strict Patch Headers:** Every patch header must explicitly state its current index and total count (e.g., `Patch 1/2`, `Patch 2/2`).
  2. **Contiguous Code Only:** Every `Find`, `Find start`, or `Find end` block must represent a single, contiguous, uninterrupted slice of literal code.
  3. **No Bridging / Ellipses:** NEVER use `...`, `...and...`, or `// rest of code` inside any block. Every block must match character-for-character.
  4. **Multiple Edit Locations = Multiple Patches:** If changing code in two different disconnected locations of the same file, you MUST split them into separate numbered patches.
  5. **Patch Formats (Standard vs. Range):**
     The LLM is equipped with two distinct patching methods and has full discretion to choose between them on a patch-by-patch basis to optimize context token efficiency:
     * **Method 1: Standard Exact Match (Best for localized changes of 1–15 lines):**
       Replaces an exact matching block of code using `Find` and `Replace with` blocks.
     * **Method 2: Range Match with Spatial Anchors (Best for modifying or refactoring larger sections):**
       Replaces everything from the beginning of `Find start` to the end of `Find end` inclusive to save output tokens instead of echoing unchanged lines. Both anchors must be completely unique to avoid ambiguous matching.
     * **Token Optimization Rule:** Choose the method that uses the fewest output tokens while maintaining 100% uniqueness and zero ambiguity. Use Standard for tight edits; use Range when replacing large spans.

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

---

## **PART I: TARGET ENVIRONMENT & NETWORK CONSTRAINTS**

### **A. TARGET DEVICES**
1. **WMPC (Walmart PC Kiosk Mode):** Primary printing terminal. Highly restricted, whitelist-enforced corporate network.
2. **Mobile / Personal Phone:** Primary scanning and mobile admin terminal.
3. **ESP Tablet:** Corporate inventory tablet.

### **B. NETWORK TRANSPORT & HARDWARE FIELD PROOF**
* **Hardware & Network Field Proof (100% Verified):** Field-tested live on target corporate hardware across both WMPC (Walmart PC kiosk) and the ESP corporate inventory tablet. External CSS, external JS, and multi-file native ES6 Module imports (`import { ... } from './submodule.js'`) are fully supported and completely unrestricted on `spamfan.github.io`.
* **Primary Transport (0-Delay):** GitHub REST API (`https://api.github.com/repos/spamfan/workflowoptimizer/contents/{file}`) decoding Base64 payloads (`JSON.parse(decodeURIComponent(escape(atob(content))))`). Bypasses GitHub Pages build delay.
* **Fallback Transport:** Local `./{file}?t=` cache-busting fetch.
* **Client-Side Processing:** All OCR runs 100% locally in-browser via Web Workers (Tesseract.js v5 via JSDelivr CDN). No external paid OCR APIs or cloud processing tokens required.
* **Blocked:** `raw.githubusercontent.com` is blocked on WMPC.
* **Allowed:** GitHub REST API, GitHub Pages root (`spamfan.github.io`), JSDelivr CDN (`cdn.jsdelivr.net`).

---

## **PART II: ACTIVE ARCHITECTURE & BASELINE (PROTOTYPE BLUE v0.0.4+)**

### **A. ARCHITECTURE & MODULAR FILE TREE**
* **Repo:** `spamfan/workflowoptimizer` (Hosted at `https://spamfan.github.io/workflowoptimizer`).
* **Modular ES6 SPA Architecture:** Zero monolith. The app lives across lean, decoupled ES6 modules:
```text
├── index.html        (Shell, modal roots, view mount points)
├── styles.css        (Global M3 design system & pill components)
├── stats.json        (Canonical pricing, devices, color codes)
└── js/
    ├── app.js        (Router, History API, Manifest modal, Ping engine)
    ├── auth.js       (PIN gatekeeper, in-memory session, store prefill)
    ├── scanner.js    (Camera viewfinder & capture logic)
    ├── ocr.js        (OCR worker & token parsers)
    └── staging.js    (LocalStorage store, review cards, inline edit)
```

### **B. DESIGN SYSTEM & UI PALETTE**
* **Canvas Background:** Light gray (`#f0f2f5`).
* **Card Containers:** Pure white (`#ffffff`) elevated rounded cards (`border-radius: 18px–20px`, subtle drop shadow).
* **Material 3 Controls:** All buttons styled as Android/Material 3 pills (`border-radius: 9999px`).
* **Top Bar Controls:**
  * Top-Left: Dynamic context button (`LOG OUT` on dashboard; `← BACK` on sub-views) + interactive `version-badge` displaying `BLUE vX.X.X`.
  * Top-Right: Fixed **`spamfan.github.io`** pill button with SVG icon (visible across all views).
* **Modal Rules:** Universal dismissal via `Escape` key (strictly scoped to modals), backdrop click/tap, or close/cancel buttons.

### **C. GATEKEEPER (LOGIN VIEW - `js/auth.js`)**
* Centered login card (`#login-view`).
* Dynamic store-scoped PIN validation (`store + "1020"`) or Master PIN (`102030`).
* Store # persists in `localStorage` (`wfo_store`) across sessions and logouts for input prefill.
* Active session access is strictly in-memory (`isAuthenticated = false` on load); requires PIN re-entry whenever refreshed or reopened.

### **D. DATA BASELINE (`stats.json`)**
* Keyed dictionary of canonical devices + color abbreviation lookup table.
* Loaded dynamically via zero-delay GitHub REST API with local `./stats.json` fallback.

### **E. MODULE MANIFEST & DIAGNOSTICS (`#manifest-modal`)**
* Tapping the top-left version badge (`#version-text`) opens an on-screen manifest listing the runtime loaded version of every active module (`app.js`, `auth.js`, `styles.css`, `index.html`).
* Eliminates caching confusion across GitHub Pages builds and target devices.

### **F. DECOUPLED UPLOAD HOOK**
* The "Upload inventory" button on the primary dashboard card serves as a clean trigger hook ready for plug-and-play mounting of future scanner/OCR submodules.

---

## **PART III: DECIDED ARCHITECTURE**

1. **Database Separation:**
   * `stats.json`: Admin-only EDLP pricing, canonical device names, and color codes.
   * `stocks.json`: Daily store inventory scan counts.
2. **LocalStorage Staging Architecture (`wfo_staged_inventory`):**
   * Multi-carrier scans (`tmo`, `vzw`, `att`) stage in local browser storage to prevent data loss on refresh/app switch.
3. **Single-Batch Commit Rule (Rate-Limit Defense):**
   * Staged scans are submitted as **one single REST API commit** to `stocks.json` upon tapping "Publish all". Prevents GitHub API rate limits (5,000/hr) and network throttling.
4. **Pricing & BIC Credit Logic:**
   * `null`: Not offered / skipped / ignored (displays `N/A` or `-`).
   * `0`: Free / $0 promo credit.
   * `> 0`: Active monthly dollar promo credit.
5. **Carrier Availability Rules:**
   * Unsupported devices (e.g., Galaxy S series on T-Mobile) have carrier fields set to `null`.
6. **Admin Security Model:**
   * Admin tools embedded directly inside the single UI, gated by GitHub Personal Access Token (PAT) / passphrase for direct commit writes.
7. **Apple Segregation for Printouts:**
   * iPhones/Watches segregated into their own section on inventory printouts with priority rule: **ATT $\rightarrow$ VZW $\rightarrow$ TMO**.

---

## **PART IV: FEATURE PIPELINE & ROADMAP**

* **Module A (Add Inventory / Pluggable Upload Pipeline):**
  * **Agnostic Intake & Processing Hook:** Pluggable upload and capture pipeline (`js/scanner.js`, `js/ocr.js`, `js/staging.js`) structured to intake physical sheet captures, extract carrier stock counts, and stage them for review prior to atomic commit. (Full user flow specification pending).
* **Module B (Print Inventory Engine):**
  * Live dynamic print table aligning carrier EDLPs from `stats.json` with store counts from `stocks.json`.
  * Interactive live preview with manual overrides, LocalStorage persistence, and mandatory edited footer notice: `[This document was edited from the original]`.
* **Module C (Stats Editor):** Mobile-first Admin UI for CRUD operations on pricing, devices, and color codes.
* **Module D (Quick Document Hub):** One-click PNG/PDF print interface with tutorial modals.
* **Module E (Bill Estimator):** Dynamic multi-line quote sheet calculating live EDLPs/BICs with customer contact export.
* **Module F (Share Wi-Fi):** QR code modal for employee network access.

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

1. **Introductions:** When an LLM first receives this document, it must:
   * Read thoroughly and confirm understanding in **1–2 concise sentences**.
   * Output **two sample patches in perfect markdown format** (one Standard patch and one Range patch) to prove protocol compliance with both formats.
   * **Objective File Verification (Zero-Assumption Rule):** Inspect literal internal metadata of all attached code files (e.g., `<title>` tag, top header comments, or root keys) and verbatim quote each in the onboarding reply using standardized status tags:
     * `Attached file inspection: <metadata> ✅ [MATCH]`
     * `Attached file inspection: <metadata> ⚠️ [MISMATCH: Expected X, Found Y]`
     * `Attached file inspection: ⁉️ [MISSING CONTEXT: Expected file X based on task, but none attached]`
   * Await explicit PL direction.
2. **Missing Media Rule:** If PL mentions media that SHOULD be attached (e.g., "see attached image", "look at this screenshot") and it is NOT present, the LLM must respond ONLY with:  
   `error: you didn't attach media!`

---

## **PART VII: ACTIVE SPRINT - OCR FAST-TRACK CALIBRATION PROTOCOL**

This protocol standardizes iterative field triage to isolate OCR/scanning defects:

1. **Trigger `startx` & Artifact Request:**
   * When the PL states `startx`, the LLM checks for provided diagnostic artifacts (physical capture, preprocessed image, or raw payload text).
   * If artifacts are missing, the LLM requests only the specific missing artifacts.
2. **Telemetry Ingestion & Defect Tracing:**
   * Audit raw scan text, token extraction, and model match scores against `stats.json`.
   * Trace execution against active codebase logic without assuming historical pipeline steps.
3. **Defect Diagnosis & Immediate Sprint Plan:**
   * Pinpoint the root defect (e.g., capture crop distortion, OCR token grouping, regex edge case).
   * Immediately transition to a concise Sprint Plan (SP) proposing targeted code patches for the next iteration.