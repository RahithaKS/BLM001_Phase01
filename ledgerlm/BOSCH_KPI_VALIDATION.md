# Bosch KPI Data Validation Report

**Date**: February 9, 2026  
**Database**: Neon PostgreSQL (cube_id: c1186804-7750-4fc2-bdc6-c5b94a11cc56)  
**Data Source**: MV_GB_INSIGHTS Excel file (766K+ rows)  
**Reference**: Queries_02 document + Data_validation_Bosch.docx (PowerBI values)

---

## Summary of Findings

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Outsourcing capacity uses employee_number filter not in Queries_02 spec | Medium | Kept per user request |
| 2 | Capacity Mix uses END capacity instead of AVG capacity | HIGH | **Needs Fix** |
| 3 | Capacity Mix missing `sector <> 'INTERNAL'` filter on Internal side | HIGH | **Needs Fix** |
| 4 | Price Mix uses wrong cost_category `'WW Employee Summary'` instead of `'WW Employee'` | HIGH | **Needs Fix** |
| 5 | Price Mix includes `'Differential'` in rate_classification but Queries_02 only has `'Premium','Lead'` | Medium | **Needs Fix** |
| 6 | Budget/Avg Cap formula doesn't match Queries_02 spec | HIGH | **Needs Fix** |
| 7 | Naming mismatch (underscore vs space) caused all KPI queries to fail | HIGH | **Fixed** |

---

## KPI-by-KPI Analysis

### 1. Offshore Average Capacity ✅ CORRECT

**Queries_02 Spec**:
```sql
SELECT SUM("Capacity") / month
FROM MV_GB_INSIGHTS_ALL 
WHERE "Cost Category" = 'GB Wise END Capacity'
  AND "Year" = 2025 AND "Month" <= month
  AND TRIM("Onsite/Offshore") = 'OFFSHORE'
  AND "Resource Type" = 'Internal'
  AND "Sector" <> 'INTERNAL'
  AND "Service Area" NOT IN ('Corporate','RBEI_CORPORATE','SDS_CORPORATE')
```

**Our Implementation**: `_build_offshore_capacity_avg_sql` (line 4835)
- ✅ cost_category = 'GB Wise END Capacity'
- ✅ onsite_offshore = 'OFFSHORE'
- ✅ resource_type = 'Internal'
- ✅ sector <> 'INTERNAL'
- ✅ Service Area exclusion
- ✅ YTD average (SUM / month count)

**Data Validation**:

| Entity | Jan 2025 (Ours) | Jan 2025 (PowerBI) | Feb 2025 (Ours) | Feb 2025 (PowerBI) |
|--------|----------------|-------------------|-----------------|-------------------|
| BGSW | 26,445 | 26,445 | 26,385 | 26,385 |
| BGSV | 3,824 | 3,824 | 3,823 | 3,823 |
| BGSW/NE-MX | 727 | 727 | 724 | 724 |

**Result**: ✅ All values match PowerBI exactly.

---

### 2. Offshore End Capacity ✅ CORRECT

**Queries_02 Spec**:
```sql
SELECT SUM("Capacity")
FROM MV_GB_INSIGHTS_ALL 
WHERE "Cost Category" = 'GB Wise END Capacity'
  AND "Year" = 2025 AND "Month" = month
  AND "Onsite/Offshore" = 'OFFSHORE'
  AND "Resource Type" = 'Internal'
  AND "Sector" <> 'INTERNAL'
  AND "Service Area" NOT IN ('Corporate','RBEI_CORPORATE','SDS_CORPORATE')
```

**Our Implementation**: `_build_offshore_capacity_end_sql` (line 4869)
- ✅ All filters match spec exactly

**Data Validation**:

| Entity | Jan 2025 (Ours) | Jan 2025 (PowerBI) | Feb 2025 (Ours) | Feb 2025 (PowerBI) |
|--------|----------------|-------------------|-----------------|-------------------|
| BGSW | 26,445 | 26,445 | 26,324 | 26,324 |
| BGSV | 3,824 | 3,824 | 3,822 | 3,822 |
| BGSW/NE-MX | 727 | 727 | 720 | 720 |

**Result**: ✅ All values match PowerBI exactly.

---

### 3. Outsourcing Average Capacity ⚠️ INTENTIONAL DEVIATION

