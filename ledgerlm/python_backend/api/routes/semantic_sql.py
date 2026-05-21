"""
Semantic SQL API Routes

Enables natural language queries on large financial Excel files
by parsing intent, generating SQL, and executing against fact tables.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import logging
import tempfile
import shutil

logger = logging.getLogger(__name__)

router = APIRouter()

# Import service
from services.semantic_sql_service import semantic_sql_service, detect_currency, get_currency_label


class SemanticQueryRequest(BaseModel):
    query: str
    cube_id: str
    user_id: str
    cube_metadata: Optional[Dict[str, Any]] = None
    domain: Optional[str] = None  # For multi-tenant routing (e.g., 'nemko.com', 'in.bosch.com')


class QueryIntentResponse(BaseModel):
    success: bool
    intent: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class QueryExecutionResponse(BaseModel):
    success: bool
    results: Optional[List[Dict[str, Any]]] = None
    row_count: Optional[int] = None
    execution_ms: Optional[int] = None
    table: Optional[List[Dict[str, Any]]] = None
    chart: Optional[Dict[str, Any]] = None
    narrative: Optional[str] = None
    generated_sql: Optional[str] = None
    error: Optional[str] = None


class IngestionResponse(BaseModel):
    success: bool
    rows_processed: Optional[int] = None
    rows_inserted: Optional[int] = None
    cost_categories: Optional[List[str]] = None
    dimensions: Optional[Dict[str, List[str]]] = None
    elapsed_seconds: Optional[float] = None
    error: Optional[str] = None


class StructuredQueryRequest(BaseModel):
    cube_id: str
    structured_query: Dict[str, Any]
    domain: Optional[str] = None  # For multi-tenant routing (e.g., 'nemko.com', 'in.bosch.com')


class TimeFilter(BaseModel):
    year: Optional[int] = None
    month: Optional[int] = None
    description: Optional[str] = None


class StructuredQueryResponse(BaseModel):
    success: bool
    results: Optional[List[Dict[str, Any]]] = None
    row_count: Optional[int] = None
    execution_ms: Optional[int] = None
    sql_query: Optional[str] = None
    columns: Optional[List[str]] = None
    narrative: Optional[str] = None
    time_filter: Optional[TimeFilter] = None
    error: Optional[str] = None
    use_rag: Optional[bool] = None  # True if calculation not supported and RAG should be used
    currency: Optional[str] = None          # 'usd' or 'inr' — drives formatter in TypeScript
    calculation_type: Optional[str] = None  # e.g. 'resource_cost', 'ebit', 'gross_margin'
    view_type: Optional[str] = None         # e.g. 'PS View', 'MS View', 'SX View' — for LLM context


def _extract_time_filter(intent: Dict[str, Any]) -> Optional[TimeFilter]:
    """Extract time filter information from intent filters for AI context"""
    month_names = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December']
    
    filters = intent.get('filters', [])
    year = None
    month = None
    
    for f in filters:
        col = f.get('column', '').lower()
        val = f.get('value')
        if col == 'year' and val:
            try:
                if isinstance(val, (int, str)):
                    year = int(val)
                elif isinstance(val, list) and val:
                    year = max(int(v) for v in val)
            except:
                pass
        elif col == 'month':
            if isinstance(val, int):
                month = val
            elif isinstance(val, list) and len(val) == 1:
                try:
                    month = int(val[0])
                except:
                    pass
            elif isinstance(val, list) and len(val) > 1:
                try:
                    months = sorted([int(m) for m in val])
                    month = months  # Keep as list for range
                except:
                    pass
    
    if year or month:
        description = ""
        if isinstance(month, list):
            month_str = f"{month_names[month[0]]} to {month_names[month[-1]]}"
            description = f"{month_str} {year}" if year else month_str
            month = month[0]  # Return first month for single value
        elif month:
            description = f"{month_names[month]} {year}" if year else month_names[month]
        elif year:
            description = str(year)
        
        return TimeFilter(year=year, month=month, description=description)
    
    return None


@router.post("/semantic-sql/query", response_model=StructuredQueryResponse)
async def execute_structured_query(request: StructuredQueryRequest):
    """
    Execute a pre-parsed structured query against cube fact data.
    Called by Node.js query orchestrator after intent parsing.
    
    Also checks plan data (cube_plan_data) if the original query contains plan keywords.
    """
    try:
        logger.info(f"Executing structured query for cube {request.cube_id}")
        
        intent = request.structured_query
        original_query = intent.get('original_query', '')
        
        # Check if this is a plan query and try to get plan data first
        # Pass domain for multi-tenant routing (Bosch vs Nemko)
        plan_detection = semantic_sql_service.detect_plan_type(original_query, request.domain)
        
        plan_results = []
        if plan_detection.get('is_plan_query'):
            logger.info(f"Detected plan query in structured query: {plan_detection}")
            plan_result = semantic_sql_service.execute_plan_query(original_query, request.cube_id)
            if plan_result.get('success') and plan_result.get('results'):
                plan_results = plan_result.get('results', [])
                logger.info(f"Got {len(plan_results)} rows from plan data")
        
        # Pass domain for multi-tenant routing (Bosch vs Nemko calculation layer)
        sql_result = semantic_sql_service.compile_sql(intent, request.cube_id, domain=request.domain)
        
        if not sql_result.get('success'):
            # Check if this is a RAG fallback suggestion (for Nemko domain)
            if sql_result.get('use_rag'):
                return StructuredQueryResponse(
                    success=False,
                    error=sql_result.get('error'),
                    use_rag=True
                )
            return StructuredQueryResponse(
                success=False,
                error=f"Failed to compile SQL: {sql_result.get('error')}"
            )
        
        generated_sql = sql_result['sql']
        params = sql_result['params']
        calc_type = sql_result.get('calculation_type', 'unknown')
        logger.info(
            f"\n{'='*60}\n"
            f"[SQL_EXEC] metric     = {calc_type}\n"
            f"[SQL_EXEC] params     = {params}\n"
            f"[SQL_EXEC] sql        =\n{generated_sql}\n"
            f"{'='*60}"
        )
        
        exec_result = semantic_sql_service.execute_query(
            generated_sql,
            params,
            request.cube_id,
            "orchestrator",
            skip_logging=True
        )
        
        if not exec_result.get('success'):
            return StructuredQueryResponse(
                success=False,
                error=f"Query execution failed: {exec_result.get('error')}"
            )
        
        fact_results = exec_result['results']
        logger.info(
            f"[SQL_RESULT] metric={calc_type} | rows={len(fact_results)} | time={exec_result.get('execution_ms', '?')}ms"
        )
        
        # Combine plan data with fact data if both exist
        combined_results = []
        if plan_results:
            # Add plan results with source marker
            for row in plan_results:
                row_copy = dict(row)
                row_copy['_data_source'] = 'plan'
                combined_results.append(row_copy)
        if fact_results:
            # Add fact results with source marker
            for row in fact_results:
                row_copy = dict(row)
                row_copy['_data_source'] = 'actuals'
                combined_results.append(row_copy)
        
        # Use combined results if we have plan data, otherwise use fact results
        final_results = combined_results if plan_results else fact_results
        
        formatted = semantic_sql_service.format_results(
            final_results,
            intent.get('query_type', 'aggregation')
        )
        
        columns = list(final_results[0].keys()) if final_results else []
        
        # Extract time filter info for AI context
        time_filter = _extract_time_filter(intent)
        
        # Log data source info
        if plan_results and fact_results:
            logger.info(f"Combined results: {len(plan_results)} plan rows + {len(fact_results)} fact rows")
        elif plan_results:
            logger.info(f"Plan data only: {len(plan_results)} rows")
        else:
            logger.info(f"Fact data only: {len(fact_results)} rows")
        
        return StructuredQueryResponse(
            success=True,
            results=final_results,
            row_count=len(final_results),
            execution_ms=exec_result['execution_ms'],
            sql_query=generated_sql,
            columns=columns,
            narrative=formatted.get('narrative'),
            time_filter=time_filter,
            currency=intent.get('currency', 'usd'),
            calculation_type=calc_type
        )
        
    except Exception as e:
        logger.error(f"Structured query execution error: {e}")
        return StructuredQueryResponse(
            success=False,
            error=str(e)
        )


class AvailablePeriodsRequest(BaseModel):
    cube_id: str

@router.post("/semantic-sql/available-periods")
async def get_available_periods(request: AvailablePeriodsRequest):
    try:
        conn = semantic_sql_service.get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT DISTINCT year, month FROM cube_fact_data WHERE cube_id = %s ORDER BY year, month",
            (request.cube_id,)
        )
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        periods = [{"year": r[0], "month": r[1]} for r in rows]
        return {"success": True, "periods": periods}
    except Exception as e:
        logger.error(f"Available periods error: {e}")
        return {"success": False, "periods": [], "error": str(e)}


@router.post("/semantic-sql/query-full", response_model=QueryExecutionResponse)
async def execute_semantic_query(request: SemanticQueryRequest):
    """
    Execute a natural language query against cube financial data
    
    Flow: Query → Rephrase → Time Default → Plan Detection → (Plan Query OR Actuals Query) → Formatting
    
    If query contains plan keywords (budget, forecast, TBP, CF02-CF11),
    routes to cube_plan_data. Otherwise routes to cube_fact_data.
    """
    try:
        original_query = request.query
        processed_query = request.query
        time_context = None
        
        # Step 0a: Rephrase query to fix misspellings and normalize terms
        rephrase_result = semantic_sql_service.rephrase_user_query(request.query, request.cube_id)
        if rephrase_result.get('was_modified'):
            processed_query = rephrase_result.get('rephrased_query', request.query)
            logger.info(f"Query rephrased: '{original_query}' -> '{processed_query}'")
        
        # Step 0b: Inject default time period if not specified (last 3 months)
        time_result = semantic_sql_service.inject_default_time_period(processed_query)
        if not time_result.get('has_time_period'):
            processed_query = time_result.get('query', processed_query)
            time_context = time_result.get('time_context')
            logger.info(f"Added default time period: {time_context}")
        
        logger.info(f"Semantic query: '{processed_query}' for cube {request.cube_id}")
        
        # Step 0c: Check if this is a plan query (Budget/Forecast/CF)
        # Pass domain for multi-tenant routing (Bosch vs Nemko)
        plan_detection = semantic_sql_service.detect_plan_type(processed_query, request.domain)
        
        if plan_detection.get('is_plan_query'):
            logger.info(f"Detected plan query - routing to cube_plan_data: {plan_detection}")
            
            # Execute plan query using the existing method (query, cube_id)
            plan_result = semantic_sql_service.execute_plan_query(
                processed_query,
                request.cube_id
            )
            
            if plan_result.get('success'):
                # Format results for plan data
                results = plan_result.get('results', [])
                formatted = semantic_sql_service.format_results(results, 'plan_data')
                return QueryExecutionResponse(
                    success=True,
                    results=results,
                    row_count=plan_result.get('row_count', 0),
                    execution_ms=0,
                    table=formatted.get('table'),
                    chart=formatted.get('chart'),
                    narrative=f"Plan data from {plan_detection.get('plan_type', 'Plan')}: {plan_result.get('row_count', 0)} records found.{' ' + time_context if time_context else ''}",
                    generated_sql=plan_result.get('sql', '')
                )
            else:
                return QueryExecutionResponse(
                    success=False,
                    error=f"Plan query failed: {plan_result.get('error')}"
                )
        
        # Step 0d: Detect currency preference (INR vs USD, default USD)
        currency = detect_currency(original_query)
        if currency == 'inr':
            logger.info(f"Currency detected: INR (user requested Indian Rupees)")
        
        # Step 1: Parse query intent (for actuals/fact data)
        intent_result = semantic_sql_service.parse_query_intent(
            processed_query, 
            request.cube_id,
            request.cube_metadata
        )
        
        if not intent_result.get('success'):
            return QueryExecutionResponse(
                success=False,
                error=f"Failed to parse query: {intent_result.get('error')}"
            )
        
        intent = intent_result['intent']
        intent['currency'] = currency
        logger.info(f"Parsed intent: {intent}")
        
        # Step 2: Compile to SQL (pass domain for multi-tenant calculation routing)
        sql_result = semantic_sql_service.compile_sql(intent, request.cube_id, domain=request.domain)
        
        if not sql_result.get('success'):
            # For Nemko domain, indicate that RAG should be used instead
            error_msg = sql_result.get('error', 'Failed to compile SQL')
            if sql_result.get('use_rag'):
                error_msg = f"{error_msg} - Please query your uploaded documents directly."
            return QueryExecutionResponse(
                success=False,
                error=error_msg
            )
        
        generated_sql = sql_result['sql']
        params = sql_result['params']
        calc_type = sql_result.get('calculation_type', 'unknown')
        logger.info(
            f"\n{'='*60}\n"
            f"[SQL_EXEC] metric     = {calc_type}\n"
            f"[SQL_EXEC] params     = {params}\n"
            f"[SQL_EXEC] sql        =\n{generated_sql}\n"
            f"{'='*60}"
        )
        
        # Check if cube exists to determine if we should log the query
        cube_exists = semantic_sql_service.validate_cube_exists(request.cube_id)
        
        # Step 3: Execute query (skip logging if cube doesn't exist in cubes table)
        exec_result = semantic_sql_service.execute_query(
            generated_sql,
            params,
            request.cube_id,
            request.user_id,
            skip_logging=not cube_exists
        )
        
        if not exec_result.get('success'):
            return QueryExecutionResponse(
                success=False,
                error=f"Query execution failed: {exec_result.get('error')}"
            )
        
        logger.info(
            f"[SQL_RESULT] metric={calc_type} | rows={exec_result.get('row_count', '?')} | time={exec_result.get('execution_ms', '?')}ms"
        )
        
        # Step 4: Format results
        formatted = semantic_sql_service.format_results(
            exec_result['results'],
            intent.get('query_type', 'aggregation')
        )
        
        # Build narrative with time context if defaults were applied
        narrative = formatted['narrative']
        if time_context:
            narrative = f"{narrative} {time_context}" if narrative else time_context
        
        return QueryExecutionResponse(
            success=True,
            results=exec_result['results'],
            row_count=exec_result['row_count'],
            execution_ms=exec_result['execution_ms'],
            table=formatted['table'],
            chart=formatted['chart'],
            narrative=narrative,
            generated_sql=generated_sql
        )
        
    except Exception as e:
        logger.error(f"Semantic query error: {e}")
        return QueryExecutionResponse(
            success=False,
            error=str(e)
        )


@router.post("/semantic-sql/parse-intent", response_model=QueryIntentResponse)
async def parse_query_intent(request: SemanticQueryRequest):
    """
    Parse a natural language query into structured intent (for debugging/testing)
    """
    try:
        # Apply query rephrasing and time defaults
        processed_query = request.query
        rephrase_result = semantic_sql_service.rephrase_user_query(request.query, request.cube_id)
        if rephrase_result.get('was_modified'):
            processed_query = rephrase_result.get('rephrased_query', request.query)
        
        time_result = semantic_sql_service.inject_default_time_period(processed_query)
        if not time_result.get('has_time_period'):
            processed_query = time_result.get('query', processed_query)
        
        result = semantic_sql_service.parse_query_intent(
            processed_query,
            request.cube_id,
            request.cube_metadata
        )
        
        if result.get('success'):
            return QueryIntentResponse(
                success=True,
                intent=result['intent']
            )
        else:
            return QueryIntentResponse(
                success=False,
                error=result.get('error')
            )
            
    except Exception as e:
        logger.error(f"Intent parsing error: {e}")
        return QueryIntentResponse(
            success=False,
            error=str(e)
        )


class PlanQueryRequest(BaseModel):
    query: str
    cube_id: str


class PlanQueryResponse(BaseModel):
    success: bool
    results: Optional[List[Dict[str, Any]]] = None
    row_count: Optional[int] = None
    data_source: Optional[str] = None
    plan_context: Optional[Dict[str, Any]] = None
    sql_query: Optional[str] = None
    narrative: Optional[str] = None
    error: Optional[str] = None


@router.post("/semantic-sql/plan-query", response_model=PlanQueryResponse)
async def execute_plan_query(request: PlanQueryRequest):
    """
    Execute a natural language query against cube_plan_data (Plan/Forecast/Budget data).
    
    This endpoint is specifically for queries about:
    - TBP (Target Business Plan)
    - CF02, CF05, CF09, CF11 Forecasts
    - YTD Forecast
    - Budget vs Actual comparisons
    - Plan metrics: Offshore Capacity, Budget, Pyramid Mix, Attrition, etc.
    
    Does NOT affect cube_fact_data queries.
    """
    try:
        logger.info(f"Plan data query: '{request.query}' for cube {request.cube_id}")
        
        # Execute plan query using the dedicated plan data method
        result = semantic_sql_service.execute_plan_query(
            request.query,
            request.cube_id
        )
        
        if not result.get('success'):
            return PlanQueryResponse(
                success=False,
                error=result.get('error', 'Unknown error')
            )
        
        # Generate narrative for results
        row_count = result.get('row_count', 0)
        plan_context = result.get('plan_context', {})
        plan_types = plan_context.get('plan_types', [])
        
        if row_count == 0:
            narrative = f"No plan data found for the specified criteria."
        else:
            plan_type_str = ', '.join(plan_types) if plan_types else 'Plan'
            narrative = f"Found {row_count} records from {plan_type_str} data."
        
        return PlanQueryResponse(
            success=True,
            results=result.get('results', []),
            row_count=row_count,
            data_source='cube_plan_data',
            plan_context=plan_context,
            sql_query=result.get('sql'),
            narrative=narrative
        )
        
    except Exception as e:
        logger.error(f"Plan query error: {e}")
        return PlanQueryResponse(
            success=False,
            error=str(e)
        )


@router.post("/semantic-sql/detect-plan-query")
async def detect_plan_query(request: PlanQueryRequest):
    """
    Detect if a query is for plan data (cube_plan_data) without executing it.
    Used by orchestrator to route queries to the correct data source.
    """
    try:
        plan_context = semantic_sql_service.detect_plan_data_query(request.query)
        
        return {
            "success": True,
            "is_plan_query": plan_context.get('is_plan_query', False),
            "plan_context": plan_context
        }
        
    except Exception as e:
        logger.error(f"Plan query detection error: {e}")
        return {
            "success": False,
            "error": str(e)
        }


class IntentRequest(BaseModel):
    query: str
    cube_id: str
    domain: Optional[str] = None  # Domain name for multi-tenant routing
    ai_config: Optional[Dict[str, Any]] = None  # Domain AI provider config (Azure OpenAI or None for Ollama)


class IntentResponse(BaseModel):
    success: bool
    structured_query: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    view_type: Optional[str] = None  # e.g. 'PS View', 'MS View', 'SX View'


def is_nemko_domain(domain: str) -> bool:
    """Check if domain is Nemko for multi-tenant routing."""
    if not domain:
        return False
    domain_lower = domain.lower()
    return 'nemko' in domain_lower


@router.post("/semantic-sql/intent", response_model=IntentResponse)
async def get_query_intent(request: IntentRequest):
    """
    Parse natural language query into structured query for SQL generation.
    Called by Node.js query orchestrator.
    """
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        conn = semantic_sql_service.get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check for fact data in both possible tables
        is_nemko = is_nemko_domain(request.domain)
        
        # First check cube_fact_data (standard structure)
        cursor.execute("SELECT COUNT(*) as count FROM cube_fact_data WHERE cube_id = %s", (request.cube_id,))
        row_count = cursor.fetchone()['count']
        
        # For Nemko domains, also check nemko_pl_fact_data if cube_fact_data is empty
        if is_nemko and row_count == 0:
            cursor.execute("SELECT COUNT(*) as count FROM nemko_pl_fact_data WHERE cube_id = %s OR cube_id IS NULL", (request.cube_id,))
            nemko_count = cursor.fetchone()['count']
            row_count = nemko_count
        
        cursor.close()
        conn.close()
        
        logger.info(f"Intent check: domain={request.domain}, is_nemko={is_nemko}, cube_id={request.cube_id}, row_count={row_count}")
        
        if row_count == 0:
            raise HTTPException(status_code=404, detail=f"No fact data found for cube {request.cube_id}")
        
        result = semantic_sql_service.parse_query_intent(
            request.query,
            request.cube_id,
            None,
            ai_config=request.ai_config
        )
        
        if result.get('success'):
            # Include original query in structured_query for plan data detection
            intent = result['intent']
            intent['original_query'] = request.query
            return IntentResponse(
                success=True,
                structured_query=intent,
                view_type=result.get('view_type')
            )
        else:
            return IntentResponse(
                success=False,
                error=result.get('error')
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Intent parsing error: {e}")
        return IntentResponse(
            success=False,
            error=str(e)
        )


@router.post("/semantic-sql/ingest", response_model=IngestionResponse)
async def ingest_excel_file(
    file: UploadFile = File(...),
    cube_id: str = Form(...)
):
    """
    Ingest an Excel file into the cube fact table for SQL queries
    
    This processes 600K+ row files by:
    1. Reading Excel with pandas
    2. Mapping columns to database schema
    3. Batch inserting into cube_fact_data table
    4. Extracting dimensions and cost categories
    """
    try:
        logger.info(f"Starting ingestion for cube {cube_id}, file: {file.filename}")
        
        # Validate file type
        if not file.filename.endswith(('.xlsx', '.xls')):
            return IngestionResponse(
                success=False,
                error="Only Excel files (.xlsx, .xls) are supported"
            )
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        
        try:
            # Process the file
            result = semantic_sql_service.ingest_excel_to_facts(tmp_path, cube_id)
            
            if result.get('success'):
                return IngestionResponse(
                    success=True,
                    rows_processed=result.get('rows_processed'),
                    rows_inserted=result.get('rows_inserted'),
                    cost_categories=result.get('cost_categories'),
                    dimensions=result.get('dimensions'),
                    elapsed_seconds=result.get('elapsed_seconds')
                )
            else:
                return IngestionResponse(
                    success=False,
                    error=result.get('error')
                )
                
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
                
    except Exception as e:
        logger.error(f"Ingestion error: {e}")
        return IngestionResponse(
            success=False,
            error=str(e)
        )


class PlanDataIngestionResponse(BaseModel):
    success: bool
    rows_inserted: Optional[int] = None
    rows_skipped: Optional[int] = None
    total_rows: Optional[int] = None
    elapsed_seconds: Optional[float] = None
    error: Optional[str] = None
    errors: Optional[List[str]] = None


class PlanDataQueryRequest(BaseModel):
    cube_id: str
    plan_type: Optional[str] = None
    entity: Optional[str] = None
    particulars: Optional[str] = None
    year: Optional[int] = None
    month: Optional[int] = None


@router.post("/semantic-sql/ingest-plan", response_model=PlanDataIngestionResponse)
async def ingest_plan_data(
    file: UploadFile = File(...),
    cube_id: str = Form(...),
    sheet_name: str = Form(default='Plan,Actual')
):
    """
    Ingest Plan/Budget data from Manual inputs MBR Master Excel file.
    Loads data into cube_plan_data table for Plan vs Actual comparisons.
    
    Expected Excel structure:
    - Year, Month: Time dimension
    - Plan/Actual: Plan type (Actual, CF02 2025, CF05 2025, TBP 2025, YTD Forecast)
    - Entity: BGSW, BGSV, NE-MX, Worldwide
    - Particulars: KPI Metric name (Offshore Capacity, Budget mUSD, etc.)
    - Particulars Sub Category: Average, End, Onsite, Offshore, Outsourcing
    - Cost value: Numeric CTG value
    - Value %: Percentage value
    """
    try:
        logger.info(f"Starting Plan data ingestion for cube {cube_id}, file: {file.filename}, sheet: {sheet_name}")
        
        if not file.filename.endswith(('.xlsx', '.xls')):
            return PlanDataIngestionResponse(
                success=False,
                error="Only Excel files (.xlsx, .xls) are supported"
            )
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        
        try:
            result = semantic_sql_service.ingest_plan_data(
                tmp_path, 
                cube_id, 
                sheet_name=sheet_name,
                source_file=file.filename
            )
            
            if result.get('success'):
                return PlanDataIngestionResponse(
                    success=True,
                    rows_inserted=result.get('rows_inserted'),
                    rows_skipped=result.get('rows_skipped'),
                    total_rows=result.get('total_rows'),
                    elapsed_seconds=result.get('elapsed_seconds'),
                    errors=result.get('errors')
                )
            else:
                return PlanDataIngestionResponse(
                    success=False,
                    error=result.get('error')
                )
                
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
                
    except Exception as e:
        logger.error(f"Plan data ingestion error: {e}")
        return PlanDataIngestionResponse(
            success=False,
            error=str(e)
        )


@router.post("/semantic-sql/ingest-nemko-pl", response_model=PlanDataIngestionResponse)
async def ingest_nemko_anaplan_pl(
    file: UploadFile = File(...),
    cube_id: str = Form(...),
    sheet_name: str = Form(default='Sheet 1'),
    statement_type: str = Form(default='P&L'),
):
    """
    Ingest Nemko Anaplan wide-format P&L export into cube_plan_data.

    Expected columns: Location, DS, LIS (P&L line), Versions, Line Items,
    then monthly columns (Jan 24, Feb 24, … Dec 26). FY totals are skipped.
    Versions (Actual / Budget / Forecast) map to plan_type.
    """
    try:
        logger.info(f"[Nemko Anaplan] Ingest request: cube={cube_id}, file={file.filename}, sheet={sheet_name}")

        if not file.filename.endswith(('.xlsx', '.xls')):
            return PlanDataIngestionResponse(success=False, error="Only Excel files (.xlsx, .xls) are supported")

        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        try:
            result = semantic_sql_service.ingest_nemko_anaplan_pl(
                tmp_path,
                cube_id,
                sheet_name=sheet_name,
                source_file=file.filename,
                statement_type=statement_type,
            )
            if result.get('success'):
                return PlanDataIngestionResponse(
                    success=True,
                    rows_inserted=result.get('rows_inserted'),
                    rows_skipped=result.get('rows_skipped'),
                    total_rows=result.get('total_rows'),
                    elapsed_seconds=result.get('elapsed_seconds'),
                    errors=result.get('errors'),
                )
            else:
                return PlanDataIngestionResponse(success=False, error=result.get('error'))
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    except Exception as e:
        logger.error(f"[Nemko Anaplan] Ingest endpoint error: {e}")
        return PlanDataIngestionResponse(success=False, error=str(e))


@router.post("/semantic-sql/plan-data")
async def query_plan_data(request: PlanDataQueryRequest):
    """
    Query plan data for a specific cube with optional filters.
    Returns plan/budget values for calculations and comparisons.
    """
    try:
        result = semantic_sql_service.get_plan_data(
            cube_id=request.cube_id,
            plan_type=request.plan_type,
            entity=request.entity,
            particulars=request.particulars,
            year=request.year,
            month=request.month
        )
        
        return {
            'success': True,
            'count': len(result),
            'data': result
        }
        
    except Exception as e:
        logger.error(f"Plan data query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/semantic-sql/plan-data/{cube_id}/particulars")
async def get_plan_particulars(cube_id: str):
    """
    Get unique KPI Metric names (Particulars) from plan data for a cube.
    Useful for UI dropdown population.
    """
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        conn = semantic_sql_service.get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT DISTINCT particulars, 
                   COUNT(*) as row_count,
                   array_agg(DISTINCT plan_type) as plan_types,
                   array_agg(DISTINCT entity) as entities
            FROM cube_plan_data 
            WHERE cube_id = %s AND particulars IS NOT NULL
            GROUP BY particulars
            ORDER BY particulars
        """, (cube_id,))
        
        particulars = [dict(row) for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return {
            'success': True,
            'cube_id': cube_id,
            'count': len(particulars),
            'particulars': particulars
        }
        
    except Exception as e:
        logger.error(f"Plan particulars fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/semantic-sql/cube/{cube_id}/schema")
async def get_cube_schema(cube_id: str):
    """
    Get the schema information for a cube including dimensions and metrics
    """
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        conn = semantic_sql_service.get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get dimensions
        cursor.execute("""
            SELECT dimension_type, array_agg(DISTINCT code) as values
            FROM cube_dimensions WHERE cube_id = %s
            GROUP BY dimension_type
        """, (cube_id,))
        dimensions = {row['dimension_type']: row['values'] for row in cursor.fetchall()}
        
        # Get cost categories
        cursor.execute("""
            SELECT name, is_summary, relevant_columns
            FROM cube_cost_categories WHERE cube_id = %s
        """, (cube_id,))
        cost_categories = [dict(row) for row in cursor.fetchall()]
        
        # Get row count
        cursor.execute("""
            SELECT COUNT(*) as count FROM cube_fact_data WHERE cube_id = %s
        """, (cube_id,))
        row_count = cursor.fetchone()['count']
        
        cursor.close()
        conn.close()
        
        return {
            'success': True,
            'cube_id': cube_id,
            'row_count': row_count,
            'dimensions': dimensions,
            'cost_categories': cost_categories,
            'available_metrics': [
                'billed_capacity', 'allocated_capacity', 'vkm_capacity', 'ms_capacity',
                'amount_usd', 'amount_inr', 'headcount', 'total_hours', 'billable_hours',
                'capacity', 'not_allocated_capacity'
            ]
        }
        
    except Exception as e:
        logger.error(f"Schema fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/semantic-sql/cube/{cube_id}/sample")
async def get_sample_data(cube_id: str, limit: int = 10):
    """
    Get sample data from the cube for preview
    """
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        conn = semantic_sql_service.get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT year, month, cost_category, region_entity, sector, project_gb,
                   billed_capacity, allocated_capacity, amount_usd, headcount
            FROM cube_fact_data 
            WHERE cube_id = %s
            LIMIT %s
        """, (cube_id, min(limit, 100)))
        
        rows = [dict(row) for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return {
            'success': True,
            'data': rows,
            'count': len(rows)
        }
        
    except Exception as e:
        logger.error(f"Sample data error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/semantic-sql/cubes")
async def list_available_cubes():
    """
    List all available cubes for Semantic SQL ingestion
    """
    try:
        cubes = semantic_sql_service.get_available_cubes()
        return {
            'success': True,
            'cubes': cubes
        }
    except Exception as e:
        logger.error(f"Error listing cubes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/semantic-sql/health")
async def health_check():
    """Health check for Semantic SQL service"""
    try:
        cubes = semantic_sql_service.get_available_cubes()
        return {
            'status': 'healthy',
            'service': 'semantic_sql',
            'cubes_available': len(cubes)
        }
    except Exception as e:
        return {
            'status': 'unhealthy',
            'service': 'semantic_sql',
            'error': str(e)
        }


@router.get("/semantic-sql/ingestion-jobs/{job_id}")
async def get_ingestion_job_status(job_id: str):
    """Get ingestion job status by ID"""
    try:
        job = semantic_sql_service.get_ingestion_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return {
            'success': True,
            'job': job
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting ingestion job: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/semantic-sql/cubes/{cube_id}/ingestion-jobs")
async def list_cube_ingestion_jobs(cube_id: str, limit: int = 5):
    """List recent ingestion jobs for a cube"""
    try:
        jobs = semantic_sql_service.get_cube_ingestion_jobs(cube_id, limit)
        return {
            'success': True,
            'jobs': jobs
        }
    except Exception as e:
        logger.error(f"Error listing cube ingestion jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))
