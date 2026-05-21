# LedgerLM Hybrid Architecture

## Overview
LedgerLM is an AI-powered financial analysis platform using a hybrid Node.js + Python architecture to deliver advanced RAG (Retrieval-Augmented Generation) capabilities for document analysis.

## System Architecture

### Frontend (React + Vite)
- **Technology**: React 18, TypeScript, TailwindCSS, Shadcn UI
- **Port**: 5000 (served by Vite dev server)
- **Features**:
  - Dashboard with analytics
  - Vault for document management with real-time processing status
  - Chat interface with AI financial analyst
  - Boards for organizing insights

### Backend Services

#### Node.js/Express Server (Port 5000)
**Responsibilities**:
- User authentication and session management
- File upload handling (multer)
- Core CRUD operations for chats, messages, documents
- Proxy routes to Python backend with authentication
- OpenAI integration for chat responses

**Key Routes**:
- `/api/auth/*` - Authentication
- `/api/chats/*` - Chat management
- `/api/documents/*` - Document upload/download
- `/api/documents/:id/process` - Proxy to Python for processing
- `/api/documents/:id/status` - Proxy to Python for status
- `/api/rag/analyze` - Proxy to Python for RAG analysis
- `/api/search` - Proxy to Python for semantic search

#### Python FastAPI Server (Port 8000)
**Responsibilities**:
- Document processing (17+ formats: PDF, DOCX, XLSX, CSV, images with OCR)
- Text chunking and embedding generation
- Vector similarity search
- RAG query processing
- Web search integration for enhanced context

**Key Routes**:
- `POST /api/v2/documents/process/{document_id}` - Process document
- `GET /api/v2/documents/{document_id}/status` - Get processing status
- `POST /api/v2/search` - Semantic search across documents
- `POST /api/v2/analyze` - RAG-enhanced analysis

**Core Modules** (from attached_assets):
- `multi_format_processor_1761731748085.py` - Multi-format document parsing
- `company_extractor_1761731748081.py` - Company name extraction
- `vector_store_1761731748083.py` - Text chunking and embeddings
- `rag_engine_1761731748086.py` - RAG orchestration
- `enhanced_web_search_1761731748084.py` - Google search integration
- `pdf_processor_1761731748087.py` - Advanced PDF processing

## Database Schema (PostgreSQL)

### Core Tables
- `users` - User accounts
- `chats` - Chat sessions
- `messages` - Chat messages
- `documents` - Uploaded documents metadata
- `boards` - Organization boards

### RAG Tables
- `document_chunks` - Text chunks with metadata
  - Links to documents
  - Stores chunk text, index, token count
  
- `document_embeddings` - Vector embeddings
  - Links to chunks
  - Stores embedding as JSON array
  - Model name (text-embedding-3-small)
  
- `document_processing` - Processing status tracking
  - Status: pending, processing, completed, failed
  - Progress tracking (total_chunks, processed_chunks)
  - Company name extraction
  - Error messages
  
- `chat_documents` - Chat-document associations
  - Links chats to relevant documents

## Document Processing Workflow

1. **Upload** (Node.js)
   - User uploads file via `/api/documents`
   - File saved to `uploads/` directory
   - Document metadata stored in PostgreSQL

2. **Trigger Processing** (Vault UI)
   - User clicks "Process Document" in Vault
   - Frontend calls `/api/documents/:id/process`
   - Node.js proxies to Python backend

3. **Background Processing** (Python)
   - Extract text from document (multi-format support)
   - Extract company name using NER
   - Chunk text into ~8000 character segments
   - Generate embeddings using OpenAI text-embedding-3-small
   - Store chunks and embeddings in PostgreSQL
   - Update processing status in real-time

4. **Status Monitoring** (Frontend)
   - Vault UI polls `/api/documents/:id/status` every 5 seconds
   - Displays real-time progress badges:
     - Pending
     - Processing (X/Y chunks)
     - Ready (N chunks)
     - Failed

## RAG Query Workflow

1. **User Query** (Chat Interface)
   - User asks question about documents
   - Frontend sends to Node.js backend

2. **Vector Search** (Python)
   - Generate query embedding
   - Compute cosine similarity with all chunk embeddings
   - Return top-k most similar chunks

