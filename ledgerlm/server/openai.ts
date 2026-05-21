// Use Ollama directly via your custom Nginx proxy
const OLLAMA_BASE = (process.env.OLLAMA_BASE_URL || "https://ollama.ledgerlm.ai").replace(/\/v1\/?$/, "").replace(/\/api\/?$/, "");

export interface DomainAiConfig {
  provider: 'ollama' | 'azure_openai';
  endpoint?: string;     // Azure: base URL e.g. https://xxx.cognitiveservices.azure.com
  apiKey?: string;       // Azure: decrypted key
  chatModel?: string;    // Azure: deployment name e.g. gpt-5.2-chat
  chatApiVersion?: string; // Azure: e.g. 2024-12-01-preview
  systemPrompt?: string; // Optional custom system prompt override
}

export interface FinancialAnalysisRequest {
  query: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  documents?: Array<{ name: string; content?: string }>;
  documentContext?: string;
  multiSourceContext?: string;
  citations?: string[];
  signal?: AbortSignal;
  domainAiConfig?: DomainAiConfig;
}

export async function* streamFinancialAnalysis(
  request: FinancialAnalysisRequest
): AsyncGenerator<string, void, unknown> {
  let systemPrompt = `You are LedgerLM, an expert AI financial analyst assistant. You help users analyze financial data, reports, balance sheets, and provide insights on financial questions. 

Your capabilities include:
- Analyzing financial statements and reports
- Providing insights on profitability, cash flow, and financial health
- Comparing financial metrics and identifying trends
- Explaining complex financial concepts in simple terms
- Offering strategic recommendations based on financial data

Be concise, professional, and provide actionable insights. When analyzing data, provide clear breakdowns and explanations. If you don't have enough information to provide a complete analysis, ask clarifying questions.

## Response Structure

CRITICAL REQUIREMENT: You MUST structure ALL responses using H3 markdown headings (###) for sections. This is MANDATORY for export compatibility and professional formatting.

**REQUIRED FORMAT - Use exactly this:**

### Summary
[Brief overview]

### Key Findings
- **Point 1:** Details
- **Point 2:** Details

### Detailed Analysis
[In-depth analysis]

**FORBIDDEN FORMATS:**
❌ Summary (without ###)
❌ **Summary** (bold without ###)
❌ 1. Summary (numbered)
❌ ## Summary (H2 heading)

**CORRECT FORMAT:**
✓ ### Summary (H3 heading)
✓ ### Key Findings (H3 heading)
✓ ### Detailed Analysis (H3 heading)

REMEMBER: Start EVERY section header with THREE hash marks (###) followed by a space, then the section title. This is non-negotiable for proper document formatting.

## Charts and Visualizations

CRITICAL: When creating charts, you MUST ALWAYS include both "xLabel" and "yLabel" fields in the config. Charts without axis labels are unreadable and useless.

**Required Chart Format:**

\`\`\`chart
{
  "type": "bar",
  "title": "Total Operating Income (MNOK)",
  "data": [
    {"label": "2023", "value": 1207.5},
    {"label": "2024", "value": 1242.4}
  ],
  "config": {
    "xKey": "label",
    "yKey": "value",
    "xLabel": "Year",
    "yLabel": "Income (MNOK)",
    "color": "primary"
  }
}
\`\`\`

**MANDATORY Requirements for ALL Charts:**
1. You MUST include "xLabel" in config - describes the X-axis (e.g., "Year", "Quarter", "Month", "Category")
2. You MUST include "yLabel" in config - describes the Y-axis with units (e.g., "Revenue (MNOK)", "Profit (MNOK)", "Percentage (%)", "Count")
3. Do NOT create charts without xLabel and yLabel - they will be rejected
4. Chart types: "bar" for comparisons, "line" for trends, "pie" for composition
5. Always include units in yLabel (MNOK, %, etc.) for clarity

**Example with proper axis labels:**
- xLabel: "Year" → X-axis shows years
- yLabel: "Operating Profit (MNOK)" → Y-axis shows profit values in millions of Norwegian Krone

## Tables

CRITICAL: When creating tables, you MUST use proper markdown table syntax with each row on its OWN line.

**REQUIRED TABLE FORMAT:**

| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Row 1 Data | Row 1 Data | Row 1 Data |
| Row 2 Data | Row 2 Data | Row 2 Data |

**MANDATORY Requirements for ALL Tables:**
1. Each table row MUST be on a separate line
2. Header row must be followed immediately by separator row with dashes
3. Each cell must be separated by single pipe characters (|)
4. Do NOT put multiple rows on a single line
5. Do NOT use code fences (\`\`\`) around tables
6. Do NOT concatenate rows with | | separators

**FORBIDDEN FORMATS:**
❌ | Row 1 | Data | | Row 2 | Data | (multiple rows on one line)
❌ \`\`\`markdown\\n| Header |\\n|--------|\\n\`\`\` (code fenced tables)
❌ Tables without separator row

**CORRECT FORMAT:**
✓ Each row on its own line
✓ Separator row with dashes after header
✓ Clean pipe separation`;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  if (request.conversationHistory) {
    messages.push(...request.conversationHistory);
  }

  let userMessage = request.query;

  // Prepend domain-specific system prompt if configured (e.g. Bosch custom instructions)
  const domainSystemPrefix = request.domainAiConfig?.systemPrompt
    ? `${request.domainAiConfig.systemPrompt}\n\n`
    : '';

  if (request.multiSourceContext) {
    systemPrompt = domainSystemPrefix + request.multiSourceContext;
    messages.unshift({ role: 'system', content: systemPrompt });
  } else {
    systemPrompt = domainSystemPrefix + systemPrompt;
    messages.unshift({ role: 'system', content: systemPrompt });
    
    if (request.documentContext) {
      userMessage = `Based on the following document excerpts, please answer the question.

Document excerpts:
${request.documentContext}

Question: ${request.query}`;
    }
  }

  messages.push({ role: 'user', content: userMessage });

  const aiConfig = request.domainAiConfig;
  const useAzure = aiConfig?.provider === 'azure_openai';

  try {
    if (useAzure && aiConfig?.endpoint && aiConfig?.apiKey && aiConfig?.chatModel) {
      // ── Azure OpenAI path ──────────────────────────────────────────────
      // Azure Cognitive Services endpoint format:
      //   POST {endpoint}/openai/deployments/{deployment}/chat/completions?api-version={version}
      const endpoint = aiConfig.endpoint.replace(/\/$/, '');
      const apiVersion = aiConfig.chatApiVersion || '2024-12-01-preview';
      const url = `${endpoint}/openai/deployments/${aiConfig.chatModel}/chat/completions?api-version=${apiVersion}`;

      console.log(`[Azure OpenAI] Using deployment ${aiConfig.chatModel} at ${endpoint}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': aiConfig.apiKey,
        },
        body: JSON.stringify({
          messages,
          stream: true,
          max_completion_tokens: 4096,
        }),
        signal: request.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Azure OpenAI error: ${response.status} ${response.statusText} — ${errText}`);
      }

      // Azure SSE streaming: data: {"choices":[{"delta":{"content":"..."}}]}
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (request.signal?.aborted) return;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(trimmed.slice(6));
            const content = json.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // malformed SSE line — skip
          }
        }
      }
    } else {
      // ── Ollama / Qwen path (default) ──────────────────────────────────
      // The custom Ollama proxy does not support true streaming — it returns
      // a single complete JSON object regardless of the stream flag.
      // We request stream:false, parse the full response, then simulate
      // streaming for the UI by yielding small word-by-word chunks.
      const response = await fetch(`${OLLAMA_BASE}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.OLLAMA_API_KEY || "ledgerlm-secret-key"
        },
        body: JSON.stringify({
          model: process.env.OLLAMA_CHAT_MODEL || "qwen2.5:32b",
          prompt: messages.map(m => `${m.role}: ${m.content}`).join('\n') + '\nassistant:',
          stream: false,
        }),
        signal: request.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama proxy error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const fullText: string = data.response || '';

      // Simulate streaming by yielding word-by-word so UI stays responsive
      const words = fullText.split(/(\s+)/);
      for (const word of words) {
        if (request.signal?.aborted) return;
        if (word) yield word;
      }
    }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return;
    }
    console.error(`${useAzure ? 'Azure OpenAI' : 'Ollama'} generation error:`, error);
    throw new Error('Failed to generate AI response');
  }
}

export async function generateFinancialAnalysis(
  request: FinancialAnalysisRequest
): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of streamFinancialAnalysis(request)) {
    chunks.push(chunk);
  }
  return chunks.join('');
}
