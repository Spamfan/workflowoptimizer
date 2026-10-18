# PRICING & DATA SPECIFICATION
### Target Files: `data-stats.json`, `js-app.js`

---

### 1. DATA TRANSPORT & SYNC
* **Direct Fetch (Read):** `js-app.js` loads `data-stats.json`  
  using cache-busting timestamp:  
  `fetch('./data-stats.json?t=' + Date.now())`  
* **Direct Commit (Write):** Updates commit directly to  
  GitHub via REST API (`PUT /repos/{owner}/{repo}/contents/data-stats.json`)  
  using fine-grained PAT stored in `localStorage`.  
* **Offline Defense:** Retain last successful  
  payload in memory during session.  

---

### 2. PRICING & PROMOTION SCHEMA
* **EDLP:** Everyday Low Price (retail monthly cost).  
* **BIC:** Bill Incentive Credit (monthly promo).  
* **Value Rules:**  
  * `null`: Not offered / carrier unsupported (shows `-`).  
  * `0`: Free / $0 promotional cost.  
  * `> 0`: Active monthly dollar promotional credit.  
* **Dashboard Entry:** Accessed via the "Print EDLPs"  
  dashboard card action.  

---

### 3. CANONICAL DICTIONARY & ORDERING
* **Structure:** Keyed lookup containing canonical  
  device entries with `name`, `abbr`, and carrier pricing.  
* **Alphabetical Ordering:** Devices in `data-stats.json`  
  and all editing tools must maintain strict  
  alphabetical ordering by full intake `name`.  
* **Matching:** Used by `js-print.js` to normalize labels  
  prior to table generation.  

---

### 4. CARRIER EXCLUSIVITY & NULLABILITY
* **Supported Carriers:** Valid positive numeric value or `0`.  
* **Unsupported / Omitted Carriers:** Value set strictly  
  to `null` (`attMO: null`, `vzwMO: null`, or `tmoDP: null,`  
  `tmoMOADP: null, tmoMO: null`). `js-print.js` automatically  
  omits unsupported items from carrier tables.  
* **T-Mobile Sub-Keys:** `tmoMO` represents monthly cost  
  with $0 down payment. `tmoDP` is down payment, and  
  `tmoMOADP` is monthly payment after down payment.  
