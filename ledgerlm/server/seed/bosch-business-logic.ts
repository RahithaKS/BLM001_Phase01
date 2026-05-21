/**
 * Bosch-Specific Business Logic Seed Data
 * 
 * This file contains business terminology, calculation formulas, filter rules,
 * and query patterns extracted from:
 * - LLM_Ledger-_Terminologies.docx
 * - LLM_Ledger-_Logics.docx
 * 
 * Run this when setting up a new Bosch cube to enable accurate SQL generation.
 */

export const BOSCH_BUSINESS_TERMS = [
  {
    termName: "YTD Revenue",
    termAliases: ["revenue YTD", "year to date revenue", "YTD Rev"],
    definition: "Year-to-date revenue - cumulative revenue from start of fiscal year to the reporting month",
    sqlFilter: "TRIM(cost_category) = 'Revenue Summary' AND include_exclude = 'Include'",
    requiredColumns: ["Cost Category", "Include/Exclude", "Amount in USD", "Year", "Month"],
    category: "revenue",
    priority: 10
  },
  {
    termName: "Revenue Summary",
    termAliases: ["total revenue", "revenue total"],
    definition: "Total revenue figures. Use the provided month alone for YTD or YTD Revenue queries.",
    sqlFilter: "cost_category = 'Revenue Summary'",
    requiredColumns: ["Cost Category", "Amount in USD"],
    category: "revenue",
    priority: 9
  },
  {
    termName: "Cost Summary",
    termAliases: ["total cost", "cost total"],
    definition: "Total cost figures for cost-related queries",
    sqlFilter: "cost_category = 'Cost Summary'",
    requiredColumns: ["Cost Category", "Amount in USD"],
    category: "cost",
    priority: 9
  },
  {
    termName: "Billing Utilization Summary",
    termAliases: ["utilization summary", "billing util"],
    definition: "Summary data for billing utilization metrics across capacity types",
    sqlFilter: "cost_category = 'Billing Utilization Summary'",
    requiredColumns: ["Cost Category", "Billed Capacity", "Allocated Capacity", "Not Allocated Capacity"],
    category: "utilization",
    priority: 9
  },
  {
    termName: "Billing Utilization",
    termAliases: ["detailed utilization", "employee utilization", "individual utilization"],
    definition: "Detailed billing utilization data at employee level. Use for employee-level utilization analysis.",
    sqlFilter: "cost_category = 'Billing Utilization'",
    requiredColumns: ["Cost Category", "Employee Number", "Employee Name", "Billed Capacity", "Allocated Capacity"],
    category: "utilization",
    priority: 7
  },
  {
    termName: "GB Wise END Capacity",
    termAliases: ["headcount", "end capacity", "GB capacity"],
    definition: "GB (Global Business) wise end capacity/headcount figures",
    sqlFilter: "cost_category = 'GB Wise END Capacity'",
    requiredColumns: ["Cost Category", "Capacity", "Region/Entity"],
    category: "headcount",
    priority: 9
  },
  {
    termName: "Available Capacity",
    termAliases: ["total available capacity", "availability"],
    definition: "Total available capacity = Allocated + Not Allocated + MS + VKM - SL2 - Non Linear",
    sqlFilter: "cost_category = 'Billing Utilization Summary'",
    requiredColumns: ["Allocated Capacity", "Not Allocated Capacity", "M/S Capacity", "VKM Capacity", "Non Linear capacity"],
    category: "capacity",
    priority: 8
  },
  {
    termName: "Bench Strength",
    termAliases: ["bench", "not allocated"],
    definition: "Associates who are not allocated to any project - represents available bench capacity",
    sqlFilter: "cost_category = 'Billing Utilization Summary'",
    requiredColumns: ["Not Allocated Capacity"],
    category: "capacity",
    priority: 7
  },
  {
    termName: "Internal Resources",
    termAliases: ["internal", "internal employees"],
    definition: "Internal Bosch employees (not contractors/outsourcing)",
    sqlFilter: "resource_type = 'Internal'",
    requiredColumns: ["Resource Type"],
    category: "resource",
    priority: 6
  },
  {
    termName: "External Resources",
    termAliases: ["external", "outsourcing", "contractors"],
    definition: "External/outsourced resources (contractors)",
    sqlFilter: "resource_type = 'External'",
    requiredColumns: ["Resource Type"],
    category: "resource",
    priority: 6
  },
  {
    termName: "Attrition",
    termAliases: ["turnover", "attrition rate", "employee turnover"],
    definition: "Employee attrition/turnover data",
    sqlFilter: "cost_category = 'Attrition'",
    requiredColumns: ["Cost Category", "Capacity"],
    category: "attrition",
    priority: 9
  },
  // === NEW COST CATEGORY TERMS (Phase 2) ===
  {
    termName: "Revenue",
    termAliases: ["detailed revenue", "project revenue", "revenue detail"],
    definition: "Detailed revenue data at project/employee level (not summary). Use for project-level analysis.",
    sqlFilter: "cost_category = 'Revenue'",
    requiredColumns: ["Cost Category", "Amount in USD", "Amount in INR", "Project ID"],
    category: "revenue",
    priority: 7
  },
  {
    termName: "Head Count",
    termAliases: ["HC", "employee headcount", "HC report"],
    definition: "Headcount data with employee-level details from HR Report",
    sqlFilter: "cost_category = 'Head Count'",
    requiredColumns: ["Cost Category", "Employee Number", "Employee Name", "Region/Entity", "Resource Type"],
    category: "headcount",
    priority: 7
  },
  {
    termName: "WW Employee",
    termAliases: ["worldwide employee", "WW emp", "WW employee revenue"],
    definition: "Worldwide employee-level revenue/cost data with amounts",
    sqlFilter: "cost_category = 'WW Employee'",
    requiredColumns: ["Cost Category", "Employee Number", "Amount in USD", "Amount in INR", "SALARYLEVEL"],
    category: "employee",
    priority: 7
  },
  {
    termName: "WW Employee Summary",
    termAliases: ["WW summary", "worldwide employee summary", "WW emp summary"],
    definition: "Aggregated worldwide employee data summary",
    sqlFilter: "cost_category = 'WW Employee Summary'",
    requiredColumns: ["Cost Category", "Amount in USD", "Amount in INR", "Resource Type"],
    category: "employee",
    priority: 7
  },
  {
    termName: "Attrition Pipeline",
    termAliases: ["resignation pipeline", "exit pipeline", "upcoming attrition", "attrition forecast"],
    definition: "Employees in the attrition pipeline (confirmed upcoming exits)",
    sqlFilter: "cost_category = 'Attrition Pipeline'",
    requiredColumns: ["Cost Category", "Employee Number", "Employee Name", "Region/Entity"],
    category: "attrition",
    priority: 7
  },
  {
    termName: "TBP Revenue Capacity",
    termAliases: ["transfer pricing", "TBP", "transfer billing price", "TBP revenue"],
    definition: "Transfer Billing Price revenue/capacity allocation data across all TBP categories",
    sqlFilter: "cost_category LIKE '%TBP-Revenue/Capacity%'",
    requiredColumns: ["Cost Category", "Amount in USD", "Amount in INR", "Region/Entity"],
    category: "tbp",
    priority: 6
  },
  {
    termName: "Offshore TBP",
    termAliases: ["offshore transfer pricing", "offshore billing", "offshore TBP revenue"],
    definition: "Transfer pricing for offshore capacity allocation",
    sqlFilter: "cost_category = 'OFFSHORE_TBP-Revenue/Capacity'",
    requiredColumns: ["Cost Category", "Amount in USD", "Amount in INR"],
    category: "tbp",
    priority: 6
  },
  {
    termName: "Onsite TBP",
    termAliases: ["onsite transfer pricing", "onsite billing", "onsite TBP revenue"],
    definition: "Transfer pricing for onsite capacity allocation",
    sqlFilter: "cost_category = 'ONSITE_TBP-Revenue/Capacity'",
    requiredColumns: ["Cost Category", "Amount in USD", "Amount in INR"],
    category: "tbp",
    priority: 6
  },
  {
    termName: "Outsourcing TBP",
    termAliases: ["outsourcing transfer pricing", "external TBP", "outsourcing billing"],
    definition: "Transfer pricing for outsourcing capacity (includes ICT-routed)",
    sqlFilter: "cost_category LIKE 'OUTSOURCING%TBP-Revenue/Capacity%'",
    requiredColumns: ["Cost Category", "Amount in USD", "Amount in INR"],
    category: "tbp",
    priority: 6
  },
  {
    termName: "Offshore ICT TBP",
    termAliases: ["ICT offshore", "offshore through ICT", "ICT offshore TBP"],
    definition: "Transfer pricing for offshore capacity routed through ICT",
    sqlFilter: "cost_category = 'OFFSHORE - THROUGH ICT_TBP-Revenue/Capacity'",
    requiredColumns: ["Cost Category", "Amount in USD", "Amount in INR"],
    category: "tbp",
    priority: 6
  },
  {
    termName: "Outsourcing ICT TBP",
    termAliases: ["ICT outsourcing", "outsourcing through ICT", "ICT external TBP"],
    definition: "Transfer pricing for outsourcing capacity routed through ICT",
    sqlFilter: "cost_category = 'OUTSOURCING - THROUGH ICT_TBP-Revenue/Capacity'",
    requiredColumns: ["Cost Category", "Amount in USD", "Amount in INR"],
    category: "tbp",
    priority: 6
  },
  {
    termName: "Billing at Actuals TBP",
    termAliases: ["actuals billing", "billing actuals", "actual billing TBP"],
    definition: "Transfer pricing for billing at actuals capacity",
    sqlFilter: "cost_category = 'BILLING AT ACTUALS_TBP-Revenue/Capacity'",
    requiredColumns: ["Cost Category", "Amount in USD", "Amount in INR"],
    category: "tbp",
    priority: 6
  },
  {
    termName: "BGSV Pass Through TBP",
    termAliases: ["BGSV passthrough", "pass through business", "BGSV TBP"],
    definition: "BGSV pass-through business transfer pricing",
    sqlFilter: "cost_category = 'BGSV (PASS THROUGH BUSINESS)_TBP-Revenue/Capacity'",
    requiredColumns: ["Cost Category", "Amount in USD", "Amount in INR"],
    category: "tbp",
    priority: 6
  },
  {
    termName: "Software Cluster TBP",
    termAliases: ["SWC TBP", "software cluster", "SWC"],
    definition: "Software cluster transfer pricing",
    sqlFilter: "cost_category = 'SOFTWARE CLUSTER (SWC)_TBP-Revenue/Capacity'",
    requiredColumns: ["Cost Category", "Amount in USD", "Amount in INR"],
    category: "tbp",
    priority: 6
  },
  // === PYRAMID MIX AND PRICE MIX TERMS (Phase 7) ===
  {
    termName: "Pyramid Mix",
    termAliases: ["pyramid", "salary level distribution", "level mix", "SALARYLEVEL mix"],
    definition: "Percentage of employees at specific salary levels within total offshore internal headcount. Categories include levels 48-51, 52-54, 55-57, etc.",
    sqlFilter: "cost_category = 'GB Wise END Capacity' AND resource_type = 'Internal' AND sector <> 'INTERNAL' AND onsite_offshore = 'OFFSHORE'",
    requiredColumns: ["Capacity", "SALARYLEVEL", "Resource Type", "Sector", "Onsite/Offshore"],
    category: "pyramid",
    priority: 8
  },
  {
    termName: "Price Mix Ratio",
    termAliases: ["price mix", "rate classification mix", "premium lead mix", "differential ratio"],
    definition: "Ratio of Premium/Lead billing capacity (Differential) to total billing capacity (Price Mix), excluding VKM codes 0001, 0002, 0003. Differential = SUM(Billed Capacity) where Rate Classification IN (Premium, Lead). Price Mix = SUM(Billed Capacity) for all VKM-filtered rows. Ratio = (Differential / Price Mix) * 100.",
    sqlFilter: "cost_category = 'WW Employee Summary' AND vkm_code NOT IN ('0001', '0002', '0003')",
    requiredColumns: ["Billed Capacity", "RATE CLASSIFICATION", "VKM Code"],
    category: "pricing",
    priority: 8
  }
];

