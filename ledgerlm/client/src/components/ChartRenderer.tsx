import { useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  LabelList,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Download, FileSpreadsheet, ArrowLeftRight, ArrowUpDown, Lock } from 'lucide-react';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import type { ChartSpec } from '@/lib/chartParser';

interface ChartRendererProps {
  spec: ChartSpec;
}

const CHART_COLORS = {
  primary: 'hsl(var(--primary))',
  secondary: 'hsl(var(--secondary))',
  accent: 'hsl(var(--accent))',
  muted: 'hsl(var(--muted))',
};

const SERIES_COLORS = [
  '#0ea5e9',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#6366f1',
  '#f97316',
  '#14b8a6',
];

const PIE_COLORS = [
  '#0ea5e9',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#6366f1',
  '#f97316',
  '#14b8a6',
];

function formatYTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(parseFloat(value.toFixed(2)));
}

/**
 * Computes a tight Y-axis domain for line charts so that small trends
 * are visible even when values are clustered near a high baseline.
 * Returns undefined (Recharts default [0, auto]) when:
 *  - any value is 0 or negative (the chart should anchor at 0)
 *  - no numeric values are found
 */
function computeLineDomain(
  data: Array<Record<string, string | number>>,
  keys: string | string[],
): [number, number] | undefined {
  const keyList = Array.isArray(keys) ? keys : [keys];
  const nums: number[] = [];
  for (const row of data) {
    for (const k of keyList) {
      const v = row[k];
      if (typeof v === 'number' && isFinite(v)) nums.push(v);
      else if (typeof v === 'string') {
        const n = parseFloat(v);
        if (isFinite(n)) nums.push(n);
      }
    }
  }
  if (nums.length === 0) return undefined;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min <= 0) return undefined; // anchor at 0 when data touches/crosses it
  return [
    parseFloat((min * 0.97).toFixed(4)),
    parseFloat((max * 1.03).toFixed(4)),
  ];
}

