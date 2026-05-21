/**
 * Nemko-Specific Business Logic Seed Data
 * 
 * This file contains business terminology, calculation formulas, filter rules,
 * and query patterns for Nemko's P&L, Balance Sheet, and Cash Flow data.
 * 
 * Data Structure:
 * - P&L: Location → DS (Department/Service) → Account → Period → Value
 * - Balance Sheet: Line Item → Subsidiary → Period → Value
 * - Cash Flow: Line Item → Subsidiary → Period → Value
 * 
 * Scenarios: Actual, Budget, Forecast
 * Periods: Monthly (Jan-Dec, FY22-FY26)
 */

// ============================================================================
// NEMKO BUSINESS TERMS
// ============================================================================

export const NEMKO_BUSINESS_TERMS = [
  // === P&L Revenue Terms ===
  {
    termName: "Total Revenues",
    termAliases: ["total revenue", "revenues", "all revenue", "gross revenue"],
    definition: "Sum of all revenue line items including external and intercompany revenue",
    sqlFilter: "\"account\" = 'Total Revenues'",
    requiredColumns: ["account", "value"],
    category: "revenue",
    priority: 10
  },
  {
    termName: "External Revenue",
    termAliases: ["external sales", "3rd party revenue", "customer revenue"],
    definition: "Revenue from external customers (non-intercompany)",
    sqlFilter: "\"account\" LIKE '%External Revenue%' OR \"account\" LIKE '%Sales revenue Ext%'",
    requiredColumns: ["account", "value"],
    category: "revenue",
    priority: 9
  },
  {
    termName: "Intercompany Revenue",
    termAliases: ["IC revenue", "I/C revenue", "internal revenue"],
    definition: "Revenue from intercompany transactions (Sales revenue I/C)",
    sqlFilter: "\"account\" LIKE '%I/C%' OR \"account\" LIKE '%Intercompany%'",
    requiredColumns: ["account", "value"],
    category: "revenue",
    priority: 8
  },
  {
    termName: "Net Revenue",
    termAliases: ["net sales", "revenue after COGS", "net sales revenue"],
    definition: "Total Revenues minus Total Cost of Sales",
    sqlFilter: "\"account\" = 'Net Revenue'",
    requiredColumns: ["account", "value"],
    category: "revenue",
    priority: 10
  },

  // === P&L Cost Terms ===
  {
    termName: "Total Cost of Sales",
    termAliases: ["COGS", "cost of goods sold", "cost of sales", "direct costs"],
    definition: "Direct costs associated with revenue generation",
    sqlFilter: "\"account\" = 'Total Cost of Sales'",
    requiredColumns: ["account", "value"],
    category: "cost",
    priority: 10
  },
  {
    termName: "Personnel Cost",
    termAliases: ["salary cost", "employee cost", "labor cost", "staff cost", "wages"],
    definition: "Total personnel-related expenses including salaries and benefits",
    sqlFilter: "\"account\" LIKE '%Personnel Cost%' OR \"account\" LIKE '%Salary%'",
    requiredColumns: ["account", "value"],
    category: "cost",
    priority: 9
  },
  {
    termName: "Other Costs",
    termAliases: ["other expenses", "operating expenses", "overhead"],
    definition: "Operating costs excluding personnel and depreciation",
    sqlFilter: "\"account\" LIKE '%Other Cost%' OR \"account\" LIKE '%Operating cost%'",
    requiredColumns: ["account", "value"],
    category: "cost",
    priority: 7
  },
  {
    termName: "Depreciation",
    termAliases: ["depreciation expense", "amortization", "D&A"],
    definition: "Depreciation and amortization expenses",
    sqlFilter: "\"account\" LIKE '%Depr%' OR \"account\" LIKE '%Depreciation%'",
    requiredColumns: ["account", "value"],
    category: "cost",
    priority: 7
  },

  // === P&L Profitability Terms ===
  {
    termName: "EBITDA",
    termAliases: ["earnings before interest tax depreciation amortization", "operating profit before D&A"],
    definition: "Earnings Before Interest, Taxes, Depreciation, and Amortization",
    sqlFilter: "\"account\" = 'EBITDA'",
    requiredColumns: ["account", "value"],
    category: "profitability",
    priority: 10
  },
  {
    termName: "EBIT",
    termAliases: ["operating profit", "operating income", "earnings before interest and tax"],
    definition: "Earnings Before Interest and Taxes (Operating Profit)",
    sqlFilter: "\"account\" = 'EBIT'",
    requiredColumns: ["account", "value"],
    category: "profitability",
    priority: 10
  },
  {
    termName: "Net Income",
    termAliases: ["net profit", "bottom line", "profit after tax", "net earnings"],
    definition: "Final profit after all expenses, interest, and taxes",
    sqlFilter: "\"account\" = 'Net Income' OR \"line_item\" = 'Net Income'",
    requiredColumns: ["account", "value"],
    category: "profitability",
    priority: 10
  },
  {
    termName: "Profit Before Tax",
    termAliases: ["PBT", "pre-tax profit", "earnings before tax"],
    definition: "Profit before income tax expense",
    sqlFilter: "\"account\" LIKE '%Profit Before Tax%' OR \"account\" LIKE '%PBT%'",
    requiredColumns: ["account", "value"],
    category: "profitability",
    priority: 9
  },

  // === Balance Sheet Terms ===
  {
    termName: "Total Assets",
    termAliases: ["assets", "all assets"],
    definition: "Sum of all assets on the balance sheet",
    sqlFilter: "\"line_item\" = 'Total Assets'",
    requiredColumns: ["line_item", "value"],
    category: "balance_sheet",
    priority: 10
  },
  {
    termName: "Fixed Assets",
    termAliases: ["property plant equipment", "PPE", "tangible assets", "non-current assets"],
    definition: "Long-term tangible assets including land, buildings, and equipment",
    sqlFilter: "\"line_item\" = 'Fixed assets' OR \"line_item\" LIKE '%Fixed Assets%'",
    requiredColumns: ["line_item", "value"],
    category: "balance_sheet",
    priority: 9
  },
  {
    termName: "Intangible Assets",
    termAliases: ["intangibles", "goodwill", "IP assets"],
    definition: "Non-physical assets including goodwill and intellectual property",
    sqlFilter: "\"line_item\" = 'Intangible assets' OR \"line_item\" LIKE '%Goodwill%'",
    requiredColumns: ["line_item", "value"],
    category: "balance_sheet",
    priority: 8
  },
  {
    termName: "Cash",
    termAliases: ["cash and cash equivalents", "liquid assets", "bank balance"],
    definition: "Cash and cash equivalents available",
    sqlFilter: "\"line_item\" LIKE '%Cash%'",
    requiredColumns: ["line_item", "value"],
    category: "balance_sheet",
    priority: 9
  },
  {
    termName: "Accounts Receivable",
    termAliases: ["AR", "receivables", "trade receivables", "debtors"],
    definition: "Amounts owed by customers for services rendered",
    sqlFilter: "\"line_item\" LIKE '%Receivable%' OR \"line_item\" LIKE '%Account receivable%'",
    requiredColumns: ["line_item", "value"],
    category: "balance_sheet",
    priority: 8
  },
  {
    termName: "Accounts Payable",
    termAliases: ["AP", "payables", "trade payables", "creditors"],
    definition: "Amounts owed to suppliers and vendors",
    sqlFilter: "\"line_item\" LIKE '%Payable%' OR \"line_item\" LIKE '%Account payable%'",
    requiredColumns: ["line_item", "value"],
    category: "balance_sheet",
    priority: 8
  },
  {
    termName: "Total Equity",
    termAliases: ["shareholders equity", "net worth", "owners equity"],
    definition: "Total shareholders' equity including retained earnings",
    sqlFilter: "\"line_item\" LIKE '%Equity%' OR \"line_item\" = 'Total Equity'",
    requiredColumns: ["line_item", "value"],
    category: "balance_sheet",
    priority: 9
  },
  {
    termName: "Deferred Tax",
    termAliases: ["deferred tax assets", "deferred tax liabilities", "DTA", "DTL"],
    definition: "Deferred tax assets or liabilities",
    sqlFilter: "\"line_item\" LIKE '%Deferred tax%'",
    requiredColumns: ["line_item", "value"],
    category: "balance_sheet",
    priority: 7
  },

  // === Cash Flow Terms ===
  {
    termName: "Operating Cash Flow",
    termAliases: ["OCF", "cash from operations", "net operating cash flow"],
    definition: "Net cash generated from operating activities",
    sqlFilter: "\"line_item\" = 'Net Operating Cash Flow'",
    requiredColumns: ["line_item", "value"],
    category: "cash_flow",
    priority: 10
  },
  {
    termName: "Investing Cash Flow",
    termAliases: ["ICF", "cash from investing", "net investing cash flow"],
    definition: "Net cash used in investing activities",
    sqlFilter: "\"line_item\" = 'Net Investing Cash Flow'",
    requiredColumns: ["line_item", "value"],
    category: "cash_flow",
    priority: 10
  },
  {
    termName: "Financing Cash Flow",
    termAliases: ["FCF", "cash from financing", "net financing cash flow"],
    definition: "Net cash from financing activities",
    sqlFilter: "\"line_item\" = 'Net Financing Cash Flow'",
    requiredColumns: ["line_item", "value"],
    category: "cash_flow",
    priority: 10
  },

  // === Department/Service Terms ===
  {
    termName: "Safety",
    termAliases: ["safety department", "S106", "safety services"],
    definition: "Safety certification and testing services (Department S106)",
    sqlFilter: "\"ds\" = 'S106 Safety' OR \"ds\" LIKE '%Safety%'",
    requiredColumns: ["ds", "value"],
    category: "department",
    priority: 8
  },
  {
    termName: "Energy Environment",
    termAliases: ["energy", "environment", "S107", "energy services"],
    definition: "Energy and environment certification services (Department S107)",
    sqlFilter: "\"ds\" = 'S107 Energy Environment' OR \"ds\" LIKE '%Energy%'",
    requiredColumns: ["ds", "value"],
    category: "department",
    priority: 8
  },
  {
    termName: "EMC Testing",
    termAliases: ["EMC", "electromagnetic compatibility", "S119"],
    definition: "Electromagnetic compatibility testing services (Department S119)",
    sqlFilter: "\"ds\" = 'S119 Testing EMC' OR \"ds\" LIKE '%EMC%'",
    requiredColumns: ["ds", "value"],
    category: "department",
    priority: 8
  },
  {
    termName: "Cyber Assurance",
    termAliases: ["cybersecurity", "cyber", "S115"],
    definition: "Cybersecurity assurance services (Department S115)",
    sqlFilter: "\"ds\" = 'S115 Cyber Assurance' OR \"ds\" LIKE '%Cyber%'",
    requiredColumns: ["ds", "value"],
    category: "department",
    priority: 8
  },
  {
    termName: "All Services",
    termAliases: ["all departments", "total services", "company total"],
    definition: "Aggregated data across all service departments",
    sqlFilter: "\"ds\" = 'ALL SERVICES'",
    requiredColumns: ["ds", "value"],
    category: "department",
    priority: 10
  }
];

