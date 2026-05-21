# Ultra-Granular KPI Manual Validation Guide

This guide provides step-by-step Excel instructions to manually validate each KPI metric against the system's calculations.

---

## DATA FILES NEEDED

1. **MV_GB_INSIGHTS** (Actual Data) - Your main Excel file with 750K+ rows
2. **Manual inputs MBR Master** (Plan Data) - Contains CTG adjustment values

---

## COLUMN REFERENCE (MV_GB_INSIGHTS)

| Column Name | Description |
|-------------|-------------|
| `Amount in USD` | Revenue/Cost values in USD |
| `Billed Capacity` | Billed capacity hours |
| `Capacity` | Total capacity |
| `Offshore Capacity` | Offshore capacity value |
| `Cap end` | End of period capacity |
| `Cost Category` | Category type (Revenue Summary, WW Employee Summary, etc.) |
| `Include/Exclude` | Filter for included data |
| `category_final` | Offshore, Onsite, Outsourcing, At actuals, BLANK |
| `Onsite/Offshore` | Location classification |
| `Resource Type` | Internal or External |
| `Service Area` | Area classification |
| `Order reason` | Order code (exclude Y36) |
| `Rate_class` / `RATE CLASSIFICATION` | Differential, Standard, etc. |
| `VKM Code` | VKM classification |
| `Sector` | Sector classification |
| `Employee Number` | Employee ID |
| `Project GB` | GB classification (MS, SX, VM, PS, XC) |
| `Region/Entity` | Entity name (BGSW, BGSV, etc.) |
| `Year` | Year |
| `Month` | Month number |

---

## CTG VALUES (from Manual inputs MBR Master)

| Metric | CTG Adjustment | Source |
|--------|---------------|--------|
| Budget/Avg Capacity Offshore | +245 | CTG Team |
| Total Capacity Average | +230 or +255 | CTG Team |
| Total Capacity END | +255 | CTG Team |
| Offshore Capacity Average | +234 | CTG Team |
| Offshore Capacity END | +140 | CTG Team |

---

# WORLD WIDE (WW) METRICS

---

## 1. BUDGET OFFSHORE

### Filter Points (Excel AutoFilter)
```
Column: category_final → Select: "Offshore", "At actuals", (Blanks)
Column: Order reason → Exclude: "Y36"
```

### Calculation
```
=SUMIFS([Amount in USD], 
        [category_final], {"Offshore","At actuals",""}, 
        [Order reason], "<>Y36")
```

### Excel Steps
1. Open MV_GB_INSIGHTS
2. Enable Data → Filter
3. Filter `category_final`: Select "Offshore", "At actuals", "(Blanks)"
4. Filter `Order reason`: Uncheck "Y36"
5. Sum the `Amount in USD` column for visible rows
6. Result = **Budget Offshore**

---

## 2. BUDGET OUTSOURCING

### Filter Points
```
Column: category_final → Select: "Outsourcing"
```

### Calculation
```
=SUMIF([category_final], "Outsourcing", [Amount in USD])
```

### Excel Steps
1. Filter `category_final`: Select only "Outsourcing"
2. Sum the `Amount in USD` column
3. Result = **Budget Outsourcing**

---

## 3. BUDGET / AVG CAPACITY - OFFSHORE (WW)

### Part A: Revenue (Numerator)
```
Filter:
- category_final: "Offshore", "At actuals", (Blanks)
- Order reason: NOT "Y36"

Calculate:
SUM([Amount in USD]) × 1,000,000 ÷ [Selected Month Number]
```

### Part B: Capacity (Denominator)
```
Filter:
- Onsite/Offshore: "Offshore"
- Resource Type: "Internal"
- Service Area: NOT IN ("Corporate", "RBEI_CORPORATE", "SDS_CORPORATE")

Calculate:
SUM([Offshore Capacity]) + 245  ← CTG Adjustment
```

### Final Calculation
```
= Part A ÷ Part B
```

### Excel Steps - DETAILED

**Step 1: Calculate Revenue**
1. Filter `category_final`: "Offshore", "At actuals", "(Blanks)"
2. Filter `Order reason`: Exclude "Y36"
3. Filter to your target Year and Month(s)
4. Sum `Amount in USD` → Note this as **REVENUE_SUM**
5. Calculate: `REVENUE_SUM × 1,000,000 ÷ MONTH_COUNT`
   - If August data: divide by 8
   - This gives **REVENUE_PER_MONTH**

