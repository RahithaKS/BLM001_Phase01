
import type {
  Evidence,
  DocumentEvidence,
  WebEvidence,
  DatabaseEvidence,
  SemanticSQLEvidence,
} from "./queryOrchestrator";
import { queryEnhancer } from "./queryEnhancer";
import type { QueryType } from "./queryEnhancer";

export interface RankedEvidence {
  evidence: Evidence;
  finalScore: number;
  ranking: number;
}

export interface EvidenceContext {
  text: string;
  citations: string[];
  chartBlock: string;
  preBuiltSections: string;
  calculationType?: string; // e.g. 'internal_capacity_mix', 'outsourcing_capacity_end'
  viewType?: string; // e.g. 'VM View', 'MS View', 'SX View'
  dataRowCount?: number; // number of data rows returned — used to tailor Key Observations
  tableData?: { headers: string[]; rows: string[][] }; // structured table bypasses AI reproduction
}

const SOURCE_WEIGHTS: Record<string, number> = {
  document: 1.0,
  semantic_sql: 0.95,
  database: 0.8,
  google_search: 0.6,
};

const FRESHNESS_WEIGHT = 0.1;
const MAX_CONTEXT_TOKENS = 4000;
const APPROX_CHARS_PER_TOKEN = 4;

export class EvidenceBroker {
  rankEvidence(evidence: Evidence[]): RankedEvidence[] {
    if (evidence.length === 0) {
      return [];
    }

    const scoredEvidence = evidence.map((item) => {
      const baseScore = item.relevanceScore || 0.5;
      const sourceWeight = SOURCE_WEIGHTS[item.source] || 0.5;
      const freshnessScore = this.calculateFreshnessScore(item);

      const finalScore =
        baseScore * sourceWeight * (1 - FRESHNESS_WEIGHT) +
        freshnessScore * FRESHNESS_WEIGHT;

      return {
        evidence: item,
        finalScore,
        ranking: 0,
      };
    });

    scoredEvidence.sort((a, b) => b.finalScore - a.finalScore);

    scoredEvidence.forEach((item, index) => {
      item.ranking = index + 1;
    });

    return scoredEvidence;
  }

