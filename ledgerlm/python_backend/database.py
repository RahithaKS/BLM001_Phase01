"""Database utilities for PostgreSQL + pgvector"""
import os
import logging
import psycopg2
from psycopg2.extras import RealDictCursor, Json
import json
from typing import List, Dict, Any, Optional
from config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_db_connection():
    """Get PostgreSQL database connection"""
    try:
        conn = psycopg2.connect(settings.DATABASE_URL)
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise

def is_database_available() -> bool:
    """Check if database is available"""
    try:
        conn = get_db_connection()
        conn.close()
        return True
    except:
        return False

def sanitize_text_for_postgres(text: str) -> str:
    """Remove NUL characters and other invalid bytes that PostgreSQL can't store"""
    if not text:
        return ""
    # Remove NUL (0x00) characters which PostgreSQL text fields can't contain
    return text.replace('\x00', '')

def store_document_chunks(document_id: str, chunks: List[Dict[str, Any]]) -> List[str]:
    """
    Store document chunks in database
    Returns list of chunk IDs
    """
    conn = get_db_connection()
    cur = conn.cursor()
    chunk_ids = []
    
    try:
        for chunk in chunks:
            # Sanitize text to remove NUL characters that PostgreSQL can't store
            sanitized_text = sanitize_text_for_postgres(chunk['text'])
            
            cur.execute("""
                INSERT INTO document_chunks 
                (document_id, chunk_text, chunk_index, token_count, metadata)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, (
                document_id,
                sanitized_text,
                chunk.get('chunk_num', 0),
                chunk.get('token_count'),
                Json(chunk.get('metadata', {}))
            ))
            chunk_id = cur.fetchone()[0]
            chunk_ids.append(chunk_id)
        
        conn.commit()
        logger.info(f"Stored {len(chunk_ids)} chunks for document {document_id}")
        return chunk_ids
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to store chunks: {e}")
        raise
    finally:
        cur.close()
        conn.close()

def store_vector_embeddings(chunk_ids: List[str], embeddings: List[List[float]], model_name: str = "mxbai-embed-large") -> bool:
    """
    Store vector embeddings for multiple chunks using native pgvector format
    Optimized for batch insertion
    Returns True if successful
    """
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Validate inputs
        if len(chunk_ids) != len(embeddings):
            raise ValueError(f"Mismatch: {len(chunk_ids)} chunk IDs but {len(embeddings)} embeddings")
        
        # Register pgvector type
        from psycopg2.extensions import register_adapter, AsIs
        register_adapter(list, lambda l: AsIs(f'ARRAY{l}'))
        
        # Batch insert embeddings using native vector format
        for idx, (chunk_id, embedding) in enumerate(zip(chunk_ids, embeddings)):
            # Validate embedding is a list
            if not isinstance(embedding, list):
                logger.error(f"Embedding at index {idx} is type {type(embedding)}, expected list. Value: {str(embedding)[:100]}")
                raise TypeError(f"Embedding at index {idx} is {type(embedding).__name__}, expected list")
            
            # Convert Python list to PostgreSQL vector format
            try:
                vector_str = '[' + ','.join(str(x) for x in embedding) + ']'
            except TypeError as te:
                logger.error(f"Failed to convert embedding at index {idx} to string. Type: {type(embedding)}, Value: {str(embedding)[:100]}")
                raise TypeError(f"Cannot iterate over embedding at index {idx}: {te}")
            
            cur.execute("""
                INSERT INTO document_embeddings 
                (chunk_id, embedding, model_name)
                VALUES (%s, %s::vector, %s)
                RETURNING id
            """, (chunk_id, vector_str, model_name))
        
        conn.commit()
        logger.info(f"Stored {len(chunk_ids)} embeddings using native pgvector format")
        return True
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to store embeddings: {e}")
        raise
    finally:
        cur.close()
        conn.close()

def search_similar_chunks(query_embedding: List[float], document_ids: Optional[List[str]] = None, top_k: int = 5) -> List[Dict[str, Any]]:
    """
    Search for similar chunks using native pgvector cosine similarity with HNSW index
    This is 10-100x faster than computing similarity in Python
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Convert query embedding to pgvector format
        vector_str = '[' + ','.join(str(x) for x in query_embedding) + ']'
        
        # Build optimized query using pgvector's <=> operator for cosine distance
        # The HNSW index automatically accelerates this query
        # CRITICAL: If document_ids is explicitly an empty list, return no results
        # This ensures chats without attached documents don't search ALL user documents
        if document_ids is not None and len(document_ids) == 0:
            logger.info("No document IDs provided - returning empty results (not searching all documents)")
            return []
        
        base_query = """
            SELECT 
                dc.id,
                dc.document_id,
                dc.chunk_text,
                dc.chunk_index,
                dc.metadata,
                d.name as document_name,
                1 - (de.embedding <=> %s::vector) as similarity
            FROM document_chunks dc
            JOIN document_embeddings de ON dc.id = de.chunk_id
            JOIN documents d ON dc.document_id = d.id
            WHERE 1=1
        """
        
        params = [vector_str]
        
        if document_ids:
            placeholders = ','.join(['%s'] * len(document_ids))
            base_query += f" AND dc.document_id IN ({placeholders})"
            params.extend(document_ids)
        
        base_query += """
            ORDER BY de.embedding <=> %s::vector
            LIMIT %s
        """
        params.extend([vector_str, top_k])
        
        cur.execute(base_query, params)
        results = cur.fetchall()
        
        # Convert to list of dicts
        return [{
            'id': row['id'],
            'document_id': row['document_id'],
            'chunk_text': row['chunk_text'],
            'chunk_index': row['chunk_index'],
            'metadata': row['metadata'],
            'document_name': row['document_name'],
            'similarity': float(row['similarity'])
        } for row in results]
        
    except Exception as e:
        logger.error(f"Failed to search chunks: {e}", exc_info=True)
        return []
    finally:
        cur.close()
        conn.close()

def update_processing_status(document_id: str, status: str, **kwargs):
    """Update document processing status"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Build dynamic UPDATE query
        fields = ['status = %s']
        values = [status]
        
        for key, value in kwargs.items():
            if key in ['total_chunks', 'processed_chunks', 'company_name', 'error_message']:
                fields.append(f"{key} = %s")
                values.append(value)
        
        if status == 'processing' and 'started_at' not in kwargs:
            fields.append("started_at = NOW()")
        elif status in ['completed', 'failed']:
            fields.append("completed_at = NOW()")
        
        values.append(document_id)
        
        query = f"""
            UPDATE document_processing 
            SET {', '.join(fields)}
            WHERE document_id = %s
        """
        
        cur.execute(query, values)
        
        # If no rows updated, insert new record
        if cur.rowcount == 0:
            cur.execute("""
                INSERT INTO document_processing (document_id, status, total_chunks, processed_chunks, company_name, error_message)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                document_id,
                status,
                kwargs.get('total_chunks'),
                kwargs.get('processed_chunks'),
                kwargs.get('company_name'),
                kwargs.get('error_message')
            ))
        
        conn.commit()
        logger.info(f"Updated processing status for document {document_id}: {status}")
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to update processing status: {e}")
        raise
    finally:
        cur.close()
        conn.close()

def get_processing_status(document_id: str) -> Optional[Dict[str, Any]]:
    """Get document processing status"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute("""
            SELECT * FROM document_processing 
            WHERE document_id = %s
            ORDER BY created_at DESC
            LIMIT 1
        """, (document_id,))
        
        result = cur.fetchone()
        return dict(result) if result else None
        
    finally:
        cur.close()
        conn.close()