**Step 2: Calculate Capacity**
1. Clear filters
2. Filter `Onsite/Offshore`: "Offshore"
3. Filter `Resource Type`: "Internal"
4. Filter `Service Area`: Uncheck "Corporate", "RBEI_CORPORATE", "SDS_CORPORATE"
5. Sum `Offshore Capacity` → Note as **CAPACITY_SUM**
6. Add CTG: `CAPACITY_SUM + 245` = **ADJUSTED_CAPACITY**

**Step 3: Final Result**
```
Budget/Avg Capacity = REVENUE_PER_MONTH ÷ ADJUSTED_CAPACITY
```

---

## 4. BUDGET / AVG CAPACITY - OUTSOURCING (WW)

### Part A: Revenue (Numerator)
```
Filter:
- category_final: "Offshore", "At actuals", (Blanks)

Calculate:
SUM([Amount in USD]) × 1,000,000 ÷ [Month Count]
```

### Part B: Capacity (Denominator)
From MV_GB_INSIGHTS:
```
Filter:
- category_final: "Outsourcing"
- Service Area: NOT IN ("Corporate", "RBEI_CORPORATE", "SDS_CORPORATE")
- Employee Number: NOT blank, NOT 0

Calculate:
SUM([Offshore Capacity])
```

PLUS from Manual inputs MBR Master:
```
Filter:
- Plan/Actual: "Actual"
- Particulars: "Outsourcing Capacity"
- Particulars Sub Category: "Average"
- Entity: "Worlwide"

Add:
SUM([Cost value])
```

### Excel Steps
1. Get revenue sum (same as above)
2. Get capacity from MV_GB_INSIGHTS with outsourcing filters
3. Get CTG value from MBR Master file
4. Add them together
5. Divide revenue by total capacity

---

## 5. TOTAL CAPACITY AVERAGE (WW)

### From MV_GB_INSIGHTS
```
Filter A:
- category_final: "Offshore" OR "Onsite"
- Resource Type: "Internal"
- Service Area: NOT IN ("Corporate", "RBEI_CORPORATE", "SDS_CORPORATE")

SUM([Offshore Capacity]) + 230  ← CTG
```

PLUS

```
Filter B:
- category_final: "Outsourcing"
- Service Area: NOT IN ("Corporate", "RBEI_CORPORATE", "SDS_CORPORATE")
- Employee Number: NOT blank, NOT 0

SUM([Offshore Capacity])
```

### Final
```
= Filter A Result + Filter B Result
```

---

## 6. TOTAL CAPACITY END (WW)

### From MV_GB_INSIGHTS
```
Filter A:
- category_final: "Offshore" OR "Onsite"
- Resource Type: "Internal"
- Service Area: NOT IN ("Corporate", "RBEI_CORPORATE", "SDS_CORPORATE")

SUM([Cap end]) + 255  ← CTG
```

PLUS

```
Filter B:
- category_final: "Outsourcing"
- Service Area: NOT IN ("Corporate", "RBEI_CORPORATE", "SDS_CORPORATE")

SUM([Cap end])
```

---

## 7. OFFSHORE CAPACITY AVERAGE (WW)

### Filter Points
```
Column: Onsite/Offshore → "Offshore"
Column: Resource Type → "Internal"
Column: Service Area → NOT IN ("Corporate", "RBEI_CORPORATE", "SDS_CORPORATE")
```

### Calculation
```
=SUM([Offshore Capacity]) + 234  ← CTG Adjustment
```

### Excel Steps
1. Filter `Onsite/Offshore`: "Offshore"
2. Filter `Resource Type`: "Internal"
3. Filter `Service Area`: Exclude corporate areas
4. Sum `Offshore Capacity`
5. Add 234 (CTG)
6. Result = **Offshore Capacity Average**

---

## 8. OFFSHORE CAPACITY END (WW)

### Filter Points
```
Same as Offshore Average
```

### Calculation
```
=SUM([Cap end]) + 140  ← CTG Adjustment
```

---

## 9. OUTSOURCING CAPACITY AVERAGE (WW)

