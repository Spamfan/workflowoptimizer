# PRICING & DATA SPECIFICATION
### Target Files: `data-stats.json`, `js-app.js`

---

### 1. DATA TRANSPORT
* **Direct Fetch:** `js-app.js` loads `data-stats.json`  
  using cache-busting timestamp:  
  `fetch('./data-stats.json?t=' + Date.now())`  
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
