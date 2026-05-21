import os
# import faiss  # Replaced with pgvector
import numpy as np
from openai import OpenAI
import pickle
import tempfile
import uuid
import logging
from database_utils import (
    store_document_chunks, store_vector_embeddings, 
    search_similar_chunks, is_database_available
)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# OpenAI client will be lazily initialized in get_embeddings()
_openai_client = None

def _get_openai_client():
    """Lazy initialization of Ollama client (OpenAI compatible)"""
    global _openai_client
    if _openai_client is None:
        from config import settings
        api_key = settings.OLLAMA_API_KEY
        # Ensure base_url is the root for OpenAI client as it appends /v1 internally
        base_url = settings.OLLAMA_BASE_URL.replace("/v1", "").rstrip("/")
        
        _openai_client = OpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=600,
            max_retries=5
        )
    return _openai_client

# Constants - Updated for Ollama/mxbai-embed-large
EMBED_MODEL = "mxbai-embed-large"
CHUNK_SIZE = 1500    # ~400 tokens — safely within mxbai-embed-large's 512 token limit
CHUNK_OVERLAP = 150  # ~10% overlap, proportional to chunk size
MAX_FILE_SIZE = 2000 * 1024 * 1024  # 2GB maximum file size for large financial files

# Token limits for embeddings (mxbai-embed-large supports up to 512 tokens per chunk)
MAX_TOKENS_PER_CHUNK = 400  # Safe limit for mxbai-embed-large (512 token max)
ENTERPRISE_ROWS_PER_CHUNK = 20  # For wide financial tables (50+ columns)

def chunk_text(text, doc_id="", chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP):
    """
    Split text into overlapping chunks of approximately chunk_size characters.
    Each chunk includes metadata about its source document.
    Enhanced for better handling of large documents with smarter text splitting.
    """
    # For very short texts, just return as a single chunk
    if len(text) <= chunk_size:
        return [{"text": text, "doc_id": doc_id, "chunk_num": 0, "page_info": "full document"}]
    
    chunks = []
    start = 0
    chunk_num = 0
    
    # For large documents, provide better logging
    if len(text) > 500000:  # For texts over 500KB
        logger.info(f"Chunking large text ({len(text)/1000:.1f} KB) for document ID: {doc_id}")
    
    while start < len(text):
        end = start + chunk_size
        if end >= len(text):
            # This is the last chunk
            chunks.append({
                "text": text[start:],
                "doc_id": doc_id,
                "chunk_num": chunk_num,
                "is_last_chunk": True
            })
            break
        
        # Try to find natural breakpoints in this order:
        # 1. Section breaks (multiple newlines)
        # 2. Paragraph breaks (single newline)
        # 3. Sentence breaks (period, question mark, exclamation mark)
        # 4. Fallback to word boundary
        
        # Initialize breakpoint to end position as default
        breakpoint = end
        
        # Look for section breaks (multiple newlines)
        section_break = text.find('\n\n', start + chunk_size - chunk_overlap, end)
        if section_break != -1:
            breakpoint = section_break + 2  # Include both newlines
        else:
            # Look for paragraph breaks (single newline)
            paragraph_break = text.rfind('\n', start + chunk_size - chunk_overlap, end)
            if paragraph_break != -1:
                breakpoint = paragraph_break + 1  # Include the newline
            else:
                # Look for sentence breaks
                sentence_break = -1
                for char in ['. ', '? ', '! ', ': ', '; ']:
                    sentence_break = text.rfind(char, start + chunk_size - chunk_overlap, end)
                    if sentence_break != -1:
                        # Include the punctuation and space
                        breakpoint = sentence_break + len(char)
                        break
                
                if sentence_break == -1:
                    # If no good breakpoint found, try breaking at a word boundary
                    space_pos = text.rfind(' ', start + chunk_size - chunk_overlap, end)
                    if space_pos != -1:
                        breakpoint = space_pos + 1  # Include the space
                    # breakpoint already set to end as fallback
        
        # Try to extract page information if present
        page_info = ""
        page_marker = text[start:breakpoint].find("Page ")
        if page_marker != -1:
            # Try to get page number
            page_text = text[start+page_marker:start+page_marker+15]  # Look at next 15 chars after "Page "
            page_info = page_text[:page_text.find('\n') if '\n' in page_text else len(page_text)]
        
        # Add chunk with metadata
        chunks.append({
            "text": text[start:breakpoint],
            "doc_id": doc_id,
            "chunk_num": chunk_num,
            "page_info": page_info if page_info else f"chunk {chunk_num+1}"
        })
        chunk_num += 1
        
        # Calculate next starting position with overlap
        start = breakpoint - chunk_overlap if breakpoint > chunk_overlap else breakpoint
    
    # Log chunking metrics for large documents
    if len(chunks) > 100:  # Only log for significantly large documents
        logger.info(f"Created {len(chunks)} chunks from document {doc_id}")
    
    return chunks