### From MV_GB_INSIGHTS
```
Filter:
- category_final: "Outsourcing"
- Service Area: NOT IN ("Corporate", "RBEI_CORPORATE", "SDS_CORPORATE")
- Employee Number: NOT 0, NOT blank

SUM([Offshore Capacity])
```

### From Manual inputs MBR Master
```
Filter:
- Plan/Actual: "Actual"
- Particulars: "Outsourcing Capacity"
- Particulars Sub Category: "Average"
- Entity: "Worlwide"

SUM([Cost value])
```

### Final
```
= MV_GB_INSIGHTS Sum + MBR Master Sum
```

---

## 10. OUTSOURCING CAPACITY END (WW)

### From MV_GB_INSIGHTS
```
Filter:
- category_final: "Outsourcing"
- Service Area: NOT IN ("Corporate", "RBEI_CORPORATE", "SDS_CORPORATE")
- Employee Number: NOT 0, NOT blank

SUM([Cap end])
```

### From Manual inputs MBR Master
```
Filter:
- Plan/Actual: "Actual"
- Particulars: "Outsourcing Capacity"
- Particulars Sub Category: "End"
- Entity: "Worlwide"

SUM([Cost value])
```

---

# ENTITY VIEW METRICS

---

## 11. BUDGET (Entity)

### Filter Points
```
Column: Cost Category → "Revenue Summary"
Column: Include/Exclude → "Include"
Column: Region/Entity → [Your selected entity, e.g., "BGSW"]
```

### Calculation
```
=SUMIFS([Amount in USD], 
        [Cost Category], "Revenue Summary",
        [Include/Exclude], "Include",
        [Region/Entity], "BGSW")
```

### Excel Steps
1. Filter `Cost Category`: "Revenue Summary"
2. Filter `Include/Exclude`: "Include"
3. Filter `Region/Entity`: Your target entity
4. Sum `Amount in USD`
5. Result = **Budget for Entity**

---

## 12. BUDGET / AVG CAPACITY (Entity)

### Numerator
```
Same as Entity Budget calculation above
Divide by selected month count
```

### Denominator
```
Offshore Avg Capacity (Entity) + Outsourcing Avg Capacity (Entity)
```

### Final
```
= (Budget ÷ Month Count) ÷ (Offshore Cap Avg + Outsourcing Cap Avg)
```

**Note: Entity view does NOT use CTG adjustments**

---

## 13. PRICE MIX RATIO (Entity)

### Filter Points
```
Column: Cost Category → "WW Employee Summary"
Column: Rate_class / RATE CLASSIFICATION → "Differential"
Column: VKM Code → NOT IN ("0001", "0002", "0003", blank)
Column: Region/Entity → [Your selected entity]
```

### Numerator
```
=SUMIFS([Billed Capacity], 
        [Cost Category], "WW Employee Summary",
        [RATE CLASSIFICATION], "Differential",
        [VKM Code], "<>0001", "<>0002", "<>0003", "<>")
```

### Denominator
```
=SUMIF([Cost Category], "WW Employee Summary", [Billed Capacity])
```

### Final Calculation
```
Price Mix Ratio = Differential Billed Capacity ÷ Total Billed Capacity
```

### Excel Steps
1. Filter to `Cost Category` = "WW Employee Summary"
2. Filter `RATE CLASSIFICATION` = "Differential"
3. Filter `VKM Code`: Exclude "0001", "0002", "0003", blanks
4. Sum `Billed Capacity` → **DIFFERENTIAL_CAP**
5. Clear VKM and Rate filters
6. Sum total `Billed Capacity` for "WW Employee Summary" → **TOTAL_CAP**
7. Calculate: `DIFFERENTIAL_CAP ÷ TOTAL_CAP`
8. Result = **Price Mix Ratio**

---

## 14. ATTRITION RATE (Entity)

### For BGSW, BGSV, BGSW/NE-MX
```
From MV_GB_INSIGHTS:
- Calculate attrition percentage from data
- Formula: (att % ÷ Selected Month) × 12

Then add CTG from Manual inputs MBR Master:
- Plan/Actual: "Actual"
- Particulars: "Attrition"
- Get: Value %
```

### For Other Entities
```
Use only the CTG value from Manual inputs MBR Master
```

---

## 15. OFFSHORE CAPACITY AVERAGE (Entity)

### Filter Points
```
Column: Sector → NOT "Internal"
Column: category_final → "OffShore"
Column: Region/Entity → [Your selected entity]
```

