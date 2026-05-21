from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
import logging
import sys
import os
import asyncio

# Add paths for existing modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../attached_assets'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from database import get_db_connection
import psycopg2
from psycopg2.extras import RealDictCursor

router = APIRouter()
logger = logging.getLogger(__name__)


from typing import Optional, Dict, Any

class ProcessDocumentRequest(BaseModel):
    file_path: str
    company_id: str
    ai_config: Optional[Dict[str, Any]] = None  # Azure OpenAI config if domain uses it

@router.get("/health")
async def health_check():
    """Health check for enterprise routes"""
    return {
        "status": "healthy",
        "service": "enterprise_data"
    }

@router.post("/process/{document_id}")
async def process_enterprise_document(
    document_id: str,
    request: ProcessDocumentRequest,
    background_tasks: BackgroundTasks
):
    """
    Process an enterprise document: extract text, chunk, generate embeddings
    """
    try:
        # Verify document exists
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT id, cube_id, name FROM enterprise_documents 
            WHERE id = %s AND company_id = %s
        """, (document_id, request.company_id))
        
        doc = cur.fetchone()
        cur.close()
        conn.close()
        
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        cube_id = doc.get('cube_id') if doc else None
        file_name = doc.get('name') if doc else None
        
        # Create ingestion job for Excel files with cube_id
        job_id = None
        if cube_id and request.file_path.lower().endswith(('.xlsx', '.xls')):
            from services.semantic_sql_service import SemanticSQLService
            sql_service = SemanticSQLService()
            job_id = sql_service.create_ingestion_job(cube_id, document_id, file_name)
        
        update_enterprise_status(document_id, request.company_id, 'processing')
        
        background_tasks.add_task(
            process_enterprise_document_background,
            document_id,
            request.company_id,
            request.file_path,
            cube_id,
            job_id,
            request.ai_config
        )
        
        return {
            "success": True,
            "message": "Enterprise document processing started",
            "document_id": document_id,
            "job_id": job_id
        }
        
    except Exception as e:
        logger.error(f"Failed to start enterprise document processing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def process_enterprise_document_background(document_id: str, company_id: str, file_path: str, cube_id: str = None, job_id: str = None, ai_config: dict = None):
    """Background task for enterprise document processing"""
    try:
        import sys
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))
        from services.document_processor import process_single_document, process_excel_file
        from services.vector_store import chunk_text, get_embeddings, chunk_structured_table
        from parsers.kpi_dashboard_extractor import is_kpi_dashboard_pdf, extract_kpi_dashboard_smart, convert_to_chunks_smart
        from services.semantic_sql_service import SemanticSQLService
        
        logger.info(f"Processing enterprise document {document_id} for company {company_id}, cube {cube_id}, job_id {job_id}")
        
        # Convert to absolute path
        if not os.path.isabs(file_path):
            project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
            if not file_path.startswith('uploads/'):
                file_path = os.path.join('uploads', file_path)
            absolute_path = os.path.join(project_root, file_path)
        else:
            absolute_path = file_path
        
        logger.info(f"Using absolute path: {absolute_path}")
        
        if not os.path.exists(absolute_path):
            raise FileNotFoundError(f"File not found: {absolute_path}")
        
        # Determine file type and use optimized processor for Excel files
        file_ext = absolute_path.lower().split('.')[-1]
        use_kpi_extractor = False
        
        if file_ext in ['xlsx', 'xls']:
            # For Excel files with cube_id: use SQL ingestion (fast, no embeddings)
            # This loads data directly into cube_fact_data OR cube_plan_data based on file format
            if cube_id:
                logger.info(f"Using SQL ingestion for Excel file (cube_id: {cube_id}, job_id: {job_id}) - no embeddings needed")
                sql_service = SemanticSQLService()
                
                # Detect file format by reading column headers
                import pandas as pd
                is_plan_data = False  # Default to fact data
                try:
                    # Read first row to detect format
                    preview_df = pd.read_excel(absolute_path, nrows=1)
                    columns_lower = [str(c).lower().strip() for c in preview_df.columns]
                    
                    # Manual inputs MBR Master format: has "Plan/Actual", "Particulars" columns
                    is_plan_data = ('plan/actual' in columns_lower or 
                                   'particulars' in columns_lower or
                                   any('particulars' in c for c in columns_lower))
                    
                    if is_plan_data:
                        logger.info(f"Detected Plan data format (Manual inputs MBR Master) - loading into cube_plan_data")
                        result = sql_service.ingest_plan_data(absolute_path, cube_id, source_file=os.path.basename(absolute_path))
                    else:
                        logger.info(f"Detected Fact data format (MV_GB_INSIGHTS) - loading into cube_fact_data")
                        result = sql_service.ingest_excel_to_facts(absolute_path, cube_id, job_id=job_id)
                except Exception as detect_err:
                    logger.warning(f"Format detection failed ({detect_err}), defaulting to fact data ingestion")
                    is_plan_data = False
                    result = sql_service.ingest_excel_to_facts(absolute_path, cube_id, job_id=job_id)
                
                if result.get('success'):
                    rows_inserted = result.get('rows_inserted', 0)
                    target_table = 'cube_plan_data' if is_plan_data else 'cube_fact_data'
                    logger.info(f"SQL ingestion complete: {rows_inserted} rows loaded into {target_table}")
                    
                    # Update status to completed (synchronous call for reliability)
                    try:
                        update_enterprise_status(
                            document_id,
                            company_id,
                            'completed',
                            total_chunks=rows_inserted,
                            processed_chunks=rows_inserted
                        )
                        logger.info(f"Successfully processed enterprise Excel {document_id} via SQL ingestion")
                    except Exception as status_err:
                        logger.error(f"Failed to update status after successful ingestion: {status_err}")
                    return  # Exit early - no embedding generation needed
                else:
                    error_msg = result.get('error', 'SQL ingestion failed')
                    logger.error(f"SQL ingestion failed: {error_msg}")
                    # Update status to failed before falling back
                    try:
                        update_enterprise_status(document_id, company_id, 'failed', error_message=error_msg)
                    except Exception as status_err:
                        logger.error(f"Failed to update status: {status_err}")
                    # Fall back to RAG processing if SQL ingestion fails
                    logger.info("Falling back to RAG processing...")
            
            logger.info("Using optimized enterprise Excel processor (RAG path)")
            processed_data = process_excel_file(absolute_path)
        elif file_ext == 'pdf':
            # Check if this is a KPI dashboard PDF for specialized extraction
            if is_kpi_dashboard_pdf(absolute_path):
                logger.info("Detected KPI Dashboard PDF - using specialized extractor")
                use_kpi_extractor = True
                kpi_result = extract_kpi_dashboard_smart(absolute_path, use_vision=True)
                processed_data = kpi_result  # Store for later use
            else:
                logger.info("Using standard PDF processor")
                with open(absolute_path, 'rb') as f:
                    file_content = f.read()
                filename = os.path.basename(absolute_path)
                processed_data = process_single_document(file_content, filename)
        else:
            logger.info("Using standard document processor")
            # Read file content for process_single_document
            with open(absolute_path, 'rb') as f:
                file_content = f.read()
            filename = os.path.basename(absolute_path)
            processed_data = process_single_document(file_content, filename)
        
        # Extract text content - handle both regular and enterprise formats
        all_chunks = []
        
        # Handle KPI Dashboard extraction first (special case)
        if use_kpi_extractor and isinstance(processed_data, dict) and processed_data.get('document_type') == 'kpi_dashboard':
            logger.info("Converting KPI dashboard extraction to chunks")
            all_chunks = convert_to_chunks_smart(processed_data, document_id)
            logger.info(f"KPI Dashboard: {len(all_chunks)} page-wise chunks created with {processed_data['extraction_quality']['metrics_extracted']} metrics")
        
        elif isinstance(processed_data, list):
            # Enterprise Excel or multi-sheet format
            for sheet_data in processed_data:
                if isinstance(sheet_data, dict) and 'text' in sheet_data:
                    sheet_text = sheet_data['text']
                    sheet_name = sheet_data.get('sheet_name', 'Unknown')
                    
                    # LAYER 1 FIX: Extract ALL metadata from sheet_data for comprehensive analysis
                    # This captures entities (Korea, Japan, etc), metrics (Operating Cash Flow, etc),
                    # periods (Apr-25, May-25, etc), and table structure for ALL Anaplan files
                    chunk_metadata = {
                        'sheet_name': sheet_name,
                        # Entities/Countries/Scenarios (e.g., Korea, Japan, Consolidated)
                        'detected_scenarios': sheet_data.get('detected_scenarios', []),
                        # Financial metrics (e.g., Operating Cash Flow, Net Income)
                        'detected_metrics': sheet_data.get('detected_metrics', []),
                        # Period/fiscal calendar info (e.g., Apr-25, FY2025)
                        'fiscal_calendar': sheet_data.get('fiscal_calendar', {}),
                        # Table structure
                        'columns': sheet_data.get('columns', []),
                        'row_count': sheet_data.get('row_count', 0),
                        # Data quality and analysis
                        'data_quality_score': sheet_data.get('data_quality_score', 0),
                        'has_time_series_data': sheet_data.get('has_time_series_data', False),
                        # Full structured data for advanced queries
                        'structured_data': sheet_data.get('structured_data', [])[:10] if sheet_data.get('structured_data') else []  # Store first 10 rows as sample
                    }
                    
                    # Log captured metadata for verification
                    logger.info(f"Sheet '{sheet_name}' metadata: {len(chunk_metadata.get('detected_scenarios', []))} scenarios, {len(chunk_metadata.get('detected_metrics', []))} metrics, {len(chunk_metadata.get('columns', []))} columns")
                    
                    # LAYER 2 FIX: Use table-aware chunking for Excel sheets
                    # This preserves table structure (headers + data together)
                    # 20 rows per chunk keeps tokens under 6000 for wide tables (50+ columns)
                    # This prevents OpenAI embedding API token limit errors (8192 max)
                    sheet_chunks = chunk_structured_table(
                        text=sheet_text,
                        sheet_name=sheet_name,
                        columns=chunk_metadata.get('columns', []),
                        doc_id=document_id,
                        rows_per_chunk=20  # 20 rows per chunk for wide Anaplan files (50+ columns)
                    )
                    
                    # Enhance chunks with comprehensive metadata from Layer 1
                    for chunk in sheet_chunks:
                        if isinstance(chunk, dict):
                            # Merge Layer 1 metadata with Layer 2 chunk metadata
                            existing_metadata = chunk.get('metadata', {})
                            existing_metadata.update(chunk_metadata)
                            chunk['metadata'] = existing_metadata
                        all_chunks.append(chunk)
                    
                    logger.info(f"Sheet '{sheet_name}' chunked into {len(sheet_chunks)} table-aware chunks with full metadata")
        
        elif isinstance(processed_data, dict) and 'content' in processed_data:
            # Regular document format
            content = processed_data['content']
            if isinstance(content, list):
                full_text = '\n\n'.join([page.get('text', '') for page in content if isinstance(page, dict)])
            elif isinstance(content, str):
                full_text = content
            else:
                full_text = str(content)
            
            all_chunks = chunk_text(full_text, doc_id=document_id)
        
        if not all_chunks:
            raise ValueError("No text content extracted from document")
        
        logger.info(f"Total chunks for document: {len(all_chunks)}")
        
        # Generate embeddings in batches for better performance
        use_azure = (
            ai_config is not None
            and ai_config.get("provider") == "azure_openai"
            and ai_config.get("endpoint")
            and ai_config.get("api_key")
            and ai_config.get("embedding_model")
        )
        logger.info(f"Generating embeddings (provider: {'azure_openai' if use_azure else 'ollama'})...")
        embeddings, processed_texts = get_embeddings(all_chunks, ai_config=ai_config)
        
        # processed_texts is a flat list of text strings corresponding to each embedding
        if len(processed_texts) != len(embeddings):
            raise ValueError(f"Mismatch: {len(processed_texts)} processed texts but {len(embeddings)} embeddings")
        
        logger.info(f"{len(all_chunks)} chunks ready for storage")
        
        # Store chunks and embeddings in enterprise tables with batch inserts
        await asyncio.to_thread(store_enterprise_chunks_and_embeddings, document_id, company_id, cube_id, all_chunks, embeddings, use_azure)
        
        # Update status to completed (run in thread pool to avoid blocking)
        await asyncio.to_thread(
            update_enterprise_status,
            document_id,
            company_id,
            'completed',
            total_chunks=len(all_chunks),
            processed_chunks=len(all_chunks)
        )
        
        logger.info(f"Successfully processed enterprise document {document_id} with {len(all_chunks)} chunks")
        
    except Exception as e:
        logger.error(f"Enterprise document processing failed: {e}", exc_info=True)
        await asyncio.to_thread(
            update_enterprise_status,
            document_id,
            company_id,
            'failed',
            error_message=str(e)
        )

def store_enterprise_chunks_and_embeddings(document_id: str, company_id: str, cube_id: str, chunks: list, embeddings: list, use_azure: bool = False):
    """
    Store enterprise document chunks and embeddings using batch inserts for performance.
    When use_azure=True, embeddings are 3072-dim and stored in the embedding_3072 column.
    Otherwise 1024-dim embeddings go into the standard embedding column.
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    model_name = 'text-embedding-3-large' if use_azure else 'mxbai-embed-large'
    embedding_col = 'embedding_3072' if use_azure else 'embedding'

    try:
        BATCH_SIZE = 100
        chunk_ids = []
        
        logger.info(f"Storing {len(chunks)} chunks in batches of {BATCH_SIZE} (cube_id: {cube_id})")
        
        for batch_start in range(0, len(chunks), BATCH_SIZE):
            batch_end = min(batch_start + BATCH_SIZE, len(chunks))
            batch_chunks = chunks[batch_start:batch_end]
            
            chunk_values = []
            for i, chunk in enumerate(batch_chunks, start=batch_start):
                chunk_text = chunk['text'] if isinstance(chunk, dict) else chunk
                token_count = chunk.get('tokens', 0) if isinstance(chunk, dict) else 0
                metadata = chunk.get('metadata', {}) if isinstance(chunk, dict) else {}
                
                chunk_values.append((
                    document_id,
                    company_id,
                    cube_id,
                    chunk_text,
                    i,
                    token_count,
                    psycopg2.extras.Json(metadata)
                ))
            
            args_str = ','.join(cur.mogrify("(%s,%s,%s,%s,%s,%s,%s)", vals).decode('utf-8') for vals in chunk_values)
            query = f"""
                INSERT INTO enterprise_document_chunks 
                (document_id, company_id, cube_id, chunk_text, chunk_index, token_count, metadata)
                VALUES {args_str}
                RETURNING id
            """
            cur.execute(query)
            batch_ids = [row['id'] for row in cur.fetchall()]
            chunk_ids.extend(batch_ids)
            
            logger.info(f"Inserted chunk batch {batch_start}-{batch_end}")
        
        logger.info(f"Storing {len(embeddings)} embeddings in batches of {BATCH_SIZE} (column: {embedding_col})")
        
        for batch_start in range(0, len(embeddings), BATCH_SIZE):
            batch_end = min(batch_start + BATCH_SIZE, len(embeddings))
            batch_embeddings = embeddings[batch_start:batch_end]
            batch_chunk_ids = chunk_ids[batch_start:batch_end]
            
            embedding_values = []
            for chunk_id, embedding in zip(batch_chunk_ids, batch_embeddings):
                embedding_str = f"[{','.join(map(str, embedding))}]"
                embedding_values.append((
                    chunk_id,
                    company_id,
                    cube_id,
                    embedding_str,
                    model_name
                ))
            
            args_str = ','.join(cur.mogrify("(%s,%s,%s,%s::vector,%s)", vals).decode('utf-8') for vals in embedding_values)
            query = f"""
                INSERT INTO enterprise_document_embeddings 
                (chunk_id, company_id, cube_id, {embedding_col}, model_name)
                VALUES {args_str}
            """
            cur.execute(query)
            
            logger.info(f"Inserted embedding batch {batch_start}-{batch_end}")
        
        conn.commit()
        logger.info(f"Successfully stored {len(chunks)} enterprise chunks with embeddings ({model_name})")
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to store enterprise chunks: {e}")
        raise
    finally:
        cur.close()
        conn.close()

def update_enterprise_status(document_id: str, company_id: str, status: str, **kwargs):
    """Update processing status for enterprise documents"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Update or insert processing status record
        cur.execute("""
            INSERT INTO enterprise_document_processing 
            (document_id, company_id, status, total_chunks, processed_chunks, error_message)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (document_id) 
            DO UPDATE SET 
                status = EXCLUDED.status,
                total_chunks = COALESCE(EXCLUDED.total_chunks, enterprise_document_processing.total_chunks),
                processed_chunks = COALESCE(EXCLUDED.processed_chunks, enterprise_document_processing.processed_chunks),
                error_message = COALESCE(EXCLUDED.error_message, enterprise_document_processing.error_message),
                completed_at = CASE WHEN EXCLUDED.status = 'completed' THEN NOW() ELSE enterprise_document_processing.completed_at END
        """, (
            document_id,
            company_id,
            status,
            kwargs.get('total_chunks'),
            kwargs.get('processed_chunks'),
            kwargs.get('error_message')
        ))
        
        conn.commit()
        logger.info(f"Updated enterprise processing status for {document_id}: {status}")
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to update enterprise processing status: {e}")
        raise
    finally:
        cur.close()
        conn.close()