def chunk_structured_table(text, sheet_name="", columns=None, doc_id="", rows_per_chunk=ENTERPRISE_ROWS_PER_CHUNK):
    """
    LAYER 2 FIX: Table-aware chunking that preserves structure for financial analysis
    
    Instead of splitting text arbitrarily, this function:
    1. Keeps column headers with EVERY chunk
    2. Chunks by logical table rows (not random character count)
    3. Preserves entity-value relationships (Korea stays with Korea's data)
    4. Adds structured metadata to help AI understand table context
    
    Args:
        text: The full table text (e.g., from Excel sheet)
        sheet_name: Name of the sheet (e.g., "Cashflow Report")
        columns: List of column headers
        doc_id: Document ID
        rows_per_chunk: Number of data rows per chunk (default 20 for wide financial tables with 50+ columns)
    
    Returns:
        List of chunks where each chunk contains headers + data rows + metadata
    
    Token-aware: 20 rows/chunk keeps chunks under 400 tokens for mxbai-embed-large limit (512)
    """
    chunks = []
    
    # Parse the text into lines
    lines = text.split('\n')
    if not lines:
        return [{"text": text, "doc_id": doc_id, "chunk_num": 0, "metadata": {}}]
    
    # Extract header section (everything before the data rows)
    # Look for common patterns: "Sheet:", "===", column separators "|"
    header_end_idx = 0
    header_lines = []
    data_start_idx = 0
    
    for idx, line in enumerate(lines):
        # Check if this looks like a data row (contains mostly values, not labels)
        if '|' in line and not line.strip().startswith('Sheet:') and not line.strip().startswith('='):
            # First pipe-separated line after sheet name = column headers
            if not header_lines:
                header_lines = lines[:idx+1]
                header_end_idx = idx
                data_start_idx = idx + 1
            break
    
    if not header_lines:
        # Fallback: use first few lines as headers
        header_lines = lines[:min(5, len(lines))]
        data_start_idx = len(header_lines)
    
    header_text = '\n'.join(header_lines)
    
    # Split remaining lines into chunks of rows
    data_lines = lines[data_start_idx:]
    
    if not data_lines:
        # No data rows, return header only
        return [{
            "text": header_text,
            "doc_id": doc_id,
            "chunk_num": 0,
            "metadata": {
                "sheet_name": sheet_name,
                "is_header_only": True,
                "columns": columns or []
            }
        }]
    
    # Create chunks with headers + batch of rows
    chunk_num = 0
    for i in range(0, len(data_lines), rows_per_chunk):
        batch_rows = data_lines[i:i + rows_per_chunk]
        
        # Combine header + this batch of rows
        chunk_text = header_text + '\n' + '\n'.join(batch_rows)
        
        # Extract entities/values from this batch for metadata
        batch_entities = []
        for row in batch_rows:
            # Extract first column value (often entity name like "Korea", "Japan")
            if '|' in row:
                parts = row.split('|')
                if len(parts) > 0:
                    entity = parts[0].strip()
                    if entity and not entity.startswith('-') and not entity.replace('.', '').replace(',', '').isdigit():
                        batch_entities.append(entity)
        
        chunks.append({
            "text": chunk_text,
            "doc_id": doc_id,
            "chunk_num": chunk_num,
            "metadata": {
                "sheet_name": sheet_name,
                "columns": columns or [],
                "row_range": f"{i+1}-{min(i+rows_per_chunk, len(data_lines))}",
                "total_rows": len(data_lines),
                "entities_in_chunk": list(set(batch_entities[:20])),  # First 20 unique entities
                "chunk_type": "structured_table"
            }
        })
        
        chunk_num += 1
    
    logger.info(f"Created {len(chunks)} table-aware chunks for '{sheet_name}' preserving structure")
    return chunks