**Queries_02 Spec** (NO employee_number filter):
```sql
SELECT SUM("Capacity") / month
FROM MV_GB_INSIGHTS_ALL 
WHERE "Cost Category" = 'GB Wise END Capacity'
  AND "Year" = 2025 AND "Month" <= month
  AND TRIM("Onsite/Offshore") = 'OFFSHORE'
  AND "Resource Type" = 'External'
  AND "Service Area" NOT IN ('Corporate','RBEI_CORPORATE','SDS_CORPORATE')
```

**Our Implementation**: `_build_outsourcing_capacity_avg_sql` (line 4891)
- ✅ cost_category = 'GB Wise END Capacity'
- ✅ onsite_offshore = 'OFFSHORE'
- ✅ resource_type = 'External'
- ✅ Service Area exclusion
- ✅ YTD average (SUM / month count)
- ⚠️ EXTRA: employee_number != '0' AND employee_number != '0.0' (not in Queries_02)

**Note**: The Queries_02 spec does NOT include employee_number filtering, but the KPI_Metrics_Logic document requires `Employee Number <> 0 and <> BLANK()`. User confirmed to keep the employee_number filter.

**Data Validation**:

| Entity | Feb (No emp filter) | Feb (With emp filter) | PowerBI |
|--------|--------------------|-----------------------|---------|
| BGSW | 2,825 | 2,825 | 2,825 |
| BGSV | 308 | 301 | 301 |
| BGSW/NE-MX | 1 | 0 | 0 |

**Result**: ✅ With employee_number filter, matches PowerBI for BGSV (301) and BGSW/NE-MX (0).

---

### 4. Outsourcing End Capacity ⚠️ NEEDS EMPLOYEE FILTER CHECK

**Queries_02 Spec**: Same as avg but without YTD division (single month).

**Data Validation (Feb 2025)**:

| Entity | No emp filter | With emp filter | PowerBI |
|--------|--------------|-----------------|---------|
| BGSW | 2,786 | TBD | 2,786 |
| BGSV | 286 | TBD | 286 |
| BGSW/NE-MX | 1 | TBD | 0 |

**Result**: BGSW and BGSV match PowerBI without employee filter. BGSW/NE-MX is 1 vs PowerBI 0.

---

### 5. Capacity Mix % ❌ BUGS FOUND

**Queries_02 Spec**:
```
Capacity Mix % = Avg Offshore / Total (Offshore + Outsourcing)
```
Uses **AVG** (YTD average) not END capacity.

**Current Implementation Issues**:

1. **BUG: Uses END capacity instead of AVG**: The `_build_internal_capacity_mix_sql` (line 4571) uses `where_clause` with single month, not YTD expanded months. The Queries_02 spec says to use Avg Offshore and Avg Outsourcing.

2. **BUG: Missing `sector <> 'INTERNAL'` filter**: The Internal capacity side doesn't exclude `sector = 'INTERNAL'` in the current implementation, but the Queries_02 offshore spec requires it.

**Correct Formula for Feb 2025**:
- Avg Offshore = Offshore Avg Capacity = 26,385 (BGSW)
- Avg Outsourcing = Outsourcing Avg Capacity = 2,825 (BGSW)  
- Internal Mix % = 26,385 / (26,385 + 2,825) = 90.33%
- External Mix % = 2,825 / (26,385 + 2,825) = 9.67%

**Data Validation (Feb 2025 with AVG + sector filter)**:

| Entity | Offshore Avg | Outsrc Avg | Internal Mix % | External Mix % |
|--------|-------------|-----------|---------------|----------------|
| BGSW | 26,385 | 2,825 | 90.33% | 9.67% |
| BGSV | 3,823 | 308 | 92.55% | 7.45% |
| BGSW/NE-MX | 724 | 1 | 99.86% | 0.14% |

---

### 6. Revenue ✅ CORRECT (needs format confirmation)

**Queries_02 Spec**:
```sql
SELECT SUM("Amount in USD") / 1000000
FROM MV_GB_INSIGHTS_ALL 
WHERE "Cost Category" = 'Revenue Summary'
  AND "Year" = 2025 AND "Month" = month
```

**Our Implementation**: `_build_revenue_sql` (line 5264)
- ✅ cost_category = 'Revenue Summary'
- ⚠️ Returns raw amount, not divided by 1M (display concern only)

**Data Validation (Feb 2025 - cumulative YTD)**:

| Entity | Revenue (raw) | Revenue (M) |
|--------|--------------|-------------|
| BGSW | 200,838,783 | 200.84 |
| BGSV | 27,600,607 | 27.60 |
| BGSW/NE-MX | 8,174,023 | 8.17 |

---

### 7. Budget / Avg Capacity ❌ FORMULA MISMATCH

**Queries_02 Spec**:
```
Budget/Avg Cap = (Revenue) / (Avg Offshore + Avg Outsourcing) / month
```

**Current Implementation**: `_build_budget_per_capacity_sql` (line 4684)
- Uses `Revenue / END Capacity` (single month), not `Revenue / (Avg Offshore + Avg Outsourcing) / month`
- Missing separation between Offshore (Internal) and Outsourcing (External) in denominator
- Missing `sector <> 'INTERNAL'` filter

**Data Validation (Jan 2025)**:

| Entity | Revenue | Offshore | Outsourcing | Budget/Avg (correct) | PowerBI |
|--------|---------|----------|-------------|---------------------|---------|
| BGSW | 67,336,950 | 26,445 | 2,864 | 2,297 | 2,297 |
| BGSV | 11,375,403 | 3,824 | 330 | 2,738 | 2,748 |
| BGSW/NE-MX | 3,558,877 | 727 | 1 | 4,889 | 4,895 |

**Note**: Small discrepancies in BGSV (2,738 vs 2,748) and BGSW/NE-MX (4,889 vs 4,895) may be due to outsourcing employee_number filter differences affecting the denominator.

---

### 8. Attrition % ✅ MOSTLY CORRECT

**Queries_02 Spec**:
```
Attrition% = (Attrition / Avg Headcount) / month * 12
Attrition: cost_category='Attrition', Resource Type='Internal', month=specific
Avg Headcount: cost_category='GB Wise END Capacity', Resource Type='Internal', SUM/month
```

**Our Implementation**: `_build_attrition_pct_sql` (line 4228)
- ✅ Uses correct formula: YTD_Attrition * 12 * 100 / Total_Capacity_YTD  
- ✅ resource_type = 'Internal'
- ✅ Uses both 'Attrition' and 'GB Wise END Capacity' cost categories
- ⚠️ Queries_02 shows Attrition for specific month only (month=2), not YTD sum. Current implementation sums attrition YTD which may differ.

---

### 9. Pyramid Mix ✅ CORRECT

**Queries_02 Spec**:
```
Pyramid Mix = (Level / Total) * 100
Level: SL in ('48','49','50','51'), Internal, Offshore, sector <> 'INTERNAL'
Total: All SL, Internal, Offshore, sector <> 'INTERNAL'
```

**Our Implementation**: `_build_pyramid_mix_sql` (line 4319)
- ✅ SALARYLEVEL IN ('48','49','50','51') via SPLIT_PART
- ✅ resource_type = 'Internal'
- ✅ onsite_offshore = 'OFFSHORE'
- ✅ sector != 'INTERNAL'
- ✅ cost_category = 'GB Wise END Capacity'

---

### 10. Price Mix ❌ WRONG cost_category

**Queries_02 Spec**:
```sql
-- Differential
SELECT SUM("Billed Capacity")
WHERE "Cost Category" = 'WW Employee Summary'
  AND "RATE CLASSIFICATION" IN ('Premium','Lead')
  AND "VKM Code" NOT IN ('0001','0002','0003')

-- Total
SELECT SUM("Billed Capacity")
WHERE "Cost Category" = 'WW Employee Summary'
  AND "VKM Code" NOT IN ('0001','0002','0003')
```

**Our Implementation**: `_build_price_mix_sql` (line 4147)
- ❌ Uses `cost_category = 'WW Employee Summary'` but DB has `'WW Employee'`
- ❌ Uses `rate_classification IN ('Lead', 'Premium', 'Differential')` but spec only has `('Premium', 'Lead')`
- ✅ vkm_code NOT IN ('0001', '0002', '0003')

**Data**: The `'WW Employee Summary'` category does NOT exist in the database. The correct category is `'WW Employee'` (112,460 rows). Available rate_classification values: Normal (75,296), Lead (29,175), Premium (4,417).

**Validation with corrected filters (Feb 2025)**:

| Entity | Premium+Lead | Total Billed | Price Mix % |
|--------|-------------|-------------|-------------|
| BGSW | 5,912.63 | 21,920.63 | 26.97% |
| BGSV | 346.28 | 2,820.28 | 12.28% |
| BGSW/NE-MX | 7.76 | 354.11 | 2.19% |

