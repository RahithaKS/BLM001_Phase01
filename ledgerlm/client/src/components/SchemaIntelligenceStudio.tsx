import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Plus, Trash2, Edit2, Check, X, Lock, Link2 } from 'lucide-react';

// Protected keywords that map to hardcoded fast-paths in semantic_sql_service.py
const PROTECTED_KEYWORDS = new Set([
  'ebit', 'ebit%', 'ebit percentage', 'profit margin',
  'revenue', 'gb revenue', 'entity revenue',
  'summarise', 'summarize', 'summary', 'overview', 'all metrics', 'full p&l', 'complete p&l',
  'vm view', 'ps view', 'xc view', 'ms gb vm', 'gb ps', 'xc cvo',
  'ms view', 'ms delivery', 'ms offshore', 'ms capacity',
  'sx view', 'sx delivery', 'sx sector', 'sx offshore',
  'forecast', 'budget', 'tbp', 'cf02', 'cf05', 'cf09', 'cf11',
  'billing utilization', 'attrition', 'attrition rate', 'attrition pct',
  'pyramid mix', 'price mix', 'offshore capacity', 'outsourcing capacity',
]);

function hasProtectedKeyword(aliases: string): boolean {
  return aliases
    .toLowerCase()
    .split(',')
    .map(s => s.trim())
    .some(k => PROTECTED_KEYWORDS.has(k));
}

interface BusinessTerm {
  id: string;
  termName: string;
  termAliases: string[] | null;
  definition: string;
  sqlFilter: string | null;
  requiredColumns: string[] | null;
  category: string | null;
  priority: number | null;
  isActive: number;
  isSeeded: number;
}

interface CalculationRule {
  id: string;
  calculationName: string;
  calculationAliases: string[] | null;
  description: string;
  formula: string;
  sqlTemplate: string | null;
  formulaType: string | null;
  resultType: string | null;
  requiredColumns: string[] | null;
  defaultFilters: string | null;
  roundingPrecision: number | null;
  isActive: number;
  isSeeded: number;
}

interface FilterRule {
  id: string;
  filterName: string;
  filterAliases: string[] | null;
  description: string;
  sqlPredicate: string;
  targetColumn: string | null;
  isDefault: number;
  isActive: number;
  isSeeded: number;
}

interface QueryPattern {
  id: string;
  patternName: string;
  patternDescription: string;
  triggerPhrases: string[] | null;
  sqlTemplate: string;
  exampleQuestion: string | null;
  category: string | null;
  isActive: number;
  isSeeded: number;
}

interface ColumnValue {
  id: string;
  columnName: string;
  valueName: string;
  valueDescription: string;
  valueAliases: string[] | null;
  usageContext: string | null;
  isActive: number;
}

interface ColumnRelationship {
  id: string;
  fromColumn: string;
  toColumn: string;
  relationshipType: string;
  role: string | null;
  metricName: string | null;
  description: string;
  isActive: number;
}

