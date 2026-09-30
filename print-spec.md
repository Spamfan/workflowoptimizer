# PRINT ENGINE SPECIFICATION
### Target Files: `js/print.js`, `styles.css`

---

### 1. LAYOUT ARCHITECTURE
* **2-Column Typewriter Table:** Formats device  
  pricing in a high-density, 2-column layout.  
* **Canonical Intake Sorting:** Carrier tables  
  sort devices alphabetically by their original  
  intake name (`dev.name`), never by abbreviations.  
* **Header Architecture:** Title is strictly bold  
  "Recent EDLP reports"; timestamp and store  
  number logic are deprecated and stripped.  
* **Inline Disclaimer Pill:** Placed immediately  
  to the right of the title in the header row,  
  displaying a circular exclamation icon with text:  
  "This software is in early development and may make mistakes."  
* **Apple Segregation:** iPhones segregate into a  
  dedicated top table (no Apple Watches in catalog).  
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
* **Action Toasts:** Hiding a device spawns an auto-  
  dismissing toast near the bottom (3s timeout, max 5  
  stacked) with an inline yellow "Undo" button.  
* **50-Step History Stack:** In-memory stack supporting  
  up to 50 undo/redo states via UI pill controls or  
  standard desktop keyboard shortcuts (`Ctrl+Z`, `Ctrl+Y`).  
* **Reset Confirmation Modal:** "Reset list to defaults"  
  triggers a 4-way dismissible confirmation modal  
  before clearing overrides, comments, and highlights.  
* **Session Overrides:** Overrides persist across  
  refresh via `localStorage['wfo_price_sheet_hidden_{store}']`.  
* **Edited Notice:** When any cell override is active,  
  footer forces notice:  
  `[This document was edited from the original]`  

---

### 3. PHYSICAL 1-PAGE CONSTRAINTS
* **Silent Driver:** Background hidden `<iframe>`  
  handles the print trigger with auto-cleanup.  
* **Physical Bound:** Strictly enforces 1-page output:  
  `max-height: 10.8in !important; overflow: hidden !important;`  
