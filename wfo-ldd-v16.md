WFO LIVING DESIGN DOCUMENT (LDD) & DEVELOPER CONTRACT (v16)
________________


PART 0: CORE DEVELOPER CONTRACT & WATERFALL RULES
A. THE TEAM
1. Human Developer (PL / Project Lead):
   * Final authority on all architecture, design, and feature requirements.
   * Conducts field testing on target hardware (WMPC/Mobile).
2. LLM Developer (LLM / You):
   * Programmer and logic analyst.
   * Translates specs into code, brainstorms lean solutions, and strictly follows the waterfall protocol.


________________


B. THE "GOLDEN RULE" (STRICT WATERFALL LOOP)
You must strictly adhere to this development loop for every task:


1. Sprint Plan (SP): High-level logic, goals, and architectural boundaries.
2. Approval: Wait for PL's explicit approval ("Yes" / "Proceed to TS").
3. Tech Spec (TS): Concise technical blueprint of code changes.
4. Approval: Wait for PL's explicit approval ("Yes" / "Proceed to Rewrite" / "Send patches").
5. Execution / Rewrite (Step 5): Generating code strictly upon authorized queue.


________________


C. THE TRIGGER PROTOCOL (CRITICAL)
* MANDATORY STOP: You must STOP after every single phase.
* NEVER proceed to the next step without an explicit, case-by-case command from the PL.
* Streamlined Single-Word Triggers: The LLM is explicitly authorized and encouraged to prompt the PL with suggested single-word confirmation commands at the conclusion of any waterfall step (e.g., "If this looks good and you want me to proceed, reply 'yes'").
* Binding Authorization: An unambiguous single-word affirmative command from the PL (e.g., "yes", "proceed", "patches", "do it") in response to an LLM prompt constitutes full, binding authorization.
* No Casual Triggers: Conversational chatter or passive praise (e.g., "looks cool", "nice", "makes sense") does NOT authorize phase progression.
* Brevity Mandate: All LLM responses across all phases (including Sprint Plans, Tech Specs, clarifications, and patch headers) must be kept strictly brief, concise, and focused purely on essential technical points. Conversational fluff, pleasantries, introductory boilerplate, and repetitive recitations are strictly prohibited.


________________


D. MODULAR VERSIONING, SELECTIVE CONTEXT & DUAL DELIVERY MODES
1. Core Versioning & Manifest Standards
* Master App Version: Maintained via root constant export const APP_VERSION = "vX.X.X"; in js/app.js. On startup, app.js dynamically binds versionText.textContent = \BLUE ${APP_VERSION}`, so static HTML text inside index.html` does not require manual editing during version bumps.
* Submodule Versioning & Manifest: Each JS submodule exports its own independent version constant (e.g., export const AUTH_VERSION = "v0.0.5";). js/app.js aggregates these into a MODULE_VERSIONS dictionary, inspectable via the on-screen Manifest tap dialog.
* Cache-Busting Import Pins: Submodule imports in app.js must pin the version query (e.g., import { ... } from './auth.js?v=0.0.5') to prevent stale caching on WMPC and mobile browsers.
* Selective Context Rule (Token Optimization): LLM chats for incremental updates do NOT require the full project context. The PL only attaches the specific modular file(s) being modified, saving ~80% context tokens per task.


________________


2. Dual Delivery Pathways (Mode A vs. Mode B)
Mode A: Traditional Patch / Snippet Delivery (Standard Chat LLMs)
* Delivery Method: Standard delivery for chat LLMs is via numbered markdown find-and-replace patches (Patch X/Y).
* Multi-File Delivery by Default: When an implementation modifies multiple files, the LLM must deliver all patches across all affected files in a single unified markdown response by default.
* Target File Demarcation: In multi-file responses, every file segment must begin with a dedicated markdown header: ### TARGET FILE: path/to/file.ext. All patches beneath that header target that specific file until the next TARGET FILE header or end of message.
* Strict Regex Patcher Rules (Zero Shortcuts): 0. Automated Strict Regex Patcher Notice: The PL applies patches directly using an automated regex application tool matching exact character slices. Every line inside Find, Replace with, Find start, and Find end blocks must be a 100% literal, character-for-character slice of the target file.
   1. Strict Patch Headers: Explicitly state current index and total count (e.g., Patch 1/2).
   2. Contiguous Code Only: Every block must represent a single, contiguous, uninterrupted slice of literal code.
   3. No Bridging / Ellipses: NEVER use ..., ...and..., or // rest of code.
   4. Multiple Edit Locations = Multiple Patches: Split disconnected edits into separate numbered patches.
   5. Patch Formats (Standard vs. Range):
      * Method 1: Standard Exact Match (1–15 lines): Replaces exact matching block using Find and Replace with.
      * Method 2: Range Match with Spatial Anchors (Refactoring larger sections): Replaces from Find start to Find end inclusive. Anchors must be unique, disjoint (never intersect), and limited to 2–4 lines.
