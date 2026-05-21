"""
RAG (Retrieval-Augmented Generation) API routes
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
import sys
import logging

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../attached_assets'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

# Import schema context builder for domain-aware RAG
try:
    from python_backend.services.schema_context_builder import schema_context_builder
    SCHEMA_CONTEXT_AVAILABLE = True
except ImportError:
    SCHEMA_CONTEXT_AVAILABLE = False

logger = logging.getLogger(__name__)

router = APIRouter()

class RAGRequest(BaseModel):
    query: str
    user_id: str
    document_ids: Optional[List[str]] = None
    chat_history: Optional[List[dict]] = None
    use_web_search: bool = True
    company_ids: Optional[List[str]] = None
    cube_ids: Optional[List[str]] = None
    cube_metadata: Optional[Dict[str, dict]] = None  # Cube metadata for query enhancement (entities, metrics, periods)
    ai_config: Optional[Dict] = None  # Domain-specific AI provider config (Azure OpenAI or None for Ollama)

def get_enterprise_chunks(query_embedding, request: RAGRequest, cursor, top_k: int = 5):
    """
    Helper function to retrieve enterprise document chunks with properly deserialized metadata.
    Uses company_ids AND cube_ids for filtering.
    When request.ai_config has provider='azure_openai', searches the embedding_3072 column
    (3072-dim Azure vectors). Otherwise searches the standard embedding column (1024-dim Ollama).
    """
    import json
    from psycopg2.extras import RealDictCursor
    
    enterprise_chunks = []
    
    company_ids = request.company_ids
    cube_ids = request.cube_ids
    ai_config = request.ai_config or {}

    # Determine which embedding column to use
    use_azure = (
        ai_config.get("provider") == "azure_openai"
        and ai_config.get("embedding_model")
    )
    embedding_col = "embedding_3072" if use_azure else "embedding"
    expected_dims = 3072 if use_azure else 1024

    logger.info(f"get_enterprise_chunks called with company_ids: {company_ids}, cube_ids: {cube_ids}, user_id: {request.user_id}, embedding_col: {embedding_col}")
    
    # Log cube metadata if provided (for future query enhancement)
    if request.cube_metadata:
        total_entities = sum(len(m.get('entities', [])) for m in request.cube_metadata.values())
        total_metrics = sum(len(m.get('metrics', [])) for m in request.cube_metadata.values())
        total_periods = sum(len(m.get('periods', [])) for m in request.cube_metadata.values())
        logger.info(f"📊 Cube metadata available: {total_entities} entities, {total_metrics} metrics, {total_periods} periods across {len(request.cube_metadata)} cubes")
    
    if not company_ids:
        logger.info(f"Enterprise data disabled - no company_ids provided for user {request.user_id}")
        return enterprise_chunks
    
    # Validate embedding dimensions match what we expect
    if len(query_embedding) != expected_dims:
        logger.error(f"Query embedding dimension mismatch: got {len(query_embedding)}, expected {expected_dims} for column {embedding_col}")
        return enterprise_chunks

    vector_str = '[' + ','.join(str(x) for x in query_embedding) + ']'
    
    dict_cursor = cursor.connection.cursor(cursor_factory=RealDictCursor)
    
    # SECURITY: Cube isolation is mandatory for enterprise data
    # Users must have explicit cube access to query enterprise documents
    # If no cube_ids provided, return zero rows to enforce data isolation
    if not cube_ids or len(cube_ids) == 0:
        logger.info(f"🔒 Cube isolation ENFORCED - user has no cube access, returning zero enterprise chunks")
        dict_cursor.close()
        return enterprise_chunks  # Return empty list
    
    logger.info(f"🔒 Cube filtering ENABLED - querying only from {len(cube_ids)} accessible cubes via {embedding_col}")
    dict_cursor.execute(f"""
        SELECT 
            ee.chunk_id,
            ec.chunk_text,
            ec.chunk_index,
            ec.metadata,
            ed.name as document_name,
            ed.id as document_id,
            ed.company_id,
            ed.cube_id,
            ee.{embedding_col} <=> %s::vector as distance
        FROM enterprise_document_embeddings ee
        JOIN enterprise_document_chunks ec ON ee.chunk_id = ec.id
        JOIN enterprise_documents ed ON ec.document_id = ed.id
        LEFT JOIN enterprise_document_processing edp ON ed.id = edp.document_id
        WHERE ed.company_id = ANY(%s) 
          AND ed.cube_id = ANY(%s)
          AND ee.{embedding_col} IS NOT NULL
          AND (edp.status = 'completed' OR edp.status IS NULL)
        ORDER BY ee.{embedding_col} <=> %s::vector
        LIMIT %s
    """, (vector_str, company_ids, cube_ids, vector_str, top_k))
    
    for row in dict_cursor.fetchall():
        # RealDictCursor automatically deserializes JSON columns
        # but we ensure metadata is a dict for safety
        metadata = row['metadata']
        if isinstance(metadata, str):
            try:
                metadata = json.loads(metadata)
            except (json.JSONDecodeError, TypeError):
                metadata = {}
        
        enterprise_chunks.append({
            'chunk_id': row['chunk_id'],
            'chunk_text': row['chunk_text'],
            'chunk_index': row['chunk_index'],
            'metadata': metadata or {},  # Ensure dict, never None
            'document_name': f"[Enterprise] {row['document_name']}",
            'document_id': row['document_id'],
            'company_id': row['company_id'],
            'distance': float(row['distance']),
            'similarity': 1.0 - float(row['distance'])
        })
    
    dict_cursor.close()
    
    logger.info(f"get_enterprise_chunks returning {len(enterprise_chunks)} chunks for company_ids: {company_ids}")
    
    return enterprise_chunks

@router.post("/analyze")
async def rag_analyze(request: RAGRequest):
    """
    Perform RAG-enhanced analysis using documents and optional web search
    """
    try:
        from services.vector_store import get_embeddings
        from services.rag_engine import synthesize_web_and_document_results, perform_web_search, should_search_web
        from config import settings
        import requests
        
        # Helper for LLM completion
        def get_ai_completion(prompt: str, system_prompt: str = None):
            base_url = settings.OLLAMA_BASE_URL.replace("/v1", "").rstrip("/")
            full_prompt = f"system: {system_prompt}\nuser: {prompt}\nassistant:" if system_prompt else prompt
            resp = requests.post(
                f"{base_url}/generate",
                json={
                    "model": settings.OLLAMA_CHAT_MODEL,
                    "prompt": full_prompt,
                    "stream": False
                },
                headers={
                    "x-api-key": settings.OLLAMA_API_KEY
                },
                verify=False
            )
            resp.raise_for_status()
            return resp.json().get("response", "")

        from database import search_similar_chunks, get_db_connection
        
        # Generate query embedding
        query_embedding, _ = get_embeddings([request.query])
        query_embedding = query_embedding[0]
        
        # Get database connection
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Search personal document chunks
        personal_chunks = search_similar_chunks(
            query_embedding,
            document_ids=request.document_ids,
            top_k=5
        )
        
        # FIX: Increase top_k to 40 for enterprise chunks to ensure all entities (Korea, Japan, Taiwan, etc.) 
        # are included in context for large Excel files - more chunks needed with 20 rows/chunk setting
        enterprise_chunks = get_enterprise_chunks(query_embedding, request, cursor, top_k=40)
        
        cursor.close()
        conn.close()
        
        # Merge and sort by distance (or similarity)
        chunks = sorted(
            personal_chunks + enterprise_chunks,
            key=lambda x: x.get('distance', 1.0 - x.get('similarity', 0))
        )[:30]
        
        context_parts = []
        metadata_summary = {
            'all_scenarios': set(),
            'all_metrics': set(),
            'all_sheets': set(),
            'has_fiscal_data': False
        }
        
        for chunk in chunks:
            chunk_metadata = chunk.get('metadata', {}) or {}
            
            if chunk_metadata.get('detected_scenarios'):
                metadata_summary['all_scenarios'].update(chunk_metadata['detected_scenarios'])
            if chunk_metadata.get('detected_metrics'):
                metadata_summary['all_metrics'].update(chunk_metadata['detected_metrics'])
            if chunk_metadata.get('sheet_name'):
                metadata_summary['all_sheets'].add(chunk_metadata['sheet_name'])
            if chunk_metadata.get('fiscal_calendar'):
                metadata_summary['has_fiscal_data'] = True
            
            context_part = f"From document '{chunk.get('document_name', 'Unknown')}'"
            if chunk_metadata.get('sheet_name'):
                context_part += f" (Sheet: {chunk_metadata['sheet_name']})"
            
            meta_info = []
            if chunk_metadata.get('entities_in_chunk'):
                entities = chunk_metadata['entities_in_chunk'][:5]
                meta_info.append(f"Entities: {', '.join(entities)}")
            if chunk_metadata.get('columns'):
                cols = chunk_metadata['columns'][:5]
                meta_info.append(f"Columns: {', '.join([str(c) for c in cols])}")
            if chunk_metadata.get('row_range'):
                meta_info.append(f"Rows: {chunk_metadata['row_range']}")
            
            if meta_info:
                context_part += f"\n[{' | '.join(meta_info)}]"
            
            context_part += f"\n\n{chunk.get('chunk_text', '')}"
            context_parts.append(context_part)
        
        summary_header = "## DATA STRUCTURE OVERVIEW\n"
        if metadata_summary['all_scenarios']:
            summary_header += f"Available Entities/Scenarios: {', '.join(list(metadata_summary['all_scenarios'])[:10])}\n"
        if metadata_summary['all_metrics']:
            summary_header += f"Available Metrics: {', '.join(list(metadata_summary['all_metrics'])[:10])}\n"
        if metadata_summary['all_sheets']:
            summary_header += f"Data Sources: {', '.join(metadata_summary['all_sheets'])}\n"
        summary_header += "\n## RELEVANT DATA:\n\n"
        
        context = summary_header + "\n\n---\n\n".join(context_parts) if context_parts else ""
        
        schema_context_section = ""
        if SCHEMA_CONTEXT_AVAILABLE and request.cube_ids:
            try:
                primary_cube_id = request.cube_ids[0]
                rag_context = schema_context_builder.build_rag_context(primary_cube_id, None)
                if rag_context:
                    schema_context_section = f"\n\n{rag_context}\n"
            except Exception as e:
                logger.warning(f"Could not build schema context: {e}")
        
        system_prompt = f"""You are LedgerLM, an expert financial analysis assistant. 
        Analyze the provided financial documents and answer questions with precision and depth.
        {schema_context_section}"""
        
        document_answer = get_ai_completion(f"Context from documents:\n{context}\n\nQuestion: {request.query}", system_prompt=system_prompt)
        
        final_answer = document_answer
        web_results = []
        if request.use_web_search and should_search_web(request.query, document_answer):
            web_results = perform_web_search(request.query, num_results=3)
            if web_results:
                final_answer = synthesize_web_and_document_results(request.query, document_answer, web_results)
        
        return {
            "success": True,
            "query": request.query,
            "answer": final_answer,
            "sources": {
                "document_chunks": len(chunks),
                "web_results": len(web_results)
            },
            "chunks": chunks[:3],
            "web_enhanced": len(web_results) > 0
        }
    except Exception as e:
        logger.error(f"RAG analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/query")
async def rag_query(request: RAGRequest):
    """
    Query documents and return relevant context
    Used by chat interface to retrieve document chunks
    """
    try:
        from services.vector_store import get_embeddings
        from database import search_similar_chunks, get_db_connection
        
        # Use domain AI config to embed the query (Azure 3072-dim or Ollama 1024-dim)
        query_embeddings, _ = get_embeddings([request.query], ai_config=request.ai_config)
        query_embedding = query_embeddings[0]
        logger.info(f"Query embedded: {len(query_embedding)}-dim vector (provider: {request.ai_config.get('provider', 'ollama') if request.ai_config else 'ollama'})")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        # Personal docs always use Ollama 1024-dim embeddings (no Azure for chat-attached docs)
        personal_query_embedding = query_embedding
        if request.ai_config and request.ai_config.get("provider") == "azure_openai":
            # Personal docs were embedded with Ollama, so re-embed query with Ollama for personal doc search
            ollama_embeddings, _ = get_embeddings([request.query], ai_config=None)
            personal_query_embedding = ollama_embeddings[0]
        personal_chunks = search_similar_chunks(personal_query_embedding, document_ids=request.document_ids, top_k=5)
        enterprise_chunks = get_enterprise_chunks(query_embedding, request, cursor, top_k=40)
        cursor.close()
        conn.close()
        
        chunks = sorted(personal_chunks + enterprise_chunks, key=lambda x: x.get('distance', 1.0 - x.get('similarity', 0)))[:30]
        
        if not chunks:
            return {"success": True, "context": "", "chunks": [], "found_chunks": 0}
        
        context_parts = []
        metadata_summary = {'all_scenarios': set(), 'all_metrics': set(), 'all_sheets': set(), 'has_fiscal_data': False}
        
        for chunk in chunks:
            chunk_metadata = chunk.get('metadata', {})
            if chunk_metadata.get('detected_scenarios'): metadata_summary['all_scenarios'].update(chunk_metadata['detected_scenarios'])
            if chunk_metadata.get('detected_metrics'): metadata_summary['all_metrics'].update(chunk_metadata['detected_metrics'])
            if chunk_metadata.get('sheet_name'): metadata_summary['all_sheets'].add(chunk_metadata['sheet_name'])
            
            context_part = f"From document '{chunk['document_name']}'"
            if chunk_metadata.get('sheet_name'): context_part += f" (Sheet: {chunk_metadata['sheet_name']})"
            
            meta_info = []
            if chunk_metadata.get('entities_in_chunk'): meta_info.append(f"Entities: {', '.join(chunk_metadata['entities_in_chunk'][:5])}")
            if meta_info: context_part += f"\n[{' | '.join(meta_info)}]"
            
            context_part += f"\n\n{chunk['chunk_text']}"
            context_parts.append(context_part)
        
        summary_header = "## DATA STRUCTURE OVERVIEW\n"
        if metadata_summary['all_scenarios']: summary_header += f"Available Entities: {', '.join(list(metadata_summary['all_scenarios'])[:10])}\n"
        
        context = summary_header + "\n\n---\n\n".join(context_parts)
        return {"success": True, "context": context, "chunks": chunks, "found_chunks": len(chunks)}
    except Exception as e:
        logger.error(f"RAG query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
async def rag_chat(request: RAGRequest):
    """
    Chat interface with RAG support
    """
    try:
        return await rag_analyze(request)
    except Exception as e:
        logger.error(f"RAG chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