// ============================================================================
// NEMKO CALCULATION RULES
// ============================================================================

export const NEMKO_CALCULATION_RULES = [
  {
    calculationName: "Gross Margin",
    calculationAliases: ["gross profit margin", "gross margin %", "GM%"],
    description: "Gross profit as a percentage of total revenue: (Net Revenue / Total Revenue) * 100",
    formula: "ROUND(100.0 * SUM(CASE WHEN \"account\" = 'Net Revenue' THEN value ELSE 0 END) / NULLIF(SUM(CASE WHEN \"account\" = 'Total Revenues' THEN value ELSE 0 END), 0), 2)",
    formulaType: "ratio",
    resultType: "percentage",
    requiredColumns: ["account", "value"],
    defaultFilters: null,
    roundingPrecision: 2
  },
  {
    calculationName: "EBITDA Margin",
    calculationAliases: ["EBITDA %", "EBITDA margin %", "operating margin before D&A"],
    description: "EBITDA as a percentage of total revenue",
    formula: "ROUND(100.0 * SUM(CASE WHEN \"account\" = 'EBITDA' THEN value ELSE 0 END) / NULLIF(SUM(CASE WHEN \"account\" = 'Total Revenues' THEN value ELSE 0 END), 0), 2)",
    formulaType: "ratio",
    resultType: "percentage",
    requiredColumns: ["account", "value"],
    defaultFilters: null,
    roundingPrecision: 2
  },
  {
    calculationName: "EBIT Margin",
    calculationAliases: ["EBIT %", "operating margin", "operating profit margin"],
    description: "EBIT as a percentage of total revenue",
    formula: "ROUND(100.0 * SUM(CASE WHEN \"account\" = 'EBIT' THEN value ELSE 0 END) / NULLIF(SUM(CASE WHEN \"account\" = 'Total Revenues' THEN value ELSE 0 END), 0), 2)",
    formulaType: "ratio",
    resultType: "percentage",
    requiredColumns: ["account", "value"],
    defaultFilters: null,
    roundingPrecision: 2
  },
  {
    calculationName: "Net Profit Margin",
    calculationAliases: ["net margin", "profit margin", "net income margin", "NPM"],
    description: "Net income as a percentage of total revenue",
    formula: "ROUND(100.0 * SUM(CASE WHEN \"account\" = 'Net Income' THEN value ELSE 0 END) / NULLIF(SUM(CASE WHEN \"account\" = 'Total Revenues' THEN value ELSE 0 END), 0), 2)",
    formulaType: "ratio",
    resultType: "percentage",
    requiredColumns: ["account", "value"],
    defaultFilters: null,
    roundingPrecision: 2
  },
  {
    calculationName: "Budget Variance",
    calculationAliases: ["variance", "budget vs actual", "actual vs budget", "BvA"],
    description: "Difference between actual and budget values",
    formula: "SUM(CASE WHEN plan_type LIKE 'Actual%' THEN value ELSE 0 END) - SUM(CASE WHEN plan_type LIKE 'Budget%' THEN value ELSE 0 END)",
    formulaType: "difference",
    resultType: "currency",
    requiredColumns: ["plan_type", "value"],
    defaultFilters: null,
    roundingPrecision: 0
  },
  {
    calculationName: "Budget Variance %",
    calculationAliases: ["variance %", "variance percentage", "BvA %"],
    description: "Percentage difference between actual and budget",
    formula: "ROUND(100.0 * (SUM(CASE WHEN plan_type LIKE 'Actual%' THEN value ELSE 0 END) - SUM(CASE WHEN plan_type LIKE 'Budget%' THEN value ELSE 0 END)) / NULLIF(SUM(CASE WHEN plan_type LIKE 'Budget%' THEN value ELSE 0 END), 0), 2)",
    formulaType: "ratio",
    resultType: "percentage",
    requiredColumns: ["plan_type", "value"],
    defaultFilters: null,
    roundingPrecision: 2
  },
  {
    calculationName: "Forecast Variance",
    calculationAliases: ["forecast vs actual", "actual vs forecast", "FvA"],
    description: "Difference between actual and forecast values",
    formula: "SUM(CASE WHEN plan_type LIKE 'Actual%' THEN value ELSE 0 END) - SUM(CASE WHEN plan_type LIKE 'Forecast%' THEN value ELSE 0 END)",
    formulaType: "difference",
    resultType: "currency",
    requiredColumns: ["plan_type", "value"],
    defaultFilters: null,
    roundingPrecision: 0
  },
  {
    calculationName: "YoY Growth",
    calculationAliases: ["year over year", "YoY", "annual growth", "yearly growth"],
    description: "Year-over-year growth rate",
    formula: "ROUND(100.0 * (SUM(CASE WHEN \"year\" = EXTRACT(YEAR FROM CURRENT_DATE) THEN value ELSE 0 END) - SUM(CASE WHEN \"year\" = EXTRACT(YEAR FROM CURRENT_DATE) - 1 THEN value ELSE 0 END)) / NULLIF(SUM(CASE WHEN \"year\" = EXTRACT(YEAR FROM CURRENT_DATE) - 1 THEN value ELSE 0 END), 0), 2)",
    formulaType: "ratio",
    resultType: "percentage",
    requiredColumns: ["year", "value"],
    defaultFilters: null,
    roundingPrecision: 2
  },
  {
    calculationName: "Revenue per Employee",
    calculationAliases: ["revenue/employee", "productivity", "revenue productivity"],
    description: "Total revenue divided by headcount (requires headcount data)",
    formula: "ROUND(SUM(CASE WHEN \"account\" = 'Total Revenues' THEN value ELSE 0 END) / NULLIF(COUNT(DISTINCT employee_number), 0), 0)",
    formulaType: "ratio",
    resultType: "currency",
    requiredColumns: ["account", "value", "employee_number"],
    defaultFilters: null,
    roundingPrecision: 0
  }
];