export const BOSCH_CALCULATION_RULES = [
  {
    calculationName: "Billing Utilization %",
    calculationAliases: ["billing util %", "utilization percentage", "BU%"],
    description: "Billed Capacity divided by Available Capacity, expressed as percentage",
    formula: "ROUND((SUM(\"Billed Capacity\") / NULLIF(SUM(\"Allocated Capacity\") + SUM(\"Not Allocated Capacity\") + SUM(\"M/S Capacity\") + SUM(\"VKM Capacity\") - SUM(\"Non Linear capacity\"), 0)) * 100, 2)",
    formulaType: "ratio",
    resultType: "percentage",
    requiredColumns: ["Billed Capacity", "Allocated Capacity", "Not Allocated Capacity", "M/S Capacity", "VKM Capacity", "Non Linear capacity"],
    defaultFilters: "\"Cost Category\" = 'Billing Utilization Summary'",
    roundingPrecision: 2
  },
  {
    calculationName: "Available Capacity",
    calculationAliases: ["total capacity", "capacity available"],
    description: "Sum of Allocated + Not Allocated + MS + VKM - Non Linear capacities",
    formula: "SUM(\"Allocated Capacity\") + SUM(\"Not Allocated Capacity\") + SUM(\"M/S Capacity\") + SUM(\"VKM Capacity\") - SUM(\"Non Linear capacity\")",
    formulaType: "sum",
    resultType: "fte",
    requiredColumns: ["Allocated Capacity", "Not Allocated Capacity", "M/S Capacity", "VKM Capacity", "Non Linear capacity"],
    defaultFilters: "\"Cost Category\" = 'Billing Utilization Summary'",
    roundingPrecision: 2
  },
  {
    calculationName: "Internal Capacity Mix",
    calculationAliases: ["offshore mix", "internal mix %", "offshore percentage"],
    description: "Offshore Capacity Avg divided by Total (Offshore + Outsourcing) Capacity. Use Capacity Mix Percentage Query pattern for calculation.",
    formula: "ROUND((SUM(CASE WHEN \"Resource Type\" = 'Internal' THEN \"Capacity\" ELSE 0 END) / NULLIF(SUM(\"Capacity\"), 0)) * 100, 2)",
    formulaType: "ratio",
    resultType: "percentage",
    requiredColumns: ["Capacity", "Onsite/Offshore", "Resource Type"],
    defaultFilters: "\"Cost Category\" = 'GB Wise END Capacity' AND TRIM(\"Onsite/Offshore\") = 'OFFSHORE' AND \"Sector\" <> 'INTERNAL' AND \"Service Area\" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')",
    roundingPrecision: 2
  },
  {
    calculationName: "External Capacity Mix",
    calculationAliases: ["outsourcing mix", "external mix %", "outsourcing percentage"],
    description: "Outsourcing Capacity Avg divided by Total (Offshore + Outsourcing) Capacity. Use Capacity Mix Percentage Query pattern for calculation.",
    formula: "ROUND((SUM(CASE WHEN \"Resource Type\" = 'External' THEN \"Capacity\" ELSE 0 END) / NULLIF(SUM(\"Capacity\"), 0)) * 100, 2)",
    formulaType: "ratio",
    resultType: "percentage",
    requiredColumns: ["Capacity", "Onsite/Offshore", "Resource Type"],
    defaultFilters: "\"Cost Category\" = 'GB Wise END Capacity' AND TRIM(\"Onsite/Offshore\") = 'OFFSHORE' AND \"Sector\" <> 'INTERNAL' AND \"Service Area\" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE') AND CASE WHEN \"Resource Type\" = 'External' THEN \"Employee Number\" <> '0.0' ELSE TRUE END",
    roundingPrecision: 2
  },
  // === NEW CALCULATIONS (Phase 3) ===
  {
    calculationName: "EBIT %",
    calculationAliases: ["EBIT percentage", "profitability %", "operating margin", "EBIT margin"],
    description: "EBIT percentage = (Revenue - Cost) / Revenue * 100. Uses BP Rate card for accurate profitability.",
    formula: "ROUND(100.0 * (SUM(CASE WHEN \"Cost Category\" = 'Revenue Summary' THEN \"Amount in USD\" ELSE 0 END) - SUM(CASE WHEN \"Cost Category\" = 'Cost Summary' THEN \"Amount in USD\" ELSE 0 END)) / NULLIF(SUM(CASE WHEN \"Cost Category\" = 'Revenue Summary' THEN \"Amount in USD\" ELSE 0 END), 0), 2)",
    formulaType: "ratio",
    resultType: "percentage",
    requiredColumns: ["Amount in USD", "Cost Category"],
    defaultFilters: "\"Cost Category\" IN ('Revenue Summary', 'Cost Summary')",
    roundingPrecision: 2
  },
  {
    calculationName: "Total Capacity",
    calculationAliases: ["total cap", "full capacity", "combined capacity"],
    description: "Total Capacity = Outsourcing Capacity + Offshore Capacity",
    formula: "SUM(\"Outsourcing Capacity\") + SUM(\"Offshore Capacity\")",
    formulaType: "sum",
    resultType: "fte",
    requiredColumns: ["Outsourcing Capacity", "Offshore Capacity"],
    defaultFilters: null,
    roundingPrecision: 2
  },
  {
    calculationName: "SL2 Adjusted Capacity",
    calculationAliases: ["SL2 capacity", "adjusted capacity"],
    description: "Available Capacity adjusted for SL2: Allocated + Not Allocated + MS + VKM - SL2 Allocated - SL2 Not Allocated - Non Linear",
    formula: "SUM(\"Allocated Capacity\") + SUM(\"Not Allocated Capacity\") + SUM(\"M/S Capacity\") + SUM(\"VKM Capacity\") - COALESCE(SUM(\"SL2 Allocated Capacity\"), 0) - COALESCE(SUM(\"SL2 Not Allocated Capacity\"), 0) - SUM(\"Non Linear capacity\")",
    formulaType: "sum",
    resultType: "fte",
    requiredColumns: ["Allocated Capacity", "Not Allocated Capacity", "M/S Capacity", "VKM Capacity", "SL2 Allocated Capacity", "SL2 Not Allocated Capacity", "Non Linear capacity"],
    defaultFilters: "\"Cost Category\" = 'Billing Utilization Summary'",
    roundingPrecision: 2
  },
  // === NEW CAPACITY CALCULATIONS (Phase 3 - From Query Document) ===
  {
    calculationName: "Offshore Capacity Avg",
    calculationAliases: ["avg offshore capacity", "offshore avg", "average offshore headcount"],
    description: "Average offshore internal capacity YTD. Use Offshore Capacity Avg Query pattern for YTD calculations with month divisor.",
    formula: "SUM(\"Capacity\")",
    formulaType: "sum",
    resultType: "fte",
    requiredColumns: ["Capacity", "Onsite/Offshore", "Resource Type", "Sector", "Service Area"],
    defaultFilters: "\"Cost Category\" = 'GB Wise END Capacity' AND TRIM(\"Onsite/Offshore\") = 'OFFSHORE' AND \"Resource Type\" = 'Internal' AND \"Sector\" <> 'INTERNAL' AND \"Service Area\" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')",
    roundingPrecision: 2
  },
  {
    calculationName: "Offshore Capacity End",
    calculationAliases: ["offshore end cap", "offshore headcount", "offshore HC"],
    description: "Offshore internal capacity for a specific month (end of month headcount).",
    formula: "SUM(\"Capacity\")",
    formulaType: "sum",
    resultType: "fte",
    requiredColumns: ["Capacity", "Onsite/Offshore", "Resource Type", "Sector", "Service Area"],
    defaultFilters: "\"Cost Category\" = 'GB Wise END Capacity' AND TRIM(\"Onsite/Offshore\") = 'OFFSHORE' AND \"Resource Type\" = 'Internal' AND \"Sector\" <> 'INTERNAL' AND \"Service Area\" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')",
    roundingPrecision: 2
  },
  {
    calculationName: "Outsourcing Capacity Avg",
    calculationAliases: ["avg outsourcing capacity", "outsourcing avg", "average external capacity"],
    description: "Average outsourcing (external) capacity YTD. Use Outsourcing Capacity Avg Query pattern for YTD calculations with month divisor.",
    formula: "SUM(\"Capacity\")",
    formulaType: "sum",
    resultType: "fte",
    requiredColumns: ["Capacity", "Onsite/Offshore", "Resource Type", "Service Area"],
    defaultFilters: "\"Cost Category\" = 'GB Wise END Capacity' AND TRIM(\"Onsite/Offshore\") = 'OFFSHORE' AND \"Resource Type\" = 'External' AND \"Service Area\" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE') AND \"Employee Number\" <> '0.0'",
    roundingPrecision: 2
  },
  {
    calculationName: "Outsourcing Capacity End",
    calculationAliases: ["outsourcing end cap", "outsourcing headcount", "external HC"],
    description: "Outsourcing (external) capacity for a specific month (end of month headcount).",
    formula: "SUM(\"Capacity\")",
    formulaType: "sum",
    resultType: "fte",
    requiredColumns: ["Capacity", "Onsite/Offshore", "Resource Type", "Service Area"],
    defaultFilters: "\"Cost Category\" = 'GB Wise END Capacity' AND TRIM(\"Onsite/Offshore\") = 'OFFSHORE' AND \"Resource Type\" = 'External' AND \"Service Area\" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE') AND \"Employee Number\" <> '0.0'",
    roundingPrecision: 2
  },
  {
    calculationName: "Revenue in Millions",
    calculationAliases: ["revenue M", "rev millions", "revenue USD millions"],
    description: "Total revenue in millions USD. Used for Budget/Avg Cap calculations.",
    formula: "ROUND(SUM(\"Amount in USD\") / 1000000, 2)",
    formulaType: "sum",
    resultType: "currency_millions",
    requiredColumns: ["Amount in USD", "Cost Category"],
    defaultFilters: "\"Cost Category\" = 'Revenue Summary'",
    roundingPrecision: 2
  },
  {
    calculationName: "GB P&L Revenue",
    calculationAliases: ["gb pl revenue", "gb p&l rev", "gb wise p&l revenue", "gb p and l revenue"],
    description: "GB P&L Revenue YTD — SUM(amount_usd or amount_inr) WHERE cost_category='Revenue Summary' AND month<=N (YTD), excluding order reasons YEH/YEI/YEJ/YEK/YN2 and GL accounts starting with 139. Use for GB-level P&L revenue queries.",
    formula: "ROUND(SUM(\"Amount in USD\") / 1000000, 2)",
    formulaType: "sum",
    resultType: "currency_millions",
    requiredColumns: ["Amount in USD", "Cost Category", "Order reason", "GL Account"],
    defaultFilters: "\"Cost Category\" = 'Revenue Summary' AND COALESCE(TRIM(\"Order reason\"),'x') NOT IN ('YEH','YEI','YEJ','YEK','YN2') AND COALESCE(TRIM(\"GL Account\"),'x') NOT LIKE '139%'",
    roundingPrecision: 2
  },
  {
    calculationName: "Entity P&L Revenue",
    calculationAliases: ["entity pl revenue", "entity p&l rev", "o&l revenue", "entity p and l revenue", "entity revenue p&l", "entity revenue pl"],
    description: "Entity P&L Revenue YTD — SUM(amount_usd or amount_inr) WHERE cost_category='Revenue Summary' AND month<=N (YTD), excluding order reasons YEH/YEI/YEJ/YEK/YN2 and GL accounts starting with 139. Use for entity-level P&L revenue queries (BGSW, BGSV, etc.).",
    formula: "ROUND(SUM(\"Amount in USD\") / 1000000, 2)",
    formulaType: "sum",
    resultType: "currency_millions",
    requiredColumns: ["Amount in USD", "Cost Category", "Order reason", "GL Account"],
    defaultFilters: "\"Cost Category\" = 'Revenue Summary' AND COALESCE(TRIM(\"Order reason\"),'x') NOT IN ('YEH','YEI','YEJ','YEK','YN2') AND COALESCE(TRIM(\"GL Account\"),'x') NOT LIKE '139%'",
    roundingPrecision: 2
  },
  {
    calculationName: "Budget Per Average Capacity",
    calculationAliases: ["budget avg cap", "revenue per capacity", "budget per head"],
    description: "Revenue divided by average total capacity (Offshore + Outsourcing) per month. Use Budget Per Average Capacity Query pattern for full calculation.",
    formula: "ROUND(SUM(\"Amount in USD\") / 1000000 / NULLIF(SUM(\"Capacity\"), 0), 2)",
    formulaType: "ratio",
    resultType: "currency",
    requiredColumns: ["Amount in USD", "Capacity"],
    defaultFilters: null,
    roundingPrecision: 2
  },
  {
    calculationName: "Average Headcount",
    calculationAliases: ["avg headcount", "avg HC", "average employee count"],
    description: "Average internal headcount YTD. Use Average Headcount Query pattern for YTD calculations with month divisor.",
    formula: "SUM(\"Capacity\")",
    formulaType: "sum",
    resultType: "fte",
    requiredColumns: ["Capacity", "Resource Type"],
    defaultFilters: "\"Cost Category\" = 'GB Wise END Capacity' AND \"Resource Type\" = 'Internal'",
    roundingPrecision: 2
  },
  {
    calculationName: "Attrition Count",
    calculationAliases: ["attrition total", "turnover count", "exits"],
    description: "Total attrition count for internal resources in a given period.",
    formula: "SUM(\"Attrition\")",
    formulaType: "sum",
    resultType: "count",
    requiredColumns: ["Attrition", "Resource Type"],
    defaultFilters: "\"Cost Category\" = 'Attrition' AND \"Resource Type\" = 'Internal'",
    roundingPrecision: 0
  },
  {
    calculationName: "Attrition Percentage",
    calculationAliases: ["attrition %", "attrition rate", "turnover rate", "annualized attrition"],
    description: "Annualized attrition rate = (Attrition / Avg Headcount) / month * 12. Use Attrition Percentage Query pattern for full calculation with month divisor.",
    formula: "ROUND((SUM(\"Attrition\") / NULLIF(SUM(\"Capacity\"), 0)) * 12 * 100, 2)",
    formulaType: "ratio",
    resultType: "percentage",
    requiredColumns: ["Attrition", "Capacity", "Resource Type"],
    defaultFilters: "\"Resource Type\" = 'Internal'",
    roundingPrecision: 2
  },
  // === WORLDWIDE BUDGET CALCULATIONS ===
  {
    calculationName: "Worldwide Budget",
    calculationAliases: ["WW budget", "worldwide budget musd", "global budget", "total budget worldwide", "budget mUSD worldwide"],
    description: "Total worldwide budget (revenue) in millions USD. Filters: Revenue Summary, Include/Exclude=Include, Order reason excludes Y36.",
    formula: "ROUND(SUM(\"Amount in USD\") / 1000000, 2)",
    formulaType: "sum",
    resultType: "currency_millions",
    requiredColumns: ["Amount in USD", "Cost Category", "Include/Exclude", "Order reason"],
    defaultFilters: "\"Cost Category\" = 'Revenue Summary' AND \"Include/Exclude\" = 'Include' AND (\"Order reason\" IS NULL OR \"Order reason\" <> 'Y36')",
    roundingPrecision: 2
  },
  {
    calculationName: "Worldwide Budget Offshore",
    calculationAliases: ["WW budget offshore", "worldwide offshore budget", "global offshore budget", "budget offshore worldwide"],
    description: "Worldwide offshore budget in millions USD. Formula: (SUM where Resource Type <> External) - (SUM where Onsite/Offshore <> OFFSHORE). This isolates the internal offshore portion of the budget.",
    formula: "(SUM(CASE WHEN \"Resource Type\" <> 'External' THEN \"Amount in USD\" END) - SUM(CASE WHEN \"Onsite/Offshore\" <> 'OFFSHORE' THEN \"Amount in USD\" END)) / 1000000",
    formulaType: "complex",
    resultType: "currency_millions",
    requiredColumns: ["Amount in USD", "Cost Category", "Include/Exclude", "Order reason", "Resource Type", "Onsite/Offshore"],
    defaultFilters: "\"Cost Category\" = 'Revenue Summary' AND \"Include/Exclude\" = 'Include' AND (\"Order reason\" IS NULL OR \"Order reason\" <> 'Y36')",
    roundingPrecision: 2
  },
  {
    calculationName: "Worldwide Budget Outsourcing",
    calculationAliases: ["WW budget outsourcing", "worldwide outsourcing budget", "global outsourcing budget", "budget outsourcing worldwide", "budget external worldwide"],
    description: "Worldwide outsourcing (external) budget in millions USD. Filters: Revenue Summary, Include, no Y36, Resource Type = External.",
    formula: "ROUND(SUM(\"Amount in USD\") / 1000000, 2)",
    formulaType: "sum",
    resultType: "currency_millions",
    requiredColumns: ["Amount in USD", "Cost Category", "Include/Exclude", "Order reason", "Resource Type"],
    defaultFilters: "\"Cost Category\" = 'Revenue Summary' AND \"Include/Exclude\" = 'Include' AND (\"Order reason\" IS NULL OR \"Order reason\" <> 'Y36') AND \"Resource Type\" = 'External'",
    roundingPrecision: 2
  },
  // === PYRAMID MIX AND PRICE MIX CALCULATIONS (Phase 7) ===
  {
    calculationName: "Pyramid Mix",
    calculationAliases: ["pyramid mix %", "salary level mix", "level distribution", "SALARYLEVEL percentage"],
    description: "Pyramid Mix = (Level Capacity / Total Capacity) * 100. Calculates the percentage of employees at specific salary levels (48-51, 52-54, etc.) within total offshore internal headcount.",
    formula: "ROUND((SUM(CASE WHEN \"SALARYLEVEL\" IN ({{salary_levels}}) THEN \"Capacity\" ELSE 0 END) / NULLIF(SUM(\"Capacity\"), 0)) * 100, 2)",
    formulaType: "ratio",
    resultType: "percentage",
    requiredColumns: ["Capacity", "SALARYLEVEL", "Resource Type", "Sector", "Onsite/Offshore"],
    defaultFilters: "\"Cost Category\" = 'GB Wise END Capacity' AND \"Resource Type\" = 'Internal' AND \"Sector\" <> 'INTERNAL' AND \"Onsite/Offshore\" = 'OFFSHORE'",
    roundingPrecision: 2
  },
  {
    calculationName: "Price Mix Ratio",
    calculationAliases: ["price mix %", "differential ratio", "premium lead ratio", "rate classification mix"],
    description: "Price Mix Ratio = (Differential / Price Mix Total) * 100. Differential = SUM(Billed Capacity) where RATE CLASSIFICATION IN ('Premium','Lead'). Price Mix = SUM(Billed Capacity) for all rows (VKM-filtered only). Both computed in a single query using CASE WHEN so entity filter applies to both parts equally.",
    formula: "ROUND((SUM(CASE WHEN \"RATE CLASSIFICATION\" IN ('Premium', 'Lead') THEN \"Billed Capacity\" ELSE 0 END) / NULLIF(SUM(\"Billed Capacity\"), 0)) * 100, 2)",
    formulaType: "ratio",
    resultType: "percentage",
    requiredColumns: ["Billed Capacity", "RATE CLASSIFICATION", "VKM Code"],
    defaultFilters: "\"Cost Category\" = 'WW Employee Summary' AND \"VKM Code\" NOT IN ('0001', '0002', '0003')",
    roundingPrecision: 2
  }
];

