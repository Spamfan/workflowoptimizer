# BILL GENERATOR SPECIFICATION
### Subsystem: `generator.js`
### Document Version: `v0.1.1`

---

### 1. OVERVIEW & SCOPE
* **Purpose:** Provides a rapid, kiosk-optimized customer quote and onboarding tear-sheet generator for wireless device financing and rate plan estimates.
* **Initial Target Scope:** Exclusively scoped to Verizon Wireless (VZW) single-line accounts on the "Simplicity" rate plan, with architectural hooks for AT&T (ATT) and T-Mobile (TMO) multi-carrier expansion.
* **Core Output:** Renders an interactive digital replica of the physical counter handout that compiles into a 2-up printable tear-sheet (2 handouts per 8.5" x 11" page).

---

### 2. SECURITY & ZERO-KNOWLEDGE ARCHITECTURE
* **Passcode / PIN Strict Exclusion:**
  * The customer PIN / Passcode must NEVER be entered into the UI, DOM inputs, memory objects, or browser storage.
  * The digital interface displays a disabled or blank physical placeholder line for PIN/Passcode.
  * The physical print layout renders an empty underline (`________`) designated strictly for post-print manual customer handwriting.
* **PII & Storage Policy:**
  * Customer Name (`Name`) and Phone Number (`Number`) remain ephemeral to the active session.
  * Non-PII configuration defaults (Carrier, State, Autopay instrument, Due date offset) persist in browser storage under key `localStorage['wfo_bill_gen']`.

---

### 3. DATA SCHEMA & FIELD DEFINITIONS
* `Carn` (Carrier): String token. Default: `"VZW"`. Extensible to `"ATT"`, `"TMO"`.
* `Name` (Customer Name): String, ceiling: 22 characters. Format: First and Last Name or First Name + Last Initial.
* `Number` (Phone Number): String, strictly 10 digits. Masking toggle optional in UI; strictly unmasked on physical print output (`XXX-XXX-XXXX` or 10 digits literal).
* `BP` (Base Plan): Currency float. Default: `25.00` (Simplicity rate plan).
  * Lookup triggers:
    * `BP == 25.00` -> Plan identified as `simplicity`
    * `BP == 65.00` -> Plan identified as `welcome`
    * `BP == 80.00` -> Plan identified as `plus`
    * `BP == 90.00` -> Plan identified as `ultimate`
* `Devi` (Device Installment): Currency float. Default: `0.00`. Monthly financing installment.
* `taf` (Taxes & Fees): Currency float.
  * Auto-fill rule: When `plan == 'simplicity'` and `state == 'NH'`, default `taf = 8.00`. User-overridable.
* `mo` (Monthly Estimate Total): Computed currency float.
  * Calculation: `raw = BP + Devi + taf`
  * Monthly Total Rounding: Always rounded UP to the nearest whole integer dollar (`Math.ceil(raw)`), e.g., $25 + $3.03 + $8 = $36.03 -> `~$37/mo`.
* `term`: String label. Default: `"(3 yr)"`.
* `pmt` (Payment Method): String token. Default: `"CHECKING ACCT"`.
* `date` (Due Date Offset): Integer days. Default: `20` days from activation.

---

### 4. MULTI-CARRIER SUPPRESSION & CALCULATION ENGINE
* **VZW & T-Mobile Suppression:**
  * When `Carn == "VZW"` or `Carn == "TMO"`, a pure white masking rectangle (`#ffffff`) covers top-sheet Y: 25.5% to 50.0%, concealing the notices and bill estimate comparison circles.
* **AT&T Reimbursement Equations:**
  * `Reimbursed = 10 (autopay) + (35 if act fee returned) + device credit`. Visual display rounds DOWN (`Math.floor(Reimbursed)`), formatted as `~[reimbursed]`.
  * `Non-reimbursed`: Defaults to `$0.00` (`N/A`), user-overridable.
  * `Bill 1 Actual = Math.ceil(Monthly + Reimbursed + NonReimbursed)`.
  * `Bills 2 & 3 Actual = [Monthly] - X`.
  * `Bill 1 Carrier Estimate = Bill 1 Actual` with checkmark (`✓`).
  * `Bills 2 & 3 Carrier Estimate = Math.ceil(Monthly + 10 + device credit)` enclosed in circle with strike-through (`✕`).

---

### 5. UI LAYOUT & PRINT MEDIA SPECIFICATION
* **Interactive UI:**
  * Form layout visually matches the physical tear-sheet layout.
  * Modifiable fields render as light gray pill inputs matching M3 tokens.
  * Any gray field is user-editable; default auto-fills populate automatically upon field dependency updates (e.g., changing BP updates plan type; changing plan/state updates taf).
* **2-Up Print Format:**
  * Optimized for standard US Letter (8.5" x 11") portrait orientation via `@media print`.
  * Top half: Tear-sheet Copy 1.
  * Bisecting center line: Horizontal dashed scissor cut line (`- - - - - - - - - - - - - - - - - - - - - - - - - - - -`).
  * Bottom half: Tear-sheet Copy 2.
  * Underlines, callout boxes, and typography render with crisp, high-contrast print borders.

---

### 6. INTEGRATION BOUNDARIES
* **Module Ownership:** `generator.js` manages state calculation, input binding, and template population.
* **Document Engine Handoff:** Integrates directly with `docs.js` via modal launch or direct print dispatch (`window.print()`).
* **Cache Busting:** Future integration into `app.js` and `index.html` must follow query-string pinning rules (`./generator.js?v=0.1.0`).