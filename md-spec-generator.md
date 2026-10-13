# BILL GENERATOR SPECIFICATION
### Subsystem: `js-generator.js`
### Document Version: `v0.1.5`

---

### 1. OVERVIEW & SCOPE
* **Purpose:** Provides a rapid, kiosk-optimized customer quote and onboarding tear-sheet generator for wireless device financing and rate plan estimates.
* **Multi-Carrier Scope:** Supports AT&T (`att`), Verizon (`vzw`), and T-Mobile (`tmo`) single-line and multi-line customer setups.
* **Core Output:** Compiles a 2-up printable tear-sheet (2 handouts per 8.5" x 11" page) using base sheet asset `doc-ths.png`.
* **Zero-Margin Baked Layout Mandate:** Outer 0.35"–0.4" sheet margins are pre-baked directly into `doc-ths.png`. The stage container and print rules enforce strictly `margin: 0; padding: 0; border: none;` to maintain exact 1:1 coordinate registration.
* **Top-Half Population Rule:** Dynamic DOM overlays populate strictly on the top half. The bottom half remains 100% blank pre-printed lines to preserve paper for manual handwriting.
* **Print Typography:** Rendered overlays print in high-contrast solid black (`#000000`).

---

### 2. SECURITY & ZERO-KNOWLEDGE ARCHITECTURE
* **Passcode / PIN Strict Exclusion:**
  * The customer PIN / Passcode must NEVER be entered into UI inputs, DOM attributes, state objects, or browser storage.
  * The digital interface omits the field entirely; the physical print output renders an untouched underline designated strictly for customer manual pen-entry.
* **PII & Storage Policy:**
  * Customer Name and Phone Number remain ephemeral to the active session.
  * Non-PII configuration defaults (Carrier, State, Autopay instrument, Due date days) persist in state and local storage.

---

### 3. CARRIER PROFILE MATRIX & DEFAULTS
* Selecting a carrier pill re-applies default profile values while permitting user overrides:
  * **AT&T (`att`):**
    * Base Plan: `$50.00`
    * Term: `3` (displays `3` inside `(___yr)`)
    * Autopay: `CHECKING ACCT`
    * First Bill Due: `20` days
    * Section Suppression: Disabled (Reimbursement section visible)
  * **Verizon (`vzw`):**
    * Base Plan: `$25.00`
    * Term: `3` (displays `3` inside `(___yr)`)
    * Autopay: `CHECKING ACCT`
    * First Bill Due: `14` days
    * Section Suppression: Enabled (`#ffffff` mask active by default)
  * **T-Mobile (`tmo`):**
    * Base Plan: `$25.00`
    * Term: `2` (displays `2` inside `(___yr)`)
    * Autopay: `DEBIT`
    * First Bill Due: `20` days
    * Section Suppression: Enabled (`#ffffff` mask active by default)

---

### 4. DATA SCHEMA & PRECISION COORDINATE LAYOUT
* Container Environment: `.gen-paper-stage` enforces `container-type: inline-size; aspect-ratio: 8.5 / 11;`. Overlays scale via `cqi` units for 1:1 screen-to-print parity.
* `carrier` (`ov-carrier`): `top: 3.60%; left: 2.40%; font-size: 2.00cqi; transform: translateY(-50%);` (Left-anchored).
* `customerName` (`ov-name`): `top: 3.40%; left: 10.70%; font-size: 2.00cqi; transform: translateY(-50%); max-width: 26%;` with dynamic `cqi` scaling down to `1.25cqi` for strings $> 18$ characters.
* `phoneNumber`: Centered mid-points:
  * `ov-num-area`: `top: 3.50%; left: 40.40%; font-size: 2.00cqi; transform: translate(-50%, -50%);`
  * `ov-num-prefix`: `top: 3.50%; left: 48.00%; font-size: 2.00cqi; transform: translate(-50%, -50%);`
  * `ov-num-line`: `top: 3.50%; left: 57.00%; font-size: 2.00cqi; transform: translate(-50%, -50%);`