export const BOSCH_FILTER_RULES = [
  // ============================================
  // FROZEN VIEW FILTER DEFINITIONS - DO NOT MODIFY
  // Validated against KPI_Metrics_Aug-25.pdf
  // Last validated: January 2026
  // ============================================
  {
    filterName: "Entity View",
    filterAliases: ["Entity", "All Entity", "Total Entity", "BGSW Entity View"],
    description: "FROZEN: Entity View - No sector filter, excludes Corporate service areas",
    sqlPredicate: "(\"new_service_area\" IS NULL OR TRIM(\"new_service_area\") NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))",
    targetColumn: "new_service_area",
    isDefault: false,
    frozen: true
  },
  {
    filterName: "MS View",
    filterAliases: ["MS Service Area", "BBM sector", "MS View Filter"],
    description: "FROZEN: MS View - new_service_area='MS' AND sector='BBM'",
    sqlPredicate: "TRIM(\"new_service_area\") = 'MS' AND TRIM(\"sector\") = 'BBM'",
    targetColumn: "new_service_area,sector",
    isDefault: false,
    frozen: true
  },
  {
    filterName: "SX View",
    filterAliases: ["SX Service Area", "BBE/BBG/BBI", "SX View Filter"],
    description: "FROZEN: SX View - new_service_area='SX' AND sector IN ('BBE','BBG','BBI','OTHERS')",
    sqlPredicate: "TRIM(\"new_service_area\") = 'SX' AND TRIM(\"sector\") IN ('BBE', 'BBG', 'BBI', 'OTHERS')",
    targetColumn: "new_service_area,sector",
    isDefault: false,
    frozen: true
  },
  {
    filterName: "MS View Billing",
    filterAliases: ["MS Billing", "BBM Billing"],
    description: "FROZEN: MS View for Billing metrics - sector='BBM' only (new_service_area is NULL in billing data)",
    sqlPredicate: "TRIM(\"sector\") = 'BBM'",
    targetColumn: "sector",
    isDefault: false,
    frozen: true
  },
  {
    filterName: "SX View Billing",
    filterAliases: ["SX Billing", "BBE/BBG/BBI Billing"],
    description: "FROZEN: SX View for Billing metrics - sector IN ('BBE','BBG','BBI','OTHERS')",
    sqlPredicate: "TRIM(\"sector\") IN ('BBE', 'BBG', 'BBI', 'OTHERS')",
    targetColumn: "sector",
    isDefault: false,
    frozen: true
  },
  {
    filterName: "VM View",
    filterAliases: ["VM GB View", "VM Customer Segment"],
    description: "FROZEN: VM View = MS View + project_gb='VM'",
    sqlPredicate: "TRIM(\"new_service_area\") = 'MS' AND TRIM(\"sector\") = 'BBM' AND TRIM(\"project_gb\") = 'VM'",
    targetColumn: "new_service_area,sector,project_gb",
    isDefault: false,
    frozen: true
  },
  {
    filterName: "PS View",
    filterAliases: ["PS GB View", "PS Customer Segment"],
    description: "FROZEN: PS View = MS View + project_gb='PS'",
    sqlPredicate: "TRIM(\"new_service_area\") = 'MS' AND TRIM(\"sector\") = 'BBM' AND TRIM(\"project_gb\") = 'PS'",
    targetColumn: "new_service_area,sector,project_gb",
    isDefault: false,
    frozen: true
  },
  {
    filterName: "XC View",
    filterAliases: ["XC GB View", "XC Customer Segment"],
    description: "FROZEN: XC View = MS View + project_gb='XC'",
    sqlPredicate: "TRIM(\"new_service_area\") = 'MS' AND TRIM(\"sector\") = 'BBM' AND TRIM(\"project_gb\") = 'XC'",
    targetColumn: "new_service_area,sector,project_gb",
    isDefault: false,
    frozen: true
  },
  // ============================================
  // END FROZEN VIEW DEFINITIONS
  // ============================================
  {
    filterName: "BGSW Entity",
    filterAliases: ["BGSW", "BGSW region"],
    description: "Filter for BGSW (Bosch Global Software) entity",
    sqlPredicate: "\"Region/Entity\" = 'BGSW'",
    targetColumn: "Region/Entity",
    isDefault: false
  },
  {
    filterName: "BGSV Entity",
    filterAliases: ["BGSV", "BGSV region"],
    description: "Filter for BGSV entity",
    sqlPredicate: "\"Region/Entity\" = 'BGSV'",
    targetColumn: "Region/Entity",
    isDefault: false
  },
  {
    filterName: "Include Valid Records",
    filterAliases: ["include only", "valid records"],
    description: "Filter to include only valid records for calculations",
    sqlPredicate: "\"Include/Exclude\" = 'Include'",
    targetColumn: "Include/Exclude",
    isDefault: true
  },
  {
    filterName: "Exclude Revenue Adjustments",
    filterAliases: ["exclude adjustments"],
    description: "Exclude specific order reasons that represent adjustments",
    sqlPredicate: "COALESCE(TRIM(\"Order reason\"), 'x') NOT IN ('YEH', 'YEI', 'YEJ', 'YEK', 'YN2')",
    targetColumn: "Order reason",
    isDefault: false
  },
  {
    filterName: "Exclude GL 139",
    filterAliases: ["exclude 139 accounts"],
    description: "Exclude GL accounts containing 139",
    sqlPredicate: "COALESCE(TRIM(\"GL Account\"), 'x') NOT LIKE '%139%'",
    targetColumn: "GL Account",
    isDefault: false
  },
  // === NEW FILTER RULES (Phase 4) ===
  {
    filterName: "End Capacity Report",
    filterAliases: ["EC report", "headcount report", "EC filter"],
    description: "Filter for End Capacity report data - for headcount reports",
    sqlPredicate: "\"Report\" = 'EC'",
    targetColumn: "Report",
    isDefault: false
  },
  {
    filterName: "Billing Capacity Report",
    filterAliases: ["BUCAP report", "capacity report", "BUCAP filter"],
    description: "Filter for Billing Utilization Capacity report data",
    sqlPredicate: "\"Report\" = 'BUCAP'",
    targetColumn: "Report",
    isDefault: false
  },
  {
    filterName: "All Service Areas",
    filterAliases: ["all sectors", "combined sectors", "all BU sectors"],
    description: "Include all service area sectors (BBM, BBE, BBG, BBI, OTHERS)",
    sqlPredicate: "TRIM(\"Sector\") IN ('BBM', 'BBE', 'BBG', 'BBI', 'OTHERS')",
    targetColumn: "Sector",
    isDefault: false
  },
  {
    filterName: "Customer Segment Filter",
    filterAliases: ["project GB filter", "customer segment"],
    description: "Filter by Customer Segment (uses ProjectGB column)",
    sqlPredicate: "\"ProjectGB\" IS NOT NULL",
    targetColumn: "ProjectGB",
    isDefault: false
  },
  // === NEW FILTER RULES (Phase 3 - Capacity Queries) ===
  {
    filterName: "Exclude Internal Sector",
    filterAliases: ["exclude internal", "no internal sector"],
    description: "Exclude internal/corporate sector from capacity calculations",
    sqlPredicate: "\"Sector\" <> 'INTERNAL'",
    targetColumn: "Sector",
    isDefault: false
  },
  {
    filterName: "Exclude Corporate Service Areas",
    filterAliases: ["exclude corporate", "no corporate"],
    description: "Exclude Corporate service areas from capacity calculations",
    sqlPredicate: "\"Service Area\" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')",
    targetColumn: "Service Area",
    isDefault: false
  },
  {
    filterName: "Offshore Only",
    filterAliases: ["offshore filter", "offshore resources only"],
    description: "Filter for offshore resources only",
    sqlPredicate: "TRIM(\"Onsite/Offshore\") = 'OFFSHORE'",
    targetColumn: "Onsite/Offshore",
    isDefault: false
  },
  {
    filterName: "Onsite Only",
    filterAliases: ["onsite filter", "onsite resources only"],
    description: "Filter for onsite resources only",
    sqlPredicate: "TRIM(\"Onsite/Offshore\") = 'ONSITE'",
    targetColumn: "Onsite/Offshore",
    isDefault: false
  },
  {
    filterName: "Internal Resources Only",
    filterAliases: ["internal only", "bosch employees only"],
    description: "Filter for internal Bosch employees only (excludes outsourcing)",
    sqlPredicate: "\"Resource Type\" = 'Internal'",
    targetColumn: "Resource Type",
    isDefault: false
  },
  {
    filterName: "External Resources Only",
    filterAliases: ["external only", "outsourcing only", "contractors only"],
    description: "Filter for external/outsourcing resources only",
    sqlPredicate: "\"Resource Type\" = 'External'",
    targetColumn: "Resource Type",
    isDefault: false
  }
];