  buildContext(
    rankedEvidence: RankedEvidence[],
    userQuery: string = "",
  ): EvidenceContext {
    const maxChars = MAX_CONTEXT_TOKENS * APPROX_CHARS_PER_TOKEN;

    const docLimit = 8;
    const webLimit = 3;
    const dbLimit = 4;
    const sqlLimit = 5;

    const documents = rankedEvidence
      .filter((e) => e.evidence.source === "document")
      .slice(0, docLimit)
      .map((e) => e.evidence as DocumentEvidence);

    const webResults = rankedEvidence
      .filter((e) => e.evidence.source === "google_search")
      .slice(0, webLimit)
      .map((e) => e.evidence as WebEvidence);

    const dbResults = rankedEvidence
      .filter((e) => e.evidence.source === "database")
      .slice(0, dbLimit)
      .map((e) => e.evidence as DatabaseEvidence);

    const allSqlResults = rankedEvidence
      .filter((e) => e.evidence.source === "semantic_sql")
      .slice(0, sqlLimit)
      .map((e) => e.evidence as SemanticSQLEvidence);

    const primarySqlResults = allSqlResults.filter(
      (sql) => !sql.isComparisonData,
    );
    const comparisonSqlResults = allSqlResults.filter(
      (sql) => sql.isComparisonData,
    );

    let contextText = "";
    const citations: string[] = [];

    if (primarySqlResults.length > 0) {
      contextText +=
        "## ACTUAL FINANCIAL DATA FROM DATABASE (ANALYZE THIS DATA)\n\n";
      contextText +=
        "**IMPORTANT: The data below is REAL aggregated data from the enterprise database. Provide financial analysis and insights based on these ACTUAL VALUES.**\n\n";

      const dataAvailability = this.extractDataAvailability(primarySqlResults);
      if (dataAvailability) {
        contextText += `**DATA AVAILABILITY NOTICE:**\n${dataAvailability}\n\n`;
      }

      primarySqlResults.forEach((sql, idx) => {
        const citationId = `[SQL${idx + 1}]`;

        const isMultiMonth = this.isMultiMonthResult(sql);
        const timeNote =
          isMultiMonth
            ? " (YTD per month — each month shows the cumulative total through that month)"
            : " (YTD - Year-To-Date cumulative values)";

        const timeFilterNote = sql.timeFilterApplied
          ? ` - Data for: ${sql.timeFilterApplied}`
          : "";

        citations.push(
          `${citationId} ${sql.cubeName}${timeNote}${timeFilterNote} (${sql.rowCount} records analyzed)`,
        );

        contextText += `${citationId} **${sql.cubeName}${timeNote}${timeFilterNote} - Real Data Analysis**\n\n`;

        if (sql.queryNote) {
          contextText += `**${sql.queryNote}**\n\n`;
        }

        contextText += this.formatSqlResultsAsTable(sql);
      });
    }

    if (comparisonSqlResults.length > 0) {
      contextText += "## COMPARISON DATA FOR TREND ANALYSIS\n\n";
      contextText +=
        "**Use this additional data to provide Month-over-Month (MoM) and Year-over-Year (YoY) trend analysis.**\n\n";

      comparisonSqlResults.forEach((sql, idx) => {
        const citationId = `[CMP${idx + 1}]`;
        const label = sql.comparisonLabel || "Comparison Period";

        const timeNote = " (YTD - Year-To-Date cumulative values)";

        citations.push(
          `${citationId} ${sql.cubeName} - ${label}${timeNote} (${sql.rowCount} records)`,
        );

        contextText += `${citationId} **${label}${timeNote}**\n\n`;

        contextText += this.formatSqlResultsAsTable(sql);
      });
    }

    if (documents.length > 0) {
      contextText += "## UPLOADED DOCUMENTS\n\n";
      documents.forEach((doc, idx) => {
        const citationId = `[DOC${idx + 1}]`;
        citations.push(`${citationId} ${doc.documentName}`);
        contextText += `${citationId} From document "${doc.documentName}":\n${doc.content}\n\n`;
      });
    }

    if (webResults.length > 0) {
      contextText += "## WEB SEARCH RESULTS\n\n";
      webResults.forEach((web, idx) => {
        const citationId = `[WEB${idx + 1}]`;
        citations.push(`${citationId} ${web.title} - ${web.url}`);
        contextText += `${citationId} ${web.title} (${web.url}):\n${web.snippet}\n\n`;
      });
    }

    if (dbResults.length > 0) {
      contextText += "## DATABASE RESULTS\n\n";
      dbResults.forEach((db, idx) => {
        const citationId = `[DB${idx + 1}]`;
        citations.push(`${citationId} ${db.databaseName}`);

        if (db.results && db.results.length > 0) {
          contextText += `${citationId} From database "${db.databaseName}":\n`;
          contextText += JSON.stringify(db.results.slice(0, 5), null, 2);
          contextText += "\n\n";
        }
      });
    }

    if (contextText.length > maxChars) {
      contextText =
        contextText.substring(0, maxChars) +
        "\n\n[Context truncated due to length...]";
    }

    // Pass comparison data so buildChartBlock can embed monthData into entity charts
    const chartBlock = this.buildChartBlock(primarySqlResults, comparisonSqlResults);
    // Suppress the redundant Period Comparison chart when:
    //   a) a multi-entity pivot chart already exists (hasEntityChart), OR
    //   b) a single-series entity bar chart already has a monthData dropdown (hasSingleSeriesMonthData).
    // In both cases the dropdown already lets the user switch between periods — the
    // side-by-side grouped-bar from buildPreBuiltSections would be redundant.
    const hasEntityChart = chartBlock.includes('"entities"');
    const hasSingleSeriesMonthData = !hasEntityChart && chartBlock.includes('"monthData"');
    const suppressComparisonCharts = hasEntityChart || hasSingleSeriesMonthData;

    const primaryEvidence =
      primarySqlResults.find((s) => !s.isComparisonData) ||
      primarySqlResults[0];
    const primaryCurrency = primaryEvidence?.currency || "usd";
    let preBuiltSections = this.buildPreBuiltSections(
      [...primarySqlResults, ...comparisonSqlResults],
      citations[0] ? "[SQL1]" : "",
      userQuery,
      primaryCurrency,
      suppressComparisonCharts,
    );

    // Append MoM / YoY trend chart only when there is no entity+month chart
    // (avoids a third chart appearing alongside the entity dropdown chart)
    if (comparisonSqlResults.length > 0 && !suppressComparisonCharts) {
      const trendChart = this.buildTrendChartBlock(
        primarySqlResults,
        comparisonSqlResults,
      );
      if (trendChart) {
        preBuiltSections += trendChart;
      }
    }

    // ── Extract structured table data ──────────────────────────────────────
    // Parse the markdown table out of preBuiltSections, then strip it from
    // the AI prompt entirely.  The full table is stored in context.tableData
    // and rendered directly in the frontend — the AI never needs to reproduce
    // it, eliminating both the "reformatted to inline text" (65-row case) and
    // the "truncated at 28 rows" (35-row case) failure modes.
    let tableData: { headers: string[]; rows: string[][] } | undefined;
    const extracted = this.extractTableFromMarkdown(preBuiltSections);
    if (extracted && extracted.rows.length >= 1) {
      tableData = extracted;
      // Remove the Detailed Analysis / Monthly Breakdown table body from the AI prompt.
      // Keep Key Findings bullets; replace the table with a one-liner note.
      preBuiltSections = preBuiltSections
        .replace(
          /### (?:Detailed Analysis|[^\n]+ — Monthly Breakdown)\n\n((?:\|[^\n]*\n)*)/g,
          "### Detailed Analysis\n\n*[Full data table attached — all rows available below the response.]*\n\n",
        )
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    return {
      text: contextText,
      citations,
      chartBlock,
      preBuiltSections,
      calculationType: primaryEvidence?.calculationType,
      viewType: primaryEvidence?.viewType,
      dataRowCount:
        primaryEvidence?.rowCount ?? primaryEvidence?.results?.length ?? 0,
      tableData,
    };
  }

  // ── Extract a markdown table into { headers, rows } ────────────────────
  // Scans the first well-formed pipe-table in the given markdown string.
  // Separator rows (| --- |) are skipped.  "Total" footer rows are excluded
  // because InteractiveDataTable computes its own totals.
  private extractTableFromMarkdown(
    markdown: string,
  ): { headers: string[]; rows: string[][] } | null {
    const lines = markdown.split("\n");
    let headers: string[] = [];
    const rows: string[][] = [];
    let headerFound = false;
    let separatorFound = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|")) {
        // End of table once we've already started collecting data rows
        if (separatorFound && rows.length > 0) break;
        continue;
      }
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      // Separator row: every cell is dashes (optional colons for alignment)
      if (cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c))) {
        if (headerFound) separatorFound = true;
        continue;
      }
      if (!headerFound) {
        headers = cells;
        headerFound = true;
      } else if (separatorFound) {
        // Skip the auto-computed Total footer row (case-insensitive, strips bold markers)
        const firstCell = cells[0] ?? "";
        const firstCellStripped = firstCell.replace(/\*\*/g, "").trim().toLowerCase();
        if (firstCellStripped === "total") continue;
        rows.push(cells);
      }
    }

    return headers.length > 0 && rows.length > 0
      ? { headers, rows }
      : null;
  }

  // -----------------------------------------------------------------------
  // GB P&L SUMMARY — focused Key Findings: Revenue | Gross Margin | EBIT%
  // -----------------------------------------------------------------------
  private buildGBPLSummaryKeyFindings(
    rows: any[],
    cite: string,
    currency: string,
  ): string {
    const sym = currency === "inr" ? "₹" : "$";
    const toNum = (v: any): number => {
      const n = typeof v === "number" ? v : parseFloat(String(v));
      return isNaN(n) ? 0 : n;
    };
    // gb_pl_summary builders return raw USD — always divide by 1M for display
    const fmtM = (v: any): string => {
      const n = toNum(v);
      const sign = n < 0 ? "-" : "";
      return `${sign}${sym}${(Math.abs(n) / 1_000_000).toFixed(2)} M`;
    };
    const fmtPct = (v: any): string => `${toNum(v).toFixed(2)}%`;
    const entityName = (r: any) => String(r.entity || r.region_entity || "-");

    // Single-row: just state the entity's metrics
    if (rows.length === 1) {
      const row = rows[0];
      return `### Key Findings\n- **${entityName(row)}**: Revenue ${fmtM(row.revenue)} | Gross Margin ${fmtM(row.gross_margin)} (${fmtPct(row.gross_margin_pct)}) | EBIT% ${fmtPct(row.ebit_pct)} ${cite}`;
    }

    // Sort by absolute revenue descending
    const sorted = [...rows].sort(
      (a, b) => Math.abs(toNum(b.revenue)) - Math.abs(toNum(a.revenue)),
    );
    const totalRev = rows.reduce((s, r) => s + Math.abs(toNum(r.revenue)), 0);
    const totalEbit = rows.reduce((s, r) => s + toNum(r.ebit ?? 0), 0);
    const blendedEbitPct =
      totalRev > 0 ? (totalEbit / totalRev) * 100 : null;

    const bullets: string[] = [];

    // 1. Top contributor by revenue
    const top = sorted[0];
    const topRevAbs = Math.abs(toNum(top.revenue));
    const topShare =
      totalRev > 0 ? ((topRevAbs / totalRev) * 100).toFixed(1) : "-";
    bullets.push(
      `- **Top contributor**: ${entityName(top)} leads with ${fmtM(top.revenue)} revenue (${topShare}% of total) and EBIT% of ${fmtPct(top.ebit_pct)} ${cite}`,
    );

    // 2. Concentration — top 2 entities combined share (only if 3+ rows)
    if (sorted.length >= 3) {
      const top2Rev = sorted
        .slice(0, 2)
        .reduce((s, r) => s + Math.abs(toNum(r.revenue)), 0);
      const top2Share =
        totalRev > 0 ? ((top2Rev / totalRev) * 100).toFixed(1) : "-";
      const top2Names = sorted
        .slice(0, 2)
        .map(entityName)
        .join(" + ");
      const label =
        parseFloat(top2Share) >= 80
          ? "highly concentrated"
          : "moderately concentrated";
      bullets.push(
        `- **Concentration**: ${top2Names} account for ${top2Share}% of revenue — ${label} ${cite}`,
      );
    }

    // 3. Negative EBIT alert
    const negEbit = rows.filter(
      (r) => toNum(r.ebit ?? 0) < 0 || toNum(r.ebit_pct ?? 0) < 0,
    );
    if (negEbit.length > 0) {
      const names = negEbit.map(entityName).join(", ");
      bullets.push(
        `- **EBIT alert**: ${negEbit.length} ${negEbit.length === 1 ? "entity is" : "entities are"} EBIT-negative — ${names} — flag for cost review ${cite}`,
      );
    }

    // 4. Blended EBIT% context
    if (blendedEbitPct !== null) {
      const thin = Math.abs(blendedEbitPct) < 2;
      bullets.push(
        `- **Blended EBIT%**: ${blendedEbitPct.toFixed(2)}%${thin ? " — extremely thin margin; minor cost overrun erases profit" : ""} ${cite}`,
      );
    }

    // 5. Scale range — only if top is meaningfully larger than bottom
    const bottom = sorted[sorted.length - 1];
    const bottomRevAbs = Math.abs(toNum(bottom.revenue));
    if (bottomRevAbs > 0 && topRevAbs / bottomRevAbs > 2) {
      const ratio = (topRevAbs / bottomRevAbs).toFixed(1);
      bullets.push(
        `- **Scale range**: ${entityName(top)} (${fmtM(top.revenue)}) is ${ratio}× larger than ${entityName(bottom)} (${fmtM(bottom.revenue)}) — uneven distribution ${cite}`,
      );
    }

    return `### Key Findings\n${bullets.join("\n")}`;
  }

  private buildPreBuiltSections(
    sqlResults: SemanticSQLEvidence[],
    citationId: string,
    userQuery: string = "",
    currency: string = "usd",
    suppressPeriodChart: boolean = false,
  ): string {
    const primary =
      sqlResults.find((s) => !s.isComparisonData) || sqlResults[0];
    if (!primary || !primary.results || primary.results.length === 0) return "";

    const rows = primary.results;
    const columns =
      primary.columns && primary.columns.length > 0
        ? primary.columns
        : Object.keys(rows[0]);

    // All rows across primary + comparison evidences (used in pivot paths)
    const allRows = sqlResults.flatMap((e) => e.results ?? []);

    // rawUSD=true  → SQL returned raw USD/INR values (need ÷1M before display).
    // rawUSD=false → SQL already returned mUSD/mINR values (use as-is).
    //
    // Entity P&L:  raw USD, detected by entity_sub_category / entity_category columns.
    // GB P&L monetary builders: raw USD, detected by their unique output column names.
    // Direct/indirect cost builders: raw USD — `amount` col = SUM(amount_usd).
    const rawUSD =
      columns.some((c) =>
        ["entity_sub_category", "entity_category"].includes(c),
      ) ||
      columns.includes("ebit") || // _build_ebit_sql
      columns.includes("gross_margin") || // _build_gross_margin_sql
      (columns.includes("total_direct_cost") &&
        columns.includes("total_indirect_cost")) || // all GB P&L builders
      (columns.includes("amount") && columns.includes("sub_cost_category")) || // direct/indirect cost builders
      columns.includes("resource_cost") || // _build_resource_cost_sql
      columns.includes("travel_cost") || // _build_travel_cost_sql
      columns.includes("other_direct_cost") || // _build_other_direct_cost_sql
      columns.some((c) => c.endsWith("_usd_sum") || c.endsWith("_inr_sum")); // generic compile_sql path: SUM(amount_usd) → amount_usd_sum

    // showRawCols=true → show raw value + mUSD side-by-side (Entity P&L only).
    // All other raw-USD paths just need the correct ÷1M formatting, not dual columns.
    const showRawCols = columns.some((c) =>
      ["entity_sub_category", "entity_category"].includes(c),
    );

    // Sub-category columns take priority so Key Findings show meaningful breakdown names
    const preferredLabelCols = [
      "entity_sub_category",
      "sub_cost_category",
      "cost_sub_category",
      "salary_band",
      "salary_level",
      "region_entity",
      "entity",
      "sector",
      "category",
      "cost_category",
      "month",
      "year",
    ];
    let labelCol = preferredLabelCols.find((c) => columns.includes(c));
    if (!labelCol) {
      labelCol = columns.find((col) => {
        const val = rows[0][col];
        return typeof val === "string" && isNaN(Number(val));
      });
    }

    // Secondary entity label appended in parentheses when sub-category is primary
    const subCategoryCols = new Set([
      "entity_sub_category",
      "sub_cost_category",
      "cost_sub_category",
      "salary_band",
      "salary_level",
    ]);
    const secondaryLabelCol =
      subCategoryCols.has(labelCol || "") && columns.includes("region_entity")
        ? "region_entity"
        : undefined;

    // Dimension columns that should never appear as metric values in bullets
    const dimensionCols = new Set([
      "id",
      "cube_id",
      "company_id",
      "cost_category",
      "region_entity",
      "sector",
      "new_service_area",
      "project_gb",
      "salary_band",
      "salary_level",
      "resource_type",
      "entity_category",
      "entity_sub_category",
      "sub_cost_category",
      "cost_sub_category",
      "month",
      "year",
      "months_used",
    ]);

    const valueColumns = columns.filter((col) => {
      if (col === labelCol || col === secondaryLabelCol) return false;
      if (dimensionCols.has(col)) return false;
      const val = rows[0][col];
      const num = typeof val === "number" ? val : parseFloat(String(val));
      return !isNaN(num);
    });

    if (valueColumns.length === 0) return "";

    const primaryValueCol = valueColumns[0];

    const grandTotal = rows.reduce((sum, row) => {
      const v = row[primaryValueCol];
      const num = typeof v === "number" ? v : parseFloat(String(v)) || 0;
      return sum + Math.abs(num);
    }, 0);

    const cite = citationId || "[SQL1]";

    // GB P&L Summary → use focused bullets (Revenue | Gross Margin | EBIT%)
    // instead of the generic pipe-dump of all 9 columns.
    let keyFindings: string;
    if (primary.calculationType === "gb_pl_summary") {
      keyFindings = this.buildGBPLSummaryKeyFindings(rows, cite, currency);
    } else {
      // Insight-based Key Findings: 3-5 derived observations, NOT one bullet per row
      const rowsSorted = [...rows].sort((a, b) => {
        const na =
          typeof a[primaryValueCol] === "number"
            ? a[primaryValueCol]
            : parseFloat(String(a[primaryValueCol])) || 0;
        const nb =
          typeof b[primaryValueCol] === "number"
            ? b[primaryValueCol]
            : parseFloat(String(b[primaryValueCol])) || 0;
        return Math.abs(nb) - Math.abs(na);
      });

      const fmtVal = (n: number) =>
        this.formatValue(n, primaryValueCol, currency, userQuery, !rawUSD);

      const getLabel = (row: any): string => {
        const main = labelCol ? String(row[labelCol] ?? "-") : "-";
        const sec = secondaryLabelCol
          ? ` (${String(row[secondaryLabelCol] ?? "")})`
          : "";
        return main + sec;
      };

      const getNum = (row: any): number => {
        const v = row[primaryValueCol];
        return typeof v === "number" ? v : parseFloat(String(v)) || 0;
      };

      const insightBullets: string[] = [];

      if (rowsSorted.length === 1) {
        // Single row — state the value and its share
        const row = rowsSorted[0];
        const n = getNum(row);
        const share =
          grandTotal > 0
            ? ` (${((Math.abs(n) / grandTotal) * 100).toFixed(1)}% of total)`
            : "";
        insightBullets.push(`- **${getLabel(row)}**: ${fmtVal(n)}${share} ${cite}`);
      } else {
        // 1. Top contributor
        const top = rowsSorted[0];
        const topN = getNum(top);
        const topShare =
          grandTotal > 0
            ? ` (${((Math.abs(topN) / grandTotal) * 100).toFixed(1)}% of total)`
            : "";
        insightBullets.push(
          `- **Top contributor**: ${getLabel(top)} — ${fmtVal(topN)}${topShare} ${cite}`,
        );

        // 2. Concentration — top 3 share (only if 4+ rows)
        if (rowsSorted.length >= 4) {
          const top3Total = rowsSorted
            .slice(0, 3)
            .reduce((s, r) => s + Math.abs(getNum(r)), 0);
          const top3Share =
            grandTotal > 0
              ? ((top3Total / grandTotal) * 100).toFixed(1)
              : "-";
          const top3Names = rowsSorted
            .slice(0, 3)
            .map(getLabel)
            .join(", ");
          insightBullets.push(
            `- **Concentration**: ${top3Names} cover ${top3Share}% of total ${cite}`,
          );
        }

        // 3. Negative values (monetary/count only, skip percentage columns)
        if (!this.isPercentageColumn(primaryValueCol)) {
          const negRows = rowsSorted.filter((r) => getNum(r) < 0);
          if (negRows.length > 0) {
            const negNames = negRows
              .map((r) => `${getLabel(r)} (${fmtVal(getNum(r))})`)
              .join(", ");
            insightBullets.push(
              `- **Below zero**: ${negRows.length} ${negRows.length === 1 ? "item" : "items"} negative — ${negNames} — review recommended ${cite}`,
            );
          }
        }

        // 4. Bottom contributor — only if meaningfully smaller than top
        const bottom = rowsSorted[rowsSorted.length - 1];
        const bottomN = getNum(bottom);
        const bottomShare =
          grandTotal > 0
            ? ` (${((Math.abs(bottomN) / grandTotal) * 100).toFixed(1)}% of total)`
            : "";
        const ratio =
          Math.abs(bottomN) > 0
            ? Math.abs(topN) / Math.abs(bottomN)
            : null;
        if (ratio !== null && ratio > 2) {
          insightBullets.push(
            `- **Smallest contributor**: ${getLabel(bottom)} — ${fmtVal(bottomN)}${bottomShare}; ${ratio.toFixed(1)}× smaller than top ${cite}`,
          );
        }
      }

      keyFindings = `### Key Findings\n${insightBullets.join("\n")}`;
    }

    const viewLabel = primary.viewType
      ? `**Data Scope: ${primary.viewType}** — results are filtered to this view only.\n\n`
      : "";

    // ── PIVOT PATH: months as column headers ─────────────────────────────────
    if (columns.includes("month")) {
      const MONTH_NAMES_FULL = [
        "",
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      const fallbackYear = primary.year ?? "";

      // Only these columns are valid row-level dimensions in the pivot table.
      // Positive allowlist avoids issues with pg returning numeric values as strings,
      // and strips out raw cost-category columns the user doesn't want as rows.
      const PIVOT_DIM_ALLOWLIST = new Set([
        "region_entity",
        "entity",
        "sector",
        "new_service_area",
        "sub_cost_category",
        "entity_sub_category",
        "cost_sub_category",
        "project_gb",
        "salary_level",
        "salary_band",
      ]);
      const dimCols = columns.filter((c) => PIVOT_DIM_ALLOWLIST.has(c));

      // Get distinct months sorted (scan across ALL evidence rows including comparison)
      const monthSet = new Set<number>();
      allRows.forEach((r) => {
        if (r["month"] !== undefined) monthSet.add(Number(r["month"]));
      });
      const sortedMonths = Array.from(monthSet).sort((a, b) => a - b);

      // Build pivot: dimKey → { dims, byMonth: month → { valCol → number } }
      const pivotMap = new Map<
        string,
        {
          dims: Record<string, string>;
          byMonth: Map<number, Record<string, number>>;
        }
      >();
      allRows.forEach((row) => {
        const key = dimCols.map((c) => String(row[c] ?? "")).join("||");
        if (!pivotMap.has(key)) {
          pivotMap.set(key, {
            dims: Object.fromEntries(
              dimCols.map((c) => [c, String(row[c] ?? "-")]),
            ),
            byMonth: new Map(),
          });
        }
        const entry = pivotMap.get(key)!;
        const m = Number(row["month"]);
        if (!entry.byMonth.has(m)) {
          entry.byMonth.set(
            m,
            Object.fromEntries(valueColumns.map((c) => [c, 0])),
          );
        }
        const mv = entry.byMonth.get(m)!;
        valueColumns.forEach((c) => {
          const v =
            typeof row[c] === "number"
              ? row[c]
              : parseFloat(String(row[c])) || 0;
          mv[c] += v;
        });
      });

      const multiMonth = sortedMonths.length > 1;
      const multipleValCols = valueColumns.length > 1;

      // Accumulate tables for ALL value columns — previously a `return` inside the loop
      // caused only the first column to render. For multi-metric results (e.g. Entity P&L
      // with revenue + total_cost + ebit + ebit_pct) every column must be shown.
      let pivotResult = "";
      let chartAdded = false;

      // Filter out database-level TOTAL summary rows (rows where region_entity = 'TOTAL'
      // are pre-computed rollups in the Bosch data source).  Excluding them prevents them
      // from inflating grand totals and appearing as a data row in the rendered table.
      const nonTotalPivotEntries = Array.from(pivotMap.entries()).filter(
        ([, { dims }]) =>
          !Object.values(dims).some(
            (v) => typeof v === "string" && v.toUpperCase() === "TOTAL",
          ),
      );

      // Suppress Share of Total % and Total row when there is only one data entity —
      // showing "100%" for a single entity is trivially obvious and confuses users.
      const isSingleEntityPivot = nonTotalPivotEntries.length <= 1;

      for (const valCol of valueColumns) {
        // Column totals per month (for Share of Total)
        const isPercentCol = this.isPercentageColumn(valCol);
        const monthTotals: Record<number, number> = Object.fromEntries(
          sortedMonths.map((m) => [m, 0]),
        );
        nonTotalPivotEntries.forEach(([, { byMonth }]) => {
          sortedMonths.forEach((m) => {
            monthTotals[m] += Math.abs(byMonth.get(m)?.[valCol] ?? 0);
          });
        });
        const ytdTotal = isPercentCol
          ? 0
          : sortedMonths.reduce((s, m) => s + monthTotals[m], 0);

        // Header row: dim cols | Jan 2025 | Feb 2025 | [YTD] | Share of Total (%)
        const monthHeaders = sortedMonths.map((m) => {
          const y =
            rows.find((r) => Number(r["month"]) === m)?.[`year`] ??
            fallbackYear;
          return `${MONTH_NAMES_FULL[m] || `Month ${m}`}${y ? ` ${y}` : ""}`;
        });
        const ytdLabel = null;

        const shareCol: string[] = [];
        const headerCols = [
          ...dimCols.map((c) => this.getColumnHeader(c, currency, userQuery)),
          ...monthHeaders,
          ...(ytdLabel ? [ytdLabel] : []),
          ...shareCol,
        ];

        const sectionLabel = multipleValCols
          ? `### ${this.getColumnHeader(valCol, currency, userQuery)} — Monthly Breakdown\n\n`
          : `### Detailed Analysis\n\n`;
        let table = sectionLabel;
        table += "| " + headerCols.join(" | ") + " |\n";
        table += "| " + headerCols.map(() => "---").join(" | ") + " |\n";

        // Total row accumulators
        const colMonthTotals: Record<number, number> = Object.fromEntries(
          sortedMonths.map((m) => [m, 0]),
        );

        nonTotalPivotEntries.forEach(([, { dims, byMonth }]) => {
          const dimVals = dimCols.map((c) => dims[c]);
          const monthVals = sortedMonths.map((m) => {
            const v = byMonth.get(m)?.[valCol] ?? 0;
            colMonthTotals[m] += v;
            return this.formatValue(v, valCol, currency, userQuery, !rawUSD);
          });
          const ytdVal = ytdLabel
            ? this.formatValue(
                sortedMonths.reduce(
                  (s, m) => s + (byMonth.get(m)?.[valCol] ?? 0),
                  0,
                ),
                valCol,
                currency,
                userQuery,
                !rawUSD,
              )
            : null;
          const rowYtd = sortedMonths.reduce(
            (s, m) => s + Math.abs(byMonth.get(m)?.[valCol] ?? 0),
            0,
          );
          const share: string[] = [];

          table +=
            "| " +
            [
              ...dimVals,
              ...monthVals,
              ...(ytdVal ? [ytdVal] : []),
              ...share,
            ].join(" | ") +
            " |\n";
        });

        // TOTAL row (skip for percentage columns and single-entity results)
        if (!isPercentCol && !isSingleEntityPivot) {
          const totalMonthVals = sortedMonths.map((m) =>
            this.formatValue(
              colMonthTotals[m],
              valCol,
              currency,
              userQuery,
              !rawUSD,
            ),
          );
          const totalYtd = ytdLabel
            ? this.formatValue(
                sortedMonths.reduce((s, m) => s + colMonthTotals[m], 0),
                valCol,
                currency,
                userQuery,
                !rawUSD,
              )
            : null;
          table +=
            "| " +
            [
              ...dimCols.map(() => "**TOTAL**"),
              ...totalMonthVals,
              ...(totalYtd ? [totalYtd] : []),
            ].join(" | ") +
            " |\n";
        }

        if (!pivotResult) {
          pivotResult = viewLabel + keyFindings + "\n\n";
        }
        pivotResult += table + "\n";

        // ── Chart block for first non-% non-unitary value column ────────────
        if (
          !chartAdded &&
          !isPercentCol &&
          !this.isCountColumn(valCol) &&
          !this.isUnitaryDollarColumn(valCol)
        ) {
          chartAdded = true;
          // Skip generating the Period Comparison chart when the entity+month
          // chart from buildChartBlock already covers this data
          if (!suppressPeriodChart) {
          const sf = rawUSD ? 1_000_000 : 1;
          const yLbl = rawUSD
            ? "Amount (mUSD)"
            : valCol.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          const isTrend = sortedMonths.length >= 5;
          const entityRows = Array.from(pivotMap.values()).filter(
            ({ dims }) =>
              !Object.values(dims).some((v) => v.toUpperCase() === "TOTAL"),
          );
          if (entityRows.length > 0) {
            if (!isTrend) {
              // Grouped bar: label = entity, keyed by period label
              const chartData = entityRows.map(({ dims, byMonth }) => {
                const lbl = dimCols.map((c) => dims[c]).join(" / ") || "-";
                const row: Record<string, string | number> = { label: lbl };
                sortedMonths.forEach((m, mi) => {
                  const raw = byMonth.get(m)?.[valCol] ?? 0;
                  row[monthHeaders[mi]] =
                    sf > 1 ? parseFloat((raw / sf).toFixed(2)) : raw;
                });
                return row;
              });
              const cSpec = {
                type: "bar",
                title: `${yLbl} — Period Comparison`,
                data: chartData,
                config: {
                  xKey: "label",
                  yKey: "value",
                  xLabel: "Entity",
                  yLabel: yLbl,
                  periods: monthHeaders,
                  periodMode: "grouped-bar",
                },
              };
              pivotResult +=
                "\n\n```chart\n" + JSON.stringify(cSpec, null, 2) + "\n```\n";
            } else {
              // Line chart: X-axis = period, one keyed series per entity
              const allEnts = entityRows.map(
                ({ dims }) => dimCols.map((c) => dims[c]).join(" / ") || "-",
              );
              const chartData = sortedMonths.map((m, mi) => {
                const row: Record<string, string | number> = {
                  label: monthHeaders[mi],
                };
                entityRows.forEach(({ dims, byMonth }) => {
                  const ent = dimCols.map((c) => dims[c]).join(" / ") || "-";
                  const raw = byMonth.get(m)?.[valCol] ?? 0;
                  row[ent] = sf > 1 ? parseFloat((raw / sf).toFixed(2)) : raw;
                });
                return row;
              });
              const cSpec = {
                type: "line",
                title: `${yLbl} — Monthly Trend`,
                data: chartData,
                config: {
                  xKey: "label",
                  yKey: "value",
                  xLabel: "Period",
                  yLabel: yLbl,
                  entities: allEnts,
                  periodMode: "line",
                },
              };
              pivotResult +=
                "\n\n```chart\n" + JSON.stringify(cSpec, null, 2) + "\n```\n";
            }
          }
          } // end if (!suppressPeriodChart)
        }
      }

      if (pivotResult) return pivotResult;
    }

    // ── CROSS-EVIDENCE PIVOT: no month SELECT column, but comparison data exists ──
    // Each SemanticSQLEvidence object = one period. Use .month/.year metadata as labels.
    const compEvidences = sqlResults.filter(
      (s) => s.isComparisonData && s.results?.length,
    );
    if (compEvidences.length > 0 && primary.month !== undefined) {
      const MONTH_NAMES_X = [
        "",
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      // Sort all evidences chronologically by year+month
      const allEvidences = [primary, ...compEvidences].sort(
        (a, b) =>
          (a.year ?? 0) * 12 +
          (a.month ?? 0) -
          ((b.year ?? 0) * 12 + (b.month ?? 0)),
      );

      // Same positive allowlist as the month-column pivot path
      const X_PIVOT_DIM_ALLOWLIST = new Set([
        "region_entity",
        "entity",
        "sector",
        "new_service_area",
        "sub_cost_category",
        "entity_sub_category",
        "cost_sub_category",
        "project_gb",
        "salary_level",
        "salary_band",
      ]);
      const xDimCols = columns.filter((c) => X_PIVOT_DIM_ALLOWLIST.has(c));

      const multiPeriod = allEvidences.length > 1;
      const periodLabels = allEvidences.map((e) => {
        const m = e.month ?? 0;
        const y = e.year ?? "";
        return `${MONTH_NAMES_X[m] || `Month ${m}`}${y ? ` ${y}` : ""}`;
      });
      const xMultipleValCols = valueColumns.length > 1;

      // Accumulate ALL value columns — same fix as PIVOT PATH above.
      let xPivotResult = "";
      let xChartAdded = false;

      // Pre-build dimKeyMap and valueMap once (independent of valCol)
      const xDimKeyMap = new Map<string, Record<string, string>>();
      allEvidences.forEach((e) => {
        (e.results ?? []).forEach((row) => {
          const key = xDimCols.map((c) => String(row[c] ?? "")).join("||");
          if (!xDimKeyMap.has(key)) {
            xDimKeyMap.set(
              key,
              Object.fromEntries(
                xDimCols.map((c) => [c, String(row[c] ?? "-")]),
              ),
            );
          }
        });
      });

      // Filter out database-level TOTAL rollup rows from the cross-evidence pivot map
      // (same rationale as PIVOT PATH above — prevents doubled totals and stray TOTAL rows)
      const nonTotalXEntries = Array.from(xDimKeyMap.entries()).filter(
        ([, dims]) =>
          !Object.values(dims).some(
            (v) => typeof v === "string" && v.toUpperCase() === "TOTAL",
          ),
      );
      const nonTotalXKeys = new Set(nonTotalXEntries.map(([k]) => k));

      // Suppress Share of Total % and Total row when there is only one data entity.
      const xIsSingleEntity = nonTotalXEntries.length <= 1;

      for (const valCol of valueColumns) {
        const xIsPercentCol = this.isPercentageColumn(valCol);

        // Build value lookup: dimKey → periodIndex → value
        const valueMap = new Map<string, Record<number, number>>();
        allEvidences.forEach((e, pi) => {
          (e.results ?? []).forEach((row) => {
            const key = xDimCols.map((c) => String(row[c] ?? "")).join("||");
            if (!valueMap.has(key)) valueMap.set(key, {});
            const v =
              typeof row[valCol] === "number"
                ? row[valCol]
                : parseFloat(String(row[valCol])) || 0;
            valueMap.get(key)![pi] = (valueMap.get(key)![pi] ?? 0) + v;
          });
        });

        // Grand total across all periods (for Share of Total) — exclude TOTAL rollup keys
        const xYtdTotal = xIsPercentCol
          ? 0
          : Array.from(valueMap.entries())
              .filter(([k]) => nonTotalXKeys.has(k))
              .reduce(
                (sum, [, byPeriod]) =>
                  sum +
                  Object.values(byPeriod).reduce((s, v) => s + Math.abs(v), 0),
                0,
              );

        // YTD column removed — each period value is already YTD cumulative
        const xYtdLabel = null;

        const xShareCol: string[] = [];
        const headerCols = [
          ...xDimCols.map((c) => this.getColumnHeader(c, currency, userQuery)),
          ...periodLabels,
          ...(xYtdLabel ? [xYtdLabel] : []),
          ...xShareCol,
        ];

        const xSectionLabel = xMultipleValCols
          ? `### ${this.getColumnHeader(valCol, currency, userQuery)} — Period Comparison\n\n`
          : `### Detailed Analysis\n\n`;
        let table = xSectionLabel;
        table += "| " + headerCols.join(" | ") + " |\n";
        table += "| " + headerCols.map(() => "---").join(" | ") + " |\n";

        const colPeriodTotals: Record<number, number> = Object.fromEntries(
          allEvidences.map((_, i) => [i, 0]),
        );

        nonTotalXEntries.forEach(([key, dims]) => {
          const dimVals = xDimCols.map((c) => dims[c]);
          const periodValsRaw = allEvidences.map(
            (_, pi) => valueMap.get(key)?.[pi] ?? 0,
          );
          periodValsRaw.forEach((v, pi) => {
            colPeriodTotals[pi] += v;
          });
          const periodFmt = periodValsRaw.map((v) =>
            this.formatValue(v, valCol, currency, userQuery, !rawUSD),
          );
          const ytdSum = periodValsRaw.reduce((s, v) => s + v, 0);
          const ytdFmt = xYtdLabel
            ? this.formatValue(ytdSum, valCol, currency, userQuery, !rawUSD)
            : null;
          const share: string[] = [];
          table +=
            "| " +
            [
              ...dimVals,
              ...periodFmt,
              ...(ytdFmt ? [ytdFmt] : []),
              ...share,
            ].join(" | ") +
            " |\n";
        });

        // TOTAL row (skip for percentage columns and single-entity results)
        if (!xIsPercentCol && !xIsSingleEntity) {
          const totalPeriodFmt = allEvidences.map((_, pi) =>
            this.formatValue(
              colPeriodTotals[pi],
              valCol,
              currency,
              userQuery,
              !rawUSD,
            ),
          );
          const totalYtd = xYtdLabel
            ? this.formatValue(
                Object.values(colPeriodTotals).reduce((s, v) => s + v, 0),
                valCol,
                currency,
                userQuery,
                !rawUSD,
              )
            : null;
          table +=
            "| " +
            [
              ...xDimCols.map(() => "**TOTAL**"),
              ...totalPeriodFmt,
              ...(totalYtd ? [totalYtd] : []),
            ].join(" | ") +
            " |\n";
        }

        if (!xPivotResult) {
          xPivotResult = viewLabel + keyFindings + "\n\n";
        }
        xPivotResult += table + "\n";

        // ── Chart block for first non-% non-unitary value column ────────────
        if (
          !xChartAdded &&
          !xIsPercentCol &&
          !this.isCountColumn(valCol) &&
          !this.isUnitaryDollarColumn(valCol)
        ) {
          xChartAdded = true;
          // Skip Period Comparison chart when entity+month chart already exists
          if (!suppressPeriodChart) {
          const sf = rawUSD ? 1_000_000 : 1;
          const yLbl = rawUSD
            ? "Amount (mUSD)"
            : valCol.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          const isTrend = allEvidences.length >= 5;
          const xEntityRows = Array.from(xDimKeyMap.entries()).filter(
            ([, dims]) =>
              !Object.values(dims).some((v) => v.toUpperCase() === "TOTAL"),
          );
          if (xEntityRows.length > 0) {
            if (!isTrend) {
              // Grouped bar: label = entity, keyed by period label
              const chartData = xEntityRows.map(([key, dims]) => {
                const lbl = xDimCols.map((c) => dims[c]).join(" / ") || "-";
                const row: Record<string, string | number> = { label: lbl };
                allEvidences.forEach((_, pi) => {
                  const raw = valueMap.get(key)?.[pi] ?? 0;
                  row[periodLabels[pi]] =
                    sf > 1 ? parseFloat((raw / sf).toFixed(2)) : raw;
                });
                return row;
              });
              const cSpec = {
                type: "bar",
                title: `${yLbl} — Period Comparison`,
                data: chartData,
                config: {
                  xKey: "label",
                  yKey: "value",
                  xLabel: "Entity",
                  yLabel: yLbl,
                  periods: periodLabels,
                  periodMode: "grouped-bar",
                },
              };
              xPivotResult +=
                "\n\n```chart\n" + JSON.stringify(cSpec, null, 2) + "\n```\n";
            } else {
              // Line chart: X-axis = period, one keyed series per entity
              const allEnts = xEntityRows.map(
                ([, dims]) => xDimCols.map((c) => dims[c]).join(" / ") || "-",
              );
              const chartData = allEvidences.map((_, pi) => {
                const row: Record<string, string | number> = {
                  label: periodLabels[pi],
                };
                xEntityRows.forEach(([key, dims]) => {
                  const ent = xDimCols.map((c) => dims[c]).join(" / ") || "-";
                  const raw = valueMap.get(key)?.[pi] ?? 0;
                  row[ent] = sf > 1 ? parseFloat((raw / sf).toFixed(2)) : raw;
                });
                return row;
              });
              const cSpec = {
                type: "line",
                title: `${yLbl} — Trend`,
                data: chartData,
                config: {
                  xKey: "label",
                  yKey: "value",
                  xLabel: "Period",
                  yLabel: yLbl,
                  entities: allEnts,
                  periodMode: "line",
                },
              };
              xPivotResult +=
                "\n\n```chart\n" + JSON.stringify(cSpec, null, 2) + "\n```\n";
            }
          }
          } // end if (!suppressPeriodChart)
        }
      }

      if (xPivotResult) return xPivotResult;
    }

    // ── FLAT PATH (no month column) ────────────────────────────────────────────
    // Monetary value columns that will get the raw+converted dual-column treatment
    const monetaryValueCols = new Set(
      valueColumns.filter(
        (c) => !this.isPercentageColumn(c) && !this.isCountColumn(c),
      ),
    );
    const rawSymbol = currency === "inr" ? "₹" : "$";

    // Build display column list — in Entity P&L context expand each monetary col into
    // [__raw__<col>, <col>] so the table shows raw value + converted millions side-by-side.
    // For all other raw-USD paths (GB P&L, direct cost, etc.) just show the scaled column.
    const displayCols: string[] = [];
    for (const c of columns) {
      if (showRawCols && monetaryValueCols.has(c)) {
        displayCols.push(`__raw__${c}`);
      }
      displayCols.push(c);
    }
    // Share of Total column removed — not shown in any table.

    let table = `### Detailed Analysis\n\n`;

    table +=
      "| " +
      displayCols
        .map((c) => {
          if (c === "Share of Total") return "Share of Total (%)";
          if (c.startsWith("__raw__")) {
            const origHeader = this.getColumnHeader(c.slice(7), currency, userQuery);
            return currency === "inr" ? `${origHeader} (Raw INR)` : `${origHeader} (Raw USD)`;
          }
          return this.getColumnHeader(c, currency, userQuery);
        })
        .join(" | ") +
      " |\n";
    table += "| " + displayCols.map(() => "---").join(" | ") + " |\n";

    rows.forEach((row) => {
      const primaryV = row[primaryValueCol];
      const primaryNum =
        typeof primaryV === "number"
          ? primaryV
          : parseFloat(String(primaryV)) || 0;
      const share =
        grandTotal > 0
          ? ((Math.abs(primaryNum) / grandTotal) * 100).toFixed(1) + "%"
          : "N/A";

      const cells = displayCols.map((col) => {
        if (col === "Share of Total") return share;

        // Raw column — show the original DB value with currency symbol, no division
        if (col.startsWith("__raw__")) {
          const origCol = col.slice(7);
          const v = row[origCol];
          if (v === null || v === undefined) return "-";
          const num = typeof v === "number" ? v : parseFloat(String(v));
          if (isNaN(num)) return "-";
          const sign = num < 0 ? "-" : "";
          return (
            sign +
            rawSymbol +
            Math.abs(num).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          );
        }

        // Normal column
        const v = row[col];
        if (v === null || v === undefined) return "-";
        if (typeof v === "string" && isNaN(parseFloat(v))) return v;
        const num = typeof v === "number" ? v : parseFloat(String(v));
        if (!isNaN(num))
          return this.formatValue(num, col, currency, userQuery, !rawUSD);
        return String(v);
      });
      table += "| " + cells.join(" | ") + " |\n";
    });

    return viewLabel + keyFindings + "\n\n" + table;
  }

  private isPercentageColumn(col: string): boolean {
    const c = col.toLowerCase();
    return (
      c.includes("_pct") ||
      c.includes("percentage") ||
      c.includes("_ratio") ||
      c.includes("utilization") ||
      c.includes("_mix") ||
      c === "ebit_percentage" ||
      c === "billing_utilization_pct" ||
      c === "attrition_pct"
    );
  }

  private isCountColumn(col: string): boolean {
    const c = col.toLowerCase();
    return (
      c.includes("capacity") ||
      c === "headcount" ||
      c === "total_hours" ||
      c === "billable_hours" ||
      c === "hours" ||
      c.endsWith("_count") ||
      c === "ytd_attrition" ||
      c === "month_attrition" ||
      c === "billed_capacity" ||
      c === "available_capacity"
    );
  }

  // Columns that hold a per-unit dollar value (not millions) — format as $X,XXX not $X.XX M
  private isUnitaryDollarColumn(col: string): boolean {
    const c = col.toLowerCase();
    return c === "budget_per_avg_capacity" || c === "budget_per_capacity";
  }

  private getCurrencyUnit(currency: string, userQuery: string): string {
    if (currency === "inr") {
      if (/\bcr\b|\bcrore[s]?\b/i.test(userQuery)) return "₹ Cr";
      return "mINR";
    }
    return "mUSD";
  }

  private getColumnHeader(
    col: string,
    currency: string,
    userQuery: string,
  ): string {
    if (col === "Share of Total") return "Share of Total (%)";

    const COLUMN_LABELS: Record<
      string,
      { label: string; type: "monetary" | "percentage" | "count" | "dimension" }
    > = {
      region_entity: { label: "Entity", type: "dimension" },
      sub_cost_category: { label: "Sub-Cost Category", type: "dimension" },
      cost_sub_category: { label: "Sub-Cost Category", type: "dimension" },
      cost_category_class: { label: "Cost Category", type: "dimension" },
      entity_category: { label: "Entity Category", type: "dimension" },
      entity_sub_category: { label: "Entity Sub-Category", type: "dimension" },
      sector: { label: "Sector", type: "dimension" },
      new_service_area: { label: "Service Area", type: "dimension" },
      project_gb: { label: "Project GB", type: "dimension" },
      salary_level: { label: "Salary Level", type: "dimension" },
      resource_type: { label: "Resource Type", type: "dimension" },
      month: { label: "Period", type: "dimension" },
      year: { label: "Year", type: "dimension" },
      revenue: { label: "Revenue", type: "monetary" },
      cost: { label: "Total Cost", type: "monetary" },
      total_cost: { label: "Total Cost", type: "monetary" },
      total_direct_cost: { label: "Total Direct Cost", type: "monetary" },
      total_indirect_cost: { label: "Total Indirect Cost", type: "monetary" },
      gross_margin: { label: "Gross Margin", type: "monetary" },
      resource_cost: { label: "Resource Cost", type: "monetary" },
      travel_cost: { label: "Travel Cost", type: "monetary" },
      other_direct_cost: { label: "Other Direct Cost", type: "monetary" },
      direct_cost: { label: "Direct Cost", type: "monetary" },
      indirect_cost: { label: "Indirect Cost", type: "monetary" },
      budget: { label: "Budget", type: "monetary" },
      revenue_millions: { label: "Revenue", type: "monetary" },
      avg_offshore_cap: { label: "Avg Offshore", type: "count" },
      avg_outsourcing_cap: { label: "Avg Outsourcing", type: "count" },
      avg_total_capacity: { label: "Avg Capacity", type: "count" },
      months_used: { label: "Months", type: "dimension" },
      budget_per_capacity: { label: "Budget / Capacity", type: "monetary" },
      budget_per_avg_capacity: { label: "Budget / Avg Cap", type: "monetary" },
      amount_usd: { label: "Amount", type: "monetary" },
      amount_usd_sum: { label: "Amount", type: "monetary" },
      amount_inr: { label: "Amount", type: "monetary" },
      amount_inr_sum: { label: "Amount", type: "monetary" },
      ebit_percentage: { label: "EBIT", type: "percentage" },
      billing_utilization_pct: {
        label: "Billing Utilisation",
        type: "percentage",
      },
      attrition_pct: { label: "Attrition %", type: "percentage" },
      month_attrition: { label: "Attritions (Month)", type: "count" },
      ytd_attrition: { label: "Attritions (YTD)", type: "count" },
      billed_capacity: { label: "Billed Capacity", type: "count" },
      available_capacity: { label: "Available Capacity", type: "count" },
      headcount: { label: "Headcount", type: "count" },
      capacity: { label: "Capacity", type: "count" },
      total_hours: { label: "Total Hours", type: "count" },
      billable_hours: { label: "Billable Hours", type: "count" },
    };

    const info = COLUMN_LABELS[col];
    if (info) {
      const unit = this.getCurrencyUnit(currency, userQuery);
      if (info.type === "monetary") {
        // Per-unit dollar columns show ($/head) not (mUSD)
        if (this.isUnitaryDollarColumn(col)) return `${info.label} ($/head)`;
        return `${info.label} (${unit})`;
      }
      if (info.type === "percentage") return `${info.label} (%)`;
      if (info.type === "count") return `${info.label} (heads)`;
      return info.label;
    }

    // Fallback: snake_case → Title Case, then guess type
    const base = col
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    if (this.isPercentageColumn(col)) return `${base} (%)`;
    if (this.isCountColumn(col)) return `${base} (heads)`;
    return base;
  }

  // preScaled = true  →  SQL already divided by 1,000,000 (all semantic-SQL builders do this
  //                       except entity P&L which returns raw USD; entity P&L sets rawUSD=true
  //                       so its callers pass preScaled=false).
  // preScaled = false →  value is raw USD/INR — divide by 1M before displaying.
  private formatValue(
    num: number,
    colName: string,
    currency: string = "usd",
    userQuery: string = "",
    preScaled = false,
  ): string {
    const col = colName.toLowerCase();
    if (Math.abs(num) < 1e-10) {
      if (this.isPercentageColumn(col)) return "0.00%";
      if (this.isCountColumn(col)) return "0";
      return "0.00";
    }

    // Dimension columns — return as plain integer (month=4, year=2025, etc.)
    if (col === "month" || col === "year" || col === "month_num") {
      return String(Math.round(num));
    }

    // Percentage columns
    if (this.isPercentageColumn(col)) {
      return num.toFixed(2) + "%";
    }

    // Count / capacity columns — plain number, no currency symbol
    if (this.isCountColumn(col)) {
      return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
    }

    // INR branch
    if (currency === "inr") {
      const isCrore = /\bcr\b|\bcrore[s]?\b/i.test(userQuery);
      if (isCrore) {
        // preScaled: num is mINR → 1 Cr = 10 mINR; raw: num is INR → 1 Cr = 10M INR
        const cr = preScaled ? num / 10 : num / 10_000_000;
        return (
          "₹" +
          cr.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) +
          " Cr"
        );
      }
      const millions = preScaled ? num : num / 1_000_000;
      return (
        "₹" +
        millions.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) +
        " M"
      );
    }

    // Per-unit dollar columns (e.g. budget per avg capacity) — plain dollar amount, not millions
    if (this.isUnitaryDollarColumn(col)) {
      return (
        "$" +
        num.toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
      );
    }

    // USD branch.
    // preScaled=true  → num is already mUSD (SQL divided by 1M) → use as-is.
    // preScaled=false → num is raw USD → divide by 1M.
    // _millions suffix is kept as a legacy signal; preScaled subsumes it.
    const alreadyMillions = preScaled || col.endsWith("_millions");
    const millions = alreadyMillions ? num : num / 1_000_000;
    return (
      "$" +
      millions.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) +
      " M"
    );
  }

  private buildChartBlock(sqlResults: SemanticSQLEvidence[], comparisonResults: SemanticSQLEvidence[] = []): string {
    const primary =
      sqlResults.find((s) => !s.isComparisonData) || sqlResults[0];
    if (!primary || !primary.results || primary.results.length < 2) return "";

    const rows = primary.results;
    const columns =
      primary.columns && primary.columns.length > 0
        ? primary.columns
        : Object.keys(rows[0]);

    // Sub-category breakdown columns take priority so X-axis shows meaningful names.
    // entity/region identifiers come after — used only when no breakdown dimension exists.
    const preferredLabelCols = [
      "entity_sub_category",
      "sub_cost_category",
      "cost_sub_category",
      "salary_band",
      "salary_level",
      "region_entity",
      "entity",
      "sector",
      "category",
      "cost_category",
      "month",
      "year",
    ];
    const skipAlwaysCols = new Set([
      "id",
      "cube_id",
      "company_id",
      "cost_category",
    ]);

    // Single-value guard: prefer a column that has more than one distinct value.
    const candidateLabelCols = preferredLabelCols.filter((c) =>
      columns.includes(c),
    );
    let labelCol: string | undefined = candidateLabelCols.find((c) => {
      const uniqueVals = new Set(rows.map((r) => r[c]));
      return uniqueVals.size > 1;
    });
    if (!labelCol) labelCol = candidateLabelCols[0];
    if (!labelCol) {
      labelCol = columns.find((col) => {
        if (skipAlwaysCols.has(col)) return false;
        const val = rows[0][col];
        return typeof val === "string" && isNaN(Number(val));
      });
    }
    if (!labelCol) return "";

    const skipValueCols = new Set([
      labelCol,
      "year",
      "month",
      "id",
      "cube_id",
      "company_id",
      "cost_category",
    ]);

    // Preferred value columns — exact names first, then _usd_sum/_inr_sum suffix variants
    // produced by the generic compile_sql aggregation path (SUM(amount_usd) → amount_usd_sum).
    const preferredValueCols = [
      "amount_usd",
      "amount_inr",
      "band_capacity",
      // Percentage / ratio metrics — show the meaningful KPI, not the raw sub-component
      "billing_utilization_pct",
      "attrition_pct",
      "pyramid_mix_pct",
      "price_mix_ratio_pct",
      "internal_mix_pct",
      "external_mix_pct",
      // Total-capacity aggregates — prefer the rolled-up total over individual parts
      "total_capacity_avg",
      "total_capacity_end",
      // Raw component cols (fallback when no % or total exists)
      "ytd_attrition",
      "billed_capacity",
      "allocated_capacity",
      "headcount",
      "value",
      "total",
      "revenue",
      "cost",
    ];

    let valueCol = preferredValueCols.find((c) => columns.includes(c));
    // Also match generic aggregation aliases: amount_usd_sum, amount_inr_sum, etc.
    if (!valueCol) {
      valueCol = columns.find(
        (c) => c.endsWith("_usd_sum") || c.endsWith("_inr_sum"),
      );
    }
    if (!valueCol) {
      valueCol = columns.find((col) => {
        if (skipValueCols.has(col)) return false;
        const val = rows[0][col];
        const num = typeof val === "number" ? val : parseFloat(String(val));
        return !isNaN(num);
      });
    }
    if (!valueCol) return "";

    // Determine if the value column holds raw USD/INR (needs ÷1M scaling).
    // Covers: exact names + generic _sum suffix variants from compile_sql path.
    const isRawUsdCol =
      valueCol === "amount_usd" ||
      valueCol === "amount_inr" ||
      valueCol.endsWith("_usd_sum") ||
      valueCol.endsWith("_inr_sum");
    const isInrCol =
      valueCol === "amount_inr" || valueCol.endsWith("_inr_sum");
    const scaleFactor = isRawUsdCol ? 1_000_000 : 1;

    // Friendly Y-axis label.
    const yLabelFriendly = isRawUsdCol
      ? isInrCol
        ? "Amount (mINR)"
        : "Amount (mUSD)"
      : valueCol.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    // Friendly X-axis label with title-case.
    const xLabelFriendly = labelCol
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace("Sub Category", "Breakdown")
      .replace("Region Entity", "Entity");

    const timeInfo = primary.timeFilterApplied
      ? ` (${primary.timeFilterApplied})`
      : "";
    const isTimeSeries = labelCol === "month" || labelCol === "year";

    // ── Multi-dimension path ────────────────────────────────────────────────
    // When the result has both a sub-category dimension AND region_entity,
    // pivot the data so X-axis = sub-category, with one keyed entry per entity.
    // The frontend renders a dropdown to filter by entity.
    const subCatCols = new Set([
      "entity_sub_category",
      "sub_cost_category",
      "cost_sub_category",
      "salary_band",
      "salary_level",
    ]);
    const entityDimCol = columns.includes("region_entity")
      ? "region_entity"
      : columns.includes("entity")
        ? "entity"
        : null;

    const isMultiDim =
      !isTimeSeries &&
      subCatCols.has(labelCol) &&
      entityDimCol !== null &&
      entityDimCol !== labelCol;

    if (isMultiDim) {
      // Collect all unique entities (cap at 8 to keep the chart readable).
      const allEntities = [
        ...new Set(
          rows
            .map((r) => String(r[entityDimCol!] ?? ""))
            .filter((v) => v && v !== "null"),
        ),
      ].slice(0, 8);

      if (allEntities.length < 2) {
        // Only one entity — fall through to single-series path below.
      } else {
        // Collect unique sub-category labels (preserve order from SQL).
        const subCatOrder: string[] = [];
        const seen = new Set<string>();
        for (const row of rows) {
          const sc = String(row[labelCol] ?? "-");
          if (!seen.has(sc)) {
            subCatOrder.push(sc);
            seen.add(sc);
          }
        }

        // Build pivot map: subCat → { entity → scaled value }
        const pivot: Record<string, Record<string, number>> = {};
        for (const sc of subCatOrder) {
          pivot[sc] = {};
        }
        for (const row of rows) {
          const sc = String(row[labelCol] ?? "-");
          const ent = String(row[entityDimCol!] ?? "");
          if (!ent || ent === "null") continue;
          const raw =
            typeof row[valueCol] === "number"
              ? (row[valueCol] as number)
              : parseFloat(String(row[valueCol])) || 0;
          const scaled =
            scaleFactor > 1
              ? parseFloat((raw / scaleFactor).toFixed(2))
              : raw;
          pivot[sc][ent] = (pivot[sc][ent] ?? 0) + scaled;
        }

        // Convert pivot to chart data rows — cap at 10 sub-categories.
        const multiData = subCatOrder.slice(0, 10).map((sc) => {
          const row: Record<string, string | number> = { label: sc };
          for (const ent of allEntities) {
            row[ent] = pivot[sc][ent] ?? 0;
          }
          return row;
        });

        // Build monthData when comparison results exist so the frontend can
        // show a month dropdown alongside the entity dropdown.
        const monthDataMap: Record<string, Array<Record<string, string | number>>> = {};
        const primaryLabel = primary.timeFilterApplied || "Current Period";
        monthDataMap[primaryLabel] = multiData;

        for (const comp of comparisonResults) {
          const compRows = comp.results ?? [];
          if (compRows.length === 0) continue;
          const compLabel = comp.timeFilterApplied || `Period ${Object.keys(monthDataMap).length + 1}`;
          const compPivot: Record<string, Record<string, number>> = {};
          for (const sc of subCatOrder) compPivot[sc] = {};
          for (const row of compRows) {
            const sc = String(row[labelCol] ?? "-");
            if (!compPivot[sc]) compPivot[sc] = {};
            const ent = String(row[entityDimCol!] ?? "");
            if (!ent || ent === "null" || !allEntities.includes(ent)) continue;
            const raw = typeof row[valueCol] === "number"
              ? (row[valueCol] as number)
              : parseFloat(String(row[valueCol])) || 0;
            const scaled = scaleFactor > 1 ? parseFloat((raw / scaleFactor).toFixed(2)) : raw;
            compPivot[sc][ent] = (compPivot[sc][ent] ?? 0) + scaled;
          }
          const compData = subCatOrder.slice(0, 10).map((sc) => {
            const row: Record<string, string | number> = { label: sc };
            for (const ent of allEntities) row[ent] = compPivot[sc]?.[ent] ?? 0;
            return row;
          });
          monthDataMap[compLabel] = compData;
        }

        const hasMultiPeriod = Object.keys(monthDataMap).length > 1;

        const friendlyTitle = `${yLabelFriendly} by ${xLabelFriendly}${timeInfo}`;
        const chartSpec = {
          type: "bar" as const,
          title: friendlyTitle,
          data: multiData,
          config: {
            xKey: "label",
            yKey: "value",
            xLabel: xLabelFriendly,
            yLabel: yLabelFriendly,
            color: "primary",
            entities: allEntities,
            ...(hasMultiPeriod ? { monthData: monthDataMap } : {}),
          },
        };
        return "\n\n```chart\n" + JSON.stringify(chartSpec, null, 2) + "\n```\n";
      }
    }

    // ── Single-series path (existing behaviour, unchanged) ──────────────────
    const chartData = rows
      .filter((row) => {
        const v = row[valueCol!];
        if (v === null || v === undefined) return false;
        const num = typeof v === "number" ? v : parseFloat(String(v));
        return !isNaN(num) && Math.abs(num) > 1e-10;
      })
      .slice(0, 12)
      .map((row) => {
        const raw =
          typeof row[valueCol!] === "number"
            ? (row[valueCol!] as number)
            : parseFloat(String(row[valueCol!])) || 0;
        return {
          label: String(row[labelCol!] ?? "-"),
          value:
            scaleFactor > 1 ? parseFloat((raw / scaleFactor).toFixed(2)) : raw,
        };
      });

    if (chartData.length < 2) return "";

    // Build monthData for the frontend month dropdown on single-series bar charts.
    // Two paths:
    //   A. Multi-month primary: primary rows already contain multiple (year,month) combos
    //      → group rows by period so each dropdown entry shows one clean month's data.
    //      (Happens when the query has no explicit month and default applies month IN [1,2].)
    //   B. Single-month primary with comparison results: existing behaviour.
    const _mnLookup = ['', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    const singleMonthDataMap: Record<string, Array<{ label: string; value: number }>> = {};
    const primaryPeriodLabel = primary.timeFilterApplied || "Current Period";

    // Detect distinct (year, month) combos in primary rows (only when not a time-series chart).
    const _primaryPeriodKeys = !isTimeSeries
      ? [...new Set(
          rows
            .filter((r) => r["month"] !== null && r["month"] !== undefined &&
                           r["year"]  !== null && r["year"]  !== undefined)
            .map((r) => `${r["year"]}-${r["month"]}`),
        )]
      : [];

    if (!isTimeSeries && _primaryPeriodKeys.length > 1) {
      // Path A — group primary rows by (year, month), latest period first.
      const _sortedPeriods = _primaryPeriodKeys
        .map((k) => { const [y, m] = k.split("-").map(Number); return { year: y, month: m }; })
        .sort((a, b) => b.year - a.year || b.month - a.month);

      for (const { year, month } of _sortedPeriods) {
        const _label = `${_mnLookup[month]} ${year}`;
        const _mRows = rows.filter(
          (r) => Number(r["month"]) === month && Number(r["year"]) === year,
        );
        const _mData = _mRows
          .filter((row) => {
            const v = row[valueCol!];
            if (v === null || v === undefined) return false;
            const num = typeof v === "number" ? v : parseFloat(String(v));
            return !isNaN(num) && Math.abs(num) > 1e-10;
          })
          .slice(0, 12)
          .map((row) => {
            const raw =
              typeof row[valueCol!] === "number"
                ? (row[valueCol!] as number)
                : parseFloat(String(row[valueCol!])) || 0;
            return {
              label: String(row[labelCol!] ?? "-"),
              value: scaleFactor > 1 ? parseFloat((raw / scaleFactor).toFixed(2)) : raw,
            };
          });
        if (_mData.length > 0) singleMonthDataMap[_label] = _mData;
      }
    } else {
      // Path B — single-month primary + optional comparison results (existing behaviour).
      singleMonthDataMap[primaryPeriodLabel] = chartData;

      for (const comp of comparisonResults) {
        const compRows = comp.results ?? [];
        if (!compRows.length) continue;
        const compLabel = comp.timeFilterApplied || `Period ${Object.keys(singleMonthDataMap).length + 1}`;
        const compData = compRows
          .filter((row) => {
            const v = row[valueCol!];
            if (v === null || v === undefined) return false;
            const num = typeof v === "number" ? v : parseFloat(String(v));
            return !isNaN(num) && Math.abs(num) > 1e-10;
          })
          .slice(0, 12)
          .map((row) => {
            const raw =
              typeof row[valueCol!] === "number"
                ? (row[valueCol!] as number)
                : parseFloat(String(row[valueCol!])) || 0;
            return {
              label: String(row[labelCol!] ?? "-"),
              value: scaleFactor > 1 ? parseFloat((raw / scaleFactor).toFixed(2)) : raw,
            };
          });
        if (compData.length > 0) singleMonthDataMap[compLabel] = compData;
      }
    }

    const hasSingleMonthData = Object.keys(singleMonthDataMap).length > 1;

    // Descriptive chart title: include entity context when breakdown is primary.
    const entityContext = (() => {
      if (subCatCols.has(labelCol) && columns.includes("region_entity")) {
        const entities = [
          ...new Set(rows.map((r) => r["region_entity"]).filter(Boolean)),
        ];
        if (entities.length === 1) return ` — ${entities[0]}`;
      }
      return "";
    })();
    const friendlyTitle = `${yLabelFriendly}${entityContext} by ${xLabelFriendly}${timeInfo}`;

    // When monthData is present, spec.data should be the latest period's data
    // (the frontend defaults selectedMonth to monthDataKeys[0] = latest period).
    // For plain single-period charts, spec.data remains the primary chartData.
    const specData = hasSingleMonthData
      ? Object.values(singleMonthDataMap)[0]
      : chartData;

    const chartSpec = {
      type: isTimeSeries ? ("line" as const) : ("bar" as const),
      title: friendlyTitle,
      data: specData,
      config: {
        xKey: "label",
        yKey: "value",
        xLabel: xLabelFriendly,
        yLabel: yLabelFriendly,
        color: "primary",
        ...(hasSingleMonthData ? { monthData: singleMonthDataMap } : {}),
      },
    };

    return "\n\n```chart\n" + JSON.stringify(chartSpec, null, 2) + "\n```\n";
  }

  private buildTrendChartBlock(
    primarySqlResults: SemanticSQLEvidence[],
    comparisonSqlResults: SemanticSQLEvidence[],
  ): string {
    if (comparisonSqlResults.length === 0) return "";

    const primary =
      primarySqlResults.find((s) => !s.isComparisonData) ||
      primarySqlResults[0];
    if (!primary?.results || primary.results.length === 0) return "";

    const columns = primary.columns?.length
      ? primary.columns
      : Object.keys(primary.results[0] || {});

    // Same value-column detection as buildChartBlock
    const skipCols = new Set([
      "id",
      "cube_id",
      "company_id",
      "region_entity",
      "entity",
      "sector",
      "month",
      "year",
      "sub_cost_category",
      "cost_sub_category",
      "entity_category",
      "entity_sub_category",
      "project_gb",
      "resource_type",
      "salary_level",
      "months_used",
      "cost_category",
    ]);
    const preferredValueCols = [
      "amount_usd",
      "amount_inr",
      "band_capacity",
      // Percentage / ratio metrics first
      "billing_utilization_pct",
      "attrition_pct",
      "pyramid_mix_pct",
      "price_mix_ratio_pct",
      "internal_mix_pct",
      "external_mix_pct",
      // Total-capacity aggregates
      "total_capacity_avg",
      "total_capacity_end",
      // Raw component fallbacks
      "ytd_attrition",
      "month_attrition",
      "billed_capacity",
      "allocated_capacity",
      "headcount",
      "value",
      "total",
    ];

    let valueCol = preferredValueCols.find((c) => columns.includes(c));
    if (!valueCol) {
      valueCol = columns.find((col) => {
        if (skipCols.has(col)) return false;
        const val = primary.results![0][col];
        return !isNaN(parseFloat(String(val)));
      });
    }
    if (!valueCol) return "";

    const millionScaleCols = new Set(["amount_inr", "amount_usd"]);
    const scaleFactor = millionScaleCols.has(valueCol) ? 1_000_000 : 1;

    const sumRows = (rows: any[]): number =>
      rows.reduce((acc, row) => {
        const v =
          typeof row[valueCol!] === "number"
            ? row[valueCol!]
            : parseFloat(String(row[valueCol!])) || 0;
        return acc + v;
      }, 0);

    // Build ordered time-series: comparison periods first, then current
    const trendPoints: { label: string; value: number }[] = [];

    for (const cmp of comparisonSqlResults) {
      if (!cmp.results?.length) continue;
      const sum = sumRows(cmp.results);
      const rawLabel = cmp.comparisonLabel || "Prior Period";
      // Shorten "January 2025 MTD" → "Jan 2025"
      const label = rawLabel
        .replace(/ MTD$/, "")
        .replace(/ YTD$/, "")
        .replace(/ YoY$/, "")
        .replace(/^(\w{3})\w+ /, "$1 ");
      trendPoints.push({
        label,
        value:
          scaleFactor > 1
            ? parseFloat((sum / scaleFactor).toFixed(2))
            : parseFloat(sum.toFixed(2)),
      });
    }

    const sumPrimary = sumRows(primary.results);
    const rawPrimaryLabel = primary.timeFilterApplied || "Current";
    const primaryLabel = rawPrimaryLabel
      .replace(/ MTD$/, "")
      .replace(/ YTD$/, "")
      .replace(/^(\w{3})\w+ /, "$1 ");
    trendPoints.push({
      label: primaryLabel,
      value:
        scaleFactor > 1
          ? parseFloat((sumPrimary / scaleFactor).toFixed(2))
          : parseFloat(sumPrimary.toFixed(2)),
    });

    if (trendPoints.length < 2) return "";

    // MoM % change annotation for title
    const prev = trendPoints[trendPoints.length - 2].value;
    const curr = trendPoints[trendPoints.length - 1].value;
    const momPct =
      prev !== 0 ? (((curr - prev) / Math.abs(prev)) * 100).toFixed(1) : null;
    const arrow =
      momPct !== null
        ? parseFloat(momPct) > 0
          ? ` ▲ ${momPct}% MoM`
          : parseFloat(momPct) < 0
            ? ` ▼ ${Math.abs(parseFloat(momPct))}% MoM`
            : " — 0% MoM"
        : "";

    const yLabelFriendly =
      scaleFactor > 1
        ? valueCol.includes("inr")
          ? "Amount (mINR)"
          : "Amount (mUSD)"
        : valueCol.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const chartSpec = {
      type: "line",
      title: `${yLabelFriendly} — Month-over-Month Trend${arrow}`,
      data: trendPoints,
      config: {
        xKey: "label",
        yKey: "value",
        xLabel: "Period",
        yLabel: yLabelFriendly,
        color: "primary",
      },
    };

    return (
      "\n\n### MoM Trend\n\n```chart\n" +
      JSON.stringify(chartSpec, null, 2) +
      "\n```\n"
    );
  }

  private calculateFreshnessScore(evidence: Evidence): number {
    if (evidence.source === "google_search") {
      const timestamp = new Date(evidence.timestamp).getTime();
      const now = Date.now();
      const ageHours = (now - timestamp) / (1000 * 60 * 60);

      if (ageHours < 24) return 1.0;
      if (ageHours < 168) return 0.8;
      if (ageHours < 720) return 0.6;
      return 0.4;
    }

    return 0.7;
  }

  private detectTimeAggregationType(_costCategory: string): "MTD" | "YTD" {
    // All source data is stored as YTD cumulative values (each month's row
    // contains the accumulated total from January through that month).
    return "YTD";
  }

  private isMultiMonthResult(sql: SemanticSQLEvidence): boolean {
    if (!sql.results || sql.results.length === 0) return false;
    const columns = sql.columns || Object.keys(sql.results[0]);
    if (!columns.includes("month")) return false;
    const distinctMonths = new Set(sql.results.map((r) => r["month"]));
    return distinctMonths.size > 1;
  }

  private formatSqlResultsAsTable(sql: SemanticSQLEvidence): string {
    if (!sql.results || sql.results.length === 0) return "";
    if (this.isMultiMonthResult(sql)) {
      return this.formatSqlResultsAsPivotTable(sql);
    }
    return this.formatFlatTable(sql);
  }

  private formatFlatTable(sql: SemanticSQLEvidence): string {
    const MONTH_NAMES = [
      "",
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    let text = "";
    if (sql.results && sql.results.length > 0) {
      const rawColumns = sql.columns || Object.keys(sql.results[0]);

      // Always replace month (and year) with a single human-readable "Period" column
      const hasMonth = rawColumns.includes("month");
      const hasYear = rawColumns.includes("year");

      // Build ordered columns: Period first, then everything except month/year
      const orderedColumns = hasMonth
        ? ["Period", ...rawColumns.filter((c) => c !== "month" && c !== "year")]
        : rawColumns;

      // Only send top 5 rows to the AI context — the full dataset is already
      // stored in metadata.tableData and rendered as an InteractiveDataTable.
      // Sending all rows causes the AI to re-output the entire table in its
      // response, creating a duplicate raw table below the formatted one.
      const CONTEXT_ROW_LIMIT = 5;
      const contextRows = sql.results.slice(0, CONTEXT_ROW_LIMIT);
      const totalRows = sql.results.length;

      if (totalRows > CONTEXT_ROW_LIMIT) {
        text += `*(Top ${CONTEXT_ROW_LIMIT} of ${totalRows} rows shown — full data table is displayed below the response. Do NOT reproduce the full table in your response.)*\n\n`;
      }

      text += "| " + orderedColumns.join(" | ") + " |\n";
      text += "| " + orderedColumns.map(() => "---").join(" | ") + " |\n";

      // Use sql.year metadata as fallback when year is not a SELECT column
      const fallbackYear = sql.year ?? "";

      contextRows.forEach((row) => {
        const values = orderedColumns.map((col) => {
          if (col === "Period") {
            const m = Number(row["month"]);
            const y = row["year"] ?? fallbackYear;
            const monthStr = MONTH_NAMES[m] || `Month ${m}`;
            return y ? `${monthStr} ${y}` : monthStr;
          }
          const val = row[col];
          if (val === null || val === undefined) return "-";
          if (typeof val === "number")
            return val.toLocaleString("en-US", { maximumFractionDigits: 2 });
          return String(val);
        });
        text += "| " + values.join(" | ") + " |\n";
      });

      const numericCols = rawColumns.filter(
        (col) =>
          col !== "month" &&
          col !== "year" &&
          sql.results.some(
            (r) =>
              typeof r[col] === "number" ||
              (typeof r[col] === "string" && !isNaN(parseFloat(r[col]))),
          ),
      );

      if (numericCols.length > 0) {
        const periodLabel = hasMonth
          ? (() => {
              const m = Number(sql.results[0]?.["month"]);
              const y = sql.results[0]?.["year"] ?? "";
              return `${MONTH_NAMES[m] || `Month ${m}`} ${y}`.trim();
            })()
          : null;
        text += "\n**Summary Statistics:**\n";
        numericCols.forEach((col) => {
          const values = sql.results.map((r) => {
            const v = r[col];
            return typeof v === "number" ? v : parseFloat(v) || 0;
          });
          const total = values.reduce((a, b) => a + b, 0);
          const label = periodLabel
            ? `${periodLabel} — Total ${col}`
            : `Total ${col}`;
          text += `- **${label}**: ${total.toLocaleString("en-US", { maximumFractionDigits: 2 })}\n`;
        });
      }

      text += "\n";
    }
    return text;
  }

  private formatSqlResultsAsPivotTable(sql: SemanticSQLEvidence): string {
    const monthNames = [
      "",
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const columns = sql.columns || Object.keys(sql.results[0]);

    const skipDimCols = new Set([
      "id",
      "cube_id",
      "company_id",
      "month",
      "year",
      "cost_category",
      "sub_cost_category",
      "cost_sub_category",
      "entity_category",
      "entity_sub_category",
      "project_gb",
      "resource_type",
      "salary_level",
      "months_used",
    ]);

    const dimCols = columns.filter((col) => {
      if (skipDimCols.has(col)) return false;
      const sample = sql.results.find(
        (r) => r[col] !== null && r[col] !== undefined,
      )?.[col];
      return typeof sample === "string";
    });

    const valCols = columns.filter((col) => {
      if (skipDimCols.has(col)) return false;
      const sample = sql.results.find(
        (r) => r[col] !== null && r[col] !== undefined,
      )?.[col];
      return (
        typeof sample === "number" ||
        (typeof sample === "string" && !isNaN(parseFloat(sample as string)))
      );
    });

    if (valCols.length === 0 || dimCols.length === 0) {
      return this.formatFlatTable(sql);
    }

    const monthSet = new Set<number>();
    const yearSet = new Set<number>();
    sql.results.forEach((r) => {
      if (r["month"] !== undefined) monthSet.add(Number(r["month"]));
      if (r["year"] !== undefined) yearSet.add(Number(r["year"]));
    });
    const sortedMonths = Array.from(monthSet).sort((a, b) => a - b);
    const year = Array.from(yearSet).sort((a, b) => a - b)[0] || "";

    const pivotMap = new Map<
      string,
      {
        dims: Record<string, string>;
        byMonth: Map<number, Record<string, number>>;
      }
    >();

    sql.results.forEach((row) => {
      const dimKey = dimCols.map((c) => String(row[c] ?? "")).join("||");
      if (!pivotMap.has(dimKey)) {
        pivotMap.set(dimKey, {
          dims: Object.fromEntries(
            dimCols.map((c) => [c, String(row[c] ?? "-")]),
          ),
          byMonth: new Map(),
        });
      }
      const entry = pivotMap.get(dimKey)!;
      const month = Number(row["month"]);
      if (!entry.byMonth.has(month)) {
        entry.byMonth.set(
          month,
          Object.fromEntries(valCols.map((c) => [c, 0])),
        );
      }
      const monthVals = entry.byMonth.get(month)!;
      valCols.forEach((c) => {
        const v =
          typeof row[c] === "number" ? row[c] : parseFloat(String(row[c])) || 0;
        monthVals[c] += v;
      });
    });

    let text = "";

    for (const valCol of valCols) {
      const monthHeaders = sortedMonths.map(
        (m) => `${monthNames[m] || `M${m}`} ${year}`,
      );
      const ytdHeader =
        sortedMonths.length > 1
          ? `YTD (${monthNames[sortedMonths[0]]}-${monthNames[sortedMonths[sortedMonths.length - 1]]} ${year})`
          : null;

      const headerCols = [
        ...dimCols,
        ...monthHeaders,
        ...(ytdHeader ? [ytdHeader] : []),
      ];
      text += "| " + headerCols.join(" | ") + " |\n";
      text += "| " + headerCols.map(() => "---").join(" | ") + " |\n";

      const monthTotals: Record<number, number> = Object.fromEntries(
        sortedMonths.map((m) => [m, 0]),
      );

      Array.from(pivotMap.values()).forEach(({ dims, byMonth }) => {
        const dimVals = dimCols.map((c) => dims[c]);
        const monthVals = sortedMonths.map((m) => {
          const v = byMonth.get(m)?.[valCol] ?? 0;
          monthTotals[m] += v;
          return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
        });
        const ytd = ytdHeader
          ? sortedMonths
              .reduce((sum, m) => sum + (byMonth.get(m)?.[valCol] ?? 0), 0)
              .toLocaleString("en-US", { maximumFractionDigits: 2 })
          : null;
        text +=
          "| " +
          [...dimVals, ...monthVals, ...(ytd ? [ytd] : [])].join(" | ") +
          " |\n";
      });

      const totalVals = sortedMonths.map((m) =>
        monthTotals[m].toLocaleString("en-US", { maximumFractionDigits: 2 }),
      );
      const grandTotal = ytdHeader
        ? sortedMonths
            .reduce((sum, m) => sum + monthTotals[m], 0)
            .toLocaleString("en-US", { maximumFractionDigits: 2 })
        : null;
      text +=
        "| " +
        [
          ...dimCols.map(() => "**TOTAL**"),
          ...totalVals,
          ...(grandTotal ? [grandTotal] : []),
        ].join(" | ") +
        " |\n";

      text += "\n**Summary Statistics (per month + YTD):**\n";
      sortedMonths.forEach((m) => {
        text += `- **${monthNames[m] || `Month ${m}`} ${year} — Total ${valCol}**: ${monthTotals[m].toLocaleString("en-US", { maximumFractionDigits: 2 })}\n`;
      });
      if (ytdHeader) {
        const ytdTotal = sortedMonths.reduce(
          (sum, m) => sum + monthTotals[m],
          0,
        );
        text += `- **YTD Total ${valCol} (${monthNames[sortedMonths[0]]}-${monthNames[sortedMonths[sortedMonths.length - 1]]} ${year})**: ${ytdTotal.toLocaleString("en-US", { maximumFractionDigits: 2 })}\n`;
      }
      text += "\n";
    }

    return text;
  }

  private extractDataAvailability(
    sqlResults: SemanticSQLEvidence[],
  ): string | null {
    const notices: string[] = [];
    const allMonths: Set<number> = new Set();
    const allYears: Set<number> = new Set();

    sqlResults.forEach((sql) => {
      if (sql.results && sql.results.length > 0) {
        sql.results.forEach((row) => {
          if (row.month !== undefined && row.month !== null) {
            allMonths.add(Number(row.month));
          }
          if (row.year !== undefined && row.year !== null) {
            allYears.add(Number(row.year));
          }
        });
      }
    });

    if (allMonths.size > 0 || allYears.size > 0) {
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const sortedMonths = Array.from(allMonths).sort((a, b) => a - b);
      const sortedYears = Array.from(allYears).sort((a, b) => a - b);

      const monthLabels = sortedMonths.map(
        (m) => monthNames[m - 1] || `Month ${m}`,
      );
      const yearLabel = sortedYears.join(", ");

      notices.push(
        `- Data available for: ${monthLabels.join(", ")} ${yearLabel}`,
      );

      if (sortedMonths.length > 0) {
        const maxMonth = Math.max(...sortedMonths);
        const expectedMonths = Array.from(
          { length: maxMonth },
          (_, i) => i + 1,
        );
        const missingMonths = expectedMonths.filter((m) => !allMonths.has(m));

        if (missingMonths.length > 0) {
          const missingLabels = missingMonths.map(
            (m) => monthNames[m - 1] || `Month ${m}`,
          );
          notices.push(
            `- CRITICAL DATA GAP: This dataset contains only ${monthLabels.join(", ")} ${yearLabel} data. ${missingLabels.join(", ")} data was NOT loaded into this system. You must NOT fabricate values for missing periods. IMPORTANT: Whenever you report any average metric (average capacity, attrition rate, budget per avg capacity, etc.), you MUST include a "Data Coverage Note" in your response that explicitly states: "Note: This average is computed on ${monthLabels.join(", ")} ${yearLabel} data only — ${missingLabels.join(", ")} data is not available in this dataset. The figures reflect the available period only and should not be compared directly to a full YTD average."`,
          );
        }
      }
    }

    sqlResults.forEach((sql) => {
      if (sql.rowCount === 0) {
        notices.push(
          `- WARNING: No data found for ${sql.costCategory || sql.cubeName} - do NOT fabricate data`,
        );
      }
    });

    return notices.length > 0 ? notices.join("\n") : null;
  }

  generatePromptWithCitations(
    userQuery: string,
    context: EvidenceContext,
    queryType?: QueryType,
  ): string {
    const formattingHint = queryType
      ? queryEnhancer.getFormattingHint(queryType)
      : "";
    const hasRealData = context.text && context.text.trim().length > 0;
    const hasPreBuilt =
      context.preBuiltSections && context.preBuiltSections.trim().length > 0;
    const hasAnySqlData = hasRealData || hasPreBuilt;
    const isSingleRow = (context.dataRowCount ?? 0) === 1;

    const calcTypeLabels: Record<string, string> = {
      internal_capacity_mix: "Internal Capacity Mix (%)",
      external_capacity_mix: "External Capacity Mix (%)",
      offshore_capacity_end: "Offshore Capacity End (heads)",
      offshore_capacity_avg: "Offshore Capacity Avg (heads)",
      outsourcing_capacity_end: "Outsourcing Capacity End (heads)",
      outsourcing_capacity_avg: "Outsourcing Capacity Avg (heads)",
      total_capacity_end: "Total Capacity End (heads)",
      total_capacity_avg: "Total Capacity Avg (heads)",
      revenue: "Revenue (millions USD)",
      budget_per_avg_capacity: "Budget Per Avg Capacity (USD/head)",
      budget_per_avg_capacity_entity: "Budget Per Avg Capacity (USD/head)",
      pyramid_mix: "Pyramid Mix (%)",
      billing_utilization: "Billing Utilization (%)",
      resource_cost: "Resource Cost (USD)",
      travel_cost:
        'Travel Cost (USD) — sub-categories use Bosch naming: "Offshore (T)" = offshore travel cost, "Onsite (T)" = onsite travel cost',
      direct_cost:
        "Total Direct Cost (USD) — includes Resource Cost, Travel Cost, and Other Direct Cost",
      indirect_cost: "Indirect Cost / Corporate Cost (USD)",
      other_direct_cost: "Other Direct Cost (USD)",
      gross_margin:
        "Gross Margin (USD) — Revenue minus (Total Direct Cost + Total Indirect/Corporate Cost)",
      ebit: "EBIT% — (Revenue − Gross Margin) / Revenue × 100 = Total Cost as % of Revenue",
      entity_pl_ebit:
        "Entity P&L EBIT — columns: Revenue, Total Cost, EBIT (Revenue − Total Cost), EBIT% (EBIT / Revenue × 100)",
      entity_pl_ebit_pct:
        "Entity P&L EBIT% — columns: Revenue, Total Cost, EBIT (Revenue − Total Cost), EBIT% (EBIT / Revenue × 100)",
    };
    const metricLabel = context.calculationType
      ? calcTypeLabels[context.calculationType] ||
        context.calculationType.replace(/_/g, " ")
      : "metric data";
    const viewSuffix = context.viewType
      ? ` filtered to ${context.viewType}`
      : "";

    // Always prepend a clear metric header when we know the calculation type
    const metricHeader = context.calculationType
      ? `**METRIC: ${metricLabel}${viewSuffix}** — this IS the data requested. Do NOT disclaim that this data is absent.\n\n`
      : "";

    const authorizedDataText =
      hasRealData || hasPreBuilt
        ? `${metricHeader}${hasRealData ? context.text : `The database returned ${metricLabel}${viewSuffix}. The Pre-Formatted Sections below contain the exact figures — use them as your ONLY source.`}`
        : "No data retrieved from the database for this query.";

    const systemPrompt = `You are LedgerLM, a financial analysis assistant.

════════════════════════════════════════════════════════════
  AUTHORIZED DATA — THE ONLY DATA YOU MAY USE
════════════════════════════════════════════════════════════
${authorizedDataText}

Sources available:
${context.citations.length > 0 ? context.citations.map((c) => `  - ${c}`).join("\n") : "  - None"}
════════════════════════════════════════════════════════════

USER QUESTION:
${userQuery}

════════════════════════════════════════════════════════════
  STRICT RULES
════════════════════════════════════════════════════════════

RULE 1 — DATA LOCK:
Only use entity names, values, and figures from the AUTHORIZED DATA above. Never invent numbers.

RULE 2 — CITATIONS:
Source reference guide:
${context.citations.map((c, idx) => `  [SQL${idx + 1}] = ${c}`).join("\n") || "  [SQL1] = Semantic SQL"}
Cite the matching tag (e.g. [SQL1]) after every statement drawn from that source.

RULE 3 — NO HALLUCINATED PERIODS:
Only report data for periods present in the AUTHORIZED DATA.

RULE 4 — BOSCH GLOSSARY:

4a. ENTITY CODES — use the country name alongside the code in every answer:
  BGSW         = India (Bosch Global Software Technologies, India)
  BGSV         = Vietnam
  BGSJ         = Japan
  BGSG         = Germany
  BGSW/NE-MX   = Mexico (NE-MX, sub-entity of BGSW)
  BGSW/EBS-PL  = Poland (EBS-PL, sub-entity of BGSW)
  BGW          = Worldwide
Example: region_entity = "BGSW" → write "BGSW (India)".

4b. COST SUB-CATEGORY NAMING — Bosch uses a suffix convention in sub_cost_category values:
  "(T)"  suffix = Travel cost component   → "Offshore (T)" means offshore travel cost; "Onsite (T)" means onsite travel cost
  "(O)"  suffix = Onsite component
  "(OS)" suffix = Offshore component (in some contexts)
When the AUTHORIZED DATA header says "Travel Cost" and the data shows sub-categories like "Offshore (T)" or "Onsite (T)", those ARE the travel cost figures. Do NOT say the data lacks travel information.

4c. COST CATEGORY CLASSES:
  Resource Cost    = headcount / payroll-related costs
  Travel Cost      = travel and expense costs (sub-categories contain "(T)" suffix)
  Other Direct Cost= other project direct costs
  Indirect Cost    = Corporate Cost (CI Charges, Corporate Investment, Facilities, HR, Others)

4d. GROSS MARGIN & EBIT OUTPUT COLUMNS — when the data contains these columns, interpret them exactly as follows:
  revenue            = total revenue (Revenue Summary)
  total_direct_cost  = Resource Cost + Travel Cost + Other Direct Cost
  total_indirect_cost= Corporate Cost (= Indirect Cost)
  gross_margin       = revenue − total_direct_cost − total_indirect_cost   [Gross Margin formula]
  ebit_percentage    = (revenue − gross_margin) / revenue × 100
                     = (total_direct_cost + total_indirect_cost) / revenue × 100   [EBIT% formula]
When reporting EBIT%, always state: "EBIT% = (Gross Margin) / Revenue" and show all intermediate values (Revenue, Direct Cost, Indirect Cost, Gross Margin) so the user can verify the arithmetic.

RULE 5 — NO PREAMBLE BEFORE HEADINGS:
Never write any text before the ### Summary heading. Your response must start directly with "### Summary". Do NOT open with a standalone sentence like "The X for [period] is [value]." — that sentence belongs INSIDE the Summary, not before it.

RULE 6 — NO UNSOLICITED DISCLAIMERS:
When the Pre-Formatted Sections contain data, NEVER open with phrases like "there is no specific mention of X", "the data does not explicitly mention", or "I cannot confirm X from the available data". The Pre-Formatted Sections ARE the authoritative answer. State the metric name from the AUTHORIZED DATA header, then deliver the answer directly.

RULE 7 — VIEW TERMS ARE NOT ENTITY NAMES:
The user query may contain analytical VIEW SELECTOR terms — these are NOT entity names and do NOT need to appear in the data:
  • "MSGB" or "MS GB"  = shorthand for the MS (Managed Services) Business Group view
  • "MS view"          = the Microsoft/Managed-Services service area view
  • "PS", "VM", "XC"   = Project GB groupings (Project Services, Value Management, etc.)
  • "GB view"          = Generic grouping abbreviation
When the query includes any of these view/grouping terms and structured data IS returned, the data IS the authorized answer for that view.
NEVER say "AUTHORIZED DATA does not contain information about MSGB", "MSGB is not found", "discrepancy in your query", or similar — when SQL data is present, it already reflects the correct filter for that view.
Simply report the returned figures directly without mentioning the view term as a missing entity.

RULE 8 — YTD DATA INTERPRETATION (CRITICAL):
All source data is stored as Year-To-Date (YTD) cumulative values. The value for a given month already includes all prior months of that year.
  • February 2025 value = January + February cumulative total
  • March 2025 value = January + February + March cumulative total
NEVER sum across multiple month rows to produce a period total — that would multiply-count. When a multi-month table is shown (e.g., Jan, Feb, Mar rows for a quarter query), the LATEST month's value (highest month number) IS the period total. For MoM trend analysis, use the difference between consecutive month values (Feb_value − Jan_value = February's contribution). Always describe single-period figures as "YTD through [Month Year]", never as "MTD".

RULE 9 — CHARTS:
When the user asks for a chart or a visual, use this exact JSON block format:
\`\`\`chart
{"type":"bar","title":"<title>","data":[{"label":"<x>","value":<n>}],"config":{"xKey":"label","yKey":"value","xLabel":"<x-axis description>","yLabel":"<y-axis description with units>","color":"primary"}}
\`\`\`
Always include "xLabel" (e.g. "Entity", "Month") and "yLabel" (e.g. "Attritions (heads)", "Revenue (USD)"). Chart types: "bar" for comparisons, "line" for trends, "pie" for composition. Never omit xLabel or yLabel.

RULE 9 — TABLES:
Use plain markdown table syntax. Each row on its own line. Header row followed immediately by a separator row of dashes. Never wrap tables in code fences.

${formattingHint ? `QUERY-SPECIFIC GUIDANCE:\n${formattingHint}\n` : ""}

════════════════════════════════════════════════════════════
${
  hasPreBuilt
    ? `  REQUIRED RESPONSE STRUCTURE
════════════════════════════════════════════════════════════
Write the Summary section in your own words, then output the Key Findings, Detailed Analysis, and any MoM Trend chart
EXACTLY as they appear below (do not alter any value, label, chart JSON, or row), then write Key Observations.

### Summary
Write 2-3 sentences using only real numbers from AUTHORIZED DATA. Lead with the grand total across all rows. Name the dominant contributor and its % share. If only one row is present, state that single value directly. Never invent numbers not present in the data.

${context.preBuiltSections}

### Key Observations
${
  isSingleRow
    ? `This result contains data for a single entity/item — the user asked for a specific entity.
DO NOT generate DOMINANCE, RATIO/SPREAD, CONCENTRATION, or ENTITY COMPARISON observations (those require multiple items to be meaningful). Instead, write 2-3 focused observations:

1. **VALUE SUMMARY** — State the entity name and its exact value with metric and period. Example: "BGSW (India) Budget YTD through March 2025 is $314.63M." NEVER say the entity "represents 100.0% of the total" — when only one entity is queried that is trivially obvious and adds no insight. Simply state the value.

2. **BUSINESS CONTEXT** — Provide one meaningful insight about this number: What does its scale imply operationally? (e.g., BGSW is the largest GB entity and this budget represents its full headcount and project cost base for the month.) If total-GB figures are visible anywhere in the AUTHORIZED DATA, compute this entity's share of the total and state it.

3. **PERIOD CONTEXT & DATA COVERAGE** — CRITICAL: If a **### MoM Trend** chart section appears in the REQUIRED RESPONSE STRUCTURE above, output it EXACTLY as written, then state the MoM % change. If only one period exists, state "This is YTD data through [period] — no prior-period comparison available."

Do NOT say "only one entity is present, so no comparison is possible" — this is obvious and unhelpful. Simply give the value and its context.`
    : `Write 3-5 sharp, data-driven observations. Every observation MUST reference exact numbers from the Key Findings / Detailed Analysis above. Required analytical patterns:

1. **DOMINANCE** — Which item (entity/category/month) contributes the most? State its value AND its % share of the grand total. Example: "Offshore Internal accounts for ₹185.9M (96.9% of BGSW's total resource cost), indicating near-total reliance on this sub-category."

2. **RATIO / SPREAD** — Compare the largest to the smallest (or second-largest). How many times larger? Example: "Offshore Internal is 74× larger than Onsite (₹185.9M vs ₹2.5M)."

3. **CONCENTRATION / PATTERN** — Is the distribution concentrated or balanced? Note any skew. Example: "Two sub-categories (Offshore Internal + Outsourcing) account for 98.7% of total cost, leaving Onsite as a negligible 1.3%."

4. **ENTITY COMPARISON** — Only include this observation if 2 or more distinct entities appear in the data. Compare them head-to-head with exact values and % difference. Example: "BGSW's total (₹192.4M) is 6.3× larger than BGSV's (₹30.3M)." If only one entity is present, skip this pattern entirely — do not write a placeholder or explain its absence.

5. **TREND / PERIOD CONTEXT & DATA COVERAGE** — CRITICAL: If a **### MoM Trend** chart section appears in the REQUIRED RESPONSE STRUCTURE above, output it EXACTLY as written (do not re-generate it — copy the block verbatim). Then state the MoM % change numerically in this observation (e.g., "Outsourcing capacity held flat at 79 heads from January to February 2025, a 0% MoM change."). If no trend chart is pre-built and only one period exists, state "This is YTD data through [period] — no prior-period data available for trend comparison." CRITICAL: If the DATA AVAILABILITY NOTICE in the AUTHORIZED DATA above flags missing months (e.g., only March is available when Jan–Mar was queried), you MUST add a clearly visible "Data Coverage Note" section immediately after your Key Observations: explain which months are in the dataset, which are absent, and that any averages reflect only the available months.`
}

Base every figure and % on the exact numbers in the table. Compute percentages yourself from the data. Do not invent, round creatively, or state anything not derivable from the numbers shown.`
    : `  RESPONSE STRUCTURE
════════════════════════════════════════════════════════════

REQUIRED RESPONSE STRUCTURE:

### Summary
Write 2-3 sentences using only real numbers from AUTHORIZED DATA. Lead with the grand total across all rows. Name the dominant contributor and its % share. If only one row is present, state that single value directly. Never invent numbers not present in the data.

### Key Findings
[3-5 insight bullets — NOT one bullet per row. Cover: top contributor and its % share, concentration (top N items cover X% of total), any negatives or anomalies, scale range between largest and smallest. Skip any pattern that does not apply. Do NOT list every row individually.]

### Detailed Analysis
[Data table with exact column names from the data above. Include ALL rows.]

### Key Observations
${
  isSingleRow
    ? `This result contains data for a single entity/item — the user asked for a specific entity.
DO NOT generate DOMINANCE, RATIO, CONCENTRATION, or ENTITY COMPARISON observations. Instead write 2-3 focused observations:
1. **VALUE SUMMARY** — State the entity name and its exact value with metric and period.
2. **BUSINESS CONTEXT** — One meaningful insight about scale or significance. If total-GB figures appear in AUTHORIZED DATA, compute and state this entity's share.
3. **PERIOD CONTEXT** — If comparison data is present state the MoM change. Otherwise: "YTD data through [period] — no prior-period comparison available."
Do NOT say "only one entity is present" — just give the value and context.`
    : `Write 3-5 sharp, data-driven observations. Every observation MUST contain exact numbers. Required patterns:
1. **DOMINANCE** — Top item's value and its % share of total. E.g. "X accounts for ₹Y (Z% of total)."
2. **RATIO** — Top vs second item as a multiplier or % gap. E.g. "X is N× larger than Y."
3. **CONCENTRATION** — Is spending/revenue concentrated in one area or spread? State the top-2 combined %.
4. **ENTITY COMPARISON** — Only include if 2 or more distinct entities appear in the data. Compare side-by-side with exact values and % difference. If only one entity is present, skip this pattern entirely.
5. **PERIOD CONTEXT & DATA COVERAGE** — If COMPARISON DATA sections are in the AUTHORIZED DATA above, state the MoM % change numerically (e.g., "Revenue rose from $40.1M in Jan to $42.3M in Feb — a +5.5% MoM increase."). If only one period: state "YTD data through [period] — no prior-period comparison available." CRITICAL: If the DATA AVAILABILITY NOTICE above flags missing months, add a "Data Coverage Note" section after Key Observations stating which months are present, which are absent, and that averages reflect only the available months.`
}

All figures must match exactly what appears in the AUTHORIZED DATA. Compute % shares from the raw numbers. Never invent data.`
}

════════════════════════════════════════════════════════════
${
  !hasAnySqlData
    ? `IMPORTANT: No data was retrieved from the database. Respond with ONLY:
"No data was found in the database for your query."
Do NOT invent any figures.`
    : `IMPORTANT: Data IS available above${hasPreBuilt ? " and in the Pre-Formatted Sections" : ""}. You MUST present the actual figures — never say "no data was found".`
}
════════════════════════════════════════════════════════════`;

    return systemPrompt;
  }
}

export const evidenceBroker = new EvidenceBroker();
