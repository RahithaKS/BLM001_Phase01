# Schema Intelligence Studio — User Guide

Teach LedgerLM how to understand **your** dataset — without writing Python code.

The Schema Intelligence Studio is the admin UI where you describe what your data means in plain English (and SQL). Once configured, the AI uses your definitions to answer questions about your dataset accurately.

> **Where to find it:** Admin → Cubes → pick a cube → **Intelligence** button.

---

## When you should use it

Use the Intelligence Studio whenever you load a **new dataset** (cube) or whenever your data structure changes. Typical situations:

- You uploaded a new fact file with columns the AI has never seen
- A column was renamed (e.g. `RegionEntity` → `Geo_Entity`)
- A new metric needs to be supported (e.g. "Adjusted EBIT" with your custom formula)
- Users keep asking questions the AI can't answer correctly

---

## The 6 tabs at a glance

| Tab | Purpose | When to use |
|---|---|---|
| **Business Terms** | Map plain-English words → SQL filters | "Offshore" should filter `region = 'OFF'` |
| **Calculations** | Define metrics (formulas or full SQL) | "Billing Utilization" = billed ÷ allocated |
| **Filter Rules** | Reusable named filters | "Active employees only" |
| **Query Patterns** | Examples of how users phrase things | "show me X by Y for last quarter" |
| **Column Values** | Tell the AI what valid values exist | Region codes: `ON`, `OFF`, `NS` |
| **Relationships** | Link related columns | `account_code` → `account_name` |

---

## Step-by-step: configuring a new dataset

### Step 1 — Load your data
Upload your file as usual through the **Cubes** page. Once ingested, the column names are detected automatically.

### Step 2 — Open the Intelligence Studio
Click the **Intelligence** button on the cube. You'll see the 6 tabs.

### Step 3 — Add Business Terms (most important)
Business terms are the bridge between human language and SQL. Without them, the AI can't translate "show me offshore headcount" into the right filter.

For each important term in your business vocabulary:
1. Click **Add Business Term**
2. Enter the **term name** (what users say): e.g. `Offshore`
3. Enter **aliases**: other ways users might say it: `OFF, off-shore, far shore`
4. Enter the **SQL filter** that selects this group: `region_code = 'OFF'`
5. Save

Repeat for: regions, business units, employee types, account groups, time buckets, status flags — anything users refer to by name.

### Step 4 — Define Calculations
Calculations are derived metrics (not raw columns). You have two ways to define them.

#### Option A: Simple formula (recommended for ratios and sums)
1. Click **Add Calculation**
2. Name it (e.g. `Billing Utilization`)
3. Add aliases (`util, billing util, utilization rate`)
4. Write a description users would understand
5. Leave the **Full SQL Template** toggle OFF
6. Enter the formula: `SUM(billed_capacity) / NULLIF(SUM(allocated_capacity), 0)`
7. Save

The AI uses this formula as context when generating SQL.

#### Option B: Full SQL Template (recommended for complex metrics)
This is the most powerful option. You write the **complete** SQL query — the AI runs it exactly as you wrote it, with placeholders filled in at query time.

1. Click **Add Calculation**
2. Name it, add aliases, write description
3. **Turn ON the Full SQL Template toggle**
4. Paste your SQL using the available placeholders:

```sql
SELECT {group_by}, SUM(headcount) AS headcount
FROM cube_fact_data
WHERE cube_id = '{cube_id}'
  AND year = {year}
  AND month = {month}
  {extra_filters}
GROUP BY {group_by}
ORDER BY headcount DESC
```

5. Save

You'll see a **"SQL Template Active"** badge on the row — meaning this metric now uses your custom SQL instead of any built-in logic.

#### Available placeholders

| Placeholder | What gets filled in |
|---|---|
| `{cube_id}` | The current cube's ID |
| `{year}` | The year mentioned in the user's question (e.g. `2025`) |
| `{month}` | The month mentioned (e.g. `2`) |
| `{group_by}` | The grouping column derived from the question (default: `region_entity`) |
| `{extra_filters}` | `AND` clauses built automatically from any matching Business Terms found in the user's question |

#### Why `{extra_filters}` is powerful
If you defined a Business Term `Offshore` with filter `region_code = 'OFF'`, then when a user asks **"Offshore headcount in Jan 2025"**, the system:
1. Detects `Offshore` in the question
2. Pulls in your filter automatically
3. Injects `AND region_code = 'OFF'` into your template

You don't have to write that filter in your template — it just works.

