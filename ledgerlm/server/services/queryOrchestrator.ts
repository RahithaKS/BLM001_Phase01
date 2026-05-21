import { googleSearchWorker } from './googleSearch';
import type { DataSource, ChatSource } from '@shared/schema';
import { chatDocuments } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { queryEnhancer } from './queryEnhancer';
import type { QueryType } from './queryEnhancer';
import { storage } from '../storage';
import { decryptValue } from '../utils/encryption';

export interface DocumentEvidence {
  source: 'document';
  sourceId: string;
  documentId: string;
  documentName: string;
  content: string;
  relevanceScore: number;
  chunkIndex?: number;
}

export interface WebEvidence {
  source: 'google_search';
  sourceId: string;
  title: string;
  url: string;
  snippet: string;
  relevanceScore: number;
  timestamp: string;
}

export interface DatabaseEvidence {
  source: 'database';
  sourceId: string;
  databaseName: string;
  query: string;
  results: any[];
  relevanceScore: number;
}

export interface SemanticSQLEvidence {
  source: 'semantic_sql';
  sourceId: string;
  cubeName: string;
  cubeId: string;
  naturalLanguageQuery: string;
  sqlQuery: string;
  results: any[];
  columns: string[];
  rowCount: number;
  relevanceScore: number;
  costCategory?: string;
  year?: number;
  month?: number;
  timeFilterApplied?: string;
  isComparisonData?: boolean;
  comparisonLabel?: string;
  queryNote?: string;
  currency?: string;          // 'usd' or 'inr' — from Python detect_currency()
  calculationType?: string;   // e.g. 'resource_cost', 'ebit', 'gross_margin'
  viewType?: string;          // e.g. 'PS View', 'MS View', 'SX View' — for LLM context
}

export type Evidence = DocumentEvidence | WebEvidence | DatabaseEvidence | SemanticSQLEvidence;

export interface OrchestratorResult {
  evidence: Evidence[];
  sourcesUsed: string[];
  sourcesSucceeded: string[];
  sourcesFailed: string[];
  latencyMs: number;
  queryType?: QueryType;
  enhancedQuery?: string;
}

interface SourceQueryResult {
  source: string;
  success: boolean;
  evidence: Evidence[];
  error?: string;
}

export class QueryOrchestrator {
  async query(params: {
    query: string;
    chatId: string;
    userId: string;
    db: any;
  }): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const { query, chatId, userId, db } = params;

    // Enhance query for better RAG matching
    const enhancement = queryEnhancer.enhance(query);

    const sourcesUsed: string[] = [];
    const sourcesSucceeded: string[] = [];
    const sourcesFailed: string[] = [];

    const enabledSources = await this.getEnabledSources(chatId, userId, db);

    const sourcePromises: Promise<SourceQueryResult>[] = [];

    if (enabledSources.documents) {
      sourcesUsed.push('documents');
      // Use enhanced query for document retrieval
      sourcePromises.push(
        this.queryDocuments(
          enhancement.enhancedQuery,
          chatId,
          userId,
          db,
          enabledSources.enterpriseEnabled,
          enabledSources.companyIds,
          enabledSources.accessibleCubeIds,
          enabledSources.cubeMetadataMap,
          enabledSources.domainAiConfig
        )
      );
    }

    if (enabledSources.googleSearch) {
      sourcesUsed.push('google_search');
      sourcePromises.push(this.queryGoogleSearch(query, db));
    }

    if (enabledSources.databases && enabledSources.databases.length > 0) {
      for (const dbSource of enabledSources.databases) {
        sourcesUsed.push(`database_${dbSource.id}`);
        sourcePromises.push(this.queryDatabase(query, dbSource, db));
      }
    }

    // Query semantic SQL cubes if available
    if (enabledSources.semanticSqlCubes && enabledSources.semanticSqlCubes.length > 0) {
      for (const cube of enabledSources.semanticSqlCubes) {
        sourcesUsed.push(`semantic_sql_${cube.cubeId}`);
        sourcePromises.push(this.querySemanticSQL(query, cube.cubeId, cube.cubeName, cube.domain, enabledSources.domainAiConfig));
      }
    }