interface BusinessLogicData {
  terms: BusinessTerm[];
  calculations: CalculationRule[];
  filters: FilterRule[];
  patterns: QueryPattern[];
  columnValues: ColumnValue[];
  relationships: ColumnRelationship[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cubeId: string;
  cubeName: string;
}

function SeededBadge() {
  return (
    <Badge variant="outline" className="text-amber-600 border-amber-400 gap-1 shrink-0 text-xs">
      <Lock className="h-3 w-3" />
      seeded
    </Badge>
  );
}

function KeywordWarning({ aliases }: { aliases: string }) {
  if (!aliases || !hasProtectedKeyword(aliases)) return null;
  return (
    <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
      <AlertCircle className="h-3 w-3 shrink-0" />
      One or more keywords overlap with a system fast-path rule. The system rule takes priority at query time.
    </p>
  );
}

// ── Business Terms Tab ─────────────────────────────────────────────────────

function BusinessTermsTab({ cubeId, data }: { cubeId: string; data: BusinessTerm[] }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ termName: '', termAliases: '', definition: '', sqlFilter: '', category: 'general', priority: '0' });
  const [editForm, setEditForm] = useState<Partial<typeof form> & { id?: string }>({});

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/cubes', cubeId, 'business-logic'] });

  const createMut = useMutation({
    mutationFn: () => apiRequest('POST', `/api/domain-admin/cubes/${cubeId}/business-terms`, {
      termName: form.termName,
      termAliases: form.termAliases.split(',').map(s => s.trim()).filter(Boolean),
      definition: form.definition,
      sqlFilter: form.sqlFilter || null,
      category: form.category,
      priority: parseInt(form.priority) || 0,
    }),
    onSuccess: () => { toast({ title: 'Business term created' }); invalidate(); setShowAdd(false); setForm({ termName: '', termAliases: '', definition: '', sqlFilter: '', category: 'general', priority: '0' }); },
    onError: (e: any) => toast({ title: 'Failed to create term', description: e.message, variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: (payload: any) => apiRequest('PUT', `/api/domain-admin/business-terms/${payload.id}`, payload),
    onSuccess: () => { toast({ title: 'Business term updated' }); invalidate(); setEditingId(null); },
    onError: (e: any) => toast({ title: 'Failed to update term', description: e.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/domain-admin/business-terms/${id}`),
    onSuccess: () => { toast({ title: 'Business term deleted' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Failed to delete term', description: e.message, variant: 'destructive' }),
  });

  const startEdit = (t: BusinessTerm) => {
    setEditingId(t.id);
    setEditForm({ id: t.id, termName: t.termName, termAliases: (t.termAliases || []).join(', '), definition: t.definition, sqlFilter: t.sqlFilter || '', category: t.category || 'general', priority: String(t.priority ?? 0) });
  };

  const saveEdit = () => {
    updateMut.mutate({
      id: editForm.id,
      termName: editForm.termName,
      termAliases: (editForm.termAliases || '').split(',').map(s => s.trim()).filter(Boolean),
      definition: editForm.definition,
      sqlFilter: editForm.sqlFilter || null,
      category: editForm.category,
      priority: parseInt(editForm.priority || '0') || 0,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Maps business terms to SQL filters. Injected as LLM context at query time.</p>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-business-term">
          <Plus className="h-4 w-4 mr-1" /> Add Term
        </Button>
      </div>

      {showAdd && (
        <div className="border rounded-md p-4 bg-muted/30 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Term Name *</Label>
              <Input placeholder="e.g. YTD Revenue" value={form.termName} onChange={e => setForm(f => ({ ...f, termName: e.target.value }))} data-testid="input-term-name" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['general', 'revenue', 'cost', 'capacity', 'utilization', 'headcount'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Keyword Aliases (comma-separated)</Label>
            <Input placeholder="e.g. revenue ytd, year to date revenue" value={form.termAliases} onChange={e => setForm(f => ({ ...f, termAliases: e.target.value }))} data-testid="input-term-aliases" />
            <KeywordWarning aliases={form.termAliases} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Definition *</Label>
            <Textarea placeholder="Human-readable explanation for the AI" value={form.definition} onChange={e => setForm(f => ({ ...f, definition: e.target.value }))} rows={2} data-testid="input-term-definition" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">SQL Filter (WHERE clause)</Label>
            <Input placeholder={`"cost_category" = 'Revenue Summary'`} value={form.sqlFilter} onChange={e => setForm(f => ({ ...f, sqlFilter: e.target.value }))} data-testid="input-term-sql" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createMut.mutate()} disabled={!form.termName || !form.definition || createMut.isPending} data-testid="button-save-term">
              {createMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {data.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No business terms yet. Add one above or use Seed Bosch Logic from the cube list.</p>}
        {data.map(t => (
          <div key={t.id} className="border rounded-md p-3 flex flex-col gap-2" data-testid={`row-term-${t.id}`}>
            {editingId === t.id ? (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input value={editForm.termName || ''} onChange={e => setEditForm(f => ({ ...f, termName: e.target.value }))} placeholder="Term name" />
                  <Select value={editForm.category || 'general'} onValueChange={v => setEditForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['general', 'revenue', 'cost', 'capacity', 'utilization', 'headcount'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Input value={editForm.termAliases || ''} onChange={e => setEditForm(f => ({ ...f, termAliases: e.target.value }))} placeholder="Aliases (comma-separated)" />
                <KeywordWarning aliases={editForm.termAliases || ''} />
                <Textarea value={editForm.definition || ''} onChange={e => setEditForm(f => ({ ...f, definition: e.target.value }))} rows={2} placeholder="Definition" />
                <Input value={editForm.sqlFilter || ''} onChange={e => setEditForm(f => ({ ...f, sqlFilter: e.target.value }))} placeholder="SQL filter" />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                  <Button size="sm" onClick={saveEdit} disabled={updateMut.isPending}><Check className="h-3 w-3 mr-1" /> Save</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{t.termName}</span>
                    {t.isSeeded === 1 && <SeededBadge />}
                    {t.category && <Badge variant="secondary" className="text-xs">{t.category}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.definition}</p>
                  {(t.termAliases || []).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">Aliases: {(t.termAliases || []).join(', ')}</p>
                  )}
                  {t.sqlFilter && (
                    <code className="text-xs bg-muted px-1 rounded mt-0.5 block truncate">{t.sqlFilter}</code>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(t)} data-testid={`button-edit-term-${t.id}`}><Edit2 className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => {
                    const msg = t.isSeeded ? `"${t.termName}" is a seeded rule used by live queries. Delete anyway?` : `Delete "${t.termName}"?`;
                    if (confirm(msg)) deleteMut.mutate(t.id);
                  }} data-testid={`button-delete-term-${t.id}`}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Calculation Rules Tab ─────────────────────────────────────────────────

const SQL_TEMPLATE_PLACEHOLDER = `SELECT {group_by}, SUM(capacity) AS my_metric
FROM cube_fact_data
WHERE cube_id = '{cube_id}'
  AND year = {year}
  AND month = {month}
  {extra_filters}
GROUP BY {group_by}
ORDER BY my_metric DESC`;

const SQL_TEMPLATE_HINT = `Available placeholders:
  {cube_id}        → this cube's ID
  {year}           → query year (e.g. 2025)
  {month}          → query month (e.g. 2)
  {group_by}       → grouping column from query (default: region_entity)
  {extra_filters}  → AND clauses from matched business terms + LLM filters`;

function CalculationsTab({ cubeId, data }: { cubeId: string; data: CalculationRule[] }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [useTemplate, setUseTemplate] = useState(false);
  const [form, setForm] = useState({ calculationName: '', calculationAliases: '', description: '', formula: '', sqlTemplate: '', formulaType: 'ratio', resultType: 'percentage', roundingPrecision: '2' });
  const [editForm, setEditForm] = useState<any>({});
  const [editUseTemplate, setEditUseTemplate] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/cubes', cubeId, 'business-logic'] });

  const createMut = useMutation({
    mutationFn: () => apiRequest('POST', `/api/domain-admin/cubes/${cubeId}/calculation-rules`, {
      calculationName: form.calculationName,
      calculationAliases: form.calculationAliases.split(',').map(s => s.trim()).filter(Boolean),
      description: form.description,
      formula: form.formula || '—',
      sqlTemplate: useTemplate ? form.sqlTemplate : null,
      formulaType: useTemplate ? 'sql_template' : form.formulaType,
      resultType: form.resultType,
      roundingPrecision: parseInt(form.roundingPrecision) || 2,
    }),
    onSuccess: () => {
      toast({ title: 'Calculation created' });
      invalidate();
      setShowAdd(false);
      setUseTemplate(false);
      setForm({ calculationName: '', calculationAliases: '', description: '', formula: '', sqlTemplate: '', formulaType: 'ratio', resultType: 'percentage', roundingPrecision: '2' });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: (payload: any) => apiRequest('PUT', `/api/domain-admin/calculation-rules/${payload.id}`, payload),
    onSuccess: () => { toast({ title: 'Calculation updated' }); invalidate(); setEditingId(null); },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/domain-admin/calculation-rules/${id}`),
    onSuccess: () => { toast({ title: 'Calculation deleted' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Defines SQL for derived metrics. Entries with a Full SQL Template override hardcoded Python builders at query time.</p>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-calculation">
          <Plus className="h-4 w-4 mr-1" /> Add Calculation
        </Button>
      </div>

      {showAdd && (
        <div className="border rounded-md p-4 bg-muted/30 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Name *</Label>
              <Input placeholder="e.g. Billing Utilization" value={form.calculationName} onChange={e => setForm(f => ({ ...f, calculationName: e.target.value }))} data-testid="input-calc-name" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Result Type</Label>
              <Select value={form.resultType} onValueChange={v => setForm(f => ({ ...f, resultType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['percentage', 'currency', 'number', 'fte'].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Keyword Aliases (comma-separated)</Label>
            <Input placeholder="e.g. billing util, utilization rate" value={form.calculationAliases} onChange={e => setForm(f => ({ ...f, calculationAliases: e.target.value }))} data-testid="input-calc-aliases" />
            <KeywordWarning aliases={form.calculationAliases} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Description *</Label>
            <Input placeholder="Human-readable explanation" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} data-testid="input-calc-desc" />
          </div>

          <div className="flex items-center gap-2 pt-1 border-t">
            <button
              type="button"
              role="switch"
              aria-checked={useTemplate}
              onClick={() => setUseTemplate(v => !v)}
              data-testid="toggle-sql-template"
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${useTemplate ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${useTemplate ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
            <Label className="text-xs cursor-pointer" onClick={() => setUseTemplate(v => !v)}>
              Full SQL Template <span className="text-muted-foreground">(overrides hardcoded Python builder)</span>
            </Label>
          </div>

          {useTemplate ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">SQL Template *</Label>
                <span className="text-xs text-muted-foreground font-mono">&#123;cube_id&#125; &#123;year&#125; &#123;month&#125; &#123;group_by&#125; &#123;extra_filters&#125;</span>
              </div>
              <Textarea
                placeholder={SQL_TEMPLATE_PLACEHOLDER}
                value={form.sqlTemplate}
                onChange={e => setForm(f => ({ ...f, sqlTemplate: e.target.value }))}
                rows={8}
                data-testid="input-calc-sql-template"
                className="font-mono text-xs"
              />
              <pre className="text-xs text-muted-foreground bg-muted/50 rounded p-2 whitespace-pre-wrap">{SQL_TEMPLATE_HINT}</pre>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">SQL Formula Expression</Label>
              <Textarea placeholder="SUM(billed_capacity) / NULLIF(SUM(allocated_capacity), 0)" value={form.formula} onChange={e => setForm(f => ({ ...f, formula: e.target.value }))} rows={3} data-testid="input-calc-formula" className="font-mono text-xs" />
              <p className="text-xs text-muted-foreground">Simple expression provided as context to the AI. To run custom SQL directly, enable Full SQL Template above.</p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setUseTemplate(false); }}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => createMut.mutate()}
              disabled={!form.calculationName || !form.description || (useTemplate ? !form.sqlTemplate : !form.formula) || createMut.isPending}
              data-testid="button-save-calculation"
            >
              {createMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {data.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No calculation rules yet.</p>}
        {data.map(c => (
          <div key={c.id} className="border rounded-md p-3 flex flex-col gap-2" data-testid={`row-calc-${c.id}`}>
            {editingId === c.id ? (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input value={editForm.calculationName || ''} onChange={e => setEditForm((f: any) => ({ ...f, calculationName: e.target.value }))} placeholder="Name" />
                  <Select value={editForm.resultType || 'percentage'} onValueChange={v => setEditForm((f: any) => ({ ...f, resultType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['percentage', 'currency', 'number', 'fte'].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Input value={editForm.calculationAliases || ''} onChange={e => setEditForm((f: any) => ({ ...f, calculationAliases: e.target.value }))} placeholder="Aliases (comma-separated)" />
                <KeywordWarning aliases={editForm.calculationAliases || ''} />
                <Input value={editForm.description || ''} onChange={e => setEditForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="Description" />

                <div className="flex items-center gap-2 pt-1 border-t">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={editUseTemplate}
                    onClick={() => setEditUseTemplate(v => !v)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${editUseTemplate ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${editUseTemplate ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                  <Label className="text-xs cursor-pointer" onClick={() => setEditUseTemplate(v => !v)}>Full SQL Template</Label>
                </div>

                {editUseTemplate ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">SQL Template</Label>
                      <span className="text-xs text-muted-foreground font-mono">&#123;cube_id&#125; &#123;year&#125; &#123;month&#125; &#123;group_by&#125; &#123;extra_filters&#125;</span>
                    </div>
                    <Textarea value={editForm.sqlTemplate || ''} onChange={e => setEditForm((f: any) => ({ ...f, sqlTemplate: e.target.value }))} rows={8} placeholder={SQL_TEMPLATE_PLACEHOLDER} className="font-mono text-xs" />
                    <pre className="text-xs text-muted-foreground bg-muted/50 rounded p-2 whitespace-pre-wrap">{SQL_TEMPLATE_HINT}</pre>
                  </div>
                ) : (
                  <Textarea value={editForm.formula || ''} onChange={e => setEditForm((f: any) => ({ ...f, formula: e.target.value }))} rows={3} placeholder="SQL formula expression" className="font-mono text-xs" />
                )}

                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                  <Button size="sm" onClick={() => updateMut.mutate({
                    id: c.id,
                    ...editForm,
                    calculationAliases: (editForm.calculationAliases || '').split(',').map((s: string) => s.trim()).filter(Boolean),
                    sqlTemplate: editUseTemplate ? (editForm.sqlTemplate || null) : null,
                    formulaType: editUseTemplate ? 'sql_template' : (editForm.formulaType || 'ratio'),
                  })} disabled={updateMut.isPending}><Check className="h-3 w-3 mr-1" /> Save</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{c.calculationName}</span>
                    {c.isSeeded === 1 && <SeededBadge />}
                    {c.sqlTemplate && <Badge className="text-xs bg-primary/10 text-primary border-primary/20">SQL Template Active</Badge>}
                    {c.resultType && !c.sqlTemplate && <Badge variant="secondary" className="text-xs">{c.resultType}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                  {(c.calculationAliases || []).length > 0 && <p className="text-xs text-muted-foreground">Aliases: {(c.calculationAliases || []).join(', ')}</p>}
                  {c.sqlTemplate
                    ? <code className="text-xs bg-muted px-1 rounded mt-0.5 block truncate text-primary">Template: {c.sqlTemplate.split('\n')[0]}…</code>
                    : <code className="text-xs bg-muted px-1 rounded mt-0.5 block truncate">{c.formula}</code>
                  }
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => {
                    setEditingId(c.id);
                    setEditUseTemplate(!!c.sqlTemplate);
                    setEditForm({ ...c, calculationAliases: (c.calculationAliases || []).join(', ') });
                  }} data-testid={`button-edit-calc-${c.id}`}><Edit2 className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(c.isSeeded ? `Seeded rule — delete "${c.calculationName}" anyway?` : `Delete "${c.calculationName}"?`)) deleteMut.mutate(c.id); }} data-testid={`button-delete-calc-${c.id}`}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Filter Rules Tab ───────────────────────────────────────────────────────

function FilterRulesTab({ cubeId, data }: { cubeId: string; data: FilterRule[] }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ filterName: '', filterAliases: '', description: '', sqlPredicate: '', targetColumn: '' });
  const [editForm, setEditForm] = useState<any>({});

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/cubes', cubeId, 'business-logic'] });

  const createMut = useMutation({
    mutationFn: () => apiRequest('POST', `/api/domain-admin/cubes/${cubeId}/filter-rules`, {
      filterName: form.filterName,
      filterAliases: form.filterAliases.split(',').map(s => s.trim()).filter(Boolean),
      description: form.description,
      sqlPredicate: form.sqlPredicate,
      targetColumn: form.targetColumn || null,
    }),
    onSuccess: () => { toast({ title: 'Filter rule created' }); invalidate(); setShowAdd(false); setForm({ filterName: '', filterAliases: '', description: '', sqlPredicate: '', targetColumn: '' }); },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: (payload: any) => apiRequest('PUT', `/api/domain-admin/filter-rules/${payload.id}`, payload),
    onSuccess: () => { toast({ title: 'Filter rule updated' }); invalidate(); setEditingId(null); },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/domain-admin/filter-rules/${id}`),
    onSuccess: () => { toast({ title: 'Filter rule deleted' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Maps semantic labels to SQL WHERE predicates. e.g. "MS View" → sector IN ('BBM').</p>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-filter">
          <Plus className="h-4 w-4 mr-1" /> Add Filter
        </Button>
      </div>

      {showAdd && (
        <div className="border rounded-md p-4 bg-muted/30 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Filter Name *</Label>
              <Input placeholder="e.g. MS View" value={form.filterName} onChange={e => setForm(f => ({ ...f, filterName: e.target.value }))} data-testid="input-filter-name" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Target Column</Label>
              <Input placeholder="e.g. sector" value={form.targetColumn} onChange={e => setForm(f => ({ ...f, targetColumn: e.target.value }))} data-testid="input-filter-target" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Aliases (comma-separated)</Label>
            <Input placeholder="e.g. ms, managed services" value={form.filterAliases} onChange={e => setForm(f => ({ ...f, filterAliases: e.target.value }))} data-testid="input-filter-aliases" />
            <KeywordWarning aliases={form.filterAliases} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Description *</Label>
            <Input placeholder="What this filter does" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} data-testid="input-filter-desc" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">SQL Predicate *</Label>
            <Textarea placeholder={`TRIM(sector) IN ('BBM')`} value={form.sqlPredicate} onChange={e => setForm(f => ({ ...f, sqlPredicate: e.target.value }))} rows={2} data-testid="input-filter-sql" className="font-mono text-xs" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createMut.mutate()} disabled={!form.filterName || !form.description || !form.sqlPredicate || createMut.isPending} data-testid="button-save-filter">
              {createMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {data.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No filter rules yet.</p>}
        {data.map(f => (
          <div key={f.id} className="border rounded-md p-3 flex flex-col gap-2" data-testid={`row-filter-${f.id}`}>
            {editingId === f.id ? (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input value={editForm.filterName || ''} onChange={e => setEditForm((ef: any) => ({ ...ef, filterName: e.target.value }))} placeholder="Name" />
                  <Input value={editForm.targetColumn || ''} onChange={e => setEditForm((ef: any) => ({ ...ef, targetColumn: e.target.value }))} placeholder="Target column" />
                </div>
                <Input value={editForm.filterAliases || ''} onChange={e => setEditForm((ef: any) => ({ ...ef, filterAliases: e.target.value }))} placeholder="Aliases" />
                <Input value={editForm.description || ''} onChange={e => setEditForm((ef: any) => ({ ...ef, description: e.target.value }))} placeholder="Description" />
                <Textarea value={editForm.sqlPredicate || ''} onChange={e => setEditForm((ef: any) => ({ ...ef, sqlPredicate: e.target.value }))} rows={2} placeholder="SQL predicate" className="font-mono text-xs" />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                  <Button size="sm" onClick={() => updateMut.mutate({ id: f.id, ...editForm, filterAliases: (editForm.filterAliases || '').split(',').map((s: string) => s.trim()).filter(Boolean) })} disabled={updateMut.isPending}><Check className="h-3 w-3 mr-1" /> Save</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{f.filterName}</span>
                    {f.isSeeded === 1 && <SeededBadge />}
                    {f.isDefault === 1 && <Badge variant="secondary" className="text-xs">default</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                  {(f.filterAliases || []).length > 0 && <p className="text-xs text-muted-foreground">Aliases: {(f.filterAliases || []).join(', ')}</p>}
                  <code className="text-xs bg-muted px-1 rounded mt-0.5 block truncate">{f.sqlPredicate}</code>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => { setEditingId(f.id); setEditForm({ ...f, filterAliases: (f.filterAliases || []).join(', ') }); }} data-testid={`button-edit-filter-${f.id}`}><Edit2 className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(f.isSeeded ? `Seeded rule — delete "${f.filterName}" anyway?` : `Delete "${f.filterName}"?`)) deleteMut.mutate(f.id); }} data-testid={`button-delete-filter-${f.id}`}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Query Patterns Tab ─────────────────────────────────────────────────────

function QueryPatternsTab({ cubeId, data }: { cubeId: string; data: QueryPattern[] }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ patternName: '', patternDescription: '', triggerPhrases: '', sqlTemplate: '', exampleQuestion: '', category: 'general' });
  const [editForm, setEditForm] = useState<any>({});

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/cubes', cubeId, 'business-logic'] });

  const createMut = useMutation({
    mutationFn: () => apiRequest('POST', `/api/domain-admin/cubes/${cubeId}/query-patterns`, {
      patternName: form.patternName,
      patternDescription: form.patternDescription,
      triggerPhrases: form.triggerPhrases.split(',').map(s => s.trim()).filter(Boolean),
      sqlTemplate: form.sqlTemplate,
      exampleQuestion: form.exampleQuestion || null,
      category: form.category,
    }),
    onSuccess: () => { toast({ title: 'Query pattern created' }); invalidate(); setShowAdd(false); setForm({ patternName: '', patternDescription: '', triggerPhrases: '', sqlTemplate: '', exampleQuestion: '', category: 'general' }); },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: (payload: any) => apiRequest('PUT', `/api/domain-admin/query-patterns/${payload.id}`, payload),
    onSuccess: () => { toast({ title: 'Query pattern updated' }); invalidate(); setEditingId(null); },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/domain-admin/query-patterns/${id}`),
    onSuccess: () => { toast({ title: 'Query pattern deleted' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">SQL templates for common question types. Trigger phrases route the AI to the right template.</p>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-pattern">
          <Plus className="h-4 w-4 mr-1" /> Add Pattern
        </Button>
      </div>

      {showAdd && (
        <div className="border rounded-md p-4 bg-muted/30 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Pattern Name *</Label>
              <Input placeholder="e.g. Month-on-Month Trend" value={form.patternName} onChange={e => setForm(f => ({ ...f, patternName: e.target.value }))} data-testid="input-pattern-name" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['general', 'temporal', 'comparison', 'breakdown', 'trend'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Trigger Phrases (comma-separated) *</Label>
            <Input placeholder="e.g. month on month, MoM, monthly trend" value={form.triggerPhrases} onChange={e => setForm(f => ({ ...f, triggerPhrases: e.target.value }))} data-testid="input-pattern-triggers" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Description *</Label>
            <Input placeholder="When to use this pattern" value={form.patternDescription} onChange={e => setForm(f => ({ ...f, patternDescription: e.target.value }))} data-testid="input-pattern-desc" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">SQL Template *</Label>
            <Textarea placeholder="SELECT {{columns}} FROM cube_fact_data WHERE cube_id = '{{cube_id}}' AND {{filters}}" value={form.sqlTemplate} onChange={e => setForm(f => ({ ...f, sqlTemplate: e.target.value }))} rows={3} data-testid="input-pattern-sql" className="font-mono text-xs" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Example Question</Label>
            <Input placeholder="e.g. What is the month-on-month revenue trend?" value={form.exampleQuestion} onChange={e => setForm(f => ({ ...f, exampleQuestion: e.target.value }))} data-testid="input-pattern-example" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createMut.mutate()} disabled={!form.patternName || !form.patternDescription || !form.sqlTemplate || createMut.isPending} data-testid="button-save-pattern">
              {createMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {data.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No query patterns yet.</p>}
        {data.map(p => (
          <div key={p.id} className="border rounded-md p-3 flex flex-col gap-2" data-testid={`row-pattern-${p.id}`}>
            {editingId === p.id ? (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input value={editForm.patternName || ''} onChange={e => setEditForm((ef: any) => ({ ...ef, patternName: e.target.value }))} placeholder="Name" />
                  <Select value={editForm.category || 'general'} onValueChange={v => setEditForm((ef: any) => ({ ...ef, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['general', 'temporal', 'comparison', 'breakdown', 'trend'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Input value={editForm.triggerPhrases || ''} onChange={e => setEditForm((ef: any) => ({ ...ef, triggerPhrases: e.target.value }))} placeholder="Trigger phrases" />
                <Input value={editForm.patternDescription || ''} onChange={e => setEditForm((ef: any) => ({ ...ef, patternDescription: e.target.value }))} placeholder="Description" />
                <Textarea value={editForm.sqlTemplate || ''} onChange={e => setEditForm((ef: any) => ({ ...ef, sqlTemplate: e.target.value }))} rows={3} placeholder="SQL template" className="font-mono text-xs" />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                  <Button size="sm" onClick={() => updateMut.mutate({ id: p.id, ...editForm, triggerPhrases: (editForm.triggerPhrases || '').split(',').map((s: string) => s.trim()).filter(Boolean) })} disabled={updateMut.isPending}><Check className="h-3 w-3 mr-1" /> Save</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{p.patternName}</span>
                    {p.isSeeded === 1 && <SeededBadge />}
                    {p.category && <Badge variant="secondary" className="text-xs">{p.category}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.patternDescription}</p>
                  {(p.triggerPhrases || []).length > 0 && <p className="text-xs text-muted-foreground">Triggers: {(p.triggerPhrases || []).join(', ')}</p>}
                  {p.exampleQuestion && <p className="text-xs text-muted-foreground italic">e.g. "{p.exampleQuestion}"</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => { setEditingId(p.id); setEditForm({ ...p, triggerPhrases: (p.triggerPhrases || []).join(', ') }); }} data-testid={`button-edit-pattern-${p.id}`}><Edit2 className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(p.isSeeded ? `Seeded rule — delete "${p.patternName}" anyway?` : `Delete "${p.patternName}"?`)) deleteMut.mutate(p.id); }} data-testid={`button-delete-pattern-${p.id}`}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Column Values Tab ─────────────────────────────────────────────────────

function ColumnValuesTab({ cubeId, data }: { cubeId: string; data: ColumnValue[] }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ columnName: '', valueName: '', valueDescription: '', valueAliases: '', usageContext: '' });
  const [editForm, setEditForm] = useState<any>({});

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/cubes', cubeId, 'business-logic'] });

  const createMut = useMutation({
    mutationFn: () => apiRequest('POST', `/api/domain-admin/cubes/${cubeId}/column-values`, {
      columnName: form.columnName,
      valueName: form.valueName,
      valueDescription: form.valueDescription,
      valueAliases: form.valueAliases.split(',').map(s => s.trim()).filter(Boolean),
      usageContext: form.usageContext || null,
    }),
    onSuccess: () => { toast({ title: 'Column value created' }); invalidate(); setShowAdd(false); setForm({ columnName: '', valueName: '', valueDescription: '', valueAliases: '', usageContext: '' }); },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: (payload: any) => apiRequest('PUT', `/api/domain-admin/column-values/${payload.id}`, payload),
    onSuccess: () => { toast({ title: 'Column value updated' }); invalidate(); setEditingId(null); },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/domain-admin/column-values/${id}`),
    onSuccess: () => { toast({ title: 'Column value deleted' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const grouped = data.reduce<Record<string, ColumnValue[]>>((acc, v) => {
    if (!acc[v.columnName]) acc[v.columnName] = [];
    acc[v.columnName].push(v);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Explains what specific column values mean. e.g. cost_category "Revenue Summary" → use for revenue queries.</p>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-col-value">
          <Plus className="h-4 w-4 mr-1" /> Add Value
        </Button>
      </div>

      {showAdd && (
        <div className="border rounded-md p-4 bg-muted/30 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Column Name *</Label>
              <Input placeholder="e.g. cost_category" value={form.columnName} onChange={e => setForm(f => ({ ...f, columnName: e.target.value }))} data-testid="input-colval-column" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Value *</Label>
              <Input placeholder="e.g. Revenue Summary" value={form.valueName} onChange={e => setForm(f => ({ ...f, valueName: e.target.value }))} data-testid="input-colval-value" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Description *</Label>
            <Input placeholder="What this value means in business context" value={form.valueDescription} onChange={e => setForm(f => ({ ...f, valueDescription: e.target.value }))} data-testid="input-colval-desc" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Aliases (comma-separated)</Label>
            <Input placeholder="e.g. revenue, rev" value={form.valueAliases} onChange={e => setForm(f => ({ ...f, valueAliases: e.target.value }))} data-testid="input-colval-aliases" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Usage Context</Label>
            <Input placeholder="When to use this value" value={form.usageContext} onChange={e => setForm(f => ({ ...f, usageContext: e.target.value }))} data-testid="input-colval-context" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createMut.mutate()} disabled={!form.columnName || !form.valueName || !form.valueDescription || createMut.isPending} data-testid="button-save-col-value">
              {createMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {Object.keys(grouped).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No column values yet.</p>}
        {Object.entries(grouped).map(([colName, values]) => (
          <div key={colName} className="border rounded-md overflow-hidden">
            <div className="bg-muted/40 px-3 py-2 border-b">
              <span className="font-mono text-sm font-medium">{colName}</span>
              <span className="text-xs text-muted-foreground ml-2">({values.length} values)</span>
            </div>
            {values.map(v => (
              <div key={v.id} className="px-3 py-2 border-b last:border-b-0" data-testid={`row-colval-${v.id}`}>
                {editingId === v.id ? (
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={editForm.columnName || ''} onChange={e => setEditForm((ef: any) => ({ ...ef, columnName: e.target.value }))} placeholder="Column" />
                      <Input value={editForm.valueName || ''} onChange={e => setEditForm((ef: any) => ({ ...ef, valueName: e.target.value }))} placeholder="Value" />
                    </div>
                    <Input value={editForm.valueDescription || ''} onChange={e => setEditForm((ef: any) => ({ ...ef, valueDescription: e.target.value }))} placeholder="Description" />
                    <Input value={editForm.valueAliases || ''} onChange={e => setEditForm((ef: any) => ({ ...ef, valueAliases: e.target.value }))} placeholder="Aliases" />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                      <Button size="sm" onClick={() => updateMut.mutate({ id: v.id, ...editForm, valueAliases: (editForm.valueAliases || '').split(',').map((s: string) => s.trim()).filter(Boolean) })} disabled={updateMut.isPending}><Check className="h-3 w-3 mr-1" /> Save</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">{v.valueName}</span>
                      <p className="text-xs text-muted-foreground">{v.valueDescription}</p>
                      {(v.valueAliases || []).length > 0 && <p className="text-xs text-muted-foreground">Aliases: {(v.valueAliases || []).join(', ')}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => { setEditingId(v.id); setEditForm({ ...v, valueAliases: (v.valueAliases || []).join(', ') }); }} data-testid={`button-edit-colval-${v.id}`}><Edit2 className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete "${v.valueName}"?`)) deleteMut.mutate(v.id); }} data-testid={`button-delete-colval-${v.id}`}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Column Relationships Tab ───────────────────────────────────────────────

const RELATIONSHIP_TYPES = ['formula_component', 'filter_dimension', 'hierarchy', 'aggregation_base'];
const ROLES = ['numerator', 'denominator', 'filter', 'groupby', 'addend', 'subtractor'];

function ColumnRelationshipsTab({ cubeId, data }: { cubeId: string; data: ColumnRelationship[] }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ fromColumn: '', toColumn: '', relationshipType: 'formula_component', role: 'numerator', metricName: '', description: '' });
  const [editForm, setEditForm] = useState<any>({});

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/cubes', cubeId, 'business-logic'] });

  const createMut = useMutation({
    mutationFn: () => apiRequest('POST', `/api/domain-admin/cubes/${cubeId}/column-relationships`, {
      fromColumn: form.fromColumn,
      toColumn: form.toColumn,
      relationshipType: form.relationshipType,
      role: form.role || null,
      metricName: form.metricName || null,
      description: form.description,
    }),
    onSuccess: () => { toast({ title: 'Relationship created' }); invalidate(); setShowAdd(false); setForm({ fromColumn: '', toColumn: '', relationshipType: 'formula_component', role: 'numerator', metricName: '', description: '' }); },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: (payload: any) => apiRequest('PUT', `/api/domain-admin/column-relationships/${payload.id}`, payload),
    onSuccess: () => { toast({ title: 'Relationship updated' }); invalidate(); setEditingId(null); },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/domain-admin/column-relationships/${id}`),
    onSuccess: () => { toast({ title: 'Relationship deleted' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Maps how columns connect to form metrics. Included in LLM context to improve formula understanding.</p>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-relationship">
          <Plus className="h-4 w-4 mr-1" /> Add Relationship
        </Button>
      </div>

      {showAdd && (
        <div className="border rounded-md p-4 bg-muted/30 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">From Column *</Label>
              <Input placeholder="e.g. billed_capacity" value={form.fromColumn} onChange={e => setForm(f => ({ ...f, fromColumn: e.target.value }))} data-testid="input-rel-from" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">To Column *</Label>
              <Input placeholder="e.g. allocated_capacity" value={form.toColumn} onChange={e => setForm(f => ({ ...f, toColumn: e.target.value }))} data-testid="input-rel-to" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Relationship Type *</Label>
              <Select value={form.relationshipType} onValueChange={v => setForm(f => ({ ...f, relationshipType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Metric Name</Label>
              <Input placeholder="e.g. Billing Utilization" value={form.metricName} onChange={e => setForm(f => ({ ...f, metricName: e.target.value }))} data-testid="input-rel-metric" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Description *</Label>
            <Input placeholder="e.g. billed_capacity is the numerator of Billing Utilization" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} data-testid="input-rel-desc" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createMut.mutate()} disabled={!form.fromColumn || !form.toColumn || !form.relationshipType || !form.description || createMut.isPending} data-testid="button-save-relationship">
              {createMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {data.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No column relationships yet. Add them to help the AI understand how columns combine to form metrics.</p>}
        {data.map(r => (
          <div key={r.id} className="border rounded-md p-3 flex flex-col gap-2" data-testid={`row-rel-${r.id}`}>
            {editingId === r.id ? (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input value={editForm.fromColumn || ''} onChange={e => setEditForm((ef: any) => ({ ...ef, fromColumn: e.target.value }))} placeholder="From column" />
                  <Input value={editForm.toColumn || ''} onChange={e => setEditForm((ef: any) => ({ ...ef, toColumn: e.target.value }))} placeholder="To column" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={editForm.relationshipType || 'formula_component'} onValueChange={v => setEditForm((ef: any) => ({ ...ef, relationshipType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RELATIONSHIP_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={editForm.role || 'numerator'} onValueChange={v => setEditForm((ef: any) => ({ ...ef, role: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input value={editForm.metricName || ''} onChange={e => setEditForm((ef: any) => ({ ...ef, metricName: e.target.value }))} placeholder="Metric name" />
                </div>
                <Input value={editForm.description || ''} onChange={e => setEditForm((ef: any) => ({ ...ef, description: e.target.value }))} placeholder="Description" />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                  <Button size="sm" onClick={() => updateMut.mutate({ id: r.id, ...editForm })} disabled={updateMut.isPending}><Check className="h-3 w-3 mr-1" /> Save</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{r.fromColumn}</span>
                    <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{r.toColumn}</span>
                    {r.role && <Badge variant="outline" className="text-xs">{r.role}</Badge>}
                    {r.metricName && <span className="text-xs text-muted-foreground">→ {r.metricName}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                  <Badge variant="secondary" className="text-xs mt-1">{r.relationshipType}</Badge>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => { setEditingId(r.id); setEditForm({ ...r }); }} data-testid={`button-edit-rel-${r.id}`}><Edit2 className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete this relationship?`)) deleteMut.mutate(r.id); }} data-testid={`button-delete-rel-${r.id}`}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function SchemaIntelligenceStudio({ open, onOpenChange, cubeId, cubeName }: Props) {
  const { data, isLoading } = useQuery<BusinessLogicData>({
    queryKey: ['/api/domain-admin/cubes', cubeId, 'business-logic'],
    queryFn: async () => {
      const res = await fetch(`/api/domain-admin/cubes/${cubeId}/business-logic`, {
        credentials: 'include',
        headers: { 'x-user-id': localStorage.getItem('userId') || '' },
      });
      if (!res.ok) throw new Error('Failed to fetch business logic');
      return res.json();
    },
    enabled: open && !!cubeId,
  });

  const terms = data?.terms || [];
  const calculations = data?.calculations || [];
  const filters = data?.filters || [];
  const patterns = data?.patterns || [];
  const columnValues = data?.columnValues || [];
  const relationships = data?.relationships || [];

  const tabCounts: Record<string, number> = {
    terms: terms.length,
    calculations: calculations.length,
    filters: filters.length,
    patterns: patterns.length,
    values: columnValues.length,
    relationships: relationships.length,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full max-h-[88vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle>Schema Intelligence Studio</DialogTitle>
          <DialogDescription>
            Manage the AI knowledge base for <strong>{cubeName}</strong>. Changes take effect on the next query.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading…</div>
        ) : (
          <Tabs defaultValue="terms" className="flex flex-col flex-1 min-h-0">
            <TabsList className="mx-6 mt-3 mb-0 shrink-0 justify-start gap-1 h-auto flex-wrap bg-transparent border-b rounded-none pb-0">
              {[
                { key: 'terms', label: 'Business Terms' },
                { key: 'calculations', label: 'Calculations' },
                { key: 'filters', label: 'Filter Rules' },
                { key: 'patterns', label: 'Query Patterns' },
                { key: 'values', label: 'Column Values' },
                { key: 'relationships', label: 'Relationships' },
              ].map(tab => (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-1.5 text-sm"
                  data-testid={`tab-${tab.key}`}
                >
                  {tab.label}
                  {tabCounts[tab.key] > 0 && (
                    <span className="text-xs bg-muted px-1.5 rounded-full">{tabCounts[tab.key]}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                <TabsContent value="terms" className="mt-0">
                  <BusinessTermsTab cubeId={cubeId} data={terms} />
                </TabsContent>
                <TabsContent value="calculations" className="mt-0">
                  <CalculationsTab cubeId={cubeId} data={calculations} />
                </TabsContent>
                <TabsContent value="filters" className="mt-0">
                  <FilterRulesTab cubeId={cubeId} data={filters} />
                </TabsContent>
                <TabsContent value="patterns" className="mt-0">
                  <QueryPatternsTab cubeId={cubeId} data={patterns} />
                </TabsContent>
                <TabsContent value="values" className="mt-0">
                  <ColumnValuesTab cubeId={cubeId} data={columnValues} />
                </TabsContent>
                <TabsContent value="relationships" className="mt-0">
                  <ColumnRelationshipsTab cubeId={cubeId} data={relationships} />
                </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
