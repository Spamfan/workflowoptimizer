# PRINT ENGINE SPECIFICATION
### Target Files: `js/print.js`, `styles.css`

---

### 1. LAYOUT ARCHITECTURE
* **2-Column Typewriter Table:** Formats device  
  pricing in a high-density, 2-column layout.  
* **Apple Segregation:** iPhones and Apple Watches  
  segregate into a dedicated top table.  
* **Carrier Priority:** Apple stock resolves in order:  
  ATT -> VZW -> TMO.  
* **Legacy Filter:** Purge obsolete iPhone 11/12/13.  

---

### 2. INTERACTIVE CELL OVERRIDES
* **In-Place Edits:** Tap price/device to edit;  
  tap to toggle visibility; right-click to highlight.  
* **Session Overrides:** Overrides persist across  
  refresh via `sessionStorage['wfo_print_overrides_{store}']`.  
* **Edited Notice:** When any cell override is active,  
  footer forces notice:  
  `[This document was edited from the original]`  

---

### 3. PHYSICAL 1-PAGE CONSTRAINTS
* **Silent Driver:** Background hidden `<iframe>`  
  handles the print trigger with auto-cleanup.  
* **Physical Bound:** Strictly enforces 1-page output:  
  `max-height: 10.8in !important; overflow: hidden !important;`  
