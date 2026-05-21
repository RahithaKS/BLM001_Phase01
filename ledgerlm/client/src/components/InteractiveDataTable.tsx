import { useState, useCallback, useMemo, useEffect } from "react";
import { Filter, X, Download, ChevronDown, ChevronUp } from "lucide-react";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface InteractiveDataTableProps {
  headers: string[];
  rows: string[][];
}

type DownloadFormat = "csv" | "xlsx" | "txt";

function parseNumeric(val: string): number | null {
  const stripped = val.replace(/[$,%\sMBK]/g, "").replace(/,/g, "");
  const n = parseFloat(stripped);
  return isNaN(n) ? null : n;
}

function detectFormat(val: string): { prefix: string; suffix: string } {
  const prefix = val.trimStart().startsWith("$") ? "$" : "";
  let suffix = "";
  if (val.trimEnd().endsWith("%")) suffix = "%";
  else if (/\s*M\s*$/.test(val)) suffix = " M";
  else if (/\s*B\s*$/.test(val)) suffix = " B";
  else if (/\s*K\s*$/.test(val)) suffix = " K";
  return { prefix, suffix };
}

function escapeCSV(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function InteractiveDataTable({ headers, rows }: InteractiveDataTableProps) {
  const [filters, setFilters] = useState<Record<number, Set<string>>>({});
  const [openCol, setOpenCol] = useState<number | null>(null);

  // Download state
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [selectedCols, setSelectedCols] = useState<Set<number>>(
    () => new Set(headers.map((_, i) => i))
  );
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>("csv");

  const uniqueValues = useMemo(() => {
    return headers.map((_, colIdx) => {
      const eligibleRows = rows.filter((row) =>
        Object.entries(filters).every(([colIdxStr, selected]) => {
          if (parseInt(colIdxStr) === colIdx) return true;
          if (!selected || selected.size === 0) return true;
          return selected.has(row[parseInt(colIdxStr)] ?? "");
        })
      );
      const vals = Array.from(new Set(eligibleRows.map((r) => r[colIdx] ?? "").filter(Boolean)));
      vals.sort((a, b) => {
        const na = parseNumeric(a);
        const nb = parseNumeric(b);
        if (na !== null && nb !== null) return na - nb;
        return a.localeCompare(b);
      });
      return vals;
    });
  }, [headers, rows, filters]);

  const colMeta = useMemo(() => {
    return headers.map((_, colIdx) => {
      const nonEmpty = rows.map((r) => r[colIdx] ?? "").filter(Boolean);
      if (nonEmpty.length === 0) return { isNumeric: false, prefix: "", suffix: "" };
      const numericCount = nonEmpty.filter((v) => parseNumeric(v) !== null).length;
      const isNumeric = numericCount / nonEmpty.length >= 0.7;
      if (!isNumeric) return { isNumeric: false, prefix: "", suffix: "" };
      const { prefix, suffix } = detectFormat(nonEmpty[0]);
      return { isNumeric: true, prefix, suffix };
    });
  }, [headers, rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) =>
      Object.entries(filters).every(([colIdxStr, selected]) => {
        if (!selected || selected.size === 0) return true;
        const val = row[parseInt(colIdxStr)] ?? "";
        return selected.has(val);
      })
    );
  }, [rows, filters]);

  const colTotals = useMemo(() => {
    return headers.map((_, colIdx) => {
      const meta = colMeta[colIdx];
      if (!meta.isNumeric || filteredRows.length === 0) return null;
      const sum = filteredRows.reduce((acc, row) => {
        const n = parseNumeric(row[colIdx] ?? "");
        return acc + (n ?? 0);
      }, 0);
      const formatted = sum.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `${meta.prefix}${formatted}${meta.suffix}`;
    });
  }, [filteredRows, colMeta, headers]);

  const hasNumericCol = colMeta.some((m) => m.isNumeric);
  const firstTextColIdx = colMeta.findIndex((m) => !m.isNumeric);
  const activeFilterCount = Object.values(filters).filter((s) => s && s.size > 0).length;

  // ── Collapse / expand ──────────────────────────────────────────────────────
  const COLLAPSE_THRESHOLD = 15;
  const [collapsed, setCollapsed] = useState(true);

  // Auto-expand when filters shrink the result set to fit without scrolling
  useEffect(() => {
    if (filteredRows.length <= COLLAPSE_THRESHOLD) setCollapsed(false);
  }, [filteredRows.length]);

  const needsCollapse = filteredRows.length > COLLAPSE_THRESHOLD;
  const visibleRows = needsCollapse && collapsed
    ? filteredRows.slice(0, COLLAPSE_THRESHOLD)
    : filteredRows;
  // ── End collapse ───────────────────────────────────────────────────────────

  const toggleValue = useCallback((colIdx: number, value: string) => {
    setFilters((prev) => {
      const current = new Set(prev[colIdx] ?? []);
      if (current.has(value)) current.delete(value);
      else current.add(value);
      return { ...prev, [colIdx]: current };
    });
  }, []);

  const toggleAll = useCallback(
    (colIdx: number, allSelected: boolean) => {
      setFilters((prev) => {
        if (allSelected) return { ...prev, [colIdx]: new Set() };
        return { ...prev, [colIdx]: new Set(uniqueValues[colIdx]) };
      });
    },
    [uniqueValues]
  );

  const clearAll = useCallback(() => setFilters({}), []);

  // ── Download helpers ───────────────────────────────────────────────────────
  const colIndices = useMemo(
    () => headers.map((_, i) => i).filter((i) => selectedCols.has(i)),
    [headers, selectedCols]
  );

  const exportHeaders = colIndices.map((i) => headers[i]);
  const exportRows = filteredRows.map((row) => colIndices.map((i) => row[i] ?? ""));

  const handleDownload = useCallback(() => {
    const ts = new Date().toISOString().slice(0, 10);
    const filename = `table-export-${ts}`;

    if (downloadFormat === "csv") {
      const lines = [exportHeaders, ...exportRows]
        .map((row) => row.map(escapeCSV).join(","))
        .join("\n");
      triggerDownload(lines, `${filename}.csv`, "text/csv;charset=utf-8;");
    } else if (downloadFormat === "txt") {
      const lines = [exportHeaders, ...exportRows]
        .map((row) => row.join("\t"))
        .join("\n");
      triggerDownload(lines, `${filename}.txt`, "text/plain;charset=utf-8;");
    } else {
      const ws = XLSX.utils.aoa_to_sheet([exportHeaders, ...exportRows]);
      // Bold the header row
      exportHeaders.forEach((_, cIdx) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: cIdx });
        if (ws[cellRef]) ws[cellRef].s = { font: { bold: true } };
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, `${filename}.xlsx`);
    }
    setDownloadOpen(false);
  }, [downloadFormat, exportHeaders, exportRows]);

  const toggleColSelection = useCallback((colIdx: number) => {
    setSelectedCols((prev) => {
      const next = new Set(prev);
      if (next.has(colIdx)) {
        if (next.size > 1) next.delete(colIdx); // always keep at least 1
      } else {
        next.add(colIdx);
      }
      return next;
    });
  }, []);

  const allColsSelected = selectedCols.size === headers.length;
  const toggleAllCols = useCallback(() => {
    if (allColsSelected) {
      setSelectedCols(new Set([0]));
    } else {
      setSelectedCols(new Set(headers.map((_, i) => i)));
    }
  }, [allColsSelected, headers]);

  return (
    <div className="my-4">
      {/* Status bar — top toolbar */}
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground" data-testid="text-row-count">
            {activeFilterCount > 0
              ? `Showing ${filteredRows.length} of ${rows.length} rows`
              : `${rows.length} rows`}
          </span>
          {activeFilterCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2"
              onClick={clearAll}
              data-testid="button-clear-all-filters"
            >
              <X className="h-3 w-3 mr-1" />
              Clear all filters
            </Button>
          )}
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="text-xs" data-testid="badge-active-filters">
              {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
            </Badge>
          )}
        </div>

        {/* Download popover */}
        <Popover open={downloadOpen} onOpenChange={setDownloadOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2 text-muted-foreground"
              data-testid="button-open-download"
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="end" onOpenAutoFocus={(e) => e.preventDefault()}>
            <div className="p-2 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">
                Columns
              </p>
              <label className="flex items-center gap-2 px-1 py-1 rounded cursor-pointer hover-elevate">
                <Checkbox
                  checked={allColsSelected}
                  onCheckedChange={toggleAllCols}
                  data-testid="checkbox-download-all-cols"
                />
                <span className="text-sm font-medium">All columns</span>
              </label>
              <div className="mt-0.5 flex flex-col gap-0.5">
                {headers.map((header, colIdx) => (
                  <label
                    key={colIdx}
                    className="flex items-center gap-2 px-1 py-1 rounded cursor-pointer hover-elevate"
                  >
                    <Checkbox
                      checked={selectedCols.has(colIdx)}
                      onCheckedChange={() => toggleColSelection(colIdx)}
                      data-testid={`checkbox-download-col-${colIdx}`}
                    />
                    <span className="text-sm truncate" title={header}>{header}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="p-2 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">
                Format
              </p>
              <div className="flex gap-1.5">
                {(["csv", "xlsx", "txt"] as DownloadFormat[]).map((fmt) => (
                  <Button
                    key={fmt}
                    size="sm"
                    variant={downloadFormat === fmt ? "default" : "outline"}
                    className="flex-1 text-xs uppercase"
                    onClick={() => setDownloadFormat(fmt)}
                    data-testid={`button-format-${fmt}`}
                  >
                    {fmt}
                  </Button>
                ))}
              </div>
            </div>
            <div className="p-2">
              <p className="text-xs text-muted-foreground mb-2 px-1">
                {filteredRows.length} row{filteredRows.length !== 1 ? "s" : ""} · {selectedCols.size} column{selectedCols.size !== 1 ? "s" : ""}
              </p>
              <Button
                size="sm"
                className="w-full text-xs"
                onClick={handleDownload}
                data-testid="button-download-confirm"
              >
                <Download className="h-3 w-3 mr-1" />
                Download .{downloadFormat}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-accent/50">
            <tr>
              {headers.map((header, colIdx) => {
                const colFilter = filters[colIdx];
                const isActive = colFilter && colFilter.size > 0;
                const vals = uniqueValues[colIdx];
                const allSelected = colFilter ? vals.every((v) => colFilter.has(v)) : false;
                const someSelected = isActive;

                return (
                  <th
                    key={colIdx}
                    className="border border-border px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{header}</span>
                      <Popover
                        open={openCol === colIdx}
                        onOpenChange={(open) => setOpenCol(open ? colIdx : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className={`h-5 w-5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                            data-testid={`button-col-filter-${colIdx}`}
                          >
                            <Filter className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-52 p-0"
                          align="start"
                          onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                          <div className="p-2 border-b border-border">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                              Filter: {header}
                            </p>
                          </div>
                          <div className="p-2 border-b border-border">
                            <label className="flex items-center gap-2 px-1 py-1 rounded cursor-pointer hover-elevate">
                              <Checkbox
                                checked={allSelected}
                                onCheckedChange={() => toggleAll(colIdx, allSelected)}
                                data-testid={`checkbox-select-all-${colIdx}`}
                              />
                              <span className="text-sm font-medium">Select All</span>
                            </label>
                          </div>
                          <div className="max-h-52 overflow-y-auto p-2 flex flex-col gap-0.5">
                            {vals.map((val) => {
                              const checked = colFilter ? colFilter.has(val) : false;
                              return (
                                <label
                                  key={val}
                                  className="flex items-center gap-2 px-1 py-1 rounded cursor-pointer hover-elevate"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => toggleValue(colIdx, val)}
                                    data-testid={`checkbox-filter-${colIdx}-${val}`}
                                  />
                                  <span className="text-sm truncate" title={val}>
                                    {val}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                          {someSelected && (
                            <div className="p-2 border-t border-border">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="w-full text-xs"
                                onClick={() =>
                                  setFilters((prev) => ({ ...prev, [colIdx]: new Set() }))
                                }
                                data-testid={`button-clear-col-filter-${colIdx}`}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Clear column filter
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="border border-border px-4 py-6 text-center text-muted-foreground text-sm"
                >
                  No rows match the active filters.
                </td>
              </tr>
            ) : (
              visibleRows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover-elevate">
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className="border border-border px-3 py-2 text-foreground whitespace-nowrap"
                      data-testid={`cell-table-${rowIdx}-${cellIdx}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>

          {((hasNumericCol && filteredRows.length > 0) || needsCollapse) && (
            <tfoot>
              {hasNumericCol && filteredRows.length > 0 && (
                <tr className="bg-accent/60 font-semibold">
                  {headers.map((_, colIdx) => {
                    const total = colTotals[colIdx];
                    if (total !== null) {
                      return (
                        <td
                          key={colIdx}
                          className="border border-border px-3 py-2 text-foreground whitespace-nowrap"
                          data-testid={`cell-total-${colIdx}`}
                        >
                          {total}
                        </td>
                      );
                    }
                    return (
                      <td
                        key={colIdx}
                        className="border border-border px-3 py-2 text-foreground whitespace-nowrap"
                        data-testid={`cell-total-label-${colIdx}`}
                      >
                        {colIdx === firstTextColIdx ? "Total" : "—"}
                      </td>
                    );
                  })}
                </tr>
              )}
              {needsCollapse && (
                <tr>
                  <td
                    colSpan={headers.length}
                    className="border-t border-border p-0"
                  >
                    <button
                      onClick={() => setCollapsed((c) => !c)}
                      className="w-full py-2 text-xs text-muted-foreground flex items-center justify-center gap-1 hover-elevate"
                      data-testid="button-expand-collapse-rows"
                    >
                      {collapsed ? (
                        <>Show all {filteredRows.length} rows <ChevronDown className="h-3 w-3" /></>
                      ) : (
                        <>Show less <ChevronUp className="h-3 w-3" /></>
                      )}
                    </button>
                  </td>
                </tr>
              )}
            </tfoot>
          )}
        </table>
      </div>

    </div>
  );
}