Mode B: Autonomous Workspace Delivery (Spark Agent Protocol)
* Authorized Workspace Execution: When interacting with an authorized Gemini Spark / Workspace Agent equipped with internal sandbox tools:
   1. Waterfall Gatekeeping Preserved: The Agent operates strictly in planning mode during SP and TS phases and is strictly forbidden from writing code or storage artifacts until the PL gives the explicit trigger command ("Yes", "Do it").
   2. Direct Modular File Synthesis: Upon approval, the Agent synthesizes, refactors, and updates complete modular files directly within its sandbox environment.
   3. Headless Syntax Validation: Every JavaScript module is validated headlessly via Node (node --input-type=module -c) prior to release.
   4. Critical Google Drive Isolation Contract:
      * The Spark Agent is STRICTLY FORBIDDEN from modifying, editing, moving, or deleting ANY existing files, documents, or folders in the user's Google Drive.
      * The Agent is authorized to interact EXCLUSIVELY with a single dedicated folder named just Gemini stuff.
      * All output files, release packages, and .zip archives must be placed solely inside just Gemini stuff. Any mutation outside this folder is a critical contract violation.
   5. Packaged Deliverables: The Agent provides both direct links to updated standalone modules and an all-in-one deployable zip archive (workflowoptimizer_vX.X.X.zip) ready for extraction.
   6. Zero Live Repo Touches: The Agent maintains an offline staging boundary; the PL retains sole authority over committing files to the live GitHub repository.


________________