export const BOSCH_QUERY_PATTERNS = [
  {
    patternName: "YTD Revenue Query",
    patternDescription: "Get year-to-date revenue for current or specified year/month",
    triggerPhrases: ["ytd revenue", "year to date revenue", "what is ytd revenue"],
    sqlTemplate: "SELECT SUM(\"Amount in USD\") AS revenue_usd FROM cube_fact_data WHERE TRIM(\"Cost Category\") = 'Revenue Summary' AND \"Include/Exclude\" = 'Include' AND \"Year\" = {{year}} AND \"Month\" = {{month}}",
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is YTD revenue for 2025?",
    exampleSql: "SELECT SUM(\"Amount in USD\") FROM \"MV_GB_INSIGHTS_ALL\" WHERE TRIM(\"Cost Category\") = 'Revenue Summary' AND \"Include/Exclude\" = 'Include' AND \"Year\" = '2025' AND \"Month\" = '11'",
    category: "revenue"
  },
  {
    patternName: "Entity Wise Revenue",
    patternDescription: "Get revenue breakdown by Region/Entity",
    triggerPhrases: ["entity wise revenue", "revenue by entity", "revenue by region"],
    sqlTemplate: "SELECT \"Region/Entity\", SUM(\"Amount in USD\") AS revenue_usd FROM cube_fact_data WHERE \"Cost Category\" = 'Revenue Summary' AND \"Year\" = {{year}} AND \"Month\" = {{month}} GROUP BY \"Region/Entity\"",
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "Entity wise revenue for 2025",
    exampleSql: "SELECT \"Region/Entity\", SUM(\"Amount in USD\") AS Revenue_USD FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Year\" = '2025' AND \"Cost Category\" = 'Revenue Summary' AND \"Month\" = '11' GROUP BY \"Region/Entity\"",
    category: "breakdown"
  },
  {
    patternName: "Month-on-Month Revenue",
    patternDescription: "Get monthly revenue trend with LAG function to show individual month values (not cumulative)",
    triggerPhrases: ["month on month", "monthly trend", "MoM revenue", "individual month revenue"],
    sqlTemplate: "SELECT \"Year\", \"Month\", cum_revenue - COALESCE(LAG(cum_revenue) OVER (PARTITION BY \"Year\" ORDER BY \"Month\"), 0) AS revenue_usd FROM (SELECT \"Year\", \"Month\", SUM(\"Amount in USD\") AS cum_revenue FROM cube_fact_data WHERE \"Year\" = {{year}} AND \"Cost Category\" = 'Revenue Summary' AND \"Include/Exclude\" = 'Include' GROUP BY \"Year\", \"Month\") t ORDER BY \"Month\"",
    templateVariables: { year: "required" },
    exampleQuestion: "What is the month-on-month revenue for 2025?",
    exampleSql: "SELECT \"Year\", \"Month\", cum_revenue - NVL(LAG(cum_revenue) OVER (PARTITION BY \"Year\" ORDER BY \"Month\"), 0) AS Revenue_USD FROM (SELECT \"Year\", \"Month\", SUM(\"Amount in USD\") AS cum_revenue FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Year\" = '2025' AND \"Cost Category\" = 'Revenue Summary' AND \"Include/Exclude\" = 'Include' GROUP BY \"Year\", \"Month\") t ORDER BY \"Month\"",
    category: "temporal"
  },
  {
    patternName: "Billing Utilization YTD",
    patternDescription: "Calculate YTD billing utilization percentage",
    triggerPhrases: ["billing utilization", "BU percentage", "utilization YTD"],
    sqlTemplate: "SELECT ROUND((SUM(\"Billed Capacity\") / NULLIF(SUM(\"Allocated Capacity\") + SUM(\"Not Allocated Capacity\") + SUM(\"M/S Capacity\") + SUM(\"VKM Capacity\") - SUM(\"Non Linear capacity\"), 0)) * 100, 2) AS billing_utilization_pct FROM cube_fact_data WHERE \"Year\" = {{year}} AND \"Month\" = {{month}} AND \"Cost Category\" = 'Billing Utilization Summary'",
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the billing utilization YTD %?",
    exampleSql: "SELECT ROUND((SUM(\"Billed Capacity\") / NULLIF(SUM(\"Allocated Capacity\") + SUM(\"Not Allocated Capacity\") + SUM(\"M/S Capacity\") + SUM(\"VKM Capacity\") - SUM(\"Non Linear capacity\"), 0)) * 100, 2) AS \"Billing Utilization %\" FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Year\" = '2025' AND \"Month\" = '11' AND \"Cost Category\" = 'Billing Utilization Summary'",
    category: "utilization"
  },
  {
    patternName: "Headcount by Entity",
    patternDescription: "Get GB wise end capacity (headcount) by Region/Entity",
    triggerPhrases: ["headcount by entity", "end capacity", "GB wise capacity"],
    sqlTemplate: "SELECT \"Month\", \"Region/Entity\", SUM(\"Capacity\") AS headcount FROM cube_fact_data WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = {{year}} AND \"Month\" = {{month}} AND \"Resource Type\" IN ('Internal', 'External') GROUP BY \"Month\", \"Region/Entity\"",
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the headcount by entity for November 2025?",
    exampleSql: "SELECT \"Month\", \"Region/Entity\", SUM(\"Capacity\") FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" = '11' AND \"Resource Type\" IN ('Internal', 'External') GROUP BY \"Month\", \"Region/Entity\"",
    category: "headcount"
  },
  {
    patternName: "Cost by Entity",
    patternDescription: "Get cost breakdown by Region/Entity",
    triggerPhrases: ["cost by entity", "entity wise cost", "cost summary by region"],
    sqlTemplate: "SELECT \"Year\", \"Region/Entity\", SUM(\"Amount in USD\") AS cost_usd FROM cube_fact_data WHERE \"Cost Category\" = 'Cost Summary' AND \"Year\" = {{year}} AND \"Month\" = {{month}} GROUP BY \"Year\", \"Region/Entity\"",
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the cost by entity for BGSW?",
    exampleSql: "SELECT \"Year\", \"Region/Entity\", SUM(\"Amount in USD\") AS Cost FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'Cost Summary' AND \"Year\" = '2025' AND \"Month\" = '11' AND \"Region/Entity\" = 'BGSW' GROUP BY \"Year\", \"Region/Entity\"",
    category: "cost"
  },
  // === NEW QUERY PATTERNS (Phase 5) ===
  {
    patternName: "EBIT Percentage Query",
    patternDescription: "Calculate EBIT % as (Revenue - Cost) / Revenue using BP Rate card with proper exclusions",
    triggerPhrases: ["ebit %", "ebit percentage", "profitability", "operating margin", "what is ebit"],
    sqlTemplate: `WITH revenue_data AS (
      SELECT "Year", "Region/Entity", SUM("Amount in USD") AS rev 
      FROM cube_fact_data 
      WHERE "Cost Category" = 'Revenue Summary' 
        AND "Year" = {{year}} AND "Month" = {{month}}
        AND COALESCE(TRIM("Order reason"), 'x') NOT IN ('YEH', 'YEI', 'YEJ', 'YEK', 'YN2')
        AND COALESCE(TRIM("GL Account"), 'x') NOT LIKE '%139%'
      GROUP BY "Year", "Region/Entity"
    ), cost_data AS (
      SELECT "Year", "Region/Entity", SUM("Amount in USD") AS cost 
      FROM cube_fact_data 
      WHERE "Cost Category" = 'Cost Summary' 
        AND "Year" = {{year}} AND "Month" = {{month}}
      GROUP BY "Year", "Region/Entity"
    )
    SELECT r."Year", r."Region/Entity", 
      ROUND(100.0 * (r.rev - COALESCE(c.cost, 0)) / NULLIF(r.rev, 0), 2) AS ebit_pct
    FROM revenue_data r
    LEFT JOIN cost_data c ON r."Year" = c."Year" AND r."Region/Entity" = c."Region/Entity"`,
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the EBIT % for 2025?",
    exampleSql: "WITH revenue_data AS (SELECT \"Year\", \"Region/Entity\", SUM(\"Amount in USD\") AS rev FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'Revenue Summary' AND \"Year\" = '2025' AND \"Month\" = '11' GROUP BY \"Year\", \"Region/Entity\"), cost_data AS (SELECT \"Year\", \"Region/Entity\", SUM(\"Amount in USD\") AS cost FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'Cost Summary' AND \"Year\" = '2025' AND \"Month\" = '11' GROUP BY \"Year\", \"Region/Entity\") SELECT r.\"Year\", r.\"Region/Entity\", ROUND(100.0 * (r.rev - COALESCE(c.cost, 0)) / NULLIF(r.rev, 0), 2) AS ebit_pct FROM revenue_data r LEFT JOIN cost_data c ON r.\"Year\" = c.\"Year\" AND r.\"Region/Entity\" = c.\"Region/Entity\"",
    category: "profitability"
  },
  {
    patternName: "Bench Strength Month-over-Month",
    patternDescription: "Calculate monthly bench strength (Not Allocated Capacity) using LAG to get individual month values from cumulative YTD",
    triggerPhrases: ["bench strength trend", "monthly bench", "not allocated trend", "bench mom", "bench strength MoM"],
    sqlTemplate: `WITH monthly_cum AS (
      SELECT "Year", "Month", SUM("Not Allocated Capacity") AS cum_total
      FROM cube_fact_data
      WHERE "Year" = {{year}}
        AND "Cost Category" = 'Billing Utilization Summary'
        AND TRIM("Sector") IN ('BBM', 'BBE', 'BBI', 'BBG', 'OTHERS')
      GROUP BY "Year", "Month"
    )
    SELECT "Year", "Month", 
      cum_total - COALESCE(LAG(cum_total) OVER (PARTITION BY "Year" ORDER BY "Month"::int), 0) AS bench_strength
    FROM monthly_cum
    ORDER BY "Month"::int`,
    templateVariables: { year: "required" },
    exampleQuestion: "What is the month-over-month bench strength for 2025?",
    exampleSql: "WITH monthly_cum AS (SELECT \"Year\", \"Month\", SUM(\"Not Allocated Capacity\") AS cum_total FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Year\" = '2025' AND \"Cost Category\" = 'Billing Utilization Summary' AND TRIM(\"Sector\") IN ('BBM', 'BBE', 'BBI', 'BBG', 'OTHERS') GROUP BY \"Year\", \"Month\") SELECT \"Year\", \"Month\", cum_total - COALESCE(LAG(cum_total) OVER (PARTITION BY \"Year\" ORDER BY TO_NUMBER(\"Month\")), 0) AS bench_strength FROM monthly_cum ORDER BY TO_NUMBER(\"Month\")",
    category: "capacity"
  },
  {
    patternName: "TBP Revenue by Category",
    patternDescription: "Get transfer pricing revenue breakdown by TBP category type (Offshore, Onsite, Outsourcing, etc.)",
    triggerPhrases: ["tbp revenue breakdown", "transfer pricing by type", "tbp analysis", "tbp revenue by category"],
    sqlTemplate: `SELECT "Cost Category", "Region/Entity", 
      SUM("Amount in USD") AS amount_usd,
      SUM("Amount in INR") AS amount_inr
    FROM cube_fact_data
    WHERE "Cost Category" LIKE '%TBP-Revenue/Capacity%'
      AND "Year" = {{year}} AND "Month" = {{month}}
    GROUP BY "Cost Category", "Region/Entity"
    ORDER BY "Cost Category"`,
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "Show TBP revenue breakdown for 2025",
    exampleSql: "SELECT \"Cost Category\", \"Region/Entity\", SUM(\"Amount in USD\") AS amount_usd FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" LIKE '%TBP-Revenue/Capacity%' AND \"Year\" = '2025' AND \"Month\" = '11' GROUP BY \"Cost Category\", \"Region/Entity\" ORDER BY \"Cost Category\"",
    category: "tbp"
  },
  {
    patternName: "WW Employee Revenue",
    patternDescription: "Get worldwide employee-level revenue/amount data",
    triggerPhrases: ["ww employee revenue", "worldwide employee", "employee wise amount"],
    sqlTemplate: "SELECT \"Region/Entity\", \"Sector\", SUM(\"Amount in USD\") AS amount_usd FROM cube_fact_data WHERE \"Cost Category\" = 'WW Employee Summary' AND \"Year\" = {{year}} AND \"Month\" = {{month}} GROUP BY \"Region/Entity\", \"Sector\"",
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the WW employee revenue for 2025?",
    exampleSql: "SELECT \"Region/Entity\", \"Sector\", SUM(\"Amount in USD\") AS amount_usd FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'WW Employee Summary' AND \"Year\" = '2025' AND \"Month\" = '11' GROUP BY \"Region/Entity\", \"Sector\"",
    category: "employee"
  },
  {
    patternName: "Attrition Pipeline Report",
    patternDescription: "Get employees in the attrition pipeline (upcoming exits)",
    triggerPhrases: ["attrition pipeline", "resignation pipeline", "upcoming exits", "exit forecast"],
    sqlTemplate: "SELECT \"Region/Entity\", \"Sector\", COUNT(DISTINCT \"Employee Number\") AS pipeline_count FROM cube_fact_data WHERE \"Cost Category\" = 'Attrition Pipeline' AND \"Year\" = {{year}} AND \"Month\" = {{month}} GROUP BY \"Region/Entity\", \"Sector\"",
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "Show attrition pipeline for 2025",
    exampleSql: "SELECT \"Region/Entity\", \"Sector\", COUNT(DISTINCT \"Employee Number\") AS pipeline_count FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'Attrition Pipeline' AND \"Year\" = '2025' AND \"Month\" = '11' GROUP BY \"Region/Entity\", \"Sector\"",
    category: "attrition"
  },
  {
    patternName: "Head Count Report",
    patternDescription: "Get headcount from HR Report (Head Count cost category)",
    triggerPhrases: ["hc report", "hr headcount", "head count report", "employee count"],
    sqlTemplate: "SELECT \"Region/Entity\", COUNT(DISTINCT \"Employee Number\") AS headcount FROM cube_fact_data WHERE \"Cost Category\" = 'Head Count' AND \"Year\" = {{year}} AND \"Month\" = {{month}} GROUP BY \"Region/Entity\"",
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the headcount from HR report for 2025?",
    exampleSql: "SELECT \"Region/Entity\", COUNT(DISTINCT \"Employee Number\") AS headcount FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'Head Count' AND \"Year\" = '2025' AND \"Month\" = '11' GROUP BY \"Region/Entity\"",
    category: "headcount"
  },
  // === NEW QUERY PATTERNS (Phase 6 - From Query Document) ===
  {
    patternName: "Offshore Capacity Avg Query",
    patternDescription: "Calculate average offshore internal capacity YTD by dividing sum by months",
    triggerPhrases: ["offshore average capacity", "avg offshore", "offshore avg capacity", "average offshore headcount"],
    sqlTemplate: `SELECT SUM("Capacity") / {{month}} AS offshore_avg_capacity
FROM cube_fact_data 
WHERE "Cost Category" = 'GB Wise END Capacity'
  AND "Year" = {{year}}
  AND "Month" <= {{month}}
  AND "Region/Entity" = {{entity}}
  AND TRIM("Onsite/Offshore") = 'OFFSHORE'
  AND "Resource Type" = 'Internal'
  AND "Sector" <> 'INTERNAL'
  AND "Service Area" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')`,
    templateVariables: { year: "required", month: "required", entity: "required" },
    exampleQuestion: "What is the offshore average capacity for BGSW in 2025?",
    exampleSql: "SELECT SUM(\"Capacity\") / 11 AS offshore_avg_capacity FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" <= '11' AND \"Region/Entity\" = 'BGSW' AND TRIM(\"Onsite/Offshore\") = 'OFFSHORE' AND \"Resource Type\" = 'Internal' AND \"Sector\" <> 'INTERNAL' AND \"Service Area\" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')",
    category: "capacity"
  },
  {
    patternName: "Offshore Capacity End Query",
    patternDescription: "Get offshore internal end capacity for a specific month",
    triggerPhrases: ["offshore end capacity", "offshore headcount", "offshore HC", "offshore end cap"],
    sqlTemplate: `SELECT SUM("Capacity") AS offshore_end_capacity
FROM cube_fact_data 
WHERE "Cost Category" = 'GB Wise END Capacity'
  AND "Year" = {{year}}
  AND "Month" = {{month}}
  AND "Region/Entity" = {{entity}}
  AND TRIM("Onsite/Offshore") = 'OFFSHORE'
  AND "Resource Type" = 'Internal'
  AND "Sector" <> 'INTERNAL'
  AND "Service Area" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')`,
    templateVariables: { year: "required", month: "required", entity: "required" },
    exampleQuestion: "What is the offshore end capacity for BGSW in November 2025?",
    exampleSql: "SELECT SUM(\"Capacity\") AS offshore_end_capacity FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" = '11' AND \"Region/Entity\" = 'BGSW' AND TRIM(\"Onsite/Offshore\") = 'OFFSHORE' AND \"Resource Type\" = 'Internal' AND \"Sector\" <> 'INTERNAL' AND \"Service Area\" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')",
    category: "capacity"
  },
  {
    patternName: "Outsourcing Capacity Avg Query",
    patternDescription: "Calculate average outsourcing (external) capacity YTD by dividing sum by months",
    triggerPhrases: ["outsourcing average capacity", "avg outsourcing", "external avg capacity", "average outsourcing headcount"],
    sqlTemplate: `SELECT SUM("Capacity") / {{month}} AS outsourcing_avg_capacity
FROM cube_fact_data 
WHERE "Cost Category" = 'GB Wise END Capacity'
  AND "Year" = {{year}}
  AND "Month" <= {{month}}
  AND "Region/Entity" = {{entity}}
  AND TRIM("Onsite/Offshore") = 'OFFSHORE'
  AND "Resource Type" = 'External'
  AND "Service Area" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')
  AND "Employee Number" <> '0.0'`,
    templateVariables: { year: "required", month: "required", entity: "required" },
    exampleQuestion: "What is the outsourcing average capacity for BGSW in 2025?",
    exampleSql: "SELECT SUM(\"Capacity\") / 11 AS outsourcing_avg_capacity FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" <= '11' AND \"Region/Entity\" = 'BGSW' AND TRIM(\"Onsite/Offshore\") = 'OFFSHORE' AND \"Resource Type\" = 'External' AND \"Service Area\" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE') AND \"Employee Number\" <> '0.0'",
    category: "capacity"
  },
  {
    patternName: "Outsourcing Capacity End Query",
    patternDescription: "Get outsourcing (external) end capacity for a specific month",
    triggerPhrases: ["outsourcing end capacity", "outsourcing headcount", "external HC", "outsourcing end cap"],
    sqlTemplate: `SELECT SUM("Capacity") AS outsourcing_end_capacity
FROM cube_fact_data 
WHERE "Cost Category" = 'GB Wise END Capacity'
  AND "Year" = {{year}}
  AND "Month" = {{month}}
  AND "Region/Entity" = {{entity}}
  AND TRIM("Onsite/Offshore") = 'OFFSHORE'
  AND "Resource Type" = 'External'
  AND "Service Area" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')
  AND "Employee Number" <> '0.0'`,
    templateVariables: { year: "required", month: "required", entity: "required" },
    exampleQuestion: "What is the outsourcing end capacity for BGSW in November 2025?",
    exampleSql: "SELECT SUM(\"Capacity\") AS outsourcing_end_capacity FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" = '11' AND \"Region/Entity\" = 'BGSW' AND TRIM(\"Onsite/Offshore\") = 'OFFSHORE' AND \"Resource Type\" = 'External' AND \"Service Area\" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE') AND \"Employee Number\" <> '0.0'",
    category: "capacity"
  },
  {
    patternName: "Revenue in Millions Query",
    patternDescription: "Get revenue in millions USD. Entity filter optional - omit for worldwide revenue.",
    triggerPhrases: ["revenue millions", "revenue in M", "total revenue M", "revenue USD millions"],
    sqlTemplate: `SELECT SUM("Amount in USD") / 1000000 AS revenue_millions
FROM cube_fact_data 
WHERE "Cost Category" = 'Revenue Summary' 
  AND "Year" = {{year}}
  AND "Month" = {{month}}`,
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the revenue in millions for 2025?",
    exampleSql: "SELECT SUM(\"Amount in USD\") / 1000000 AS revenue_millions FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'Revenue Summary' AND \"Year\" = '2025' AND \"Month\" = '11'",
    category: "revenue"
  },
  {
    patternName: "Budget Per Average Capacity Query",
    patternDescription: "Calculate revenue divided by average total capacity (Offshore + Outsourcing) per month for a specific entity",
    triggerPhrases: ["budget avg cap", "revenue per capacity", "budget per head", "revenue per average capacity"],
    sqlTemplate: `WITH offshore_cap AS (
  SELECT SUM("Capacity") / {{month}} AS offshore_avg
  FROM cube_fact_data 
  WHERE "Cost Category" = 'GB Wise END Capacity'
    AND "Year" = {{year}} AND "Month" <= {{month}}
    AND "Region/Entity" = {{entity}}
    AND TRIM("Onsite/Offshore") = 'OFFSHORE'
    AND "Resource Type" = 'Internal'
    AND "Sector" <> 'INTERNAL'
    AND "Service Area" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')
), outsourcing_cap AS (
  SELECT SUM("Capacity") / {{month}} AS outsourcing_avg
  FROM cube_fact_data 
  WHERE "Cost Category" = 'GB Wise END Capacity'
    AND "Year" = {{year}} AND "Month" <= {{month}}
    AND "Region/Entity" = {{entity}}
    AND TRIM("Onsite/Offshore") = 'OFFSHORE'
    AND "Resource Type" = 'External'
    AND "Service Area" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')
    AND "Employee Number" <> '0.0'
), revenue AS (
  SELECT SUM("Amount in USD") / 1000000 AS rev_millions
  FROM cube_fact_data 
  WHERE "Cost Category" = 'Revenue Summary' 
    AND "Year" = {{year}} AND "Month" = {{month}}
)
SELECT ROUND(rev_millions / NULLIF(offshore_avg + outsourcing_avg, 0) / {{month}}, 2) AS budget_per_avg_cap
FROM revenue, offshore_cap, outsourcing_cap`,
    templateVariables: { year: "required", month: "required", entity: "required" },
    exampleQuestion: "What is the budget per average capacity for BGSW in 2025?",
    exampleSql: "WITH offshore_cap AS (SELECT SUM(\"Capacity\") / 11 AS offshore_avg FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" <= '11' AND \"Region/Entity\" = 'BGSW' AND TRIM(\"Onsite/Offshore\") = 'OFFSHORE' AND \"Resource Type\" = 'Internal' AND \"Sector\" <> 'INTERNAL' AND \"Service Area\" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')), outsourcing_cap AS (SELECT SUM(\"Capacity\") / 11 AS outsourcing_avg FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" <= '11' AND \"Region/Entity\" = 'BGSW' AND TRIM(\"Onsite/Offshore\") = 'OFFSHORE' AND \"Resource Type\" = 'External' AND \"Service Area\" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE') AND \"Employee Number\" <> '0.0'), revenue AS (SELECT SUM(\"Amount in USD\") / 1000000 AS rev_millions FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'Revenue Summary' AND \"Year\" = '2025' AND \"Month\" = '11') SELECT ROUND(rev_millions / NULLIF(offshore_avg + outsourcing_avg, 0) / 11, 2) AS budget_per_avg_cap FROM revenue, offshore_cap, outsourcing_cap",
    category: "budget"
  },
  {
    patternName: "Capacity Mix Percentage Query",
    patternDescription: "Calculate internal (offshore) and external (outsourcing) capacity mix percentages for a specific entity",
    triggerPhrases: ["capacity mix", "capacity mix %", "offshore outsourcing mix", "internal external ratio"],
    sqlTemplate: `WITH offshore_cap AS (
  SELECT SUM("Capacity") / {{month}} AS offshore_avg
  FROM cube_fact_data 
  WHERE "Cost Category" = 'GB Wise END Capacity'
    AND "Year" = {{year}} AND "Month" <= {{month}}
    AND "Region/Entity" = {{entity}}
    AND TRIM("Onsite/Offshore") = 'OFFSHORE'
    AND "Resource Type" = 'Internal'
    AND "Sector" <> 'INTERNAL'
    AND "Service Area" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')
), outsourcing_cap AS (
  SELECT SUM("Capacity") / {{month}} AS outsourcing_avg
  FROM cube_fact_data 
  WHERE "Cost Category" = 'GB Wise END Capacity'
    AND "Year" = {{year}} AND "Month" <= {{month}}
    AND "Region/Entity" = {{entity}}
    AND TRIM("Onsite/Offshore") = 'OFFSHORE'
    AND "Resource Type" = 'External'
    AND "Service Area" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')
    AND "Employee Number" <> '0.0'
)
SELECT 
  ROUND(offshore_avg / NULLIF(offshore_avg + outsourcing_avg, 0) * 100, 2) AS internal_mix_pct,
  ROUND(outsourcing_avg / NULLIF(offshore_avg + outsourcing_avg, 0) * 100, 2) AS external_mix_pct
FROM offshore_cap, outsourcing_cap`,
    templateVariables: { year: "required", month: "required", entity: "required" },
    exampleQuestion: "What is the capacity mix percentage for BGSW in 2025?",
    exampleSql: "WITH offshore_cap AS (SELECT SUM(\"Capacity\") / 11 AS offshore_avg FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" <= '11' AND \"Region/Entity\" = 'BGSW' AND TRIM(\"Onsite/Offshore\") = 'OFFSHORE' AND \"Resource Type\" = 'Internal' AND \"Sector\" <> 'INTERNAL' AND \"Service Area\" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')), outsourcing_cap AS (SELECT SUM(\"Capacity\") / 11 AS outsourcing_avg FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" <= '11' AND \"Region/Entity\" = 'BGSW' AND TRIM(\"Onsite/Offshore\") = 'OFFSHORE' AND \"Resource Type\" = 'External' AND \"Service Area\" NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE') AND \"Employee Number\" <> '0.0') SELECT ROUND(offshore_avg / NULLIF(offshore_avg + outsourcing_avg, 0) * 100, 2) AS internal_mix_pct, ROUND(outsourcing_avg / NULLIF(offshore_avg + outsourcing_avg, 0) * 100, 2) AS external_mix_pct FROM offshore_cap, outsourcing_cap",
    category: "capacity"
  },
  {
    patternName: "Attrition Percentage Query",
    patternDescription: "Calculate annualized attrition rate = (Attrition / Avg Headcount) / month * 12 for a specific entity",
    triggerPhrases: ["attrition %", "attrition rate", "attrition percentage", "annualized attrition", "turnover rate"],
    sqlTemplate: `WITH attrition_data AS (
  SELECT SUM("Attrition") AS total_attrition
  FROM cube_fact_data 
  WHERE "Cost Category" = 'Attrition'
    AND "Region/Entity" = {{entity}}
    AND "Year" = {{year}}
    AND "Month" = {{month}}
    AND "Resource Type" = 'Internal'
), avg_hc AS (
  SELECT SUM("Capacity") / {{month}} AS avg_headcount
  FROM cube_fact_data 
  WHERE "Cost Category" = 'GB Wise END Capacity'
    AND "Year" = {{year}}
    AND "Month" <= {{month}}
    AND "Region/Entity" = {{entity}}
    AND "Resource Type" = 'Internal'
)
SELECT ROUND(((total_attrition / NULLIF(avg_headcount, 0)) / {{month}}) * 12 * 100, 2) AS attrition_pct
FROM attrition_data, avg_hc`,
    templateVariables: { year: "required", month: "required", entity: "required" },
    exampleQuestion: "What is the attrition percentage for BGSW in 2025?",
    exampleSql: "WITH attrition_data AS (SELECT SUM(\"Attrition\") AS total_attrition FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'Attrition' AND \"Region/Entity\" = 'BGSW' AND \"Year\" = '2025' AND \"Month\" = '11' AND \"Resource Type\" = 'Internal'), avg_hc AS (SELECT SUM(\"Capacity\") / 11 AS avg_headcount FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" <= '11' AND \"Region/Entity\" = 'BGSW' AND \"Resource Type\" = 'Internal') SELECT ROUND(((total_attrition / NULLIF(avg_headcount, 0)) / 11) * 12 * 100, 2) AS attrition_pct FROM attrition_data, avg_hc",
    category: "attrition"
  },
  {
    patternName: "Average Headcount Query",
    patternDescription: "Calculate average internal headcount YTD by dividing sum by months for a specific entity",
    triggerPhrases: ["average headcount", "avg headcount", "avg HC", "average employee count"],
    sqlTemplate: `SELECT SUM("Capacity") / {{month}} AS avg_headcount
FROM cube_fact_data 
WHERE "Cost Category" = 'GB Wise END Capacity'
  AND "Year" = {{year}}
  AND "Month" <= {{month}}
  AND "Region/Entity" = {{entity}}
  AND "Resource Type" = 'Internal'`,
    templateVariables: { year: "required", month: "required", entity: "required" },
    exampleQuestion: "What is the average headcount for BGSW in 2025?",
    exampleSql: "SELECT SUM(\"Capacity\") / 11 AS avg_headcount FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" <= '11' AND \"Region/Entity\" = 'BGSW' AND \"Resource Type\" = 'Internal'",
    category: "headcount"
  },
  // === PYRAMID MIX AND PRICE MIX QUERIES (Phase 7) ===
  {
    patternName: "Pyramid Mix Query",
    patternDescription: "Calculate pyramid mix percentage = (Level / Total) * 100 for salary level categories",
    triggerPhrases: ["pyramid mix", "salary level mix", "level distribution", "pyramid percentage", "SALARYLEVEL mix"],
    sqlTemplate: `WITH level_cap AS (
  SELECT SUM("Capacity") AS level_total
  FROM cube_fact_data 
  WHERE "Cost Category" = 'GB Wise END Capacity'
    AND "Year" = {{year}}
    AND "Month" <= {{month}}
    AND "Resource Type" = 'Internal'
    AND "Sector" <> 'INTERNAL'
    AND "Onsite/Offshore" = 'OFFSHORE'
    AND "Region/Entity" = {{entity}}
    AND "SALARYLEVEL" IN ({{salary_levels}})
), total_cap AS (
  SELECT SUM("Capacity") AS total
  FROM cube_fact_data 
  WHERE "Cost Category" = 'GB Wise END Capacity'
    AND "Year" = {{year}}
    AND "Month" <= {{month}}
    AND "Resource Type" = 'Internal'
    AND "Sector" <> 'INTERNAL'
    AND "Region/Entity" = {{entity}}
    AND "Onsite/Offshore" = 'OFFSHORE'
)
SELECT ROUND((level_total / NULLIF(total, 0)) * 100, 2) AS pyramid_mix_pct
FROM level_cap, total_cap`,
    templateVariables: { year: "required", month: "required", entity: "required", salary_levels: "required" },
    exampleQuestion: "What is the pyramid mix for salary levels 48-51 for BGSW in 2025?",
    exampleSql: "WITH level_cap AS (SELECT SUM(\"Capacity\") AS level_total FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" <= '11' AND \"Resource Type\" = 'Internal' AND \"Sector\" <> 'INTERNAL' AND \"Onsite/Offshore\" = 'OFFSHORE' AND \"Region/Entity\" = 'BGSW' AND \"SALARYLEVEL\" IN ('48','49','50','51')), total_cap AS (SELECT SUM(\"Capacity\") AS total FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" <= '11' AND \"Resource Type\" = 'Internal' AND \"Sector\" <> 'INTERNAL' AND \"Region/Entity\" = 'BGSW' AND \"Onsite/Offshore\" = 'OFFSHORE') SELECT ROUND((level_total / NULLIF(total, 0)) * 100, 2) AS pyramid_mix_pct FROM level_cap, total_cap",
    category: "pyramid"
  },
  {
    patternName: "Price Mix Ratio Query",
    patternDescription: "Calculate price mix ratio = (Differential / Price mix) * 100. Differential = Billed Capacity where RATE CLASSIFICATION IN (Premium, Lead). Price mix = total Billed Capacity (no rate filter). Both exclude VKM codes 0001, 0002, 0003.",
    triggerPhrases: ["price mix ratio", "price mix", "rate classification mix", "premium lead ratio", "differential ratio"],
    sqlTemplate: `WITH differential AS (
  SELECT SUM("Billed Capacity") AS diff_total
  FROM cube_fact_data 
  WHERE "Cost Category" = 'WW Employee Summary'
    AND "Year" = {{year}}
    AND "Month" = {{month}}
    AND "Region/Entity" = {{entity}}
    AND "RATE CLASSIFICATION" IN ('Premium', 'Lead')
    AND "VKM Code" NOT IN ('0001', '0002', '0003')
), price_mix AS (
  SELECT SUM("Billed Capacity") AS price_total
  FROM cube_fact_data 
  WHERE "Cost Category" = 'WW Employee Summary'
    AND "Year" = {{year}}
    AND "Month" = {{month}}
    AND "Region/Entity" = {{entity}}
    AND "VKM Code" NOT IN ('0001', '0002', '0003')
)
SELECT ROUND((diff_total / NULLIF(price_total, 0)) * 100, 2) AS price_mix_ratio_pct
FROM differential, price_mix`,
    templateVariables: { year: "required", month: "required", entity: "required" },
    exampleQuestion: "What is the price mix ratio for BGSW in November 2025?",
    exampleSql: "WITH differential AS (SELECT SUM(\"Billed Capacity\") AS diff_total FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'WW Employee Summary' AND \"Year\" = '2025' AND \"Month\" = '11' AND \"Region/Entity\" = 'BGSW' AND \"RATE CLASSIFICATION\" IN ('Premium', 'Lead') AND \"VKM Code\" NOT IN ('0001', '0002', '0003')), price_mix AS (SELECT SUM(\"Billed Capacity\") AS price_total FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'WW Employee Summary' AND \"Year\" = '2025' AND \"Month\" = '11' AND \"Region/Entity\" = 'BGSW' AND \"VKM Code\" NOT IN ('0001', '0002', '0003')) SELECT ROUND((diff_total / NULLIF(price_total, 0)) * 100, 2) AS price_mix_ratio_pct FROM differential, price_mix",
    category: "pricing"
  },
  // === WORLDWIDE (WW) QUERIES - NO REGION/ENTITY FILTER (Phase 8) ===
  // Same logic as entity-specific queries but aggregates across ALL regions
  {
    patternName: "Worldwide Outsourcing Capacity End",
    patternDescription: "Total outsourcing (external) end capacity across ALL regions/entities worldwide",
    triggerPhrases: ["worldwide outsourcing end capacity", "WW outsourcing end cap", "global outsourcing capacity", "total outsourcing end capacity", "worldwide external capacity"],
    sqlTemplate: `SELECT SUM("Capacity") AS ww_outsourcing_end_capacity
FROM cube_fact_data 
WHERE "Cost Category" = 'GB Wise END Capacity'
  AND "Year" = {{year}}
  AND "Month" = {{month}}
  AND "Resource Type" = 'External'
  AND "Employee Number" <> '0.0'`,
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the worldwide outsourcing end capacity for November 2025?",
    exampleSql: "SELECT SUM(\"Capacity\") AS ww_outsourcing_end_capacity FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" = '11' AND \"Resource Type\" = 'External' AND \"Employee Number\" <> '0.0'",
    category: "capacity"
  },
  {
    patternName: "Worldwide Outsourcing Capacity Avg",
    patternDescription: "Average outsourcing (external) capacity YTD across ALL regions/entities worldwide",
    triggerPhrases: ["worldwide outsourcing average capacity", "WW outsourcing avg cap", "global outsourcing avg", "total outsourcing average capacity"],
    sqlTemplate: `SELECT SUM("Capacity") / {{month}} AS ww_outsourcing_avg_capacity
FROM cube_fact_data 
WHERE "Cost Category" = 'GB Wise END Capacity'
  AND "Year" = {{year}}
  AND "Month" <= {{month}}
  AND "Resource Type" = 'External'
  AND "Employee Number" <> '0.0'`,
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the worldwide outsourcing average capacity for 2025?",
    exampleSql: "SELECT SUM(\"Capacity\") / 11 AS ww_outsourcing_avg_capacity FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" <= '11' AND \"Resource Type\" = 'External' AND \"Employee Number\" <> '0.0'",
    category: "capacity"
  },
  {
    patternName: "Worldwide Offshore Capacity End",
    patternDescription: "Total offshore internal end capacity across ALL regions/entities worldwide",
    triggerPhrases: ["worldwide offshore end capacity", "WW offshore end cap", "global offshore capacity", "total offshore end capacity", "worldwide internal capacity"],
    sqlTemplate: `SELECT SUM("Capacity") AS ww_offshore_end_capacity
FROM cube_fact_data 
WHERE "Cost Category" = 'GB Wise END Capacity'
  AND "Year" = {{year}}
  AND "Month" = {{month}}
  AND "Resource Type" = 'Internal'`,
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the worldwide offshore end capacity for November 2025?",
    exampleSql: "SELECT SUM(\"Capacity\") AS ww_offshore_end_capacity FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" = '11' AND \"Resource Type\" = 'Internal'",
    category: "capacity"
  },
  {
    patternName: "Worldwide Offshore Capacity Avg",
    patternDescription: "Average offshore internal capacity YTD across ALL regions/entities worldwide",
    triggerPhrases: ["worldwide offshore average capacity", "WW offshore avg cap", "global offshore avg", "total offshore average capacity"],
    sqlTemplate: `SELECT SUM("Capacity") / {{month}} AS ww_offshore_avg_capacity
FROM cube_fact_data 
WHERE "Cost Category" = 'GB Wise END Capacity'
  AND "Year" = {{year}}
  AND "Month" <= {{month}}
  AND "Resource Type" = 'Internal'`,
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the worldwide offshore average capacity for 2025?",
    exampleSql: "SELECT SUM(\"Capacity\") / 11 AS ww_offshore_avg_capacity FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" <= '11' AND \"Resource Type\" = 'Internal'",
    category: "capacity"
  },
  {
    patternName: "Worldwide Revenue",
    patternDescription: "Total YTD revenue across ALL regions/entities worldwide",
    triggerPhrases: ["worldwide revenue", "WW revenue", "global revenue", "total revenue all regions", "worldwide YTD revenue"],
    sqlTemplate: `SELECT SUM("Amount in USD") / 1000000 AS ww_revenue_millions
FROM cube_fact_data 
WHERE "Cost Category" = 'Revenue Summary'
  AND "Year" = {{year}}
  AND "Month" = {{month}}
  AND "Include/Exclude" = 'Include'`,
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the worldwide revenue for November 2025?",
    exampleSql: "SELECT SUM(\"Amount in USD\") / 1000000 AS ww_revenue_millions FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'Revenue Summary' AND \"Year\" = '2025' AND \"Month\" = '11' AND \"Include/Exclude\" = 'Include'",
    category: "revenue"
  },
  {
    patternName: "Worldwide Attrition Percentage",
    patternDescription: "Annualized attrition rate across ALL regions/entities worldwide",
    triggerPhrases: ["worldwide attrition", "WW attrition %", "global attrition", "total attrition rate", "worldwide turnover"],
    sqlTemplate: `WITH attrition_data AS (
  SELECT SUM("Attrition") AS total_attrition
  FROM cube_fact_data 
  WHERE "Cost Category" = 'Attrition'
    AND "Year" = {{year}}
    AND "Month" = {{month}}
    AND "Resource Type" = 'Internal'
), avg_hc AS (
  SELECT SUM("Capacity") / {{month}} AS avg_headcount
  FROM cube_fact_data 
  WHERE "Cost Category" = 'GB Wise END Capacity'
    AND "Year" = {{year}}
    AND "Month" <= {{month}}
    AND "Resource Type" = 'Internal'
)
SELECT ROUND(((total_attrition / NULLIF(avg_headcount, 0)) / {{month}}) * 12 * 100, 2) AS ww_attrition_pct
FROM attrition_data, avg_hc`,
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the worldwide attrition percentage for 2025?",
    exampleSql: "WITH attrition_data AS (SELECT SUM(\"Attrition\") AS total_attrition FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'Attrition' AND \"Year\" = '2025' AND \"Month\" = '11' AND \"Resource Type\" = 'Internal'), avg_hc AS (SELECT SUM(\"Capacity\") / 11 AS avg_headcount FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" <= '11' AND \"Resource Type\" = 'Internal') SELECT ROUND(((total_attrition / NULLIF(avg_headcount, 0)) / 11) * 12 * 100, 2) AS ww_attrition_pct FROM attrition_data, avg_hc",
    category: "attrition"
  },
  {
    patternName: "Worldwide Billing Utilization",
    patternDescription: "Billing utilization percentage across ALL regions/entities worldwide",
    triggerPhrases: ["worldwide billing utilization", "WW billing util", "global utilization", "total billing utilization", "worldwide BU%"],
    sqlTemplate: `SELECT ROUND((SUM("Billed Capacity") / NULLIF(SUM("Allocated Capacity") + SUM("Not Allocated Capacity") + SUM("M/S Capacity") + SUM("VKM Capacity") - SUM("Non Linear capacity"), 0)) * 100, 2) AS ww_billing_util_pct
FROM cube_fact_data 
WHERE "Cost Category" = 'Billing Utilization Summary'
  AND "Year" = {{year}}
  AND "Month" = {{month}}`,
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the worldwide billing utilization for November 2025?",
    exampleSql: "SELECT ROUND((SUM(\"Billed Capacity\") / NULLIF(SUM(\"Allocated Capacity\") + SUM(\"Not Allocated Capacity\") + SUM(\"M/S Capacity\") + SUM(\"VKM Capacity\") - SUM(\"Non Linear capacity\"), 0)) * 100, 2) AS ww_billing_util_pct FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'Billing Utilization Summary' AND \"Year\" = '2025' AND \"Month\" = '11'",
    category: "utilization"
  },
  {
    patternName: "Worldwide Pyramid Mix",
    patternDescription: "Pyramid mix percentage across ALL regions/entities worldwide",
    triggerPhrases: ["worldwide pyramid mix", "WW pyramid mix", "global pyramid mix", "total pyramid mix"],
    sqlTemplate: `WITH level_cap AS (
  SELECT SUM("Capacity") AS level_total
  FROM cube_fact_data 
  WHERE "Cost Category" = 'GB Wise END Capacity'
    AND "Year" = {{year}}
    AND "Month" <= {{month}}
    AND "Resource Type" = 'Internal'
    AND "Sector" <> 'INTERNAL'
    AND "Onsite/Offshore" = 'OFFSHORE'
    AND "SALARYLEVEL" IN ({{salary_levels}})
), total_cap AS (
  SELECT SUM("Capacity") AS total
  FROM cube_fact_data 
  WHERE "Cost Category" = 'GB Wise END Capacity'
    AND "Year" = {{year}}
    AND "Month" <= {{month}}
    AND "Resource Type" = 'Internal'
    AND "Sector" <> 'INTERNAL'
    AND "Onsite/Offshore" = 'OFFSHORE'
)
SELECT ROUND((level_total / NULLIF(total, 0)) * 100, 2) AS ww_pyramid_mix_pct
FROM level_cap, total_cap`,
    templateVariables: { year: "required", month: "required", salary_levels: "required" },
    exampleQuestion: "What is the worldwide pyramid mix for salary levels 48-51 in 2025?",
    exampleSql: "WITH level_cap AS (SELECT SUM(\"Capacity\") AS level_total FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" <= '11' AND \"Resource Type\" = 'Internal' AND \"Sector\" <> 'INTERNAL' AND \"Onsite/Offshore\" = 'OFFSHORE' AND \"SALARYLEVEL\" IN ('48','49','50','51')), total_cap AS (SELECT SUM(\"Capacity\") AS total FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" <= '11' AND \"Resource Type\" = 'Internal' AND \"Sector\" <> 'INTERNAL' AND \"Onsite/Offshore\" = 'OFFSHORE') SELECT ROUND((level_total / NULLIF(total, 0)) * 100, 2) AS ww_pyramid_mix_pct FROM level_cap, total_cap",
    category: "pyramid"
  },
  {
    patternName: "Worldwide Price Mix Ratio",
    patternDescription: "Price mix ratio across ALL regions/entities worldwide. Differential = Billed Capacity where RATE CLASSIFICATION IN (Premium, Lead). Price mix = total Billed Capacity (no rate filter). Both exclude VKM codes 0001, 0002, 0003.",
    triggerPhrases: ["worldwide price mix", "WW price mix ratio", "global price mix", "total price mix ratio"],
    sqlTemplate: `WITH differential AS (
  SELECT SUM("Billed Capacity") AS diff_total
  FROM cube_fact_data 
  WHERE "Cost Category" = 'WW Employee Summary'
    AND "Year" = {{year}}
    AND "Month" = {{month}}
    AND "RATE CLASSIFICATION" IN ('Premium', 'Lead')
    AND "VKM Code" NOT IN ('0001', '0002', '0003')
), price_mix AS (
  SELECT SUM("Billed Capacity") AS price_total
  FROM cube_fact_data 
  WHERE "Cost Category" = 'WW Employee Summary'
    AND "Year" = {{year}}
    AND "Month" = {{month}}
    AND "VKM Code" NOT IN ('0001', '0002', '0003')
)
SELECT ROUND((diff_total / NULLIF(price_total, 0)) * 100, 2) AS ww_price_mix_ratio_pct
FROM differential, price_mix`,
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the worldwide price mix ratio for November 2025?",
    exampleSql: "WITH differential AS (SELECT SUM(\"Billed Capacity\") AS diff_total FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'WW Employee Summary' AND \"Year\" = '2025' AND \"Month\" = '11' AND \"RATE CLASSIFICATION\" IN ('Premium', 'Lead') AND \"VKM Code\" NOT IN ('0001', '0002', '0003')), price_mix AS (SELECT SUM(\"Billed Capacity\") AS price_total FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'WW Employee Summary' AND \"Year\" = '2025' AND \"Month\" = '11' AND \"VKM Code\" NOT IN ('0001', '0002', '0003')) SELECT ROUND((diff_total / NULLIF(price_total, 0)) * 100, 2) AS ww_price_mix_ratio_pct FROM differential, price_mix",
    category: "pricing"
  },
  {
    patternName: "Worldwide Budget (mUSD)",
    patternDescription: "Total worldwide budget (revenue) in millions USD across ALL regions/entities",
    triggerPhrases: ["worldwide budget", "WW budget", "global budget", "total budget", "budget worldwide", "worldwide budget musd", "WW budget musd"],
    sqlTemplate: `SELECT ROUND(SUM("Amount in USD")::numeric / 1000000, 2) AS ww_budget_musd
FROM cube_fact_data 
WHERE "Cost Category" = 'Revenue Summary'
  AND "Year" = {{year}}
  AND "Month" = {{month}}
  AND ("Order reason" IS NULL OR "Order reason" <> 'Y36')
  AND "Include/Exclude" = 'Include'`,
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the worldwide budget for November 2025?",
    exampleSql: "SELECT ROUND(SUM(\"Amount in USD\")::numeric / 1000000, 2) AS ww_budget_musd FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'Revenue Summary' AND \"Year\" = '2025' AND \"Month\" = '11' AND (\"Order reason\" IS NULL OR \"Order reason\" <> 'Y36') AND \"Include/Exclude\" = 'Include'",
    category: "budget"
  },
  {
    patternName: "Worldwide Budget Offshore",
    patternDescription: "Offshore portion of worldwide budget in millions USD. Formula: (Non-External revenue) - (Non-Offshore revenue) = Internal Offshore revenue",
    triggerPhrases: ["worldwide budget offshore", "WW budget offshore", "global budget offshore", "budget offshore worldwide", "worldwide offshore budget", "WW offshore budget"],
    sqlTemplate: `SELECT ROUND(
  (SUM(CASE WHEN "Resource Type" <> 'External' THEN "Amount in USD" END) 
   - SUM(CASE WHEN "Onsite/Offshore" <> 'OFFSHORE' THEN "Amount in USD" END))::numeric / 1000000, 2
) AS ww_budget_offshore_musd
FROM cube_fact_data 
WHERE "Cost Category" = 'Revenue Summary'
  AND "Year" = {{year}}
  AND "Month" = {{month}}
  AND ("Order reason" IS NULL OR "Order reason" <> 'Y36')
  AND "Include/Exclude" = 'Include'`,
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the worldwide budget offshore for November 2025?",
    exampleSql: "SELECT ROUND((SUM(CASE WHEN \"Resource Type\" <> 'External' THEN \"Amount in USD\" END) - SUM(CASE WHEN \"Onsite/Offshore\" <> 'OFFSHORE' THEN \"Amount in USD\" END))::numeric / 1000000, 2) AS ww_budget_offshore_musd FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'Revenue Summary' AND \"Year\" = '2025' AND \"Month\" = '11' AND (\"Order reason\" IS NULL OR \"Order reason\" <> 'Y36') AND \"Include/Exclude\" = 'Include'",
    category: "budget"
  },
  {
    patternName: "Worldwide Budget Outsourcing",
    patternDescription: "Outsourcing (external) portion of worldwide budget in millions USD. Filters by Resource Type = External.",
    triggerPhrases: ["worldwide budget outsourcing", "WW budget outsourcing", "global budget outsourcing", "budget outsourcing worldwide", "worldwide outsourcing budget", "WW outsourcing budget", "budget external worldwide"],
    sqlTemplate: `SELECT ROUND(SUM("Amount in USD")::numeric / 1000000, 2) AS ww_budget_outsourcing_musd
FROM cube_fact_data 
WHERE "Cost Category" = 'Revenue Summary'
  AND "Year" = {{year}}
  AND "Month" = {{month}}
  AND ("Order reason" IS NULL OR "Order reason" <> 'Y36')
  AND "Include/Exclude" = 'Include'
  AND "Resource Type" = 'External'`,
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the worldwide budget outsourcing for November 2025?",
    exampleSql: "SELECT ROUND(SUM(\"Amount in USD\")::numeric / 1000000, 2) AS ww_budget_outsourcing_musd FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'Revenue Summary' AND \"Year\" = '2025' AND \"Month\" = '11' AND (\"Order reason\" IS NULL OR \"Order reason\" <> 'Y36') AND \"Include/Exclude\" = 'Include' AND \"Resource Type\" = 'External'",
    category: "budget"
  },
  {
    patternName: "Worldwide Budget Per Average Capacity",
    patternDescription: "Budget per average capacity across ALL regions/entities worldwide",
    triggerPhrases: ["worldwide budget per avg capacity", "WW budget per avg cap", "global budget per capacity", "total budget per average capacity", "worldwide budget/avg cap"],
    sqlTemplate: `WITH revenue AS (
  SELECT SUM("Amount in USD") AS total_revenue
  FROM cube_fact_data 
  WHERE "Cost Category" = 'Revenue Summary'
    AND "Year" = {{year}}
    AND "Month" = {{month}}
    AND "Include/Exclude" = 'Include'
), avg_cap AS (
  SELECT SUM("Capacity") / {{month}} AS avg_capacity
  FROM cube_fact_data 
  WHERE "Cost Category" = 'GB Wise END Capacity'
    AND "Year" = {{year}}
    AND "Month" <= {{month}}
    AND "Resource Type" = 'Internal'
)
SELECT ROUND(total_revenue / NULLIF(avg_capacity, 0), 2) AS ww_budget_per_avg_cap
FROM revenue, avg_cap`,
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the worldwide budget per average capacity for 2025?",
    exampleSql: "WITH revenue AS (SELECT SUM(\"Amount in USD\") AS total_revenue FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'Revenue Summary' AND \"Year\" = '2025' AND \"Month\" = '11' AND \"Include/Exclude\" = 'Include'), avg_cap AS (SELECT SUM(\"Capacity\") / 11 AS avg_capacity FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" <= '11' AND \"Resource Type\" = 'Internal') SELECT ROUND(total_revenue / NULLIF(avg_capacity, 0), 2) AS ww_budget_per_avg_cap FROM revenue, avg_cap",
    category: "budget"
  },
  {
    patternName: "Worldwide Capacity Mix Percentage",
    patternDescription: "Capacity mix percentage (outsourcing vs total) across ALL regions/entities worldwide",
    triggerPhrases: ["worldwide capacity mix", "WW capacity mix %", "global capacity mix", "total capacity mix", "worldwide outsourcing ratio"],
    sqlTemplate: `WITH outsourcing AS (
  SELECT SUM("Capacity") / {{month}} AS outsourcing_avg
  FROM cube_fact_data 
  WHERE "Cost Category" = 'GB Wise END Capacity'
    AND "Year" = {{year}}
    AND "Month" <= {{month}}
    AND "Resource Type" = 'External'
    AND "Employee Number" <> '0.0'
), total_cap AS (
  SELECT SUM("Capacity") / {{month}} AS total_avg
  FROM cube_fact_data 
  WHERE "Cost Category" = 'GB Wise END Capacity'
    AND "Year" = {{year}}
    AND "Month" <= {{month}}
)
SELECT ROUND((outsourcing_avg / NULLIF(total_avg, 0)) * 100, 2) AS ww_capacity_mix_pct
FROM outsourcing, total_cap`,
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the worldwide capacity mix percentage for 2025?",
    exampleSql: "WITH outsourcing AS (SELECT SUM(\"Capacity\") / 11 AS outsourcing_avg FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" <= '11' AND \"Resource Type\" = 'External' AND \"Employee Number\" <> '0.0'), total_cap AS (SELECT SUM(\"Capacity\") / 11 AS total_avg FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" <= '11') SELECT ROUND((outsourcing_avg / NULLIF(total_avg, 0)) * 100, 2) AS ww_capacity_mix_pct FROM outsourcing, total_cap",
    category: "capacity"
  },
  {
    patternName: "Worldwide Average Headcount",
    patternDescription: "Average internal headcount YTD across ALL regions/entities worldwide",
    triggerPhrases: ["worldwide average headcount", "WW avg headcount", "global average headcount", "total average headcount", "worldwide avg HC"],
    sqlTemplate: `SELECT SUM("Capacity") / {{month}} AS ww_avg_headcount
FROM cube_fact_data 
WHERE "Cost Category" = 'GB Wise END Capacity'
  AND "Year" = {{year}}
  AND "Month" <= {{month}}
  AND "Resource Type" = 'Internal'`,
    templateVariables: { year: "required", month: "required" },
    exampleQuestion: "What is the worldwide average headcount for 2025?",
    exampleSql: "SELECT SUM(\"Capacity\") / 11 AS ww_avg_headcount FROM \"MV_GB_INSIGHTS_ALL\" WHERE \"Cost Category\" = 'GB Wise END Capacity' AND \"Year\" = '2025' AND \"Month\" <= '11' AND \"Resource Type\" = 'Internal'",
    category: "headcount"
  }
];