### Calculation
```
=SUMIFS([avg_cap_act_ytd] or [Offshore Capacity],
        [Sector], "<>Internal",
        [category_final], "OffShore",
        [Region/Entity], "BGSW")
```

**Note: No CTG adjustment for Entity view**

---

## 16. OFFSHORE CAPACITY END (Entity)

### Filter Points
```
Column: category_final → "OffShore"
Column: Sector → NOT "Internal"
Column: Region/Entity → [Your selected entity]
```

### Calculation
```
=SUM([YTD End cap] or [Cap end])
```

---

## 17. OUTSOURCING CAPACITY AVERAGE (Entity)

### Filter Points
```
Column: Service Area → NOT IN ("Corporate", "RBEI_CORPORATE", "SDS_CORPORATE")
Column: category_final → "Outsourcing"
Column: Employee Number → NOT 0, NOT blank
Column: Region/Entity → [Your selected entity]
```

### Calculation
```
=SUMIFS([Offshore Capacity] or [avg_cap_act_ytd],
        [Service Area], "<>Corporate",
        [category_final], "Outsourcing",
        [Employee Number], "<>0",
        [Region/Entity], "BGSW")
```

---

## 18. OUTSOURCING CAPACITY END (Entity)

### Same filters as above, but sum:
```
[YTD End cap] or [Cap end]
```

---

## 19. CAPACITY MIX % - INTERNAL (Entity)

### Formula
```
Internal Mix = Internal Capacity ÷ Total Capacity
```

Where:
- Internal Capacity = Sum where Resource Type = "Internal"
- Total Capacity = Internal + External

---

## 20. CAPACITY MIX % - EXTERNAL (Entity)

### Formula
```
External Mix = 1 - Internal Mix
OR
External Mix = External Capacity ÷ Total Capacity
```

---

## 21. BILLING UTILIZATION

### Filter Points
```
Column: Cost Category → "WW Employee Summary" (or relevant)
```

### Calculation
```
Billing Utilization = Billed Capacity ÷ (Billed Capacity + Allocated Capacity)
```

### Excel Steps
1. Filter to your entity/period
2. Sum `Billed Capacity` → **BILLED**
3. Sum `Allocated Capacity` → **ALLOCATED**
4. Calculate: `BILLED ÷ (BILLED + ALLOCATED)`
5. Result = **Billing Utilization**

---

## 22. PYRAMID MIX (SL48)

### Filter Points
```
For different salary levels (SL4-SL8)
Column: SALARYLEVEL → Filter for specific levels
```

### Calculation
```
Pyramid Mix = SL4-8 Count ÷ Total Headcount
```

---

## 23. EBIT PERCENTAGE

### Filter Points
```
Column: Cost Category → Filter for revenue and cost categories
```

### Calculation
```
EBIT % = (Revenue - Costs) ÷ Revenue × 100
```

---

# GB/MS VIEW FILTERS

For specific GB views, add these filters:

| View | Filter |
|------|--------|
| MS | `Project GB` = "MS" |
| SX | `Project GB` = "SX" |
| VM | `Project GB` = "VM" |
| PS | `Project GB` = "PS" |
| XC (excl CVO) | `Project GB` = "XC" |

---

# CTG ADJUSTMENT VALIDATION

## From Manual inputs MBR Master

### File Structure
```
Sheet: "Plan,Actual"
Columns: Year, Month, Plan/Actual, Entity, GB, Particulars, 
         Particulars Sub Category, Cost value, Value %, Page
```

### How to Find CTG Values
1. Open Manual inputs MBR Master
2. Go to "Plan,Actual" sheet
3. Filter:
   - `Plan/Actual` = "Actual"
   - `Entity` = "Worlwide" (for WW) or specific entity
   - `Particulars` = metric you need (e.g., "Offshore Capacity", "Outsourcing Capacity")
   - `Particulars Sub Category` = "Average" or "End"
4. Get the `Cost value` for that combination

### CTG Types
| Particulars | Sub Category | Used In |
|-------------|--------------|---------|
| Offshore Capacity | Average | WW Offshore Capacity Avg |
| Offshore Capacity | End | WW Offshore Capacity End |
| Outsourcing Capacity | Average | WW Outsourcing Capacity Avg |
| Outsourcing Capacity | End | WW Outsourcing Capacity End |
| Attrition | - | Attrition Rate |
| Price mix Ratio | - | Price Mix validation |

