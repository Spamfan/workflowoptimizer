# PRINT ENGINE SPECIFICATION
### Target Files: `js/print.js`, `styles.css`

---

### 1. LAYOUT ARCHITECTURE
* **Asymmetric 2-Column Layout:** High-density  
  split layout. Left column (~42%) stacks ATT  
  above VZW. Right column (~56%) stacks TMO  
  above Apple Devices (wider width accommodates  
  multi-carrier pricing).  
* **Canonical Intake Sorting:** Carrier tables  
  sort devices alphabetically by their original  
  intake name (`dev.name`), never by abbreviations.  
* **Header Architecture:** Title is bold "Recent EDLP  
  Reports (internal use only)" with early development  
  disclaimer immediately underneath.  
* **External Interactive Hint:** Tutorial hint  
  resides outside the sheet preview, situated between  
  navigation controls and the paper viewport.  
* **Total Installment Pricing:** All single and  
  multi-carrier prices explicitly include `# PRINT ENGINE SPECIFICATION
### Target Files: `js/print.js`, `styles.css`

---

### 1. LAYOUT ARCHITECTURE
* **Asymmetric 2-Column Layout:** High-density  
  split layout. Left column (~42%) stacks ATT  
  above VZW. Right column (~56%) stacks TMO  
  above Apple Devices (wider width accommodates  
  multi-carrier pricing).  
* **Canonical Intake Sorting:** Carrier tables  
  sort devices alphabetically by their original  
  intake name (`dev.name`), never by abbreviations.  
* **Header Architecture:** Title is bold "Recent EDLP  
  Reports (internal use only)" with early development  
  disclaimer immediately underneath.  
* **External Interactive Hint:** Tutorial hint  
  resides outside the sheet preview, situated between  
  navigation controls and the paper viewport.  
 currency  
  signs (e.g., `$TOTAL`, `$TOTAL ($DP + $MO/mo)`).  
* **Typography & Header Parity:** All sheet labels,  
  headers, and prices match device name font size  
  (`0.76rem`). Carrier titles are underlined. Column  
  header is strictly "Device name".  
* **Store Defaults Factory Whitelist:** Unedited  
  initial load and "Reset list to defaults" restore  
  the curated baseline store active list, moving all  
  other catalog entries into the "Other devices" drawer.  
* **Apple Segregation:** All iPhones segregate  
  strictly into the Apple Devices table (checked via  
  canonical name and root abbreviations); zero  
  iPhones appear in ATT, VZW, or TMO tables.  
* **Carrier Priority:** Apple stock resolves in order:  
  ATT -> VZW -> TMO.  
* **Legacy Filter:** Purge obsolete iPhone 11/12/13.  

---

### 2. INTERACTIVE CELL OVERRIDES & RECOVERY
* **In-Place Edits:** Tap price to edit; right-click  
  row to highlight ('partial' | 'full' cycle).  
* **Instant Hide & Collapse:** Tapping a device row  
  immediately hides it from the report. Subsequent  
  rows collapse upward with zero empty gaps.  
* **Other Devices Sticky Drawer:** Fixed to bottom-right  
  viewport. Collapsible dock tab displays hidden count.  
  Categorized by carrier (ATT, VZW, TMO, Apple). Tapping  
  any item teleports it back to the active report in  
  strict alphabetical order by intake name (`dev.name`).  
* **Action Toasts & Swipe Dismissal:** Hiding a device  
  spawns a toast (3s timeout, max 5 stacked) with an inline  
  yellow "Undo" button and horizontal touch swipe-to-dismiss.  
* **Mobile RTC Toolbar:** Rich text controls dock dynamically  
  above virtual keyboard via `visualViewport` tracking,  
  with left-aligned dark controls.  
* **50-Step History Stack:** In-memory stack supporting  
  up to 50 undo/redo states via compact pill controls  
  with hotkey hints (`Ctrl+Z`, `Ctrl+Y`).  
* **Reset Confirmation Modal:** "Reset list to defaults"  
  triggers a 4-way dismissible confirmation modal  
  (Cancel, backdrop click, Escape, popstate) before  
  restoring whitelist defaults, clearing overrides,  
  comments, and highlights.  
* **Session Overrides:** Client state persists across  
  refresh via unified keys `wfo_price_sheet_state` and  
  `wfo_saved_comment` without requiring store credentials.  
* **Footer Notice Rules:** Manually hidden devices  
  and report comments are omitted from footer edit notices.  
  The notice `[This document was edited from the original]`  
  triggers strictly and exclusively on price overrides.  

---

### 3. PHYSICAL 1-PAGE CONSTRAINTS & MARGIN DEFENSE
* **Letter Paper Geometry Lock:** On-screen sheet preview  
  locks to Letter proportions (`aspect-ratio: 8.5 / 11; width: 8.5in; height: 11in;`)  
  preventing vertical elongation.  
* **Margin Safeguards:** Enforces `0.35in 0.4in` printable buffer  
  via `@page` rules and `.print-preview-sheet` padding so prints  
  with "Margins: None" never clip against paper edges.  
* **Silent Driver:** Background hidden `<iframe>`  
  handles the print trigger with auto-cleanup.  
* **Physical Bound:** Strictly enforces 1-page output:  
  `max-height: 10.8in !important; overflow: hidden !important;`  