---

## Root Cause Analysis

### Issue 1: Naming Convention Mismatch (FIXED)
- **Root Cause**: LLM metric routing returns underscore-format IDs (`outsourcing_capacity_avg`) but database and hardcoded builders expect space-format (`outsourcing capacity avg`).
- **Impact**: ALL Bosch KPI queries returned "Calculation not found", causing AI to fall back to generic "I don't have your dataset" response.
- **Fix**: Added `calculation_name.replace('_', ' ')` normalization at entry point of `compile_calculation_sql`.

### Issue 2: Capacity Mix Uses Wrong Aggregation
- **Root Cause**: `_build_internal_capacity_mix_sql` and `_build_external_capacity_mix_sql` use single-month WHERE clause (END capacity) instead of YTD expanded WHERE clause (AVG capacity).
- **Impact**: Capacity mix percentages may differ from PowerBI, especially for entities with varying month-to-month capacity.
- **Fix Needed**: Convert to use `_expand_month_filter_for_ytd` and divide by month count, matching the Offshore/Outsourcing avg builders.

### Issue 3: Capacity Mix Missing sector Filter
- **Root Cause**: The Internal capacity CASE expression doesn't include `sector <> 'INTERNAL'` filter, but the Queries_02 offshore spec requires it.
- **Impact**: Includes INTERNAL sector data in offshore capacity calculations, inflating the Internal side.
- **Fix Needed**: Add `AND (sector IS NULL OR LOWER(sector) != 'internal')` to Internal capacity CASE expressions.

### Issue 4: Price Mix Wrong cost_category
- **Root Cause**: The Queries_02 document references `'WW Employee Summary'` but the actual data in the database uses `'WW Employee'` as the cost_category value. The "Summary" suffix doesn't exist.
- **Impact**: Price Mix query returns zero rows / empty results.
- **Fix Needed**: Change `cost_category = 'WW Employee Summary'` to `cost_category = 'WW Employee'` in `_build_price_mix_sql`.

### Issue 5: Price Mix Includes Differential
- **Root Cause**: Our code adds `'Differential'` to the rate_classification filter, but the Queries_02 spec only lists `('Premium', 'Lead')`.
- **Impact**: May over-count the premium capacity by including 'Differential' records.
- **Fix Needed**: Remove `'Differential'` from the rate_classification IN clause.

### Issue 6: Budget/Avg Cap Formula Mismatch
- **Root Cause**: Current `_build_budget_per_capacity_sql` uses `Revenue / END Capacity` (all offshore together), but Queries_02 says `Revenue / (Avg Offshore + Avg Outsourcing) / month`, which requires YTD averaging and separated Internal/External capacity.
- **Impact**: Budget per capacity values slightly differ from PowerBI expectations.

---

## Column Mapping Notes

| Queries_02 Column | Database Column | Notes |
|-------------------|----------------|-------|
| Cost Category | cost_category | Exact match |
| Year | year | Integer |
| Month | month | Integer |
| Region/Entity | region_entity | String |
| Onsite/Offshore | onsite_offshore | Values: 'OFFSHORE', 'ONSITE' |
| Resource Type | resource_type | Values: 'Internal', 'External' |
| Sector | sector | Values: various + 'INTERNAL' to exclude |
| Service Area | service_area | Map: new_service_area in DB |
| Capacity | capacity | Numeric |
| Amount in USD | amount_usd | Numeric |
| Billed Capacity | billed_capacity | Numeric |
| RATE CLASSIFICATION | rate_classification | Values: 'Normal', 'Lead', 'Premium' |
| VKM Code | vkm_code | String |
| SALARYLEVEL | salary_level | String (e.g., '48.0', '49.0') |
| Attrition | attrition | Numeric |
| Employee Number | employee_number | String (includes '0.0' values to exclude) |
| Include/Exclude | include_exclude | Values: 'Include', 'Exclude' |

## Data Notes

- `cost_category = 'WW Employee Summary'` does NOT exist. Correct value: `'WW Employee'` (112,460 rows)
- `employee_number = '0.0'` (not '0') is the format for zero employee records (38 rows in BGSV)
- `salary_level` values include decimal suffix (e.g., '48.0') - handled by SPLIT_PART in pyramid mix
- `rate_classification` has: Normal (75K), Lead (29K), Premium (4K), NULL (3.5K)