// ============================================================================
// NEMKO FILTER RULES
// ============================================================================

export const NEMKO_FILTER_RULES = [
  // === Scenario Filters ===
  {
    filterName: "Actuals Only",
    filterAliases: ["actual", "actuals", "actual data", "real data"],
    description: "Filter for actual/historical data only",
    sqlPredicate: "plan_type LIKE 'Actual%'",
    targetColumn: "plan_type",
    isDefault: false
  },
  {
    filterName: "Budget Only",
    filterAliases: ["budget", "budget data", "planned"],
    description: "Filter for budget data only",
    sqlPredicate: "plan_type LIKE 'Budget%'",
    targetColumn: "plan_type",
    isDefault: false
  },
  {
    filterName: "Forecast Only",
    filterAliases: ["forecast", "forecast data", "projected"],
    description: "Filter for forecast data only",
    sqlPredicate: "plan_type LIKE 'Forecast%'",
    targetColumn: "plan_type",
    isDefault: false
  },

  // === Geographic/Entity Filters (JSONB format for cube_fact_data) ===
  // Note: Use REPLACE(row_data->>'Values', chr(160), ' ') to normalize non-breaking spaces
  {
    filterName: "Exclude Eliminations",
    filterAliases: ["no eliminations", "exclude IC", "operating entities only"],
    description: "Exclude intercompany elimination entries for consolidated reporting",
    sqlPredicate: "REPLACE(row_data->>'Values', chr(160), ' ') NOT LIKE '%Elimination%'",
    targetColumn: "row_data.Values",
    isDefault: true
  },
  {
    filterName: "E10 Asia",
    filterAliases: ["Asia", "Asian entities", "APAC", "asia", "E10"],
    description: "FROZEN: Filter for E10 Asia entity",
    sqlPredicate: "REPLACE(row_data->>'Values', chr(160), ' ') = 'E10 Asia'",
    targetColumn: "row_data.Values",
    isDefault: false
  },
  {
    filterName: "E13 Taiwan",
    filterAliases: ["Taiwan", "taiwan", "E13", "Taiwan branch"],
    description: "FROZEN: Filter for E13 Taiwan branch entity",
    sqlPredicate: "REPLACE(row_data->>'Values', chr(160), ' ') = 'E13 Taiwan branch'",
    targetColumn: "row_data.Values",
    isDefault: false
  },
  {
    filterName: "E16 India Test Lab",
    filterAliases: ["India Test Lab", "E16", "India test", "test lab"],
    description: "FROZEN: Filter for E16 India Test Lab entity",
    sqlPredicate: "REPLACE(row_data->>'Values', chr(160), ' ') = 'E16 India (Test Lab) Private Limited'",
    targetColumn: "row_data.Values",
    isDefault: false
  },
  {
    filterName: "E17 India",
    filterAliases: ["India", "india", "E17", "India Private Limited"],
    description: "FROZEN: Filter for E17 India entity",
    sqlPredicate: "REPLACE(row_data->>'Values', chr(160), ' ') = 'E17 India Private Limited'",
    targetColumn: "row_data.Values",
    isDefault: false
  },
  {
    filterName: "E50 USA",
    filterAliases: ["USA", "US", "E50", "America"],
    description: "FROZEN: Filter for E50 USA entity",
    sqlPredicate: "REPLACE(row_data->>'Values', chr(160), ' ') = 'E50 USA, Inc.'",
    targetColumn: "row_data.Values",
    isDefault: false
  },
  {
    filterName: "E51 Canada",
    filterAliases: ["Canada", "E51"],
    description: "FROZEN: Filter for E51 Canada entity",
    sqlPredicate: "REPLACE(row_data->>'Values', chr(160), ' ') = 'E51 Canada, Inc.'",
    targetColumn: "row_data.Values",
    isDefault: false
  },
  {
    filterName: "E7 Nemko Group AS",
    filterAliases: ["Norway", "Norwegian", "E7", "Nemko Group AS", "Oslo"],
    description: "FROZEN: Filter for E7 Nemko Group AS (Norway) entity",
    sqlPredicate: "REPLACE(row_data->>'Values', chr(160), ' ') = 'E7 Nemko Group AS'",
    targetColumn: "row_data.Values",
    isDefault: false
  },
  {
    filterName: "E0 Group Total",
    filterAliases: ["Group Total", "consolidated", "total group", "Nemko Group", "E0"],
    description: "FROZEN: Filter for E0 Group Total (consolidated) entity",
    sqlPredicate: "REPLACE(row_data->>'Values', chr(160), ' ') = 'E0 Group Total'",
    targetColumn: "row_data.Values",
    isDefault: false
  },
  {
    filterName: "Europe Region",
    filterAliases: ["Europe", "European entities", "EU"],
    description: "Filter for European subsidiaries",
    sqlPredicate: "REPLACE(row_data->>'Values', chr(160), ' ') IN ('E7 Nemko Group AS', 'E33 GmbH', 'E34 Spa a socio unico', 'E61 Nemko Digital B.V', 'E27 Scandinavia AS', 'E32 System Sikkerhet AS', 'E57 Norlab AS', 'E25 Europe')",
    targetColumn: "row_data.Values",
    isDefault: false
  },
  {
    filterName: "Asia Pacific Region",
    filterAliases: ["APAC Region", "Asia Pacific"],
    description: "Filter for all Asia Pacific subsidiaries",
    sqlPredicate: "REPLACE(row_data->>'Values', chr(160), ' ') IN ('E13 Taiwan branch', 'E20 Hongkong', 'E15 Korea', 'E17 India Private Limited', 'E16 India (Test Lab) Private Limited', 'E10 Asia')",
    targetColumn: "row_data.Values",
    isDefault: false
  },
  {
    filterName: "North America Region",
    filterAliases: ["North America", "NA", "Americas"],
    description: "Filter for North American subsidiaries",
    sqlPredicate: "REPLACE(row_data->>'Values', chr(160), ' ') IN ('E50 USA, Inc.', 'E51 Canada, Inc.', 'E48 North America Inc (Holding)')",
    targetColumn: "row_data.Values",
    isDefault: false
  },

  // === Department Filters (JSONB format) ===
  {
    filterName: "Total Services/Departments",
    filterAliases: ["summary", "aggregated", "all departments"],
    description: "FROZEN: Filter for TOTAL SERVICES/DEPARTMENTS aggregated row",
    sqlPredicate: "row_data->>'Unnamed: 1' = 'TOTAL SERVICES/DEPARTMENTS'",
    targetColumn: "row_data.Unnamed: 1",
    isDefault: false
  },

  // === Account Filters (JSONB format for P&L accounts) ===
  {
    filterName: "Net Revenue",
    filterAliases: ["total revenue", "revenue", "net sales", "total sales"],
    description: "FROZEN: Filter for Net Revenue (Total Revenues minus Cost of Sales)",
    sqlPredicate: "row_data->>'Unnamed: 2' = 'Net Revenue'",
    targetColumn: "row_data.Unnamed: 2",
    isDefault: false
  },
  {
    filterName: "Total Revenues",
    filterAliases: ["gross revenue", "all revenue", "total revenues"],
    description: "FROZEN: Filter for Total Revenues (before cost of sales deduction)",
    sqlPredicate: "row_data->>'Unnamed: 2' = 'Total Revenues'",
    targetColumn: "row_data.Unnamed: 2",
    isDefault: false
  },
  {
    filterName: "EBITDA",
    filterAliases: ["ebitda", "earnings before interest tax depreciation"],
    description: "FROZEN: Filter for EBITDA account",
    sqlPredicate: "row_data->>'Unnamed: 2' = 'EBITDA'",
    targetColumn: "row_data.Unnamed: 2",
    isDefault: false
  },
  {
    filterName: "EBIT",
    filterAliases: ["ebit", "operating profit", "operating income"],
    description: "FROZEN: Filter for EBIT account",
    sqlPredicate: "row_data->>'Unnamed: 2' = 'EBIT'",
    targetColumn: "row_data.Unnamed: 2",
    isDefault: false
  },
  {
    filterName: "Net Income",
    filterAliases: ["net income", "net profit", "bottom line", "profit after tax"],
    description: "FROZEN: Filter for Net Income account",
    sqlPredicate: "row_data->>'Unnamed: 2' = 'Net Income'",
    targetColumn: "row_data.Unnamed: 2",
    isDefault: false
  },

  // === Statement Type Filters ===
  {
    filterName: "P&L Statement",
    filterAliases: ["income statement", "profit and loss", "P&L"],
    description: "Filter for P&L statement data",
    sqlPredicate: "statement_type = 'P&L'",
    targetColumn: "statement_type",
    isDefault: false
  },
  {
    filterName: "Balance Sheet",
    filterAliases: ["BS", "financial position", "assets and liabilities"],
    description: "Filter for Balance Sheet data",
    sqlPredicate: "statement_type = 'BS'",
    targetColumn: "statement_type",
    isDefault: false
  },
  {
    filterName: "Cash Flow",
    filterAliases: ["CF", "cash flow statement", "cash movements"],
    description: "Filter for Cash Flow statement data",
    sqlPredicate: "statement_type = 'CF'",
    targetColumn: "statement_type",
    isDefault: false
  },

  // === Fiscal Year Filters ===
  {
    filterName: "FY24",
    filterAliases: ["fiscal 2024", "2024", "FY2024"],
    description: "Filter for fiscal year 2024 data",
    sqlPredicate: "period LIKE '%FY24%' OR \"year\" = 2024",
    targetColumn: "period",
    isDefault: false
  },
  {
    filterName: "FY25",
    filterAliases: ["fiscal 2025", "2025", "FY2025", "current year"],
    description: "Filter for fiscal year 2025 data",
    sqlPredicate: "period LIKE '%FY25%' OR \"year\" = 2025",
    targetColumn: "period",
    isDefault: false
  },
  {
    filterName: "FY26",
    filterAliases: ["fiscal 2026", "2026", "FY2026", "next year"],
    description: "Filter for fiscal year 2026 data",
    sqlPredicate: "period LIKE '%FY26%' OR \"year\" = 2026",
    targetColumn: "period",
    isDefault: false
  }
];