export const BOSCH_COLUMN_VALUES = [
  // Cost Category values
  {
    columnName: "Cost Category",
    valueName: "Revenue Summary",
    valueDescription: "Use for all revenue-related queries. Contains YTD revenue when filtered by specific month.",
    valueAliases: ["revenue", "rev summary"],
    usageContext: "For YTD Revenue, filter by Cost Category = 'Revenue Summary' AND Include/Exclude = 'Include'",
    relatedValues: ["Cost Summary", "Billing Utilization Summary"]
  },
  {
    columnName: "Cost Category",
    valueName: "Cost Summary",
    valueDescription: "Use for cost-related queries and calculations",
    valueAliases: ["cost", "expenses"],
    usageContext: "For total cost, EBIT calculations",
    relatedValues: ["Revenue Summary"]
  },
  {
    columnName: "Cost Category",
    valueName: "Billing Utilization Summary",
    valueDescription: "Aggregated billing utilization data. Use for capacity and utilization calculations.",
    valueAliases: ["utilization", "billing util"],
    usageContext: "For Billing Utilization %, Available Capacity, Bench Strength calculations",
    relatedValues: ["Billing Utilization"]
  },
  {
    columnName: "Cost Category",
    valueName: "Billing Utilization",
    valueDescription: "Detailed billing utilization at employee level",
    valueAliases: ["detailed utilization"],
    usageContext: "For employee-level utilization analysis",
    relatedValues: ["Billing Utilization Summary"]
  },
  {
    columnName: "Cost Category",
    valueName: "GB Wise END Capacity",
    valueDescription: "GB (Global Business) wise end capacity/headcount",
    valueAliases: ["headcount", "end capacity", "HC"],
    usageContext: "For headcount queries, filter Resource Type = Internal or External",
    relatedValues: ["Attrition"]
  },
  {
    columnName: "Cost Category",
    valueName: "Attrition",
    valueDescription: "Employee attrition/turnover data",
    valueAliases: ["turnover", "attrition rate"],
    usageContext: "For attrition and turnover queries",
    relatedValues: ["GB Wise END Capacity"]
  },
  // Sector values
  {
    columnName: "Sector",
    valueName: "BBM",
    valueDescription: "Manufacturing Solutions (MS) service area",
    valueAliases: ["MS", "Manufacturing Solutions"],
    usageContext: "Filter for MS View: Sector = 'BBM'",
    relatedValues: ["BBE", "BBG", "BBI"]
  },
  {
    columnName: "Sector",
    valueName: "BBE",
    valueDescription: "Part of SX service areas",
    valueAliases: ["SX"],
    usageContext: "Filter for SX View along with BBG, BBI, OTHERS",
    relatedValues: ["BBM", "BBG", "BBI", "OTHERS"]
  },
  // Resource Type values
  {
    columnName: "Resource Type",
    valueName: "Internal",
    valueDescription: "Internal Bosch employees",
    valueAliases: ["internal employees", "Bosch employees"],
    usageContext: "For internal headcount and capacity calculations",
    relatedValues: ["External"]
  },
  {
    columnName: "Resource Type",
    valueName: "External",
    valueDescription: "External/outsourced resources (contractors)",
    valueAliases: ["outsourcing", "contractors", "external resources"],
    usageContext: "For outsourcing capacity and external headcount",
    relatedValues: ["Internal"]
  },
  // Include/Exclude values
  {
    columnName: "Include/Exclude",
    valueName: "Include",
    valueDescription: "Records that should be included in calculations",
    valueAliases: ["valid records", "active"],
    usageContext: "Always filter Include/Exclude = 'Include' for revenue and most calculations",
    relatedValues: ["Exclude"]
  },
  {
    columnName: "Include/Exclude",
    valueName: "Exclude",
    valueDescription: "Records that should be excluded from standard calculations",
    valueAliases: ["excluded", "invalid"],
    usageContext: "Typically excluded from revenue and utilization calculations",
    relatedValues: ["Include"]
  },
  // === NEW COST CATEGORY VALUES (Phase 1) ===
  {
    columnName: "Cost Category",
    valueName: "Revenue",
    valueDescription: "Detailed revenue data at project/employee level (not summary)",
    valueAliases: ["detailed revenue", "project revenue"],
    usageContext: "For project-level revenue analysis. Includes Project ID. Use Revenue Summary for aggregated YTD revenue.",
    relatedValues: ["Revenue Summary"]
  },
  {
    columnName: "Cost Category",
    valueName: "Head Count",
    valueDescription: "Headcount data with employee details from HR Report",
    valueAliases: ["HC", "employee count", "HR headcount"],
    usageContext: "For headcount queries with employee breakdown. Different from GB Wise END Capacity.",
    relatedValues: ["GB Wise END Capacity"]
  },
  {
    columnName: "Cost Category",
    valueName: "WW Employee",
    valueDescription: "Worldwide employee-level data with amounts",
    valueAliases: ["employee revenue", "WW emp", "worldwide employee"],
    usageContext: "For employee-level revenue/cost analysis with SALARYLEVEL",
    relatedValues: ["WW Employee Summary"]
  },
  {
    columnName: "Cost Category",
    valueName: "WW Employee Summary",
    valueDescription: "Summarized worldwide employee data",
    valueAliases: ["WW summary", "worldwide summary"],
    usageContext: "For aggregated WW employee analysis by Region/Entity and Sector",
    relatedValues: ["WW Employee"]
  },
  {
    columnName: "Cost Category",
    valueName: "Attrition Pipeline",
    valueDescription: "Employees in the attrition pipeline (upcoming exits)",
    valueAliases: ["resignation pipeline", "exit pipeline", "upcoming attrition"],
    usageContext: "For attrition forecasting - shows confirmed future exits",
    relatedValues: ["Attrition"]
  },
  // TBP-Revenue/Capacity variants
  {
    columnName: "Cost Category",
    valueName: "OFFSHORE_TBP-Revenue/Capacity",
    valueDescription: "Transfer pricing for offshore capacity",
    valueAliases: ["offshore TBP", "offshore transfer pricing"],
    usageContext: "For offshore capacity revenue/cost allocation analysis",
    relatedValues: ["ONSITE_TBP-Revenue/Capacity", "OFFSHORE - THROUGH ICT_TBP-Revenue/Capacity"]
  },
  {
    columnName: "Cost Category",
    valueName: "ONSITE_TBP-Revenue/Capacity",
    valueDescription: "Transfer pricing for onsite capacity",
    valueAliases: ["onsite TBP", "onsite transfer pricing"],
    usageContext: "For onsite capacity revenue/cost allocation analysis",
    relatedValues: ["OFFSHORE_TBP-Revenue/Capacity"]
  },
  {
    columnName: "Cost Category",
    valueName: "OUTSOURCING_TBP-Revenue/Capacity",
    valueDescription: "Transfer pricing for outsourcing capacity",
    valueAliases: ["outsourcing TBP", "external TBP"],
    usageContext: "For outsourcing capacity allocation analysis",
    relatedValues: ["OUTSOURCING - THROUGH ICT_TBP-Revenue/Capacity"]
  },
  {
    columnName: "Cost Category",
    valueName: "OUTSOURCING - THROUGH ICT_TBP-Revenue/Capacity",
    valueDescription: "Transfer pricing for ICT-routed outsourcing",
    valueAliases: ["ICT outsourcing TBP", "ICT external"],
    usageContext: "For ICT outsourcing capacity allocation",
    relatedValues: ["OUTSOURCING_TBP-Revenue/Capacity"]
  },
  {
    columnName: "Cost Category",
    valueName: "OFFSHORE - THROUGH ICT_TBP-Revenue/Capacity",
    valueDescription: "Transfer pricing for ICT-routed offshore",
    valueAliases: ["ICT offshore TBP", "ICT offshore"],
    usageContext: "For ICT offshore capacity allocation",
    relatedValues: ["OFFSHORE_TBP-Revenue/Capacity"]
  },
  {
    columnName: "Cost Category",
    valueName: "BILLING AT ACTUALS_TBP-Revenue/Capacity",
    valueDescription: "Billing at actuals transfer pricing",
    valueAliases: ["actuals billing TBP", "actual billing"],
    usageContext: "For actual-based billing allocation",
    relatedValues: []
  },
  {
    columnName: "Cost Category",
    valueName: "BGSV (PASS THROUGH BUSINESS)_TBP-Revenue/Capacity",
    valueDescription: "BGSV pass-through business transfer pricing",
    valueAliases: ["BGSV passthrough", "pass through business", "BGSV TBP"],
    usageContext: "For BGSV pass-through revenue allocation",
    relatedValues: []
  },
  {
    columnName: "Cost Category",
    valueName: "SOFTWARE CLUSTER (SWC)_TBP-Revenue/Capacity",
    valueDescription: "Software cluster transfer pricing",
    valueAliases: ["SWC TBP", "software cluster", "SWC"],
    usageContext: "For software cluster capacity allocation",
    relatedValues: []
  },
  // === ORGANIZATIONAL HIERARCHY COLUMNS ===
  {
    columnName: "ResBU",
    valueName: "ResBU",
    valueDescription: "Resource Business Unit - Always use ResBU for BU queries, not BU",
    valueAliases: ["BU", "Business Unit", "resource BU"],
    usageContext: "When user asks for 'BU', always use ResBU column. This is the authoritative BU column.",
    relatedValues: ["ResTop_Section", "ResSection", "ResDept", "ResGroup"]
  },
  {
    columnName: "ResTop_Section",
    valueName: "ResTop_Section",
    valueDescription: "Top Section organizational level - Always use ResTop_Section for Top Section queries",
    valueAliases: ["Top Section", "top section"],
    usageContext: "For org hierarchy queries at Top Section level - use ResTop_Section",
    relatedValues: ["ResBU", "ResSection"]
  },
  {
    columnName: "ResSection",
    valueName: "ResSection",
    valueDescription: "Section organizational level - Always use ResSection for Section queries",
    valueAliases: ["Section", "section"],
    usageContext: "For section-level queries - use ResSection",
    relatedValues: ["ResTop_Section", "ResDept"]
  },
  {
    columnName: "ResDept",
    valueName: "ResDept",
    valueDescription: "Department organizational level - Always use ResDept for Dept queries",
    valueAliases: ["Dept", "Department", "department"],
    usageContext: "For department-level queries - use ResDept",
    relatedValues: ["ResSection", "ResGroup"]
  },
  {
    columnName: "ResGroup",
    valueName: "ResGroup",
    valueDescription: "Group organizational level - Always use ResGroup for Group queries",
    valueAliases: ["Group", "group"],
    usageContext: "For group-level queries - use ResGroup",
    relatedValues: ["ResDept"]
  },
  // Report column values
  {
    columnName: "Report",
    valueName: "EC",
    valueDescription: "End Capacity report type - used for headcount data",
    valueAliases: ["End Capacity Report", "EC report"],
    usageContext: "Filter Report = 'EC' for headcount reports. Important to distinguish from capacity reports.",
    relatedValues: ["BUCAP"]
  },
  {
    columnName: "Report",
    valueName: "BUCAP",
    valueDescription: "Billing Utilization Capacity report type",
    valueAliases: ["Billing Capacity Report", "BUCAP report", "capacity report"],
    usageContext: "Filter Report = 'BUCAP' for capacity data. Important to distinguish from headcount.",
    relatedValues: ["EC"]
  },
  // Customer Segment / Project GB
  {
    columnName: "ProjectGB",
    valueName: "ProjectGB",
    valueDescription: "Customer Segment / Project Global Business - use for customer segmentation",
    valueAliases: ["Customer Segment", "Project GB", "customer", "project global business"],
    usageContext: "Customer Segment relates to ProjectGB column. Use for customer-based analysis.",
    relatedValues: ["PlanningGB"]
  },
  {
    columnName: "PlanningGB",
    valueName: "PlanningGB",
    valueDescription: "Planning Global Business - used for planning and budget allocation",
    valueAliases: ["Planning GB", "planning global business"],
    usageContext: "For planning-based analysis. Related to but different from ProjectGB.",
    relatedValues: ["ProjectGB"]
  },
  // === NEW SERVICE AREA COLUMNS (Phase 2 additions) ===
  {
    columnName: "New Service Area",
    valueName: "CORPORATE",
    valueDescription: "Corporate service area - general corporate functions",
    valueAliases: ["corporate", "corp"],
    usageContext: "Filter or group by New Service Area = 'CORPORATE' for corporate data",
    relatedValues: ["MS", "RBEI_BD"]
  },
  {
    columnName: "New Service Area",
    valueName: "MS",
    valueDescription: "Manufacturing Solutions service area",
    valueAliases: ["manufacturing solutions", "manufacturing"],
    usageContext: "Filter or group by New Service Area = 'MS' for manufacturing solutions data",
    relatedValues: ["CORPORATE", "RBEI_BD"]
  },
  {
    columnName: "New Service Area",
    valueName: "RBEI_BD",
    valueDescription: "RBEI Business Development service area",
    valueAliases: ["RBEI", "BD", "business development"],
    usageContext: "Filter or group by New Service Area = 'RBEI_BD' for RBEI BD data",
    relatedValues: ["CORPORATE", "MS"]
  },
  {
    columnName: "New Service Area",
    valueName: "New Service Area Column",
    valueDescription: "Column for grouping by new service area categories. Use for summarizing data by service area.",
    valueAliases: ["service area", "new service area", "service area column", "by service area"],
    usageContext: "GROUP BY New Service Area for service area breakdown. Available in Billing Utilization data.",
    relatedValues: ["Service Area", "ResSubServiceArea"]
  },
  {
    columnName: "Service Area",
    valueName: "Service Area Column",
    valueDescription: "Original service area column for backward compatibility",
    valueAliases: ["original service area", "legacy service area"],
    usageContext: "Older service area classification. Prefer 'New Service Area' for latest groupings.",
    relatedValues: ["New Service Area"]
  },
  {
    columnName: "ResSubServiceArea",
    valueName: "ResSubServiceArea Column",
    valueDescription: "Resource sub-service area for detailed organizational analysis",
    valueAliases: ["sub service area", "resource sub area"],
    usageContext: "For detailed sub-service area analysis at resource level",
    relatedValues: ["New Service Area", "ProjSubServiceArea"]
  },
  {
    columnName: "ProjSubServiceArea",
    valueName: "ProjSubServiceArea Column",
    valueDescription: "Project sub-service area for project-level analysis",
    valueAliases: ["project sub service area", "proj sub area"],
    usageContext: "For detailed sub-service area analysis at project level",
    relatedValues: ["New Service Area", "ResSubServiceArea"]
  },
  {
    columnName: "SubCostCategory",
    valueName: "SubCostCategory Column",
    valueDescription: "Sub-category classification for detailed cost/category breakdown",
    valueAliases: ["sub category", "sub cost category", "cost sub category"],
    usageContext: "For detailed breakdown within cost categories",
    relatedValues: ["Cost Category", "CostCatergory_Class"]
  },
  {
    columnName: "ProfitCenter",
    valueName: "ProfitCenter Column",
    valueDescription: "Profit center code for financial analysis",
    valueAliases: ["profit center", "PC", "profit centre"],
    usageContext: "For profit center based financial analysis",
    relatedValues: ["Cost Center"]
  },
  // === ONSITE/OFFSHORE COLUMN VALUES (Phase 3 - Capacity Queries) ===
  {
    columnName: "Onsite/Offshore",
    valueName: "OFFSHORE",
    valueDescription: "Offshore location - resources based in offshore locations (India, Vietnam, etc.)",
    valueAliases: ["offshore", "offshore capacity", "offshore resources"],
    usageContext: "Filter Onsite/Offshore = 'OFFSHORE' for offshore capacity calculations. Used with GB Wise END Capacity.",
    relatedValues: ["ONSITE"]
  },
  {
    columnName: "Onsite/Offshore",
    valueName: "ONSITE",
    valueDescription: "Onsite location - resources based at customer/project locations",
    valueAliases: ["onsite", "onsite capacity", "onsite resources"],
    usageContext: "Filter Onsite/Offshore = 'ONSITE' for onsite capacity calculations.",
    relatedValues: ["OFFSHORE"]
  },
  {
    columnName: "Sector",
    valueName: "INTERNAL",
    valueDescription: "Internal sector - corporate/internal functions to be excluded from capacity calculations",
    valueAliases: ["internal sector", "corp sector"],
    usageContext: "Exclude Sector = 'INTERNAL' from capacity calculations to get accurate headcount",
    relatedValues: ["BBM", "BBE", "BBG", "BBI"]
  },
  {
    columnName: "Attrition",
    valueName: "Attrition Column",
    valueDescription: "Attrition count column for turnover calculations",
    valueAliases: ["attrition count", "turnover count"],
    usageContext: "SUM(Attrition) for attrition totals. Use with Cost Category = 'Attrition'.",
    relatedValues: ["Capacity"]
  }
];

