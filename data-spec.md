# PRICING & DATA SPECIFICATION
### Target Files: `stats.json`, `js/app.js`

---

### 1. DATA TRANSPORT
* **Direct Fetch:** `app.js` loads `stats.json`  
  using cache-busting timestamp:  
  `fetch('./stats.json?t=' + Date.now())`  
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

### 3. CANONICAL DICTIONARY
* **Structure:** Keyed lookup containing canonical  
  model names, capacities, colors, and carrier aliases.  
* **Matching:** Used by `print.js` to normalize labels  
  prior to table generation.  
