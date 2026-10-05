# SPECIFICATION: STATIC DOCUMENT PRINT ENGINE (docs.js)

### 1. Architectural Boundary
* `docs.js` executes static reference sheet and customer hand-out printing.
* Fully decoupled from `print.js` (EDLP shelf-tag price engine).

### 2. Document Registry Schema
* `takehome`: Take Home Sheet (`ths3-1.png`), tutorial enabled.
* `intake`: Postpaid Intake Sheet (`postpaid-IS.png`).
* `prepaidintake`: Prepaid Intake Sheet (`prepaid-IS.png`).
* `warpcalls`: WARP Calls Guide (`https://i.imgur.com/0YAC03J.png`).
* `vzwtrade`: Verizon Trade-in Guide (`https://i.imgur.com/1vBTDLU.png`, locked/caution gate).
* `iphonetransfer`: iPhone Transfer Guide (`https://i.imgur.com/TVFeWTr.png`, locked/caution gate).
* `scrappaper`: Scrap Paper cutting guide (`scrap-paper.png`).

### 3. Safety Gate Architecture
* Caution modals safeguard unfinished workflows (`vzwtrade`, `iphonetransfer`).
* Explicit user acknowledgment required prior to clearing lock state and initiating print dialog.

### 4. Print Lifecycle & Clean-up
* Applies targeted class `printing-[docId]` to document body.
* `cleanupPrint()` executes on touch/click return to prevent persistent layout mutations.