### Step 5 — Add Filter Rules (optional)
Reusable named filters that users can apply ad-hoc. Example: `Active Employees Only` → `status = 'A'`.

### Step 6 — Add Query Patterns (optional but helpful)
Show the AI 3–5 example questions in the user's typical phrasing along with the right SQL. The AI uses these as few-shot examples and gets dramatically better at understanding your dataset's vocabulary.

### Step 7 — List Column Values (optional)
For categorical columns, list the valid values. This stops the AI from guessing wrong codes (e.g. `Onshore` vs `ONS` vs `ON`).

### Step 8 — Map Column Relationships (optional)
If two columns always go together (like `account_code` and `account_name`), declare the relationship so the AI doesn't separate them.

---

## A complete worked example

**Scenario:** You uploaded a sales dataset with columns `region`, `product_line`, `revenue`, `units_sold`, `year`, `month`.

### Business Terms
| Term | Aliases | SQL Filter |
|---|---|---|
| `EMEA` | `Europe, EMEA region` | `region IN ('UK','DE','FR','ES','IT')` |
| `Hardware` | `HW, hardware products` | `product_line = 'HARDWARE'` |
| `SaaS` | `software, subscription` | `product_line = 'SAAS'` |

### Calculation (Full SQL Template)
**Name:** `Revenue per Unit`
**Aliases:** `RPU, average selling price, ASP`
**Template:**
```sql
SELECT {group_by},
       SUM(revenue) AS revenue,
       SUM(units_sold) AS units,
       SUM(revenue) / NULLIF(SUM(units_sold), 0) AS revenue_per_unit
FROM cube_fact_data
WHERE cube_id = '{cube_id}'
  AND year = {year}
  AND month = {month}
  {extra_filters}
GROUP BY {group_by}
ORDER BY revenue_per_unit DESC
```

### Now the magic happens
A user asks: **"What was the revenue per unit for EMEA hardware in March 2025?"**

The system:
1. Matches `revenue per unit` → your calculation
2. Detects `EMEA` and `Hardware` business terms
3. Builds the SQL:
   ```sql
   SELECT region,
          SUM(revenue) AS revenue,
          SUM(units_sold) AS units,
          SUM(revenue) / NULLIF(SUM(units_sold), 0) AS revenue_per_unit
   FROM cube_fact_data
   WHERE cube_id = '<your-cube-id>'
     AND year = 2025
     AND month = 3
     AND region IN ('UK','DE','FR','ES','IT')
     AND product_line = 'HARDWARE'
   GROUP BY region
   ORDER BY revenue_per_unit DESC
   ```
4. Returns the answer — using **your** definition, not a hardcoded one.

---

## Tips for great results

- **Start small.** Add 5–10 business terms covering your most common dimensions first. Test. Then expand.
- **Watch for keyword collisions.** If you alias a calculation `revenue` and also have a business term `revenue`, the AI may get confused. The studio shows a warning when it detects this.
- **Prefer Full SQL Templates for any non-trivial metric.** They give you 100% control. Simple formulas are fine for "sum this column" cases.
- **Use `{extra_filters}` everywhere.** Always include it in your templates so business terms automatically apply.
- **Re-test after data refreshes.** If column names change, your templates may need updating.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Numbers look way too big (e.g. row counts instead of headcount) | No matching calculation, AI fell back to a generic count | Add a calculation with a Full SQL Template for this metric |
| AI returns "all regions" when user asked for a specific one | Missing or misspelled business term | Add the region as a Business Term with the correct SQL filter |
| Same query returns different answers each time | Multiple calculations have overlapping aliases | Remove duplicate aliases; keep them unique per metric |
| Template runs but returns no rows | Year/month placeholder didn't match a real value | Verify `{year}` and `{month}` exist in your data; check cube_id is correct |
| "Failed to save" when saving a calculation | SQL template has a syntax error | Check for unbalanced quotes, missing commas, or unmatched parentheses |

---

## What the system does behind the scenes

Every time a user asks a question:
1. **Match the metric.** The system looks at your Calculations and finds the best match by name + aliases.
2. **Check for a SQL template.** If the matched calculation has one, that template wins — built-in Python logic is bypassed completely.
3. **Match business terms.** Any term name or alias found in the question contributes its SQL filter to `{extra_filters}`.
4. **Substitute placeholders.** `{cube_id}`, `{year}`, `{month}`, `{group_by}`, `{extra_filters}` get filled in.
5. **Run the SQL.** Results come back to the user as a chart or table.

This means **you control how every metric is calculated** — no developer required when your data evolves.