def estimate_token_count(text):
    """
    Estimate token count for mxbai-embed-large.
    Uses character-based estimate (approx 4 chars per token).
    """
    if not text:
        return 0
    return len(text) // 4

def split_text_by_tokens(text, max_tokens=MAX_TOKENS_PER_CHUNK):
    """
    Split text into smaller pieces if it exceeds max_tokens.
    Uses token estimation to ensure pieces stay within model limits.
    Returns list of text pieces.
    """
    actual_tokens = estimate_token_count(text)
    
    if actual_tokens <= max_tokens:
        return [text]
    
    # Use binary search approach to find actual safe split points
    pieces = []
    remaining = text
    
    while remaining:
        remaining_tokens = estimate_token_count(remaining)
        if remaining_tokens <= max_tokens:
            pieces.append(remaining)
            break
        
        # Start with a conservative estimate based on ratio
        ratio = max_tokens / remaining_tokens
        initial_split = int(len(remaining) * ratio * 0.9)  # 90% of estimate for safety
        
        # Find a good break point near this position
        split_point = initial_split
        
        # Look for newline near the split point
        search_start = max(0, int(initial_split * 0.7))
        search_end = min(len(remaining), int(initial_split * 1.1))
        newline_pos = remaining.rfind('\n', search_start, search_end)
        if newline_pos != -1:
            split_point = newline_pos + 1
        else:
            # Try to break at space
            space_pos = remaining.rfind(' ', search_start, search_end)
            if space_pos != -1:
                split_point = space_pos + 1
        
        # Verify the piece is within token limit, shrink if needed
        piece = remaining[:split_point]
        while estimate_token_count(piece) > max_tokens and split_point > 100:
            split_point = int(split_point * 0.8)
            # Find nearest break point
            newline_pos = remaining.rfind('\n', 0, split_point)
            if newline_pos > split_point // 2:
                split_point = newline_pos + 1
            piece = remaining[:split_point]
        
        pieces.append(piece)
        remaining = remaining[split_point:]
    
    logger.info(f"Split text ({actual_tokens} tokens) into {len(pieces)} pieces")
    return pieces