* `planCost` (`ov-plan`): `top: 7.20%; left: 16.30%; font-size: 2.00cqi; transform: translate(-50%, -50%);`
* `deviceNet` (`ov-device`): `top: 7.30%; left: 26.00%; font-size: 2.00cqi; transform: translate(-50%, -50%);`
* `taxes` (`ov-taxes`): `top: 7.30%; left: 35.40%; font-size: 2.00cqi; transform: translate(-50%, -50%);`
* `monthlyTotal` (`ov-monthly`): `top: 7.20%; left: 82.50%; font-size: 2.00cqi; transform: translate(-50%, -50%);`
* `term` (`ov-term`): `top: 7.20%; left: 90.80%; font-size: 2.00cqi; transform: translate(-50%, -50%);`
* `autopayMethod` (`ov-autopay`): `top: 14.00%; left: 3.60%; font-size: 1.55cqi; transform: translateY(-50%);` (Left-anchored).
* `dueDateDays` (`ov-duedate`): `top: 13.80%; left: 60.50%; font-size: 2.00cqi; transform: translate(-50%, -50%);`
* AT&T 4-Bill Overlays:
  * `ov-reimbursed`: `top: 34.60%; left: 40.80%; font-size: 2.00cqi; transform: translate(-50%, -50%);`
  * `ov-nonreimbursed`: `top: 38.00%; left: 40.80%; font-size: 2.00cqi; transform: translate(-50%, -50%);`
  * `ov-bill1-actual`: `top: 42.20%; left: 35.00%; font-size: 2.00cqi; transform: translate(-50%, -50%);`
  * `ov-bill2-actual`: `top: 42.10%; left: 53.50%; font-size: 2.00cqi; transform: translate(-50%, -50%);`
  * `ov-bill3-actual`: `top: 42.00%; left: 71.00%; font-size: 2.00cqi; transform: translate(-50%, -50%);`
  * `ov-bill4-actual`: `top: 42.00%; left: 89.50%; font-size: 2.00cqi; transform: translate(-50%, -50%);`
  * `ov-bill1-carrier`: `top: 46.20%; left: 34.90%; font-size: 2.00cqi; transform: translate(-50%, -50%);`
  * `ov-bill2-carrier`: `top: 46.30%; left: 53.40%; font-size: 2.00cqi; transform: translate(-50%, -50%);`
  * `ov-bill3-carrier`: `top: 46.30%; left: 70.50%; font-size: 2.00cqi; transform: translate(-50%, -50%);`
  * `ov-bill4-carrier`: `top: 46.20%; left: 89.00%; font-size: 2.00cqi; transform: translate(-50%, -50%);`

---

### 5. SECTION SUPPRESSION & MASKING OVERRIDES
* **Default Suppression:** For `vzw` and `tmo`, a solid white masking rectangle (`#ffffff`) covers top-sheet Y: 25.5% to 50.0%, concealing notices and comparison circles.
* **Manual Override Toggle:** A "White-out bill notices?" checkbox (`maskNotices`) allows unmasking VZW and TMO sections. When unchecked, the white mask hides, allowing reps to handwrite on the raw pre-printed lines.
* **AT&T Visibility:** Always shows the full notice and calculation overlays.

---

### 6. AT&T 4-BILL CALCULATION ENGINE
* `reimbursedActual = autopayCredit ($10) + (actFeeReturned ? 35 : 0) + deviceDiscount`.
* `reimbursedDisplay = Math.floor(reimbursedActual)`. Renders before `is reimbursed...`.
* `nonReimbursedActual`: Defaults to `$0.00` (`N/A`). Overridable by rep.
* `bill1Actual = Math.ceil(monthlyTotal + reimbursedActual + nonReimbursedActual)`.
* `bill2Actual`, `bill3Actual`, `bill4Actual`: Rendered as `${monthlyTotal}⁻ˣ` (superscript `-X`).
* `carrierBill1 = ${bill1Actual} ✓`.
* `carrierSubsequent = Math.ceil(monthlyTotal + autopayCredit + deviceDiscount)`. Rendered inside pre-printed oval strikethrough graphics labeled "wrong".

---

### 7. UI LAYOUT & PRINT MEDIA SPECIFICATION
* **Interactive UI:**
  * Form layout on left pane (`.gen-form-pane`); live WYSIWYG sheet on right (`.gen-preview-pane`).
  * Inputs adhere to M3 pill styling tokens.
* **Print Media Rules:**
  * Isolated via `@media print` with class `body.printing-generator`.
  * Renders standard US Letter (8.5" x 11") portrait orientation with zero margins.
  * Single-page constraint with `page-break-after: avoid; break-after: avoid`.

---

### 8. INTEGRATION BOUNDARIES & CACHE BUSTING
* **Module Ownership:** `js-generator.js` manages state calculation, input binding, and template population.
* **Document Engine Handoff:** Dispatches print jobs directly via `window.print()`.
* **Cache Busting:** Downstream consumers `js-app.js` and `index.html` pin version query strings (`./js-generator.js?v=0.1.4`, `styles.css?v=0.1.21`).