// ============================================================================
// NEMKO QUERY PATTERNS
// ============================================================================

export const NEMKO_QUERY_PATTERNS = [
  {
    patternName: "Department Revenue Breakdown",
    patternDescription: "Breaks down revenue by department/service line",
    triggerPhrases: ["revenue by department", "department breakdown", "service revenue", "revenue by service"],
    sqlTemplate: `SELECT ds as department, SUM(value) as total_revenue 
FROM {{table}} 
WHERE {{cube_filter}} AND account = 'Total Revenues' {{additional_filters}}
GROUP BY ds 
ORDER BY total_revenue DESC`,
    templateVariables: { "table": "required", "cube_filter": "required", "additional_filters": "optional" },
    exampleQuestion: "What is revenue by department for FY25?",
    exampleSql: "SELECT ds as department, SUM(value) as total_revenue FROM cube_fact_data WHERE cube_id = 'nemko-pl' AND account = 'Total Revenues' AND plan_type LIKE 'Actual_FY25%' GROUP BY ds ORDER BY total_revenue DESC",
    category: "breakdown"
  },
  {
    patternName: "Subsidiary Comparison",
    patternDescription: "Compares metrics across subsidiaries/entities",
    triggerPhrases: ["by subsidiary", "by entity", "entity comparison", "subsidiary breakdown", "by location"],
    sqlTemplate: `SELECT subsidiary, SUM(value) as total_value 
FROM {{table}} 
WHERE {{cube_filter}} {{metric_filter}} {{additional_filters}}
GROUP BY subsidiary 
ORDER BY total_value DESC`,
    templateVariables: { "table": "required", "cube_filter": "required", "metric_filter": "required", "additional_filters": "optional" },
    exampleQuestion: "Show Net Income by subsidiary for FY25",
    exampleSql: "SELECT subsidiary, SUM(value) as total_value FROM cube_fact_data WHERE cube_id = 'nemko-cf' AND line_item = 'Net Income' AND period LIKE 'FY25%' GROUP BY subsidiary ORDER BY total_value DESC",
    category: "comparison"
  },
  {
    patternName: "Monthly Trend",
    patternDescription: "Shows monthly trend for a metric over time",
    triggerPhrases: ["monthly trend", "by month", "month over month", "monthly breakdown"],
    sqlTemplate: `SELECT period, SUM(value) as total_value 
FROM {{table}} 
WHERE {{cube_filter}} {{metric_filter}} AND period NOT LIKE 'FY%' AND period != 'Total' {{additional_filters}}
GROUP BY period 
ORDER BY period`,
    templateVariables: { "table": "required", "cube_filter": "required", "metric_filter": "required", "additional_filters": "optional" },
    exampleQuestion: "Show monthly revenue trend for Safety department",
    exampleSql: "SELECT period, SUM(value) as total_value FROM cube_fact_data WHERE cube_id = 'nemko-pl' AND account = 'Total Revenues' AND ds = 'S106 Safety' AND period NOT LIKE 'FY%' GROUP BY period ORDER BY period",
    category: "temporal"
  },
  {
    patternName: "YoY Comparison",
    patternDescription: "Compares values between fiscal years",
    triggerPhrases: ["year over year", "YoY", "compare years", "annual comparison", "yearly trend"],
    sqlTemplate: `SELECT 
  period,
  SUM(value) as total_value
FROM {{table}} 
WHERE {{cube_filter}} {{metric_filter}} AND period LIKE 'FY%' {{additional_filters}}
GROUP BY period 
ORDER BY period`,
    templateVariables: { "table": "required", "cube_filter": "required", "metric_filter": "required", "additional_filters": "optional" },
    exampleQuestion: "Compare EBIT year over year",
    exampleSql: "SELECT period, SUM(value) as total_value FROM cube_fact_data WHERE cube_id = 'nemko-pl' AND account = 'EBIT' AND period LIKE 'FY%' GROUP BY period ORDER BY period",
    category: "comparison"
  },
  {
    patternName: "Actual vs Budget",
    patternDescription: "Compares actual values against budget",
    triggerPhrases: ["actual vs budget", "budget comparison", "budget variance", "against budget"],
    sqlTemplate: `SELECT 
  {{group_by}},
  SUM(CASE WHEN plan_type LIKE 'Actual%' THEN value ELSE 0 END) as actual,
  SUM(CASE WHEN plan_type LIKE 'Budget%' THEN value ELSE 0 END) as budget,
  SUM(CASE WHEN plan_type LIKE 'Actual%' THEN value ELSE 0 END) - SUM(CASE WHEN plan_type LIKE 'Budget%' THEN value ELSE 0 END) as variance
FROM {{table}} 
WHERE {{cube_filter}} {{metric_filter}} {{additional_filters}}
GROUP BY {{group_by}}`,
    templateVariables: { "table": "required", "cube_filter": "required", "metric_filter": "required", "group_by": "required", "additional_filters": "optional" },
    exampleQuestion: "Show actual vs budget revenue by department",
    exampleSql: "SELECT ds, SUM(CASE WHEN plan_type LIKE 'Actual%' THEN value ELSE 0 END) as actual, SUM(CASE WHEN plan_type LIKE 'Budget%' THEN value ELSE 0 END) as budget FROM cube_fact_data WHERE cube_id = 'nemko-pl' AND account = 'Total Revenues' GROUP BY ds",
    category: "comparison"
  },
  {
    patternName: "Balance Sheet Position",
    patternDescription: "Shows balance sheet position at a point in time",
    triggerPhrases: ["balance sheet", "financial position", "assets and liabilities", "BS position"],
    sqlTemplate: `SELECT line_item, subsidiary, value 
FROM {{table}} 
WHERE {{cube_filter}} AND period = '{{period}}' {{additional_filters}}
ORDER BY line_item, subsidiary`,
    templateVariables: { "table": "required", "cube_filter": "required", "period": "required", "additional_filters": "optional" },
    exampleQuestion: "Show balance sheet for December 2024",
    exampleSql: "SELECT line_item, subsidiary, value FROM cube_fact_data WHERE cube_id = 'nemko-bs' AND period = '2024-12' ORDER BY line_item, subsidiary",
    category: "breakdown"
  },
  {
    patternName: "Cash Flow Summary",
    patternDescription: "Summarizes cash flow by category",
    triggerPhrases: ["cash flow summary", "cash movements", "cash position", "CF summary"],
    sqlTemplate: `SELECT 
  line_item,
  SUM(value) as total_value
FROM {{table}} 
WHERE {{cube_filter}} AND line_item IN ('Net Operating Cash Flow', 'Net Investing Cash Flow', 'Net Financing Cash Flow') {{additional_filters}}
GROUP BY line_item`,
    templateVariables: { "table": "required", "cube_filter": "required", "additional_filters": "optional" },
    exampleQuestion: "Show cash flow summary for FY25",
    exampleSql: "SELECT line_item, SUM(value) as total_value FROM cube_fact_data WHERE cube_id = 'nemko-cf' AND line_item IN ('Net Operating Cash Flow', 'Net Investing Cash Flow', 'Net Financing Cash Flow') AND period LIKE 'FY25%' GROUP BY line_item",
    category: "breakdown"
  },
  {
    patternName: "Top/Bottom Performers",
    patternDescription: "Identifies top or bottom performing entities",
    triggerPhrases: ["top performers", "bottom performers", "best performing", "worst performing", "top 5", "top 10"],
    sqlTemplate: `SELECT subsidiary, SUM(value) as total_value 
FROM {{table}} 
WHERE {{cube_filter}} {{metric_filter}} {{additional_filters}}
GROUP BY subsidiary 
ORDER BY total_value {{order}} 
LIMIT {{limit}}`,
    templateVariables: { "table": "required", "cube_filter": "required", "metric_filter": "required", "order": "DESC|ASC", "limit": "number", "additional_filters": "optional" },
    exampleQuestion: "Show top 5 subsidiaries by revenue",
    exampleSql: "SELECT subsidiary, SUM(value) as total_value FROM cube_fact_data WHERE cube_id = 'nemko-pl' AND account = 'Total Revenues' GROUP BY subsidiary ORDER BY total_value DESC LIMIT 5",
    category: "ranking"
  }
];

