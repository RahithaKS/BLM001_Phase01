"""
Embeddings and vector search API routes
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import sys
import logging

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from database import search_similar_chunks

logger = logging.getLogger(__name__)

router = APIRouter()

class SearchRequest(BaseModel):
    query: str
    document_ids: Optional[List[str]] = None
    top_k: int = 5

@router.post("/search")
async def semantic_search(request: SearchRequest):
    """
    Perform semantic search across documents
    """
    try:
        import sys
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))
        
        # Import vector_store module
        from services.vector_store import get_embeddings
        
        # Generate query embedding
        embeddings, _ = get_embeddings([request.query])
        query_embedding = embeddings[0]
        
        # Search similar chunks
        results = search_similar_chunks(
            query_embedding,
            document_ids=request.document_ids,
            top_k=request.top_k
        )
        
        return {
            "success": True,
            "query": request.query,
            "results": results,
            "count": len(results)
        }
        
    except Exception as e:
        logger.error(f"Semantic search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/documents/{document_id}/similar")
async def find_similar_chunks(document_id: str, query: str, top_k: int = 5):
    """Find similar chunks within a specific document"""
    try:
        import sys
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))
        
        from services.vector_store import get_embeddings
        
        # Generate query embedding
        embeddings, _ = get_embeddings([query])
        query_embedding = embeddings[0]
        
        # Search within specific document
        results = search_similar_chunks(
            query_embedding,
            document_ids=[document_id],
            top_k=top_k
        )
        
        return {
            "success": True,
            "document_id": document_id,
            "query": query,
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Similar chunks search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