def get_embeddings(texts, ai_config=None):
    """
    Generate embeddings for a list of texts.

    ai_config: optional dict with Azure OpenAI credentials:
        {
            "provider": "azure_openai",
            "endpoint": "https://xxx.cognitiveservices.azure.com",
            "api_key": "...",
            "embedding_model": "text-embedding-3-large",   # deployment name
            "embedding_api_version": "2024-02-01",
        }
    When ai_config is None or provider != "azure_openai", falls back to Ollama.
    Returns (embeddings, total_tokens_estimate).
    """
    import time
    import requests
    from config import settings
    if not texts: return [], []
    # Support both plain strings and chunk dicts ({"text": ..., ...})
    raw_strings = []
    for item in texts:
        if isinstance(item, dict):
            raw_strings.append(item.get('text', ''))
        else:
            raw_strings.append(str(item))
    processed_texts = [t.replace("\n", " ") for t in raw_strings]
    all_embeddings = []

    use_azure = (
        ai_config is not None
        and ai_config.get("provider") == "azure_openai"
        and ai_config.get("endpoint")
        and ai_config.get("api_key")
        and ai_config.get("embedding_model")
    )

    if use_azure:
        endpoint = ai_config["endpoint"].rstrip("/")
        api_key = ai_config["api_key"]
        deployment = ai_config["embedding_model"]
        api_version = ai_config.get("embedding_api_version", "2024-02-01")
        url = f"{endpoint}/openai/deployments/{deployment}/embeddings?api-version={api_version}"
        expected_dims = 3072  # text-embedding-3-large default

        logger.info(f"[Azure Embeddings] Using deployment '{deployment}' at {endpoint}")

        for text in processed_texts:
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    response = requests.post(
                        url,
                        json={"input": text},
                        headers={"Content-Type": "application/json", "api-key": api_key},
                        timeout=60,
                        verify=True
                    )
                    response.raise_for_status()
                    embedding = response.json()["data"][0]["embedding"]
                    all_embeddings.append(embedding)
                    break
                except Exception as e:
                    if attempt < max_retries - 1:
                        time.sleep(1)
                    else:
                        logger.error(f"Azure embedding failed after {max_retries} attempts: {e}")
                        all_embeddings.append([0.0] * expected_dims)
    else:
        base_url = settings.OLLAMA_BASE_URL.replace("/v1", "").rstrip("/")
        for text in processed_texts:
            # Hard safety cap: mxbai-embed-large has 512 token limit (~1800 chars)
            # Truncate any chunk that somehow exceeds this to avoid "input length exceeds context length" errors
            if len(text) > 1800:
                text = text[:1800]
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    response = requests.post(
                        f"{base_url}/embeddings",
                        json={"model": settings.OPENAI_EMBEDDING_MODEL, "text": text},
                        headers={"x-api-key": settings.OLLAMA_API_KEY},
                        timeout=60,
                        verify=False
                    )
                    response.raise_for_status()
                    all_embeddings.append(response.json()["embedding"])
                    break
                except Exception as e:
                    if attempt < max_retries - 1:
                        time.sleep(1)
                    else:
                        all_embeddings.append([0.0] * 1024)

    return all_embeddings, processed_texts
    """
    Create a vector store from multiple documents.
    Documents is either:
    - A list of strings (backwards compatibility)
    - A list of dicts with 'text' and 'id' keys
    
    Returns a dictionary with the vector store and metadata needed for retrieval.
    """
    all_chunks = []
    
    # Validate input
    if not documents or len(documents) == 0:
        raise ValueError("No documents provided for vector store creation")
    
    # Handle both document formats for backward compatibility
    if isinstance(documents, list):
        if len(documents) > 0:
            if isinstance(documents[0], str):
                # Legacy format: list of text strings
                for i, doc_text in enumerate(documents):
                    if doc_text and doc_text.strip():  # Skip empty documents
                        doc_id = f"doc_{i}"
                        doc_chunks = chunk_text(doc_text, doc_id)
                        all_chunks.extend(doc_chunks)
            else:
                # New format: list of document objects
                for doc in documents:
                    # Try multiple possible text fields
                    doc_text = ""
                    
                    # First try simple text fields
                    if doc.get("text") and isinstance(doc.get("text"), str):
                        doc_text = doc.get("text")
                    elif doc.get("total_text") and isinstance(doc.get("total_text"), str):
                        doc_text = doc.get("total_text")
                    
                    # If content is a list (like pages), extract text
                    if not doc_text and doc.get("content"):
                        content = doc.get("content")
                        if isinstance(content, list):
                            doc_text = '\n\n'.join([page.get('text', '') for page in content if isinstance(page, dict) and page.get('text')])
                        elif isinstance(content, str):
                            doc_text = content
                    
                    # Last resort - check if content field is actually a string
                    if not doc_text and doc.get("content") and isinstance(doc.get("content"), str):
                        doc_text = doc.get("content")
                    
                    if doc_text and doc_text.strip():  # Skip empty documents
                        # Use document name or filename as ID for better identification
                        doc_id = doc.get("name", doc.get("filename", doc.get("id", f"doc_{uuid.uuid4()}")))
                        # Clean up document ID to remove file extensions and make it readable
                        if doc_id.endswith('.pdf'):
                            doc_id = doc_id[:-4]
                        doc_chunks = chunk_text(doc_text, doc_id)
                        all_chunks.extend(doc_chunks)
    
    if not all_chunks:
        raise ValueError("No valid text content found in documents")
    
    logger.info(f"Created {len(all_chunks)} chunks from documents")
    
    try:
        # Get embeddings for chunks
        embeddings, processed_chunks = get_embeddings(all_chunks)
        # Use processed_chunks in case any were split due to token limits
        all_chunks = processed_chunks
        
        if not embeddings:
            raise ValueError("Failed to generate embeddings for document chunks")
        
        # Use pgvector for storage if database is available
        if is_database_available():
            logger.info("Using pgvector database storage for vector embeddings")
            
            # Group chunks by document for database storage
            doc_chunks_map = {}
            for i, chunk in enumerate(all_chunks):
                doc_id = chunk.get("doc_id", f"doc_{i}")
                if doc_id not in doc_chunks_map:
                    doc_chunks_map[doc_id] = {
                        "chunks": [],
                        "embeddings": []
                    }
                doc_chunks_map[doc_id]["chunks"].append(chunk)
                doc_chunks_map[doc_id]["embeddings"].append(embeddings[i])
            
            all_chunk_ids = []
            document_ids = list(doc_chunks_map.keys())
            
            # Store chunks and embeddings for each document
            for doc_id, data in doc_chunks_map.items():
                # Use document database ID if available, otherwise we need to create/find the document
                actual_doc_id = None
                
                # Try to get the actual document database ID from the first chunk
                first_chunk = data["chunks"][0] if data["chunks"] else {}
                if "document_db_id" in first_chunk:
                    actual_doc_id = first_chunk["document_db_id"]
                else:
                    # CRITICAL FIX: Don't attempt DB storage without proper Document.id UUID
                    logger.error(f"No document database ID found for doc_id {doc_id} - skipping pgvector storage for this document")
                    logger.error("This indicates a legacy caller that doesn't provide document_db_id")
                    continue  # Skip this document rather than risk FK constraint violations
                
                # Store document chunks in database using proper document ID
                chunk_ids = store_document_chunks(actual_doc_id, data["chunks"])
                
                if chunk_ids:
                    # Store vector embeddings
                    if store_vector_embeddings(chunk_ids, data["embeddings"]):
                        all_chunk_ids.extend(chunk_ids)
                        logger.info(f"Stored {len(chunk_ids)} chunks and embeddings for document {doc_id}")
                    else:
                        logger.error(f"Failed to store embeddings for document {doc_id}")
                else:
                    logger.error(f"Failed to store chunks for document {doc_id}")
            
            # Create pgvector-based vector store metadata
            vector_store = {
                "pgvector": True,
                "chunk_ids": all_chunk_ids,
                "chunks": all_chunks,  # Keep for compatibility
                "embeddings": embeddings,  # Keep for compatibility
                "document_ids": document_ids,
                "document_count": len(document_ids),
                "total_chunks": len(all_chunk_ids)
            }
            
            logger.info(f"Pgvector store created with {len(all_chunk_ids)} chunks across {len(document_ids)} documents")
            return vector_store
            
        else:
            # Fallback to in-memory storage when database not available
            logger.warning("Database not available - falling back to in-memory vector storage")
            
            # Create in-memory vector store (simplified without FAISS)
            vector_store = {
                "pgvector": False,
                "chunks": all_chunks,
                "embeddings": embeddings,
                "document_ids": [chunk["doc_id"] for chunk in all_chunks],
                "document_count": len(set(chunk["doc_id"] for chunk in all_chunks))
            }
            
            logger.info(f"In-memory vector store created with {len(all_chunks)} chunks across {vector_store['document_count']} documents")
            return vector_store
        
    except Exception as e:
        logger.error(f"Failed to create vector store: {str(e)}")
        raise

