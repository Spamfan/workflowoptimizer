# SPECIFICATION: STATIC DOCUMENT PRINT ENGINE (docs.js)

### 1. Architectural Boundary
* `docs.js` executes static reference sheet and customer hand-out printing.
* Fully decoupled from `print.js` (EDLP shelf-tag price engine).

### 2. Document Registry Schema
* `takehome`: Take Home Sheet (`ths3-1.png`), tutorial enabled.
* `intake`: Postpaid Intake Sheet (`postpaid-IS.png`).
* `prepaidintake`: Prepaid Intake Sheet (`prepaid-IS.png`).
* `warpcalls`: WARP Calls Guide (`warp-calls.png`).
* `vzwtrade`: Verizon Trade-in Guide (`vzw-trade.png`, locked/caution gate).
* `iphonetransfer`: iPhone Transfer Guide (`iphone-transfer.png`, locked/caution gate).
* `scrappaper`: Scrap Paper cutting guide (`scrap-paper.png`).

### 3. Safety Gate Architecture
* Caution modals safeguard unfinished workflows (`vzwtrade`, `iphonetransfer`).
* Explicit user acknowledgment required prior to clearing lock state and initiating print dialog.

### 4. Print Lifecycle & Clean-up
* Applies targeted class `printing-[docId]` to document body.
* `cleanupPrint()` executes on touch/click return to prevent persistent layout mutations.
* Enforces zero `@page` margin policy (`size: letter portrait; margin: 0;`) so 8.5" × 11" pre-formatted sheets print full-bleed with no shrink scaling.
* Suppresses `#print-view` during static doc prints (`body[class*="printing-"] #print-view { display: none !important; }`) to prevent trailing blank page ejections.

### 5. Static Asset Cache Busting
* All document sheets and tutorial illustrations dynamically bind a version query parameter (`?v=${DOCS_VERSION}`) on image URLs during DOM generation.
* Whenever a static document asset is updated or replaced under an existing filename, `DOCS_VERSION` in `docs.js` must be bumped by one patch version.
* Under the Downstream Ripple Mandate, bumping `docs.js` requires updating the query string import in `app.js` and bumping `app.js` and `index.html`.