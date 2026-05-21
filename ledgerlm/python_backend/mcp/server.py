"""
MCP Server for LedgerLM Document Processing
Provides tools for document processing, embedding generation, and RAG queries
"""
import asyncio
import logging
from typing import Any, Dict, List
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import (
    store_document_chunks,
    store_vector_embeddings,
    search_similar_chunks,
    update_processing_status,
    get_processing_status
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MCPServer:
    """MCP Server for orchestrating document processing workflows"""
    
    def __init__(self):
        self.tools = {
            "process_document": self.process_document,
            "search_documents": self.search_documents,
            "generate_embeddings": self.generate_embeddings,
            "rag_query": self.rag_query,
            "get_status": self.get_processing_status,
        }
    
    async def process_document(self, document_id: str, file_path: str) -> Dict[str, Any]:
        """
        Process a document: extract text, chunk, and prepare for embedding
        """
        try:
            import sys
            import os
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
            
            from services.document_processor import process_single_document as process_doc_func
            from services.company_extractor import CompanyExtractor
            from services.vector_store import chunk_text
            
            logger.info(f"Processing document {document_id}")
            update_processing_status(document_id, 'processing')
            
            # Read file content for process_single_document
            with open(file_path, 'rb') as f:
                file_content = f.read()
            filename = os.path.basename(file_path)
            
            # Process document
            processed_data = process_doc_func(file_content, filename)
            
            # Extract company name
            extractor = CompanyExtractor()
            filename = os.path.basename(file_path)
            
            # Extract text
            full_text = ""
            if isinstance(processed_data, dict) and 'content' in processed_data:
                content = processed_data['content']
                if isinstance(content, list):
                    full_text = '\n\n'.join([page.get('text', '') for page in content if isinstance(page, dict)])
                elif isinstance(content, str):
                    full_text = content
            elif isinstance(processed_data, list):
                full_text = '\n\n'.join([item.get('text', '') for item in processed_data if isinstance(item, dict)])
            
            company_info = extractor.extract_company_name(full_text, filename)
            company_name = company_info.get('primary_company')
            
            # Chunk the text
            chunks = chunk_text(full_text, doc_id=document_id)
            
            # Store chunks
            chunk_ids = store_document_chunks(document_id, chunks)
            
            update_processing_status(
                document_id,
                'processing',
                total_chunks=len(chunks),
                company_name=company_name
            )
            
            return {
                "success": True,
                "document_id": document_id,
                "chunks": len(chunks),
                "chunk_ids": chunk_ids,
                "company_name": company_name
            }
            
        except Exception as e:
            logger.error(f"Document processing failed: {e}")
            update_processing_status(document_id, 'failed', error_message=str(e))
            return {"success": False, "error": str(e)}
    
    async def generate_embeddings(self, chunk_ids: List[str] = None) -> Dict[str, Any]:
        """
        Generate embeddings for document chunks
        """
        if chunk_ids is None:
            chunk_ids = []
            
        try:
            import sys
            import os
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
            
            from services.vector_store import get_embeddings
            import psycopg2
            from config import settings
            
            # Get chunk texts
            conn = psycopg2.connect(settings.DATABASE_URL)
            cur = conn.cursor()
            
            placeholders = ','.join(['%s'] * len(chunk_ids))
            cur.execute(f"""
                SELECT id, chunk_text FROM document_chunks 
                WHERE id IN ({placeholders})
            """, chunk_ids)
            
            chunks = cur.fetchall()
            cur.close()
            conn.close()
            
            # Generate embeddings
            texts = [chunk[1] for chunk in chunks]
            embeddings, _ = get_embeddings(texts)
            
            # Store embeddings
            for chunk_id, embedding in zip(chunk_ids, embeddings):
                store_vector_embeddings(chunk_id, embedding)
            
            return {
                "success": True,
                "embedded_chunks": len(chunk_ids)
            }
            
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def search_documents(self, query: str, document_ids: List[str] = None, top_k: int = 5) -> Dict[str, Any]:
        """
        Search for relevant document chunks using semantic search
        """
        try:
            import sys
            import os
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
            
            from services.vector_store import get_embeddings
            
            # Generate query embedding
            query_embedding, _ = get_embeddings([query])
            query_embedding = query_embedding[0]
            
            # Search similar chunks
            results = search_similar_chunks(query_embedding, document_ids, top_k)
            
            return {
                "success": True,
                "query": query,
                "results": results,
                "count": len(results)
            }
            
        except Exception as e:
            logger.error(f"Document search failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def rag_query(self, query: str, document_ids: List[str] = None, chat_history: List[Dict] = None) -> Dict[str, Any]:
        """
        Perform RAG-enhanced query with document context
        """
        if chat_history is None:
            chat_history = []
            
        try:
            import sys
            import os
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
            
            from services.vector_store import get_embeddings
            from services.rag_engine import synthesize_web_and_document_results, perform_web_search, should_search_web
            from openai import OpenAI
            from config import settings
            
            # Generate query embedding and search
            query_embedding, _ = get_embeddings([query])
            query_embedding = query_embedding[0]
            chunks = search_similar_chunks(query_embedding, document_ids, top_k=5)
            
            # Build context
            context = "\n\n".join([chunk['chunk_text'] for chunk in chunks])
            
            # Generate answer
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            
            system_prompt = """You are LedgerLM, an expert financial analysis assistant.
            Analyze the provided financial documents and answer questions with precision and depth."""
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Context from documents:\n{context}\n\nQuestion: {query}"}
            ]
            
            if chat_history:
                for msg in chat_history[-5:]:
                    messages.insert(-1, msg)
            
            response = client.chat.completions.create(
                model=settings.OPENAI_CHAT_MODEL,
                messages=messages,  # type: ignore
                temperature=0.2,
                max_tokens=2000
            )
            
            answer = response.choices[0].message.content or ""
            
            # Check if web search needed
            web_results = []
            if answer and should_search_web(query, answer):
                web_results = perform_web_search(query, num_results=3)
                if web_results:
                    answer = synthesize_web_and_document_results(query, answer, web_results)
            
            return {
                "success": True,
                "query": query,
                "answer": answer,
                "chunks": chunks[:3],
                "web_enhanced": len(web_results) > 0
            }
            
        except Exception as e:
            logger.error(f"RAG query failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_processing_status(self, document_id: str) -> Dict[str, Any]:
        """
        Get document processing status
        """
        try:
            status = get_processing_status(document_id)
            return {"success": True, "status": status}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def call_tool(self, tool_name: str, **kwargs) -> Dict[str, Any]:
        """
        Call a tool by name with parameters
        """
        if tool_name not in self.tools:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}
        
        tool_func = self.tools[tool_name]
        return await tool_func(**kwargs)

# Singleton instance
mcp_server = MCPServer()