def search_vector_store(query, vector_store, top_k=5, filter_doc_id=None, include_metadata=False):
    """
    Search the vector store for chunks similar to the query.
    Returns the top_k most similar chunks with optional metadata.
    
    Parameters:
    - query: String with the search query
    - vector_store: Vector store dictionary
    - top_k: Maximum number of results to return
    - filter_doc_id: Optional document ID to filter results
    - include_metadata: If True, return chunks with metadata (for visualization)
    """
    try:
        # Get embedding for the query
        query_embedding, _ = get_embeddings([query])
        query_embedding = query_embedding[0]
        
        # Use pgvector search if available
        if vector_store.get("pgvector") and is_database_available():
            logger.info("Using pgvector database search")
            
            # Use session-based search if filter_doc_id is provided
            # Note: This assumes filter_doc_id is actually a session_id for pgvector search
            session_id = filter_doc_id if filter_doc_id else None
            
            # Search using pgvector
            search_results = search_similar_chunks(
                query_embedding=query_embedding,
                session_id=session_id,
                top_k=top_k
            )
            
            # Convert pgvector results to expected format
            results = []
            for result in search_results:
                if include_metadata:
                    results.append({
                        "text": result["text"],
                        "similarity": result["similarity_score"],
                        "chunk_id": result["chunk_id"],
                        "chunk_number": result["chunk_number"],
                        "filename": result["filename"],
                        "company_name": result["company_name"],
                        "metadata": result["metadata"]
                    })
                else:
                    results.append(result["text"])
            
            logger.info(f"Pgvector search returned {len(results)} results")
            return results
            
        else:
            # Fallback to in-memory search
            logger.info("Using in-memory fallback search")
            
            if not vector_store.get("chunks") or not vector_store.get("embeddings"):
                logger.error("Vector store missing chunks or embeddings for fallback search")
                return []
            
            # Calculate similarities manually
            query_vector = np.array(query_embedding)
            similarities = []
            
            for i, embedding in enumerate(vector_store["embeddings"]):
                # Calculate cosine similarity
                embedding_vector = np.array(embedding)
                similarity = np.dot(query_vector, embedding_vector) / (
                    np.linalg.norm(query_vector) * np.linalg.norm(embedding_vector)
                )
                similarities.append((similarity, i))
            
            # Sort by similarity (descending)
            similarities.sort(reverse=True)
            
            # Get top results with optional document filtering
            results = []
            for similarity_score, idx in similarities:
                if len(results) >= top_k:
                    break
                    
                chunk = vector_store["chunks"][idx]
                
                # Apply document filtering if specified
                if filter_doc_id:
                    chunk_doc_id = chunk.get("doc_id") if isinstance(chunk, dict) else None
                    if chunk_doc_id and chunk_doc_id != filter_doc_id:
                        continue
                
                # For backwards compatibility - if chunk is a string
                if isinstance(chunk, str):
                    if include_metadata:
                        results.append({
                            "text": chunk,
                            "similarity": similarity_score,
                            "chunk_index": idx,
                            "doc_id": "legacy_doc"
                        })
                    else:
                        results.append(chunk)
                else:
                    # Handle dictionary chunks
                    if include_metadata:
                        results.append({
                            "text": chunk.get("text", ""),
                            "similarity": similarity_score,
                            "chunk_index": idx,
                            "doc_id": chunk.get("doc_id", "unknown"),
                            "chunk_num": chunk.get("chunk_num", 0)
                        })
                    else:
                        results.append(chunk.get("text", ""))
        
        logger.info(f"Found {len(results)} results for query")
        return results
    except Exception as e:
        logger.error(f"Error searching vector store: {str(e)}")
        raise