// ============================================================================
// NEMKO HIERARCHY DEFINITIONS
// ============================================================================

export const NEMKO_HIERARCHIES = {
  subsidiary: {
    name: "Subsidiary Hierarchy",
    description: "Geographic/legal entity hierarchy from location to group level",
    levels: ["location", "subsidiary", "region", "group"],
    mappings: {
      "E7 Nemko Group AS (Oslo)": { subsidiary: "E7 Nemko Group AS", region: "Europe", group: "Nemko Group Consolidated" },
      "E13 Taiwan branch (Taipei)": { subsidiary: "E13 Taiwan branch", region: "Asia", group: "Nemko Group Consolidated" },
      "E20 Hongkong": { subsidiary: "E20 Hongkong", region: "Asia", group: "Nemko Group Consolidated" },
      "E50 USA, Inc.": { subsidiary: "E50 USA, Inc.", region: "North America", group: "Nemko Group Consolidated" },
      "E51 Canada, Inc.": { subsidiary: "E51 Canada, Inc.", region: "North America", group: "Nemko Group Consolidated" },
      "E33 GmbH": { subsidiary: "E33 GmbH", region: "Europe", group: "Nemko Group Consolidated" },
      "E34 Spa a socio unico": { subsidiary: "E34 Spa a socio unico", region: "Europe", group: "Nemko Group Consolidated" },
      "E15 Korea": { subsidiary: "E15 Korea", region: "Asia", group: "Nemko Group Consolidated" },
      "E17 India Private Limited": { subsidiary: "E17 India Private Limited", region: "Asia", group: "Nemko Group Consolidated" },
      "E27 Scandinavia AS": { subsidiary: "E27 Scandinavia AS", region: "Europe", group: "Nemko Group Consolidated" },
      "E32 System Sikkerhet AS": { subsidiary: "E32 System Sikkerhet AS", region: "Europe", group: "Nemko Group Consolidated" },
      "E57 Norlab AS": { subsidiary: "E57 Norlab AS", region: "Europe", group: "Nemko Group Consolidated" },
      "E61 Nemko Digital B.V": { subsidiary: "E61 Nemko Digital B.V", region: "Europe", group: "Nemko Group Consolidated" }
    }
  },
  department: {
    name: "Department Hierarchy",
    description: "Service line/department hierarchy",
    levels: ["department_code", "department_name", "category"],
    mappings: {
      "S106": { department_name: "Safety", category: "Testing & Certification" },
      "S107": { department_name: "Energy Environment", category: "Testing & Certification" },
      "S109": { department_name: "Field Evaluation", category: "Inspection" },
      "S110": { department_name: "Factory Inspection", category: "Inspection" },
      "S111": { department_name: "International Approval Local", category: "Certification" },
      "S112": { department_name: "International Approval Global", category: "Certification" },
      "S113": { department_name: "Metrology", category: "Testing" },
      "S115": { department_name: "Cyber Assurance", category: "Digital Services" },
      "S117": { department_name: "Product Certification Global", category: "Certification" },
      "S118": { department_name: "Management System Certification", category: "Certification" },
      "S119": { department_name: "Testing EMC", category: "Testing" },
      "S120": { department_name: "Testing Wireless", category: "Testing" },
      "S124": { department_name: "Reliability testing", category: "Testing" },
      "S125": { department_name: "Advisory", category: "Consulting" },
      "S127": { department_name: "EX", category: "Testing & Certification" },
      "D102": { department_name: "Finance", category: "Corporate" }
    }
  },
  account: {
    name: "P&L Account Hierarchy",
    description: "Chart of accounts hierarchy for P&L",
    levels: ["account_code", "account_name", "category", "statement_section"],
    mappings: {
      "31000": { account_name: "Sales revenue I/C", category: "Revenue", statement_section: "Total Revenues" },
      "32000": { account_name: "Sales revenue External", category: "Revenue", statement_section: "Total Revenues" },
      "41000": { account_name: "Purchase for resale I/C", category: "Cost of Sales", statement_section: "Total Cost of Sales" },
      "50000": { account_name: "Salary", category: "Personnel Cost", statement_section: "Personnel Cost" },
      "58410": { account_name: "Salary hired employees I/C", category: "Personnel Cost", statement_section: "Personnel Cost" },
      "60000": { account_name: "Depreciation", category: "Depreciation", statement_section: "Other Costs inc. Depreciation" },
      "65000": { account_name: "Operating cost", category: "Operating Cost", statement_section: "Other Costs inc. Depreciation" }
    }
  }
};