---

# VALIDATION CHECKLIST

Use this checklist to verify each metric:

| # | Metric | Filter Applied | Sum Column | CTG Added | Result Matches |
|---|--------|---------------|------------|-----------|----------------|
| 1 | Budget Offshore | ☐ | Amount USD | N/A | ☐ |
| 2 | Budget Outsourcing | ☐ | Amount USD | N/A | ☐ |
| 3 | Budget/Avg Cap Offshore | ☐ | Formula | +245 | ☐ |
| 4 | Budget/Avg Cap Outsourcing | ☐ | Formula | MBR | ☐ |
| 5 | Total Capacity Avg | ☐ | Offshore Cap | +230 | ☐ |
| 6 | Total Capacity End | ☐ | Cap end | +255 | ☐ |
| 7 | Offshore Capacity Avg | ☐ | Offshore Cap | +234 | ☐ |
| 8 | Offshore Capacity End | ☐ | Cap end | +140 | ☐ |
| 9 | Outsourcing Capacity Avg | ☐ | Offshore Cap | MBR | ☐ |
| 10 | Outsourcing Capacity End | ☐ | Cap end | MBR | ☐ |
| 11 | Entity Budget | ☐ | Amount USD | N/A | ☐ |
| 12 | Entity Budget/Avg Cap | ☐ | Formula | N/A | ☐ |
| 13 | Price Mix Ratio | ☐ | Billed Cap | N/A | ☐ |
| 14 | Attrition Rate | ☐ | Formula | MBR | ☐ |
| 15 | Billing Utilization | ☐ | Capacity | N/A | ☐ |
| 16 | Pyramid Mix | ☐ | Headcount | N/A | ☐ |
| 17 | EBIT % | ☐ | Amount USD | N/A | ☐ |
| 18 | Capacity Mix Internal | ☐ | Capacity | N/A | ☐ |
| 19 | Capacity Mix External | ☐ | Capacity | N/A | ☐ |

---

# QUICK REFERENCE: COMMON EXCLUSIONS

Always exclude from most calculations:
```
Service Area: "Corporate", "RBEI_CORPORATE", "SDS_CORPORATE"
Order reason: "Y36" (for revenue calculations)
```

Always include conditions:
```
Employee Number: <> 0 and <> blank (for outsourcing capacity)
Include/Exclude: "Include" (for revenue)
```

---

# TIPS FOR EXCEL VALIDATION

1. **Use PivotTables**: Create a pivot table with your filters as Row/Column fields
2. **Named Ranges**: Define names for common filter criteria
3. **SUMIFS**: Use SUMIFS with multiple criteria for accurate filtering
4. **Data Validation**: Always verify row counts match between filtered data and your sum
5. **CTG Separate**: Keep CTG adjustments as separate cells so you can see base vs adjusted values

---

# EXAMPLE: Complete Budget/Avg Capacity Validation

**Scenario**: Validate Budget/Avg Capacity for August 2025

**Step 1**: Get Revenue
```excel
In MV_GB_INSIGHTS:
- Filter Year = 2025
- Filter Month = 1 to 8 (YTD)
- Filter category_final = Offshore, At actuals, (Blanks)
- Filter Order reason ≠ Y36
- Sum Amount in USD = 1,075,000,000 (example)
- Per month: 1,075,000,000 ÷ 8 = 134,375,000
- Multiply by 1,000,000 (if in millions): Already in USD
```

**Step 2**: Get Capacity
```excel
In MV_GB_INSIGHTS:
- Clear all filters
- Filter Onsite/Offshore = Offshore
- Filter Resource Type = Internal
- Filter Service Area ≠ Corporate, RBEI_CORPORATE, SDS_CORPORATE
- Sum Offshore Capacity = 12,500 (example)
- Add CTG: 12,500 + 245 = 12,745
```

**Step 3**: Calculate
```
Budget/Avg Capacity = 134,375,000 ÷ 12,745 = 10,543.29 USD
```

**Step 4**: Compare with system output
```
Ask: "budget avg capacity offshore for august 2025"
Compare result with 10,543.29
```

---

*Document created for LedgerLM validation purposes*