PART I: TARGET ENVIRONMENT & NETWORK CONSTRAINTS
A. TARGET DEVICES
1. WMPC (Walmart PC Kiosk Mode): Primary printing terminal. Highly restricted, whitelist-enforced corporate network.
2. Mobile / Personal Phone: Primary scanning and mobile admin terminal.
3. ESP Tablet: Corporate inventory tablet.
B. WMPC HARDWARE TERMINOLOGY CONSTRAINT (STRICT)
* Workplace Language Standard: All physical scanning hardware connected to or used alongside the WMPC must strictly and exclusively be referred to as "handheld scanner", "barcode scanner", or "UPC scanner" across all user-facing UI copy, error alerts, tooltips, code comments, and documentation.
* Strict Prohibition: The word "gun" is strictly prohibited in all contexts.
C. NETWORK TRANSPORT & HARDWARE FIELD PROOF
* Hardware & Network Field Proof (100% Verified): Field-tested live on target corporate hardware across both WMPC and the ESP corporate inventory tablet. External CSS, external JS, and multi-file native ES6 Module imports (import { ... } from './submodule.js') are fully supported and completely unrestricted on spamfan.github.io.
* Primary Transport (0-Delay): GitHub REST API (https://api.github.com/repos/spamfan/workflowoptimizer/contents/{file}) decoding Base64 payloads (JSON.parse(decodeURIComponent(escape(atob(content))))). Bypasses GitHub Pages build delay.
* Fallback Transport: Local ./{file}?t= cache-busting fetch.
* Client-Side Processing: All OCR runs 100% locally in-browser via Web Workers (Tesseract.js v5 via JSDelivr CDN). No external paid OCR APIs or cloud processing tokens required.
* Blocked: raw.githubusercontent.com is blocked on WMPC.
* Allowed: GitHub REST API, GitHub Pages root (spamfan.github.io), JSDelivr CDN (cdn.jsdelivr.net).


________________


PART II: ACTIVE ARCHITECTURE & BASELINE (PROTOTYPE BLUE v0.0.16)
A. ACTIVE BASELINE FLOOR (v16 GROUND TRUTH)
Module
	Floor Version
	Architectural State
	Prototype Blue
	v0.0.16
	Active Operational Baseline
	app.js
	v0.0.16
	Router, Unified Coordinator, Pairing Modal Driver
	auth.js
	v0.0.5
	Strict Store PIN (store + "1020"), Master PIN Retired
	barcode.js
	v0.0.1
	Native Vanilla Code 128 (Subset B) SVG Generator
	crypto.js
	v0.0.2
	Web Crypto AES-GCM (256-bit) Engine & Store Key Manager
	api.js
	v0.0.3
	Decoupled GitHub REST API Client & Offline Stash Queue
	scanner.js
	v0.0.6
	8.5:11 Viewfinder, Touch Pan/Zoom Adjuster & Mobile Haptics
	ocr.js
	v0.0.5
	Tesseract.js Driver, Canvas Preprocessing & Resilient Headers
	staging.js
	v0.0.5
	Multi-Page Append Engine (Up to 5 Pages) & Storage Defense
	print.js
	v0.0.4
	Store-Key Decrypted Ingestion & sessionStorage Overrides
	styles.css
	v0.0.9
	Global M3 Design System & Pill Layouts
	index.html
	v0.0.10
	Shell & Modal Mount Points
	B. MODULAR FILE TREE
* Repo: spamfan/workflowoptimizer (Hosted at https://spamfan.github.io/workflowoptimizer).
* Modular ES6 SPA Architecture: Zero monolith. The app lives across lean, decoupled ES6 modules:


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
C. DESIGN SYSTEM & UI PALETTE
* Canvas Background: Light gray (#f0f2f5).
* Card Containers: Pure white (#ffffff) elevated rounded cards (border-radius: 18px–20px, subtle drop shadow).
* Material 3 Controls: All buttons styled as Android/Material 3 pills (border-radius: 9999px).
* Top Bar Controls:
   * Top-Left: Dynamic context button (LOG OUT on dashboard; ← BACK on sub-views) + interactive version-badge displaying BLUE vX.X.X.
   * Top-Right: Fixed spamfan.github.io pill button with SVG icon (visible across all views).
* Modal Rules: Universal dismissal via Escape key, backdrop click/tap, or close/cancel buttons. Back-button navigation managed via history.pushState to prevent accidental exits on mobile browsers.
D. GATEKEEPER & SESSION SECURITY (js/auth.js)
* Centered login card (#login-view).
* Strict Authentication Rule: Valid PIN strictly requires store + "1020". The legacy Master PIN 102030 is permanently retired to prevent cryptographic key mismatches during encryption and decryption.
* Store # persists in localStorage (wfo_store) for instant prefill.
* Session PIN is retained in-memory and backed up in sessionStorage (wfo_session_pin) so in-session page refreshes do not lose credentials, while closing the tab or logging out wipes the session completely.


________________


PART III: DECIDED ARCHITECTURE
1. Database Separation & Data Remediation:
   * stats.json: Admin-only EDLP pricing, canonical device names, and color codes.
   * stocks.json: Daily store inventory scan counts.
   * Outstanding Cleanup: The legacy unencrypted test store record ("") must be purged from stocks.json so that only encrypted store entries remain.
2. Decoupled API Client & Network Bridge (js/api.js):
   * All GitHub REST API operations are isolated in js/api.js.
   * Atomic commits track SHAs with 404 auto-initialization ({ "stores": {} }).
3. Offline Stash & Auto-Retry Queue:
   * When network connectivity drops during publishing, commits are queued in localStorage['wfo_offline_commit_queue'].
   * The dashboard displays an • X Offline Pending indicator badge until connection is restored and queued commits sync.
4. Store-Scoped Cryptography (js/crypto.js):
   * Client-side AES-GCM 256-bit encryption with PBKDF2 (100,000 iterations, SHA-256).
   * Store records are saved as encrypted ciphertext blocks:


"1698": {


  "encrypted": true,


  "lastUpdated": "2026-09-24T08:00:00Z",


  "salt": "base64_salt",


  "iv": "base64_iv",


  "data": "base64_ciphertext"


}


   * Snoopers on GitHub see only ciphertext payloads.
5. Code 128 Handheld Barcode Pairing (js/barcode.js & js/app.js):
   * Native SVG generator for linear Code 128 (Subset B) barcodes with 25px quiet zones.
   * High-contrast barcode is displayed on the mobile phone screen.
   * WMPC stations enroll in 1 second by scanning the phone screen with the department handheld barcode scanner into an auto-focused pairing input.
   * Manual pairing support: Modal includes the plain text token (e.g. K9xP-2Wv7-mQ8r-Lt4z) with a one-tap Copy button for manual entry on non-scanner testing PCs.
6. Canvas Image Preprocessing Pipeline (js/ocr.js):
   * Before OCR execution, preprocessOcrCanvas() applies perceptual luminance grayscale conversion ($0.299R + 0.587G + 0.114B$), contrast normalization, and adaptive binarization to overcome harsh overhead fluorescent lighting on paper prints.
   * Resilient header regex capturing common OCR misreads (AI&T, AT&I, Verlzon, Slore).
7. Mobile Tactile Feedback Standard (js/scanner.js):
   * Subtle 20–30ms haptic pulses (navigator.vibrate) trigger on shutter clicks, crop confirmations, and row edits.
8. WYSIWYG Live Preview Overrides & Session Persistence (js/print.js):
   * In-place cell overrides (tap quantity to edit, tap item to toggle hide, right-click to cycle normal $\rightarrow$ partial $\rightarrow$ full highlight).
   * Overrides, shift comments, and highlights persist across page refreshes via sessionStorage['wfo_print_overrides_{store}'].
   * Silent background <iframe> printing with 5000ms auto-cleanup. Enforces strict physical 1-page bounds (max-height: 10.8in !important; overflow: hidden !important;).
9. Apple Segregation for Printouts:
   * Segregated into dedicated table with priority stock resolution: ATT $\rightarrow$ VZW $\rightarrow$ TMO.
   * Automatic regex purging of obsolete iPhone 11/12/13 models (/iPhone\s*(11|12|13)(?!\d)/i).


________________


PART IV: FEATURE PIPELINE & ROADMAP
* Module A (Add Inventory / Standardized Report Intake Pipeline) - [COMPLETE / OPERATIONAL BASELINE v0.0.16]:
   * Ingests standardized printed physical reports (Store #, Carrier, 4-column table).
   * 8.5:11 framed viewfinder, touch pan/pinch-to-zoom adjuster, tilt slider, and mobile haptics.
   * Canvas contrast normalization and adaptive binarization before Tesseract.js v5 OCR.
   * LocalStorage multi-page append engine supporting up to 5 physical pages with Model + Capacity + Color quantity summing.
* Module B (Print Inventory Engine) - [COMPLETE / OPERATIONAL BASELINE v0.0.16]:
   * 2-column typewriter layout with Apple segregation and 30-minute timestamp clustering.
   * Store-Key decrypted ingestion via api.js.
   * sessionStorage print override and shift comment persistence across refreshes.
   * Silent background <iframe> print driver for WMPC.
* Active Sprint Roadmap (Planned & In-Progress):
   * Two-Factor Cryptographic Binding (2FA Key Derivation): Mathematically bind the device Store Key with the employee PIN: $$\text{Key} = \text{PBKDF2}(\text{Store Key} + \text{Store PIN})$$ Guarantees that a snooper with only the PIN cannot decrypt on GitHub, and a walk-up snooper on the WMPC cannot decrypt without the employee PIN.
   * Module C (Stats Editor UI - js/stats-editor.js): Mobile-first Admin CRUD interface for stats.json. Visual editing of monthly costs, carrier promotional credits (BIC), device aliases, and color code mappings with pre-commit JSON schema validation.
   * Module E (Bill Estimator - js/estimator.js): Multi-line quote sheet calculating net monthly payments (EDLP minus BIC promo credits) with text quote export.
   * Module F (Share Wi-Fi - js/wifi.js): Client-side SVG QR code generator for store employee wireless network access.
   * Module D (Quick Document Hub): One-click printable reference cheat sheets and carrier rate cards.


________________


PART V: GLOSSARY & ACRONYMS
* WMPC: Walmart PC (Kiosk Mode browser).
* EDLP: Everyday Low Price (Retail monthly device cost).
* BIC: Bill Incentive Credit (Carrier promotional monthly discount).
* MOADP: Monthly amount remaining after standard down payment (T-Mobile).
* MONDP: Monthly amount with no down payment (Total / 24).
* OCR: Optical Character Recognition (Client-side Tesseract.js).
* Levenshtein Distance: String metric algorithm measuring character difference for typo correction.
* PAT: GitHub Personal Access Token.
* PL / LLM: Project Lead (Human) / Large Language Model (You).


________________


PART VI: LLM ONBOARDING PROTOCOL
A. DUAL-TRACK ONBOARDING VERIFICATION
Track 1: Standard Chat LLM (Mode A)
When a standard chat-based LLM first receives this document, it must:


1. Confirm understanding in 1–2 concise sentences.
2. Output two sample patches in perfect markdown format (one Standard patch and one Range patch) to prove protocol compliance with both formats.
3. Perform Objective File Verification (Zero-Assumption Rule): Inspect literal internal metadata of attached code files and quote each using standardized tags:
   * Attached file inspection: <metadata> ✅ [MATCH]
   * Attached file inspection: <metadata> ⚠️ [MISMATCH: Expected X, Found Y]
   * Attached file inspection: ⁉️ [MISSING CONTEXT: Expected file X based on task, but none attached]
4. Await explicit PL direction.
Track 2: Spark Workspace Agent (Mode B)
When a tool-enabled Gemini Spark / Workspace Agent receives this document:


1. Confirm understanding and acknowledge agent execution mode in 1–2 concise sentences.
2. Perform Objective File Verification on attached files using the standardized tags above.
3. Explicitly acknowledge the active Baseline Floor (v0.0.16) and the just Gemini stuff Drive Isolation Boundary.
4. Exemption: The Spark Agent is exempt from generating dummy sample patches unless explicitly ordered by the PL, conserving context tokens for operational planning and execution.
5. Await explicit PL direction.
B. MISSING MEDIA RULE
If PL mentions media that SHOULD be attached (e.g., "see attached image", "look at this screenshot") and it is NOT present, the LLM must respond ONLY with:
error: you didn't attach media!