def search_across_documents(query, vector_store, top_k=3):
    """
    Search across all documents and return results grouped by document.
    This allows comparing information from multiple documents.
    
    Returns a dictionary with document IDs as keys and relevant chunks as values.
    """
    try:
        # Get embedding for the query
        query_embedding, _ = get_embeddings([query])
        query_embedding = query_embedding[0]
        query_vector = np.array([query_embedding]).astype('float32')
        
        # Determine how many documents we have
        doc_ids = set()
        for chunk in vector_store["chunks"]:
            if isinstance(chunk, dict) and "doc_id" in chunk:
                doc_ids.add(chunk["doc_id"])
        
        # Get more results to ensure coverage across documents
        search_k = top_k * len(doc_ids) * 2
        search_k = min(search_k, len(vector_store["chunks"]))
        
        # Ensure we have a valid FAISS index
        if not hasattr(vector_store["index"], 'search'):
            logger.error(f"Invalid vector store index type: {type(vector_store['index'])}")
            raise ValueError("Vector store index is not a valid FAISS index object")
        
        D, I = vector_store["index"].search(query_vector, search_k)
        
        # Group results by document
        results_by_doc = {}
        
        for i, idx in enumerate(I[0]):
            chunk = vector_store["chunks"][idx]
            
            # Skip if it's an old-format chunk (string)
            if isinstance(chunk, str):
                continue
                
            doc_id = chunk["doc_id"]
            
            # Initialize document entry if it doesn't exist
            if doc_id not in results_by_doc:
                results_by_doc[doc_id] = []
            
            # Add result if we haven't reached the limit for this document
            if len(results_by_doc[doc_id]) < top_k:
                results_by_doc[doc_id].append({
                    "text": chunk["text"],
                    "similarity": float(D[0][i]),
                    "chunk_num": chunk.get("chunk_num", 0)
                })
        
        logger.info(f"Found results across {len(results_by_doc)} documents")
        return results_by_doc
    except Exception as e:
        logger.error(f"Error searching across documents: {str(e)}")
        raise