/**
 * Seed Bosch business logic into a cube
 */
export async function seedBoschBusinessLogic(cubeId: string, db: any) {
  console.log(`🌱 Seeding Bosch business logic for cube ${cubeId}...`);
  
  let results = {
    termsCreated: 0,
    calculationsCreated: 0,
    filtersCreated: 0,
    patternsCreated: 0,
    columnValuesCreated: 0
  };
  
  try {
    // Seed business terms
    for (const term of BOSCH_BUSINESS_TERMS) {
      try {
        await db.execute(`
          INSERT INTO cube_business_terms 
          (cube_id, term_name, term_aliases, definition, sql_filter, required_columns, category, priority)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT DO NOTHING
        `, [cubeId, term.termName, term.termAliases, term.definition, term.sqlFilter, term.requiredColumns, term.category, term.priority]);
        results.termsCreated++;
      } catch (e) {
        // Skip duplicates
      }
    }
    
    // Seed calculation rules
    for (const calc of BOSCH_CALCULATION_RULES) {
      try {
        await db.execute(`
          INSERT INTO cube_calculation_rules 
          (cube_id, calculation_name, calculation_aliases, description, formula, formula_type, result_type, required_columns, default_filters, rounding_precision)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT DO NOTHING
        `, [cubeId, calc.calculationName, calc.calculationAliases, calc.description, calc.formula, calc.formulaType, calc.resultType, calc.requiredColumns, calc.defaultFilters, calc.roundingPrecision]);
        results.calculationsCreated++;
      } catch (e) {
        // Skip duplicates
      }
    }
    
    // Seed filter rules
    for (const filter of BOSCH_FILTER_RULES) {
      try {
        await db.execute(`
          INSERT INTO cube_filter_rules 
          (cube_id, filter_name, filter_aliases, description, sql_predicate, target_column, is_default)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT DO NOTHING
        `, [cubeId, filter.filterName, filter.filterAliases, filter.description, filter.sqlPredicate, filter.targetColumn, filter.isDefault ? 1 : 0]);
        results.filtersCreated++;
      } catch (e) {
        // Skip duplicates
      }
    }
    
    // Seed query patterns
    for (const pattern of BOSCH_QUERY_PATTERNS) {
      try {
        await db.execute(`
          INSERT INTO cube_query_patterns 
          (cube_id, pattern_name, pattern_description, trigger_phrases, sql_template, template_variables, example_question, example_sql, category)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT DO NOTHING
        `, [cubeId, pattern.patternName, pattern.patternDescription, pattern.triggerPhrases, pattern.sqlTemplate, JSON.stringify(pattern.templateVariables), pattern.exampleQuestion, pattern.exampleSql, pattern.category]);
        results.patternsCreated++;
      } catch (e) {
        // Skip duplicates
      }
    }
    
    // Seed column values
    for (const cv of BOSCH_COLUMN_VALUES) {
      try {
        await db.execute(`
          INSERT INTO cube_column_values 
          (cube_id, column_name, value_name, value_description, value_aliases, usage_context, related_values)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT DO NOTHING
        `, [cubeId, cv.columnName, cv.valueName, cv.valueDescription, cv.valueAliases, cv.usageContext, cv.relatedValues]);
        results.columnValuesCreated++;
      } catch (e) {
        // Skip duplicates
      }
    }
    
    console.log(`✅ Bosch business logic seeded:`, results);
    return results;
    
  } catch (error) {
    console.error('Error seeding Bosch business logic:', error);
    throw error;
  }
}