    const results = await Promise.allSettled(sourcePromises);

    const allEvidence: Evidence[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const sourceResult = result.value;
        if (sourceResult.success) {
          sourcesSucceeded.push(sourceResult.source);
          allEvidence.push(...sourceResult.evidence);
        } else {
          sourcesFailed.push(sourceResult.source);
          console.error(`Source ${sourceResult.source} failed:`, sourceResult.error);
        }
      } else {
        const sourceName = sourcesUsed[index] || 'unknown';
        sourcesFailed.push(sourceName);
        console.error(`Source ${sourceName} rejected:`, result.reason);
      }
    });

    const latencyMs = Date.now() - startTime;

    return {
      evidence: allEvidence,
      sourcesUsed,
      sourcesSucceeded,
      sourcesFailed,
      latencyMs,
      queryType: enhancement.queryType,
      enhancedQuery: enhancement.enhancedQuery,
    };
  }

  private async getEnabledSources(
    chatId: string,
    userId: string,
    db: any
  ): Promise<{
    documents: boolean;
    googleSearch: boolean;
    databases: DataSource[];
    enterpriseEnabled: boolean;
    companyIds: string[];
    accessibleCubeIds: string[];
    cubeMetadataMap: Record<string, { entities: string[]; metrics: string[]; periods: string[] }>;
    semanticSqlCubes: { cubeId: string; cubeName: string; domain: string }[];
    userEmail: string;
    domainAiConfig: Record<string, string> | null;
  }> {
    try {
      const { chatDocuments, chatSources, dataSources, userSettings, companyMemberships, users, domains, cubes } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const hasDocuments = await db
        .select()
        .from(chatDocuments)
        .where(eq(chatDocuments.chatId, chatId))
        .limit(1);

      const userSettingsRecord = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

      const hasEnterpriseAccess = userSettingsRecord.length > 0 && userSettingsRecord[0].enterpriseEnabled === 1;
      const cubePreferences: Record<string, boolean> = userSettingsRecord.length > 0 && userSettingsRecord[0].cubePreferences 
        ? JSON.parse(userSettingsRecord[0].cubePreferences) 
        : {};

      const userCompanyMemberships = await db
        .select({ companyId: companyMemberships.companyId })
        .from(companyMemberships)
        .where(eq(companyMemberships.userId, userId));

      const companyIds = userCompanyMemberships.map((m: any) => m.companyId);

      // Get user email for cube access lookup
      const userRecord = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      const userEmail = userRecord.length > 0 ? userRecord[0].username : '';

      // Get accessible cube IDs for the user, filtered by their preferences
      let accessibleCubeIds: string[] = [];
      const cubeMetadataMap: Record<string, { entities: string[]; metrics: string[]; periods: string[] }> = {};
      if (hasEnterpriseAccess && userEmail && companyIds.length > 0) {
        // Find user's domain based on company membership
        const allDomains = await storage.getAllDomains();
        const userDomain = allDomains.find(d => companyIds.includes(d.companyId || ''));
        
        if (userDomain) {
          let allAccessibleCubes = await storage.getAccessibleCubeIds(userEmail, userDomain.id);
          
          // Filter by user's cube preferences (if they've set any)
          if (Object.keys(cubePreferences).length > 0) {
            accessibleCubeIds = allAccessibleCubes.filter(cubeId => cubePreferences[cubeId] !== false);
          } else {
            accessibleCubeIds = allAccessibleCubes;
          }
          
          // Fetch cube metadata for all accessible cubes
          for (const cubeId of accessibleCubeIds) {
            const metadata = await storage.getCubeMetadata(cubeId);
            if (metadata) {
              cubeMetadataMap[cubeId] = {
                entities: Array.isArray(metadata.entities) ? metadata.entities : [],
                metrics: Array.isArray(metadata.metrics) ? metadata.metrics : [],
                periods: Array.isArray(metadata.periods) ? metadata.periods : [],
              };
            }
          }
          
          console.log(`🔍 User ${userEmail} has access to ${accessibleCubeIds.length} cubes (${allAccessibleCubes.length} total, filtered by preferences). Metadata loaded for ${Object.keys(cubeMetadataMap).length} cubes.`);
        }
      }

      const chatSourceRecords = await db
        .select({
          source: dataSources,
          enabled: chatSources.enabled,
        })
        .from(chatSources)
        .innerJoin(dataSources, eq(chatSources.sourceId, dataSources.id))
        .where(
          and(
            eq(chatSources.chatId, chatId),
            eq(chatSources.enabled, 1)
          )
        );

      const googleSearchEnabled = chatSourceRecords.some(
        (r: any) => r.source.type === 'google_search'
      );

      const databaseSources = chatSourceRecords
        .filter((r: any) => r.source.type === 'database')
        .map((r: any) => r.source);

      // Get semantic SQL cubes that user has access to (parallelize cube loading)
      // Include domain name for multi-tenant routing (Bosch vs Nemko)
      const semanticSqlCubes: { cubeId: string; cubeName: string; domain: string }[] = [];
      if (hasEnterpriseAccess && accessibleCubeIds.length > 0) {
        // Load cube info with domain name in parallel
        const cubePromises = accessibleCubeIds.map(async (cubeId) => {
          try {
            const cube = await storage.getCube(cubeId);
            if (!cube) return null;
            
            // Get domain name for this cube
            const domainRecord = await db
              .select({ name: domains.name })
              .from(domains)
              .where(eq(domains.id, cube.domainId))
              .limit(1);
            
            const domainName = domainRecord.length > 0 ? domainRecord[0].name : '';
            return { cubeId, cubeName: cube.name || 'Unknown Cube', domain: domainName };
          } catch {
            return null;
          }
        });
        const cubeResults = await Promise.all(cubePromises);
        for (const result of cubeResults) {
          if (result) {
            semanticSqlCubes.push(result);
          }
        }
        if (semanticSqlCubes.length > 0) {
          console.log(`🔍 Semantic SQL enabled for ${semanticSqlCubes.length} cubes:`, semanticSqlCubes.map(c => `${c.cubeName} (${c.domain})`).join(', '));
        }
      }

      // Look up domain AI config for this user (Azure vs Ollama routing)
      let domainAiConfig: Record<string, string> | null = null;
      try {
        const allDomains2 = await storage.getAllDomains();
        const userDomainForAi = allDomains2.find(d => companyIds.includes(d.companyId || ''));
        if (userDomainForAi?.aiProvider === 'azure_openai' && userDomainForAi.aiEndpoint && userDomainForAi.aiApiKey) {
          domainAiConfig = {
            provider: 'azure_openai',
            endpoint: userDomainForAi.aiEndpoint,
            api_key: decryptValue(userDomainForAi.aiApiKey),
            chat_model: userDomainForAi.aiChatModel || '',
            chat_api_version: userDomainForAi.aiChatApiVersion || '2024-12-01-preview',
            embedding_model: userDomainForAi.aiEmbeddingModel || '',
            embedding_api_version: userDomainForAi.aiEmbeddingApiVersion || '2024-02-01',
            system_prompt: userDomainForAi.aiSystemPrompt || '',
          };
          console.log(`[AI Router] RAG will use Azure OpenAI for domain ${userDomainForAi.name} (embedding: ${userDomainForAi.aiEmbeddingModel})`);
        }
      } catch (aiConfigErr) {
        console.warn('[AI Router] Could not load domain AI config for RAG, falling back to Ollama:', aiConfigErr);
      }

      return {
        documents: hasDocuments.length > 0 || hasEnterpriseAccess,
        googleSearch: googleSearchEnabled,
        databases: databaseSources,
        enterpriseEnabled: hasEnterpriseAccess,
        companyIds: companyIds,
        accessibleCubeIds: accessibleCubeIds,
        cubeMetadataMap: cubeMetadataMap,
        semanticSqlCubes: semanticSqlCubes,
        userEmail: userEmail,
        domainAiConfig,
      };
    } catch (error) {
      console.error('Error fetching enabled sources:', error);
      return {
        documents: true,
        googleSearch: false,
        databases: [],
        enterpriseEnabled: false,
        companyIds: [],
        accessibleCubeIds: [],
        cubeMetadataMap: {},
        semanticSqlCubes: [],
        userEmail: '',
        domainAiConfig: null,
      };
    }
  }

  private async queryDocuments(
    query: string,
    chatId: string,
    userId: string,
    db: any,
    enterpriseEnabled: boolean = false,
    companyIds: string[] = [],
    accessibleCubeIds: string[] = [],
    cubeMetadataMap: Record<string, { entities: string[]; metrics: string[]; periods: string[] }> = {},
    domainAiConfig: Record<string, string> | null = null
  ): Promise<SourceQueryResult> {
    try {
      // Get document IDs attached to this chat
      const chatDocs = await db
        .select({ documentId: chatDocuments.documentId })
        .from(chatDocuments)
        .where(eq(chatDocuments.chatId, chatId));

      const documentIds = chatDocs.map((cd: any) => cd.documentId);

      const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
      
      const requestBody: any = {
        query: query,
        user_id: userId,
        document_ids: documentIds,
        top_k: 40,  // Increased from 8 to 40 for comprehensive financial data analysis
      };

      // Always pass domain AI config so Python uses the right embedding model + column
      if (domainAiConfig) {
        requestBody.ai_config = domainAiConfig;
      }

      if (enterpriseEnabled && companyIds.length > 0) {
        requestBody.company_ids = companyIds;
        console.log(`🔍 Enterprise ENABLED - sending company_ids to Python: ${JSON.stringify(companyIds)}`);
        
        // Add cube filtering if user has cube access configured
        if (accessibleCubeIds.length > 0) {
          requestBody.cube_ids = accessibleCubeIds;
          console.log(`🔍 Cube filtering ENABLED - sending ${accessibleCubeIds.length} cube_ids to Python`);
          
          // Add cube metadata to enhance query relevance
          if (Object.keys(cubeMetadataMap).length > 0) {
            requestBody.cube_metadata = cubeMetadataMap;
            const totalEntities = Object.values(cubeMetadataMap).reduce((sum, m) => sum + (m.entities?.length || 0), 0);
            const totalMetrics = Object.values(cubeMetadataMap).reduce((sum, m) => sum + (m.metrics?.length || 0), 0);
            const totalPeriods = Object.values(cubeMetadataMap).reduce((sum, m) => sum + (m.periods?.length || 0), 0);
            console.log(`🔍 Cube metadata included - ${totalEntities} entities, ${totalMetrics} metrics, ${totalPeriods} periods`);
          }
        } else {
          console.log(`🔍 Cube filtering DISABLED - user has no enabled cubes (enterprise data will be blocked)`);
        }
      } else {
        console.log(`🔍 Enterprise DISABLED - no company_ids sent (enterpriseEnabled: ${enterpriseEnabled}, companyIds.length: ${companyIds.length})`);
      }

      console.log(`📤 RAG request for user ${userId}:`, {
        enterpriseEnabled,
        hasCompanyIds: !!requestBody.company_ids,
        companyIdsCount: requestBody.company_ids?.length || 0,
        hasCubeIds: !!requestBody.cube_ids,
        cubeIdsCount: requestBody.cube_ids?.length || 0,
        personalDocsCount: documentIds.length
      });

      const response = await fetch(`${PYTHON_BACKEND_URL}/api/v2/rag/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`RAG query failed: ${response.statusText}`);
      }

      const data = await response.json();
      const chunks = data.chunks || [];

      const evidence: DocumentEvidence[] = chunks.map((chunk: any, index: number) => ({
        source: 'document' as const,
        sourceId: `doc_${chunk.document_id?.substring(0, 12) || index}`,
        documentId: chunk.document_id || '',
        documentName: chunk.document_name || 'Unknown Document',
        content: chunk.text || chunk.chunk_text || '',
        relevanceScore: chunk.similarity_score || (1.0 - index * 0.1),
        chunkIndex: chunk.chunk_index,
      }));

      return {
        source: 'documents',
        success: true,
        evidence,
      };
    } catch (error: any) {
      return {
        source: 'documents',
        success: false,
        evidence: [],
        error: error.message,
      };
    }
  }

  private async queryGoogleSearch(
    query: string,
    db: any
  ): Promise<SourceQueryResult> {
    try {
      const results = await googleSearchWorker.search(query, {
        maxResults: 3,
        useCache: true,
        db,
      });

      const evidence: WebEvidence[] = results.map((result) => ({
        source: 'google_search' as const,
        sourceId: result.sourceId,
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        relevanceScore: result.relevanceScore,
        timestamp: result.timestamp,
      }));

      return {
        source: 'google_search',
        success: true,
        evidence,
      };
    } catch (error: any) {
      return {
        source: 'google_search',
        success: false,
        evidence: [],
        error: error.message,
      };
    }
  }

  private async queryDatabase(
    query: string,
    dbSource: DataSource,
    db: any
  ): Promise<SourceQueryResult> {
    try {
      const evidence: DatabaseEvidence[] = [{
        source: 'database' as const,
        sourceId: dbSource.id,
        databaseName: dbSource.label,
        query: query,
        results: [],
        relevanceScore: 0.5,
      }];

      return {
        source: `database_${dbSource.id}`,
        success: true,
        evidence,
      };
    } catch (error: any) {
      return {
        source: `database_${dbSource.id}`,
        success: false,
        evidence: [],
        error: error.message,
      };
    }
  }

  private async querySemanticSQL(
    query: string,
    cubeId: string,
    cubeName: string,
    domain: string,
    domainAiConfig: Record<string, string> | null = null
  ): Promise<SourceQueryResult> {
    const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
    
    try {
      console.log(`🔍 Semantic SQL query for cube ${cubeName} (${cubeId}) domain ${domain}: "${query}"`);
      
      const intentBody: Record<string, any> = {
        query: query,
        cube_id: cubeId,
        domain: domain,
      };

      if (domainAiConfig) {
        intentBody.ai_config = domainAiConfig;
        console.log(`[AI Router] Semantic SQL intent will use Azure OpenAI for domain ${domain}`);
      }

      const intentResponse = await fetch(`${PYTHON_BACKEND_URL}/api/v2/semantic-sql/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(intentBody),
      });

      if (!intentResponse.ok) {
        if (intentResponse.status === 404) {
          console.log(`ℹ️ Semantic SQL: No fact table for cube ${cubeName} - skipping`);
          return { source: `semantic_sql_${cubeId}`, success: true, evidence: [] };
        }
        const errorText = await intentResponse.text();
        console.log(`⚠️ Semantic SQL intent parse failed for ${cubeName}: ${errorText}`);
        return { source: `semantic_sql_${cubeId}`, success: false, evidence: [], error: `Intent parsing failed: ${intentResponse.statusText}` };
      }

      const intentData = await intentResponse.json();
      
      if (!intentData.success || !intentData.structured_query) {
        console.log(`⚠️ Semantic SQL: No structured query generated for ${cubeName}`);
        return { source: `semantic_sql_${cubeId}`, success: true, evidence: [] };
      }

      const structuredQuery = intentData.structured_query;
      const queryNote: string | undefined = structuredQuery.query_note;
      const detectedViewType: string | undefined = intentData.view_type || undefined;

      // Use the structured query as-is; single-month queries stay single-month.
      // Range queries ("from Jan") are handled by the intent parser via month IN (...).
      const effectiveQuery = structuredQuery;

      const primaryQueryPromise = this.executeSQLQuery(PYTHON_BACKEND_URL, cubeId, effectiveQuery, domain);

      const comparisonQueryPromise = this.executeComparisonQuery(
        PYTHON_BACKEND_URL, cubeId, effectiveQuery, domain, cubeName
      );

      const [primaryResult, comparisonResults] = await Promise.all([primaryQueryPromise, comparisonQueryPromise]);

      if (!primaryResult.success || !primaryResult.results) {
        if (primaryResult.status === 404) {
          console.log(`ℹ️ Semantic SQL: No data found for cube ${cubeName} - skipping`);
          return { source: `semantic_sql_${cubeId}`, success: true, evidence: [] };
        }
        console.log(`⚠️ Semantic SQL: No results for ${cubeName}`);
        return { source: `semantic_sql_${cubeId}`, success: true, evidence: [] };
      }

      console.log(`✅ Semantic SQL returned ${primaryResult.row_count} rows from ${cubeName}`);

      const results = primaryResult.results || [];
      let costCategory: string | undefined;
      if (results.length > 0 && results[0].cost_category) {
        costCategory = results[0].cost_category;
      }

      const year = primaryResult.time_filter?.year;
      const month = primaryResult.time_filter?.month;
      const timeFilterApplied = primaryResult.time_filter?.description;

      const evidence: SemanticSQLEvidence[] = [{
        source: 'semantic_sql' as const,
        sourceId: `semantic_sql_${cubeId}`,
        cubeName: cubeName,
        cubeId: cubeId,
        naturalLanguageQuery: query,
        sqlQuery: primaryResult.sql_query || '',
        results: results,
        columns: primaryResult.columns || [],
        rowCount: primaryResult.row_count || 0,
        relevanceScore: 0.95,
        costCategory: costCategory,
        year: year,
        month: month,
        timeFilterApplied: timeFilterApplied,
        queryNote: queryNote,
        currency: primaryResult.currency || 'usd',
        calculationType: primaryResult.calculation_type || undefined,
        viewType: detectedViewType,
      }];

      // Push one evidence object per comparison period (each has correct month/year metadata).
      // Previously all periods were bundled into one combined SQL → wrong labels + cross-product rows.
      for (const compResult of comparisonResults) {
        if (compResult.results && compResult.results.length > 0) {
          console.log(`📊 Comparison data: ${compResult.results.length} rows for ${compResult.label}`);

          let compCostCategory: string | undefined;
          if (compResult.results[0]?.cost_category) {
            compCostCategory = compResult.results[0].cost_category;
          }

          evidence.push({
            source: 'semantic_sql' as const,
            sourceId: `semantic_sql_${cubeId}_comparison_${compResult.month}_${compResult.year}`,
            cubeName: cubeName,
            cubeId: cubeId,
            naturalLanguageQuery: query,
            sqlQuery: compResult.sql_query || '',
            results: compResult.results,
            columns: compResult.columns || [],
            rowCount: compResult.results.length,
            relevanceScore: 0.85,
            costCategory: compCostCategory || costCategory,
            year: compResult.year,
            month: compResult.month,
            timeFilterApplied: compResult.time_filter?.description,
            isComparisonData: true,
            comparisonLabel: `Comparison Data (${compResult.label})`,
          });
        }
      }

      return {
        source: `semantic_sql_${cubeId}`,
        success: true,
        evidence,
      };
    } catch (error: any) {
      console.error(`Semantic SQL error for cube ${cubeName}:`, error);
      return {
        source: `semantic_sql_${cubeId}`,
        success: false,
        evidence: [],
        error: error.message,
      };
    }
  }

  private async executeSQLQuery(
    backendUrl: string,
    cubeId: string,
    structuredQuery: any,
    domain: string
  ): Promise<any> {
    try {
      const response = await fetch(`${backendUrl}/api/v2/semantic-sql/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cube_id: cubeId, structured_query: structuredQuery, domain }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'no body');
        console.error(`⚠️ SQL query failed (${response.status}): ${errorBody.substring(0, 500)}`);
        return { success: false, status: response.status };
      }

      return await response.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async expandSingleMonthQuery(
    backendUrl: string,
    cubeId: string,
    structuredQuery: any
  ): Promise<any | null> {
    try {
      const filters = structuredQuery.filters || [];
      let queryYear: number | null = null;
      let singleMonth: number | null = null;

      for (const f of filters) {
        const col = (f.column || '').toLowerCase();
        if (col === 'year') {
          queryYear = typeof f.value === 'number' ? f.value : parseInt(f.value);
        } else if (col === 'month') {
          if (!Array.isArray(f.value) && (f.operator === '=' || f.operator === undefined || f.operator === null)) {
            const mv = typeof f.value === 'number' ? f.value : parseInt(f.value);
            if (!isNaN(mv)) singleMonth = mv;
          }
        }
      }

      if (!singleMonth || !queryYear) return null;

      const resp = await fetch(`${backendUrl}/api/v2/semantic-sql/available-periods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cube_id: cubeId }),
      });

      if (!resp.ok) return null;

      const availablePeriods = await resp.json();
      const periodsForYear = (availablePeriods.periods || [])
        .filter((p: any) => {
          const py = typeof p.year === 'number' ? p.year : parseInt(p.year);
          return py === queryYear;
        })
        .map((p: any) => typeof p.month === 'number' ? p.month : parseInt(p.month))
        .sort((a: number, b: number) => a - b);

      if (periodsForYear.length <= 1) return null;

      const newFilters = filters.map((f: any) => {
        const col = (f.column || '').toLowerCase();
        if (col === 'month') {
          return { ...f, value: periodsForYear, operator: 'IN' };
        }
        return f;
      });

      const existingGroupBy = structuredQuery.group_by || ['region_entity'];
      const newGroupBy = [...existingGroupBy];
      if (!newGroupBy.includes('month')) newGroupBy.push('month');

      console.log(`📅 Auto-expanded single-month (${singleMonth}) query to all ${periodsForYear.length} available months: [${periodsForYear.join(', ')}]`);

      return {
        ...structuredQuery,
        filters: newFilters,
        group_by: newGroupBy,
      };
    } catch (error: any) {
      console.log(`📅 Single-month expansion skipped: ${error.message}`);
      return null;
    }
  }

  private async executeComparisonQuery(
    backendUrl: string,
    cubeId: string,
    structuredQuery: any,
    domain: string,
    cubeName: string
  ): Promise<Array<{ success: boolean; results?: any[]; columns?: string[]; sql_query?: string; time_filter?: any; label: string; year: number; month: number }>> {
    try {
      const filters = structuredQuery.filters || [];
      let queryYear: number | null = null;
      let queryMonths: number[] = [];

      for (const f of filters) {
        const col = (f.column || '').toLowerCase();
        if (col === 'year') {
          if (typeof f.value === 'number') {
            queryYear = f.value;
          } else if (Array.isArray(f.value)) {
            queryYear = Math.max(...f.value.map(Number));
          } else {
            queryYear = parseInt(f.value);
          }
        } else if (col === 'month') {
          if (Array.isArray(f.value)) {
            queryMonths = f.value.map((v: any) => typeof v === 'number' ? v : parseInt(v));
          } else if (typeof f.value === 'number' || typeof f.value === 'string') {
            queryMonths = [typeof f.value === 'number' ? f.value : parseInt(f.value as string)];
          }
        }
      }

      if (queryMonths.length === 0 || queryMonths.length > 1) {
        return [];
      }

      if (!queryYear || isNaN(queryYear)) {
        console.log(`📊 Comparison query skipped: year could not be determined from intent filters`);
        return [];
      }

      const availablePeriodsResp = await fetch(`${backendUrl}/api/v2/semantic-sql/available-periods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cube_id: cubeId }),
      });

      if (!availablePeriodsResp.ok) return [];

      const availablePeriods = await availablePeriodsResp.json();
      const availableSet = new Set(
        (availablePeriods.periods || []).map((p: any) => `${p.year}-${p.month}`)
      );

      const comparisonMonths: { year: number; month: number }[] = [];
      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

      for (const qm of queryMonths) {
        const prevMonth = qm === 1 ? 12 : qm - 1;
        const prevYear  = qm === 1 ? queryYear! - 1 : queryYear!;
        if (availableSet.has(`${prevYear}-${prevMonth}`)) {
          comparisonMonths.push({ year: prevYear, month: prevMonth });
        }

        const yoyYear = queryYear! - 1;
        if (availableSet.has(`${yoyYear}-${qm}`)) {
          comparisonMonths.push({ year: yoyYear, month: qm });
        }
      }

      if (comparisonMonths.length === 0) return [];

      const uniquePeriods = Array.from(
        new Map(comparisonMonths.map(p => [`${p.year}-${p.month}`, p])).values()
      ).filter(p => !queryMonths.includes(p.month) || p.year !== queryYear);

      if (uniquePeriods.length === 0) return [];

      // Group_by for comparison: keep original dimensions, strip month/year since each
      // query targets exactly one period — no need to GROUP BY time columns.
      const existingGroupBy = structuredQuery.group_by || ['region_entity'];
      const compGroupBy = existingGroupBy.filter((c: string) => c !== 'month' && c !== 'year');
      if (compGroupBy.length === 0) compGroupBy.push('region_entity');

      // Fire ONE separate query per comparison period instead of a combined IN query.
      // This prevents SQL cross-products (month IN [1,2] AND year IN [2025,2026] → 4 rows
      // instead of the 2 we want) and ensures each evidence has correct month/year metadata.
      const periodQueries = uniquePeriods.map(async (period) => {
        const { year: pYear, month: pMonth } = period;
        const label = `${monthNames[pMonth]} ${pYear}`;

        const compFilters = structuredQuery.filters.map((f: any) => {
          const col = (f.column || '').toLowerCase();
          if (col === 'month') return { ...f, value: pMonth, operator: '=' };
          if (col === 'year')  return { ...f, value: pYear,  operator: '=' };
          return f;
        });

        // Inject year/month if they were absent from the original filters
        if (!compFilters.some((f: any) => (f.column || '').toLowerCase() === 'year')) {
          compFilters.push({ column: 'year', operator: '=', value: pYear });
        }
        if (!compFilters.some((f: any) => (f.column || '').toLowerCase() === 'month')) {
          compFilters.push({ column: 'month', operator: '=', value: pMonth });
        }

        const compQuery = { ...structuredQuery, filters: compFilters, group_by: compGroupBy, original_query: structuredQuery.original_query || '' };

        console.log(`📊 Running comparison query for ${cubeName}: ${label}`);

        try {
          const response = await fetch(`${backendUrl}/api/v2/semantic-sql/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cube_id: cubeId, structured_query: compQuery, domain }),
          });

          if (!response.ok) return null;

          const data = await response.json();
          if (!data.success || !data.results || data.results.length === 0) return null;

          return {
            success: true as const,
            results: data.results,
            columns: data.columns,
            sql_query: data.sql_query,
            time_filter: data.time_filter,
            label,
            year: pYear,
            month: pMonth,
          };
        } catch (err: any) {
          console.log(`📊 Comparison query failed for ${label}: ${err.message}`);
          return null;
        }
      });

      const settled = await Promise.all(periodQueries);
      return settled.filter((r): r is NonNullable<typeof r> => r !== null && r.success === true);

    } catch (error: any) {
      console.log(`📊 Comparison query skipped: ${error.message}`);
      return [];
    }
  }
}

export const queryOrchestrator = new QueryOrchestrator();