// ============================================================================
// NEMKO CUBE COLUMN CONFIGURATIONS
// ============================================================================

export const NEMKO_CUBE_COLUMNS = {
  pl: [
    { columnIndex: 0, jsonKey: "Values", originalName: "Location", displayName: "Location", columnType: "dimension", dataType: "text", description: "Legal entity with location suffix", aliases: ["entity", "office"] },
    { columnIndex: 1, jsonKey: "Unnamed: 1", originalName: "DS", displayName: "Department", columnType: "dimension", dataType: "text", description: "Department/Service code and name (e.g., S106 Safety)", aliases: ["service", "department", "service line"] },
    { columnIndex: 2, jsonKey: "Unnamed: 2", originalName: "LIS: 1000 PL All", displayName: "Account", columnType: "dimension", dataType: "text", description: "P&L account code and name", aliases: ["account", "line item", "gl account"] },
    { columnIndex: 3, jsonKey: "Unnamed: 3", originalName: "Fake Months", displayName: "Month", columnType: "period", dataType: "text", description: "Month name (Jan-Dec) or Total", aliases: ["period", "month"] },
    { columnIndex: 4, jsonKey: "Unnamed: 4", originalName: "Actual_FY24", displayName: "Actual FY24", columnType: "metric", dataType: "number", description: "Actual values for fiscal year 2024", aliases: ["FY24 actual"] },
    { columnIndex: 5, jsonKey: "Unnamed: 5", originalName: "Actual_FY25", displayName: "Actual FY25", columnType: "metric", dataType: "number", description: "Actual values for fiscal year 2025", aliases: ["FY25 actual"] }
  ],
  pl_budget: [
    { columnIndex: 0, originalName: "Location", displayName: "Location", columnType: "dimension", dataType: "text", description: "Legal entity with location suffix" },
    { columnIndex: 1, originalName: "DS", displayName: "Department", columnType: "dimension", dataType: "text", description: "Department/Service code and name" },
    { columnIndex: 2, originalName: "LIS: 1000 PL All", displayName: "Account", columnType: "dimension", dataType: "text", description: "P&L account code and name" },
    { columnIndex: 3, originalName: "Fake Months", displayName: "Month", columnType: "period", dataType: "text", description: "Month name (Jan-Dec) or Total" },
    { columnIndex: 4, originalName: "Budget_FY24", displayName: "Budget FY24", columnType: "metric", dataType: "number", description: "Budget values for fiscal year 2024" },
    { columnIndex: 5, originalName: "Budget_FY25_Rev_V6", displayName: "Budget FY25", columnType: "metric", dataType: "number", description: "Revised budget for fiscal year 2025" },
    { columnIndex: 6, originalName: "Budget_FY26_Rev_V9", displayName: "Budget FY26", columnType: "metric", dataType: "number", description: "Revised budget for fiscal year 2026" }
  ],
  bs: [
    { columnIndex: 0, originalName: "Line Item", displayName: "Line Item", columnType: "dimension", dataType: "text", description: "Balance sheet line item (asset/liability/equity)", aliases: ["account", "bs item"] },
    { columnIndex: 1, originalName: "Subsidiary", displayName: "Subsidiary", columnType: "dimension", dataType: "text", description: "Legal entity code and name", aliases: ["entity", "company"] },
    { columnIndex: 2, originalName: "Period", displayName: "Period", columnType: "period", dataType: "text", description: "Period in YYYY-MM format or FYxx", aliases: ["date", "month"] },
    { columnIndex: 3, originalName: "Value", displayName: "Value", columnType: "metric", dataType: "number", description: "Balance sheet value", aliases: ["amount", "balance"] }
  ],
  cf: [
    { columnIndex: 0, originalName: "Line Item", displayName: "Line Item", columnType: "dimension", dataType: "text", description: "Cash flow line item", aliases: ["account", "cf item"] },
    { columnIndex: 1, originalName: "Subsidiary", displayName: "Subsidiary", columnType: "dimension", dataType: "text", description: "Legal entity code and name", aliases: ["entity", "company"] },
    { columnIndex: 2, originalName: "Period", displayName: "Period", columnType: "period", dataType: "text", description: "Period in YYYY-MM format or FYxx", aliases: ["date", "month"] },
    { columnIndex: 3, originalName: "Value", displayName: "Value", columnType: "metric", dataType: "number", description: "Cash flow value", aliases: ["amount", "cash"] }
  ]
};

// ============================================================================
// NEMKO DOMAIN CONFIGURATION
// ============================================================================

export const NEMKO_DOMAIN_CONFIG = {
  domainName: "nemko.com",
  adminEmail: "admin@nemko.com",
  userQuota: 100,
  cubes: [
    {
      name: "P&L",
      description: "Profit & Loss statement with Actual, Budget, and Forecast data by Location, Department, and Account",
      sourceType: "manual"
    },
    {
      name: "Balance Sheet",
      description: "Balance Sheet statement with Actual and Forecast data by Line Item and Subsidiary",
      sourceType: "manual"
    },
    {
      name: "Cash Flow",
      description: "Cash Flow statement with Actual and Forecast data by Line Item and Subsidiary",
      sourceType: "manual"
    }
  ]
};