3. **Context Building**
   - Combine relevant chunks into context
   - Include chat history for continuity

4. **LLM Generation** (OpenAI GPT-4o)
   - System prompt: Financial analysis expert
   - User query + document context
   - Temperature: 0.2 for consistency

5. **Web Enhancement** (Optional)
   - Detect if query needs current information
   - Perform Google search
   - Synthesize web + document results

6. **Response**
   - Return answer with sources
   - Track which chunks were used

## Vector Similarity Search

**Implementation**: Python-based cosine similarity
```python
def cosine_similarity(vec1, vec2):
    return dot(vec1, vec2) / (norm(vec1) * norm(vec2))
```

**Process**:
1. Load all candidate chunks from database
2. Parse JSON embeddings
3. Compute cosine similarity for each
4. Sort by similarity (descending)
5. Return top-k results

**Future Enhancement**: Migrate to pgvector extension for database-level similarity search at scale

## MCP (Model Context Protocol) Integration

The MCP server (`python_backend/mcp/server.py`) provides orchestration tools:

- `process_document` - Full document processing pipeline
- `generate_embeddings` - Batch embedding generation
- `search_documents` - Semantic search
- `rag_query` - Complete RAG workflow
- `get_status` - Processing status

These tools can be called independently or composed into workflows.

## Environment Configuration

### Required Secrets (Replit Secrets)
- `OPENAI_API_KEY` - For chat and embeddings
- `GOOGLE_API_KEY` - For web search (optional)
- `GOOGLE_CSE_ID` - Google Custom Search Engine (optional)
- `DATABASE_URL` - PostgreSQL connection (auto-configured)

### Python Configuration (`python_backend/config.py`)
- API host/port settings
- OpenAI model selection (gpt-4o, text-embedding-3-small)
- Chunking parameters (8000 chars, 1000 overlap)
- File size limits (500MB)

## Technology Stack

### Frontend
- React 18
- TypeScript
- Vite
- TailwindCSS
- Shadcn UI
- TanStack Query
- Wouter (routing)

### Backend (Node.js)
- Express
- Drizzle ORM
- Multer (file upload)
- OpenAI SDK
- Session management

### Backend (Python)
- FastAPI
- Uvicorn
- Pydantic
- OpenAI SDK
- psycopg2
- NumPy/SciPy

### Document Processing
- PyPDF2, pdf2image
- pytesseract (OCR)
- python-docx
- openpyxl
- pandas
- BeautifulSoup4

## API Flow Example

**Upload → Process → Query**

```
1. Upload: POST /api/documents (Node.js)
   ↓
2. Trigger: POST /api/documents/123/process (Node.js → Python)
   ↓
3. Process: Python extracts text, chunks, embeds
   ↓
4. Store: Chunks + embeddings → PostgreSQL
   ↓
5. Query: POST /api/rag/analyze (Node.js → Python)
   ↓
6. Search: Vector similarity → top chunks
   ↓
7. Generate: GPT-4o + context → answer
   ↓
8. Return: Answer + sources → Frontend
```

## Performance Considerations

- **Embedding Generation**: Batched processing (10 chunks at a time)
- **Status Updates**: Polling every 5 seconds (frontend)
- **Vector Search**: In-memory cosine similarity (suitable for <10k chunks)
- **Web Search**: Cached results, 3 results max
- **File Upload**: 50MB limit per file

## Security

- Authentication required for all document operations
- User ID validation on all proxied requests
- File type validation
- SQL injection prevention (parameterized queries)
- Environment secrets for API keys

## Deployment Notes

- Node.js server must start first (port 5000)
- Python server should run on port 8000
- Both servers share same PostgreSQL database
- CORS configured for cross-origin requests
- File uploads stored in `uploads/` directory

## Future Enhancements

1. **pgvector Integration**: Move similarity search to database for better performance
2. **Streaming Responses**: Stream RAG responses for better UX
3. **Document Versioning**: Track document updates
4. **Batch Processing**: Process multiple documents simultaneously
5. **Advanced Filtering**: Filter by company, date, document type
6. **Export Results**: Export analysis to PDF/DOCX
7. **Collaborative Features**: Share chats and insights
