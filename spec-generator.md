# BILL GENERATOR SPECIFICATION
### Subsystem: `generator.js`
### Document Version: `v0.1.4`

---

### 1. OVERVIEW & SCOPE
* **Purpose:** Provides a rapid, kiosk-optimized customer quote and onboarding tear-sheet generator for wireless device financing and rate plan estimates.
* **Multi-Carrier Scope:** Supports AT&T (`att`), Verizon (`vzw`), and T-Mobile (`tmo`) single-line and multi-line customer setups.
* **Core Output:** Compiles a 2-up printable tear-sheet (2 handouts per 8.5" x 11" page) using base sheet asset `ths3-1.png`.
* **Zero-Margin Baked Layout Mandate:** Outer 0.35"–0.4" sheet margins are pre-baked directly into `ths3-1.png`. The stage container and print rules enforce strictly `margin: 0; padding: 0; border: none;` to maintain exact 1:1 coordinate registration.
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
* `carrier`: Left-anchored on pre-printed carrier underline.
* `customerName`: Left-anchored on `___ for` line with `max-width: 17.5%` and auto-scaling font size for names $> 18$ characters.
* `phoneNumber`: 10 digits parsed into 3 discrete mid-point centered slots (`ov-num-area`, `ov-num-prefix`, `ov-num-line`) centered over respective blank underlines. Pre-printed dashes remain untouched.
* `planCost`: Mid-point centered over `PLAN(S)` blank.
* `deviceRetailMonthly` / `deviceMonthlyCredit`: Computes net installment `deviceNet = Math.max(0, retail - credit)`. Mid-point centered over `DEVICE(S)` blank.
* `state` & `taxes`: State tax defaults. Mid-point centered over `TAXES/FEES` blank.
* `monthlyTotal`: `Math.ceil(planCost + deviceNet + taxes)` mid-point centered before `/mo`.
* `term`: Mid-point centered inside `(___yr)` (e.g. `3` or `2`).
* `autopayMethod`: Left-anchored on line before `and paperless billing to email`.
* `dueDateDays`: Mid-point centered before `days or date selected for autopay`.
* `ov-bill-drop`: Minus-X suffix `⁻ˣ` anchored directly beneath the vertical dashed arrow terminus for AT&T Bills 2, 3, and 4.

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
* **Module Ownership:** `generator.js` manages state calculation, input binding, and template population.
* **Document Engine Handoff:** Dispatches print jobs directly via `window.print()`.
* **Cache Busting:** Downstream consumers `app.js` and `index.html` pin version query strings (`./generator.js?v=0.1.2`, `styles.css?v=0.1.19`).