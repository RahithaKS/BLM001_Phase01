// Query enhancement and type detection for financial analysis

export type QueryType = 'comparison' | 'summary' | 'trend' | 'specific' | 'general';

export interface QueryEnhancementResult {
  originalQuery: string;
  enhancedQuery: string;
  queryType: QueryType;
  financialKeywords: string[];
}

// Financial keyword synonyms for better RAG matching
const FINANCIAL_SYNONYMS: Record<string, string[]> = {
  revenue: ['sales', 'income', 'turnover', 'receipts', 'proceeds'],
  profit: ['earnings', 'margin', 'net income', 'bottom line', 'gain'],
  loss: ['deficit', 'shortfall', 'negative earnings', 'red ink'],
  expenses: ['costs', 'expenditure', 'spending', 'outlay', 'charges'],
  assets: ['holdings', 'resources', 'property', 'capital'],
  liabilities: ['debt', 'obligations', 'payables', 'owing'],
  equity: ['net worth', 'shareholders equity', 'book value'],
  cashflow: ['cash flow', 'liquidity', 'working capital'],
  growth: ['increase', 'expansion', 'rise', 'upturn'],
  decline: ['decrease', 'reduction', 'fall', 'downturn'],
  quarter: ['Q1', 'Q2', 'Q3', 'Q4', 'quarterly'],
  year: ['annual', 'yearly', 'YoY', 'year-over-year'],
  month: ['monthly', 'MoM', 'month-over-month'],
};

// Patterns for detecting query types
const QUERY_TYPE_PATTERNS = {
  comparison: [
    /compar(e|ing|ison)/i,
    /vs\.?|versus/i,
    /difference between/i,
    /how (?:does|do) .* differ/i,
    /contrast/i,
    /against/i,
    /\w+ vs \w+/i,
  ],
  summary: [
    /summari[sz]e/i,
    /overview/i,
    /highlights?/i,
    /key (?:points|findings|takeaways)/i,
    /what (?:are|is) the main/i,
    /give me (?:a|an) (?:brief|quick)/i,
    /tl;?dr/i,
  ],
  trend: [
    /trend/i,
    /over time/i,
    /historical/i,
    /change(?:s|d)? (?:over|across|through)/i,
    /trajectory/i,
    /evolution/i,
    /how .* (?:changed|evolved|grown|declined)/i,
  ],
  specific: [
    /what (?:is|was|were)/i,
    /how (?:much|many)/i,
    /when (?:did|was)/i,
    /which/i,
    /who/i,
    /show me (?:the)? (?:exact|specific)/i,
  ],
};

export class QueryEnhancer {
  /**
   * Detect the type of query to determine appropriate response format
   */
  detectQueryType(query: string): QueryType {
    const lowerQuery = query.toLowerCase();

    // Check patterns in priority order
    for (const [type, patterns] of Object.entries(QUERY_TYPE_PATTERNS)) {
      if (patterns.some(pattern => pattern.test(lowerQuery))) {
        return type as QueryType;
      }
    }

    return 'general';
  }

  /**
   * Extract financial keywords from the query
   */
  extractFinancialKeywords(query: string): string[] {
    const keywords: string[] = [];
    const lowerQuery = query.toLowerCase();

    for (const [keyword, synonyms] of Object.entries(FINANCIAL_SYNONYMS)) {
      if (lowerQuery.includes(keyword) || synonyms.some(syn => lowerQuery.includes(syn))) {
        keywords.push(keyword);
      }
    }

    return keywords;
  }

  /**
   * Enhance query by adding financial synonyms for better RAG matching
   */
  enhanceQueryWithSynonyms(query: string): string {
    const keywords = this.extractFinancialKeywords(query);
    
    if (keywords.length === 0) {
      return query;
    }

    // Add most relevant synonyms to the query
    const synonymsToAdd: string[] = [];
    
    keywords.forEach(keyword => {
      const synonyms = FINANCIAL_SYNONYMS[keyword] || [];
      // Add top 2 most common synonyms
      synonymsToAdd.push(...synonyms.slice(0, 2));
    });

    if (synonymsToAdd.length === 0) {
      return query;
    }

    // Append synonyms for semantic search expansion
    return `${query} ${synonymsToAdd.join(' ')}`;
  }

  /**
   * Main enhancement function
   */
  enhance(query: string): QueryEnhancementResult {
    const queryType = this.detectQueryType(query);
    const financialKeywords = this.extractFinancialKeywords(query);
    const enhancedQuery = this.enhanceQueryWithSynonyms(query);

    return {
      originalQuery: query,
      enhancedQuery,
      queryType,
      financialKeywords,
    };
  }

  /**
   * Get formatting hints based on query type for the AI
   */
  getFormattingHint(queryType: QueryType): string {
    switch (queryType) {
      case 'comparison':
        return 'This is a comparison query. Use markdown tables to compare data points with clear headers, values, and percentage changes.';
      
      case 'summary':
        return 'This is a summary query. Provide a brief overview with bullet points for key findings. Structure: Summary → Key Findings → Important Metrics.';
      
      case 'trend':
        return 'This is a trend analysis query. Describe the direction of change with specific percentages. Use tables for time-series data when applicable.';
      
      case 'specific':
        return 'This is a specific data query. Provide direct, concise answers with exact numbers and citations.';
      
      default:
        return 'Provide a comprehensive analysis using appropriate formatting (tables for comparisons, bullets for lists, headings for structure).';
    }
  }
}

export const queryEnhancer = new QueryEnhancer();