function downloadXLSX(data: Array<Record<string, string | number>>, title: string) {
  if (!data.length) return;
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Chart Data');
  const fileName = `${(title || 'chart_data').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function downloadCSV(data: Array<Record<string, string | number>>, title: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const escape = (v: string) =>
    v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
  const rows = data.map((row) => headers.map((h) => escape(String(row[h] ?? ''))));
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(title || 'chart_data').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Transpose spec.data matrix: entities become X rows, original X values become series columns
function pivotData(
  data: Array<Record<string, string | number>>,
  entities: string[],
  xKey: string,
): { rows: Array<Record<string, string | number>>; newSeries: string[] } {
  const xValues = data.map((row) => String(row[xKey] ?? ''));
  const rows = entities.map((entity) => {
    const row: Record<string, string | number> = { label: entity };
    data.forEach((origRow) => {
      const xVal = String(origRow[xKey] ?? '');
      row[xVal] =
        typeof origRow[entity] === 'number'
          ? (origRow[entity] as number)
          : parseFloat(String(origRow[entity] ?? 0)) || 0;
    });
    return row;
  });
  return { rows, newSeries: xValues };
}

function waitFrames() {
  return new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

// Bottom download footer — matches the table's "Download" button style
function ChartFooter({
  isDownloading,
  onImageDownload,
  onXlsxDownload,
  onCsvDownload,
}: {
  isDownloading: boolean;
  onImageDownload: () => void;
  onXlsxDownload: () => void;
  onCsvDownload: () => void;
}) {
  const [dataFormat, setDataFormat] = useState<'xlsx' | 'csv'>('xlsx');

  if (isDownloading) return null;

  const handleDataDownload = () => {
    if (dataFormat === 'xlsx') onXlsxDownload();
    else onCsvDownload();
  };

  return (
    <div className="flex items-center justify-end mt-2 pt-2 border-t border-border">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs px-2 text-muted-foreground"
            data-testid="button-chart-download-menu"
          >
            <Download className="h-3 w-3 mr-1" />
            Download
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="end" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Image row — plain button, same structure as Data row */}
          <button
            onClick={onImageDownload}
            className="flex items-center w-full text-xs px-3 py-1.5 rounded-sm hover-elevate"
            data-testid="button-download-chart-image"
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            <span className="ml-2 w-10 shrink-0 text-left">Image</span>
            <span className="text-muted-foreground">(.png)</span>
          </button>

          {/* Data row — identical layout; icon | fixed-label | format selector */}
          <div className="flex items-center w-full text-xs rounded-sm hover-elevate pr-1">
            <button
              onClick={handleDataDownload}
              className="flex items-center flex-1 px-3 py-1.5"
              data-testid="button-download-chart-data"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
              <span className="ml-2 w-10 shrink-0 text-left">Data</span>
            </button>
            <Select
              value={dataFormat}
              onValueChange={(v) => setDataFormat(v as 'xlsx' | 'csv')}
            >
              <SelectTrigger
                className="h-7 w-[68px] text-xs border-0 border-none bg-transparent shadow-none ring-0 focus:ring-0 focus-visible:ring-0 outline-none p-0 gap-1 text-muted-foreground"
                data-testid="select-chart-data-format"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="xlsx">.xlsx</SelectItem>
                <SelectItem value="csv">.csv</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// External colour legend (below chart, never overlaps X-axis)
function ExternalLegend({
  items,
  selected,
  onSelect,
  barMarginLeft = 0,
  barMarginRight = 0,
}: {
  items: { key: string; color: string }[];
  selected: string;
  onSelect?: (key: string) => void;
  barMarginLeft?: number;
  barMarginRight?: number;
}) {
  return (
    <div
      className="flex flex-wrap gap-x-4 gap-y-1 mt-3 justify-center"
      style={{ marginLeft: barMarginLeft, marginRight: barMarginRight }}
    >
      {items.map(({ key, color }) => (
        <button
          key={key}
          onClick={() => onSelect?.(key)}
          className={`flex items-center gap-1.5 text-xs px-1 py-0.5 rounded hover-elevate ${
            onSelect ? 'cursor-pointer' : 'cursor-default'
          } ${selected !== 'all' && selected !== key ? 'opacity-40' : ''}`}
          data-testid={`button-legend-${key}`}
        >
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ background: color }}
          />
          <span className="text-muted-foreground">{key}</span>
        </button>
      ))}
    </div>
  );
}

export function ChartRenderer({ spec }: ChartRendererProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<string>('all');

  // Month dropdown state — only used when spec.config.monthData is present
  const monthDataKeys = spec.config.monthData ? Object.keys(spec.config.monthData) : [];
  const [selectedMonth, setSelectedMonth] = useState<string>(
    monthDataKeys.length > 0 ? monthDataKeys[0] : '',
  );

  // Pivot state — only used by multi-entity bar chart
  const [isPivotOpen, setIsPivotOpen] = useState(false);
  const [isPivoted, setIsPivoted] = useState(false);
  const [pendingSwapped, setPendingSwapped] = useState(false);

  const chartConfig = {
    value: {
      label: spec.config.yKey || 'Value',
      color: CHART_COLORS[spec.config.color as keyof typeof CHART_COLORS] || CHART_COLORS.primary,
    },
  };

  const xKey = spec.config.xKey || 'label';
  const avgLabelLen =
    spec.data.length > 0
      ? spec.data.reduce((sum, d) => sum + String(d[xKey] ?? '').length, 0) / spec.data.length
      : 0;
  const needsRotation = avgLabelLen > 10;

  const handleImageDownload = async () => {
    if (!chartRef.current || isDownloading) return;
    setIsDownloading(true);
    await waitFrames();
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      const link = document.createElement('a');
      link.download = spec.title
        ? `${spec.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`
        : `chart_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Chart image download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleXlsxDownload = () => downloadXLSX(spec.data, spec.title || 'chart_data');
  const handleCsvDownload = () => downloadCSV(spec.data, spec.title || 'chart_data');

  const yAxisLabel = spec.config.yLabel
    ? {
        value: spec.config.yLabel,
        angle: -90,
        position: 'insideLeft' as const,
        offset: 8,
        style: {
          fill: 'hsl(var(--foreground))',
          fontSize: '11px',
          fontWeight: 500,
          textAnchor: 'middle' as const,
        },
      }
    : undefined;

  // ── Multi-entity bar chart (with pivot support) ────────────────────────────
  if (spec.type === 'bar' && spec.config.entities && spec.config.entities.length >= 2) {
    const entities = spec.config.entities;
    const xDimName = spec.config.xLabel || 'X Dimension';
    const measureName = spec.config.yLabel || 'Value';

    // Use month-filtered data when monthData is present and a month is selected
    const baseData = (spec.config.monthData && selectedMonth && spec.config.monthData[selectedMonth])
      ? spec.config.monthData[selectedMonth]
      : spec.data;

    // Compute active data based on pivot state
    const pivoted = isPivoted ? pivotData(baseData, entities, xKey) : null;
    const activeData = pivoted ? pivoted.rows : baseData;
    const activeSeries = pivoted ? pivoted.newSeries : entities;
    const activeXKey = 'label';

    // Rotation check on active data
    const avgActiveLen =
      activeData.length > 0
        ? activeData.reduce((s, d) => s + String(d[activeXKey] ?? '').length, 0) / activeData.length
        : 0;
    const activeNeedsRotation = avgActiveLen > 10;

    // Dropdown options change with pivot
    const dropdownOptions = activeSeries;
    const allLabel = isPivoted ? `All ${xDimName}` : 'All Entities';

    // Config for recharts
    const activeConfig: Record<string, { label: string; color: string }> = {};
    activeSeries.forEach((s, i) => {
      activeConfig[s] = { label: s, color: SERIES_COLORS[i % SERIES_COLORS.length] };
    });

    // Single-filter view data
    const singleFilterData = activeData.map((row) => ({
      label: String(row[activeXKey] ?? '-'),
      value:
        typeof row[selectedEntity] === 'number'
          ? (row[selectedEntity] as number)
          : parseFloat(String(row[selectedEntity] ?? 0)) || 0,
    }));

    const showLabelsAll = activeData.length * activeSeries.length <= 20;
    const showLabelsSingle = activeData.length <= 10;

    const legendItems = activeSeries.map((s, i) => ({
      key: s,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
    }));

    return (
      <Card className="p-4 my-4" ref={chartRef}>
        {/* Header: title + month dropdown + entity dropdown + pivot icon */}
        <div className={`mb-3 ${isDownloading ? 'relative flex items-center' : 'flex items-center gap-2 flex-wrap'}`}>
          {spec.title && (
            <h3 className={`text-base font-semibold text-center ${isDownloading ? 'w-full' : 'flex-1'}`}>{spec.title}</h3>
          )}
          {isDownloading ? (
            <span className="absolute right-0 text-xs font-medium text-muted-foreground">
              {selectedMonth ? selectedMonth : ''}{selectedEntity !== 'all' ? ` · ${selectedEntity}` : ''}
            </span>
          ) : (
            <>
              {/* Month dropdown — only shown when multi-period data is available */}
              {monthDataKeys.length > 1 && (
                <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setSelectedEntity('all'); }}>
                  <SelectTrigger className="w-36 shrink-0" data-testid="select-month-filter">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthDataKeys.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {/* Entity dropdown */}
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger className="w-40 shrink-0" data-testid="select-entity-filter">
                  <SelectValue placeholder={allLabel} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{allLabel}</SelectItem>
                  {dropdownOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          {!isDownloading && (
            <Popover
              open={isPivotOpen}
              onOpenChange={(open) => {
                if (open) setPendingSwapped(isPivoted);
                setIsPivotOpen(open);
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  variant={isPivoted ? 'secondary' : 'ghost'}
                  title="Pivot dimensions"
                  data-testid="button-pivot-open"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="right" align="start" className="w-72 p-4 space-y-3">
                <div className="text-sm font-semibold">Pivot Dimensions</div>
                <p className="text-xs text-muted-foreground">
                  Swap the X axis and filter dropdown to reframe the chart.
                </p>

                {/* X Axis */}
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">X Axis</div>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${
                    !pendingSwapped
                      ? 'border-primary/50 bg-primary/5 text-foreground'
                      : 'border-border bg-muted/30 text-muted-foreground'
                  }`}>
                    <span className="select-none text-muted-foreground">⠿</span>
                    <span>{!pendingSwapped ? xDimName : 'Entity'}</span>
                  </div>
                </div>

                {/* Swap */}
                <div className="flex justify-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPendingSwapped(!pendingSwapped)}
                    data-testid="button-pivot-swap"
                    className="gap-1.5 text-xs"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    Swap
                  </Button>
                </div>

                {/* Page */}
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Page (Filter Dropdown)</div>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${
                    pendingSwapped
                      ? 'border-primary/50 bg-primary/5 text-foreground'
                      : 'border-border bg-muted/30 text-muted-foreground'
                  }`}>
                    <span className="select-none text-muted-foreground">⠿</span>
                    <span>{pendingSwapped ? xDimName : 'Entity'}</span>
                  </div>
                </div>

                {/* Y Axis locked */}
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Y Axis (Measure — fixed)</div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/40 text-sm opacity-60">
                    <Lock className="h-3 w-3 shrink-0" />
                    <span>{measureName}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setPendingSwapped(false);
                      setIsPivoted(false);
                      setIsPivotOpen(false);
                      setSelectedEntity('all');
                    }}
                    data-testid="button-pivot-reset"
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setIsPivoted(pendingSwapped);
                      setIsPivotOpen(false);
                      setSelectedEntity('all');
                    }}
                    data-testid="button-pivot-apply"
                  >
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Chart — no legend inside */}
        {selectedEntity === 'all' ? (
          <ChartContainer
            config={activeConfig}
            className="w-full"
            style={{ height: activeNeedsRotation ? '340px' : '280px' }}
          >
            <BarChart
              data={activeData}
              margin={
                activeNeedsRotation
                  ? { bottom: 70, left: 16, right: 16, top: showLabelsAll ? 20 : 8 }
                  : { bottom: 8, left: 16, right: 16, top: showLabelsAll ? 20 : 8 }
              }
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey={activeXKey}
                interval={0}
                tick={
                  activeNeedsRotation
                    ? { fill: 'hsl(var(--muted-foreground))', fontSize: 11, angle: -35, textAnchor: 'end', dx: -4 }
                    : { fill: 'hsl(var(--muted-foreground))', fontSize: 11 }
                }
              />
              <YAxis
                tickFormatter={formatYTick}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                label={yAxisLabel}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              {activeSeries.map((s, i) => (
                <Bar key={s} dataKey={s} fill={SERIES_COLORS[i % SERIES_COLORS.length]} radius={[4, 4, 0, 0]}>
                  {showLabelsAll && (
                    <LabelList dataKey={s} position="top" formatter={formatYTick} style={{ fontSize: 9, fill: '#666' }} />
                  )}
                </Bar>
              ))}
            </BarChart>
          </ChartContainer>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="w-full"
            style={{ height: activeNeedsRotation ? '340px' : '280px' }}
          >
            <BarChart
              data={singleFilterData}
              margin={
                activeNeedsRotation
                  ? { bottom: 70, left: 16, right: 16, top: showLabelsSingle ? 20 : 8 }
                  : { bottom: 8, left: 16, right: 16, top: showLabelsSingle ? 20 : 8 }
              }
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                interval={0}
                tick={
                  activeNeedsRotation
                    ? { fill: 'hsl(var(--muted-foreground))', fontSize: 11, angle: -35, textAnchor: 'end', dx: -4 }
                    : { fill: 'hsl(var(--muted-foreground))', fontSize: 11 }
                }
              />
              <YAxis
                tickFormatter={formatYTick}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                label={yAxisLabel}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="value"
                fill={SERIES_COLORS[activeSeries.indexOf(selectedEntity) % SERIES_COLORS.length]}
                radius={[4, 4, 0, 0]}
              >
                {showLabelsSingle && (
                  <LabelList dataKey="value" position="top" formatter={formatYTick} style={{ fontSize: 10, fill: '#666' }} />
                )}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}

        {/* External legend — margins match bar area (Y-axis ~60px + left margin 16px) */}
        <ExternalLegend
          items={legendItems}
          selected={selectedEntity}
          onSelect={(key) => setSelectedEntity(selectedEntity === key ? 'all' : key)}
          barMarginLeft={76}
          barMarginRight={16}
        />

        <ChartFooter
          isDownloading={isDownloading}
          onImageDownload={handleImageDownload}
          onXlsxDownload={handleXlsxDownload}
          onCsvDownload={handleCsvDownload}
        />
      </Card>
    );
  }

  // ── Period grouped-bar chart (2–4 periods) ─────────────────────────────────
  if (spec.type === 'bar' && spec.config.periods && spec.config.periodMode === 'grouped-bar') {
    const periods = spec.config.periods;
    const avgLbl =
      spec.data.length > 0
        ? spec.data.reduce((s, d) => s + String(d[xKey] ?? '').length, 0) / spec.data.length
        : 0;
    const needsRot = avgLbl > 8;

    const periodCfg: Record<string, { label: string; color: string }> = {};
    periods.forEach((p, i) => {
      periodCfg[p] = { label: p, color: SERIES_COLORS[i % SERIES_COLORS.length] };
    });

    const showPeriodLabels = spec.data.length * periods.length <= 8;
    const periodLegendItems = periods.map((p, i) => ({ key: p, color: SERIES_COLORS[i % SERIES_COLORS.length] }));

    return (
      <Card className="p-4 my-4" ref={chartRef}>
        {spec.title && (
          <h3 className="text-base font-semibold mb-4 text-center">{spec.title}</h3>
        )}
        <ChartContainer
          config={periodCfg}
          className="w-full"
          style={{ height: needsRot ? '340px' : '280px' }}
        >
          <BarChart
            data={spec.data}
            margin={
              needsRot
                ? { bottom: 70, left: 16, right: 16, top: showPeriodLabels ? 20 : 8 }
                : { bottom: 8, left: 16, right: 16, top: showPeriodLabels ? 20 : 8 }
            }
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey={xKey}
              interval={0}
              tick={
                needsRot
                  ? { fill: 'hsl(var(--muted-foreground))', fontSize: 11, angle: -35, textAnchor: 'end', dx: -4 }
                  : { fill: 'hsl(var(--muted-foreground))', fontSize: 11 }
              }
            />
            <YAxis
              tickFormatter={formatYTick}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              label={yAxisLabel}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            {periods.map((p, i) => (
              <Bar key={p} dataKey={p} fill={SERIES_COLORS[i % SERIES_COLORS.length]} radius={[4, 4, 0, 0]}>
                {showPeriodLabels && (
                  <LabelList dataKey={p} position="top" formatter={formatYTick} style={{ fontSize: 9, fill: '#666' }} />
                )}
              </Bar>
            ))}
          </BarChart>
        </ChartContainer>

        <ExternalLegend items={periodLegendItems} selected="all" />

        <ChartFooter
          isDownloading={isDownloading}
          onImageDownload={handleImageDownload}
          onXlsxDownload={handleXlsxDownload}
          onCsvDownload={handleCsvDownload}
        />
      </Card>
    );
  }

  // ── Single-series bar chart ────────────────────────────────────────────────
  if (spec.type === 'bar') {
    // Use month-filtered data when monthData is present
    const singleBaseData =
      spec.config.monthData && selectedMonth && spec.config.monthData[selectedMonth]
        ? spec.config.monthData[selectedMonth]
        : spec.data;

    const showSingleLabels = singleBaseData.length <= 12;

    return (
      <Card className="p-4 my-4" ref={chartRef}>
        {/* Header — shown with month dropdown when multi-period data is available */}
        <div className={`mb-3 ${isDownloading ? 'relative flex items-center' : 'flex items-center gap-2 flex-wrap'}`}>
          {spec.title && (
            <h3 className={`text-base font-semibold text-center ${isDownloading ? 'w-full' : 'flex-1'}`}>
              {spec.title}
            </h3>
          )}
          {isDownloading ? (
            selectedMonth ? (
              <span className="absolute right-0 text-xs font-medium text-muted-foreground">
                {selectedMonth}
              </span>
            ) : null
          ) : (
            monthDataKeys.length > 1 && (
              <Select
                value={selectedMonth}
                onValueChange={setSelectedMonth}
              >
                <SelectTrigger className="w-36 shrink-0" data-testid="select-single-month-filter">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {monthDataKeys.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          )}
        </div>

        <ChartContainer
          config={chartConfig}
          className="w-full"
          style={{ height: needsRotation ? '340px' : '280px' }}
        >
          <BarChart
            data={singleBaseData}
            margin={
              needsRotation
                ? { bottom: 70, left: 16, right: 16, top: showSingleLabels ? 20 : 8 }
                : { bottom: 8, left: 16, right: 16, top: showSingleLabels ? 20 : 8 }
            }
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey={spec.config.xKey || 'label'}
              interval={0}
              tick={
                needsRotation
                  ? { fill: 'hsl(var(--muted-foreground))', fontSize: 11, angle: -35, textAnchor: 'end', dx: -4 }
                  : { fill: 'hsl(var(--muted-foreground))', fontSize: 11 }
              }
            />
            <YAxis
              className="text-xs"
              tickFormatter={formatYTick}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              label={yAxisLabel}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey={spec.config.yKey || 'value'} fill={chartConfig.value.color} radius={[4, 4, 0, 0]}>
              {showSingleLabels && (
                <LabelList
                  dataKey={spec.config.yKey || 'value'}
                  position="top"
                  formatter={formatYTick}
                  style={{ fontSize: 10, fill: '#666' }}
                />
              )}
            </Bar>
          </BarChart>
        </ChartContainer>

        <ChartFooter
          isDownloading={isDownloading}
          onImageDownload={handleImageDownload}
          onXlsxDownload={handleXlsxDownload}
          onCsvDownload={handleCsvDownload}
        />
      </Card>
    );
  }

  // ── Multi-entity line chart (5+ periods, trend) ────────────────────────────
  if (spec.type === 'line' && spec.config.periodMode === 'line' && spec.config.entities) {
    const entities = spec.config.entities;

    const multiLineCfg: Record<string, { label: string; color: string }> = {};
    entities.forEach((ent, i) => {
      multiLineCfg[ent] = { label: ent, color: SERIES_COLORS[i % SERIES_COLORS.length] };
    });

    const lineLegendItems = entities.map((ent, i) => ({ key: ent, color: SERIES_COLORS[i % SERIES_COLORS.length] }));

    // Tight domain: scan only the visible series so the axis zooms to the data
    const multiLineActiveKeys = selectedEntity === 'all' ? entities : [selectedEntity];
    const multiLineDomain = computeLineDomain(spec.data, multiLineActiveKeys);

    return (
      <Card className="p-4 my-4" ref={chartRef}>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {spec.title && (
            <h3 className="text-base font-semibold flex-1 text-center">{spec.title}</h3>
          )}
          {entities.length > 1 && (
            isDownloading ? (
              <span className="text-xs text-muted-foreground shrink-0">
                {selectedEntity === 'all' ? 'All Entities' : selectedEntity}
              </span>
            ) : (
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger className="w-40 shrink-0" data-testid="select-trend-entity-filter">
                  <SelectValue placeholder="All Entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  {entities.map((ent) => (
                    <SelectItem key={ent} value={ent}>{ent}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          )}
        </div>

        <ChartContainer
          config={selectedEntity === 'all' ? multiLineCfg : chartConfig}
          className="h-[280px] w-full"
        >
          <LineChart data={spec.data} margin={{ bottom: 8, left: 16, right: 16, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey={spec.config.xKey || 'label'}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            />
            <YAxis
              tickFormatter={formatYTick}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              label={yAxisLabel}
              {...(multiLineDomain ? { domain: multiLineDomain } : {})}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            {selectedEntity === 'all' ? (
              entities.map((ent, i) => (
                <Line
                  key={ent}
                  type="monotone"
                  dataKey={ent}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={2}
                  dot={{ fill: SERIES_COLORS[i % SERIES_COLORS.length], r: 3 }}
                />
              ))
            ) : (
              <Line
                type="monotone"
                dataKey={selectedEntity}
                stroke={SERIES_COLORS[entities.indexOf(selectedEntity) % SERIES_COLORS.length]}
                strokeWidth={2}
                dot={{ fill: SERIES_COLORS[entities.indexOf(selectedEntity) % SERIES_COLORS.length], r: 4 }}
              />
            )}
          </LineChart>
        </ChartContainer>

        <ExternalLegend
          items={lineLegendItems}
          selected={selectedEntity}
          onSelect={(key) => setSelectedEntity(selectedEntity === key ? 'all' : key)}
        />

        <ChartFooter
          isDownloading={isDownloading}
          onImageDownload={handleImageDownload}
          onXlsxDownload={handleXlsxDownload}
          onCsvDownload={handleCsvDownload}
        />
      </Card>
    );
  }

  // ── Single-series line chart ───────────────────────────────────────────────
  if (spec.type === 'line') {
    const singleLineDomain = computeLineDomain(spec.data, spec.config.yKey || 'value');
    return (
      <Card className="p-4 my-4" ref={chartRef}>
        {spec.title && (
          <h3 className="text-base font-semibold mb-4 text-center">{spec.title}</h3>
        )}
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <LineChart data={spec.data} margin={{ bottom: 8, left: 16, right: 16, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey={spec.config.xKey || 'label'}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            />
            <YAxis
              className="text-xs"
              tickFormatter={formatYTick}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              label={yAxisLabel}
              {...(singleLineDomain ? { domain: singleLineDomain } : {})}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey={spec.config.yKey || 'value'}
              stroke={chartConfig.value.color}
              strokeWidth={2}
              dot={{ fill: chartConfig.value.color, r: 4 }}
            />
          </LineChart>
        </ChartContainer>

        <ChartFooter
          isDownloading={isDownloading}
          onImageDownload={handleImageDownload}
          onXlsxDownload={handleXlsxDownload}
          onCsvDownload={handleCsvDownload}
        />
      </Card>
    );
  }

  // ── Pie chart ─────────────────────────────────────────────────────────────
  if (spec.type === 'pie') {
    return (
      <Card className="p-4 my-4" ref={chartRef}>
        {spec.title && (
          <h3 className="text-base font-semibold mb-4 text-center">{spec.title}</h3>
        )}
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent />} />
            <Pie
              data={spec.data}
              dataKey={spec.config.yKey || 'value'}
              nameKey={spec.config.xKey || 'label'}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={(entry) =>
                `${entry[spec.config.xKey || 'label']}: ${entry[spec.config.yKey || 'value']}`
              }
            >
              {spec.data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        <ChartFooter
          isDownloading={isDownloading}
          onImageDownload={handleImageDownload}
          onXlsxDownload={handleXlsxDownload}
          onCsvDownload={handleCsvDownload}
        />
      </Card>
    );
  }

  return null;
}
