#!/usr/bin/env python3
"""
Test RAG Flow - Understand how documents flow through the system
This script tests all 3 document sources:
1. Vault Documents (personal/attached)
2. Enterprise Data (Anaplan)
3. Combined search
"""

import os
import sys
import json

sys.path.insert(0, os.path.dirname(__file__))

from database import get_db_connection, search_similar_chunks
from config import settings
from psycopg2.extras import RealDictCursor

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)

def test_database_tables():
    """Check what data exists in each table"""
    print_section("STEP 1: DATABASE TABLES STATUS")
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    tables = [
        ("documents", "Personal Vault Documents"),
        ("document_chunks", "Personal Document Chunks"),
        ("document_embeddings", "Personal Embeddings (RAG)"),
        ("enterprise_documents", "Enterprise Documents (Anaplan)"),
        ("enterprise_document_chunks", "Enterprise Document Chunks"),
        ("enterprise_document_embeddings", "Enterprise Embeddings (RAG)"),
        ("chat_documents", "Chat -> Document Links"),
        ("user_settings", "User Enterprise Toggle Settings"),
    ]
    
    print(f"\n{'Table':<35} {'Count':>10}")
    print("-" * 50)
    
    for table, desc in tables:
        try:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = cur.fetchone()['count']
            print(f"{desc:<35} {count:>10}")
        except Exception as e:
            print(f"{desc:<35} {'ERROR':>10} - {e}")
    
    cur.close()
    conn.close()

def test_personal_documents():
    """Show personal vault documents"""
    print_section("STEP 2: PERSONAL VAULT DOCUMENTS")
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("""
        SELECT d.id, d.name, d.file_type, u.username as owner,
               COUNT(dc.id) as chunk_count
        FROM documents d
        JOIN users u ON d.user_id = u.id
        LEFT JOIN document_chunks dc ON d.id = dc.document_id
        GROUP BY d.id, d.name, d.file_type, u.username
        ORDER BY d.uploaded_at DESC
        LIMIT 10
    """)
    
    docs = cur.fetchall()
    
    if docs:
        print(f"\n{'Document Name':<40} {'Type':<10} {'Chunks':>8}")
        print("-" * 60)
        for doc in docs:
            name = doc['name'][:38] if len(doc['name']) > 38 else doc['name']
            print(f"{name:<40} {doc['file_type']:<10} {doc['chunk_count']:>8}")
    else:
        print("\n  No personal documents found!")
    
    cur.close()
    conn.close()
    return docs

def test_enterprise_documents():
    """Show enterprise documents (Anaplan)"""
    print_section("STEP 3: ENTERPRISE DOCUMENTS (ANAPLAN)")
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("""
        SELECT ed.id, ed.name, ed.source, ed.is_active, c.name as company,
               COUNT(ec.id) as chunk_count
        FROM enterprise_documents ed
        JOIN companies c ON ed.company_id = c.id
        LEFT JOIN enterprise_document_chunks ec ON ed.id = ec.document_id
        GROUP BY ed.id, ed.name, ed.source, ed.is_active, c.name
        ORDER BY ed.uploaded_at DESC
        LIMIT 10
    """)
    
    docs = cur.fetchall()
    
    if docs:
        print(f"\n{'Document Name':<35} {'Source':<15} {'Active':>6} {'Chunks':>8}")
        print("-" * 70)
        for doc in docs:
            name = doc['name'][:33] if len(doc['name']) > 33 else doc['name']
            active = 'Yes' if doc['is_active'] else 'No'
            print(f"{name:<35} {doc['source']:<15} {active:>6} {doc['chunk_count']:>8}")
    else:
        print("\n  No enterprise documents found!")
    
    cur.close()
    conn.close()
    return docs

def test_chat_document_links():
    """Show which documents are attached to which chats"""
    print_section("STEP 4: CHAT -> DOCUMENT ATTACHMENTS")
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("""
        SELECT c.id as chat_id, c.title, d.name as doc_name, cd.created_at
        FROM chat_documents cd
        JOIN chats c ON cd.chat_id = c.id
        JOIN documents d ON cd.document_id = d.id
        ORDER BY cd.created_at DESC
        LIMIT 15
    """)
    
    links = cur.fetchall()
    
    if links:
        print(f"\n{'Chat Title':<30} {'Attached Document':<35}")
        print("-" * 70)
        for link in links:
            title = (link['title'] or 'Untitled')[:28]
            doc = link['doc_name'][:33]
            print(f"{title:<30} {doc:<35}")
    else:
        print("\n  No documents attached to any chats yet!")
        print("  (Users need to select documents when creating/using chats)")
    
    cur.close()
    conn.close()

def test_user_enterprise_settings():
    """Show user enterprise toggle settings"""
    print_section("STEP 5: USER ENTERPRISE TOGGLE SETTINGS")
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("""
        SELECT u.username, us.enterprise_enabled, c.name as active_company
        FROM user_settings us
        JOIN users u ON us.user_id = u.id
        LEFT JOIN companies c ON us.active_company_id = c.id
        ORDER BY us.updated_at DESC
    """)
    
    settings_list = cur.fetchall()
    
    if settings_list:
        print(f"\n{'Username':<35} {'Enterprise':>10} {'Company':<20}")
        print("-" * 70)
        for s in settings_list:
            enabled = 'ON' if s['enterprise_enabled'] else 'OFF'
            company = s['active_company'] or 'None'
            print(f"{s['username']:<35} {enabled:>10} {company:<20}")
    else:
        print("\n  No user settings found (users haven't toggled enterprise data yet)")
    
    cur.close()
    conn.close()

def test_rag_search_personal(document_ids=None):
    """Test RAG search on personal documents"""
    print_section("STEP 6: TEST RAG SEARCH (PERSONAL DOCUMENTS)")
    
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '.'))
    
    try:
        from services.vector_store import get_embeddings
        
        test_query = "What is the revenue trend?"
        print(f"\n  Test Query: '{test_query}'")
        print(f"  Document IDs filter: {document_ids if document_ids else 'None (search all)'}")
        
        # Generate query embedding
        query_embedding, _ = get_embeddings([test_query])
        query_embedding = query_embedding[0]
        
        # Search
        results = search_similar_chunks(
            query_embedding,
            document_ids=document_ids,
            top_k=5
        )
        
        if results:
            print(f"\n  Found {len(results)} matching chunks:")
            print(f"\n  {'Document':<30} {'Similarity':>10} {'Preview':<40}")
            print("  " + "-" * 85)
            for r in results:
                doc_name = r['document_name'][:28] if len(r['document_name']) > 28 else r['document_name']
                preview = r['chunk_text'][:38].replace('\n', ' ')
                print(f"  {doc_name:<30} {r['similarity']:>10.4f} {preview:<40}")
        else:
            print("\n  No matching chunks found!")
            if document_ids == []:
                print("  (Empty document_ids list = intentionally returns nothing)")
            
    except Exception as e:
        print(f"\n  ERROR: {e}")

def test_rag_search_enterprise():
    """Test RAG search on enterprise documents"""
    print_section("STEP 7: TEST RAG SEARCH (ENTERPRISE DOCUMENTS)")
    
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '.'))
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Get company IDs
    cur.execute("SELECT id, name FROM companies LIMIT 5")
    companies = cur.fetchall()
    
    if not companies:
        print("\n  No companies found - enterprise data not available")
        cur.close()
        conn.close()
        return
    
    company_ids = [c['id'] for c in companies]
    print(f"\n  Companies: {[c['name'] for c in companies]}")
    
    try:
        from services.vector_store import get_embeddings
        
        test_query = "What is Korea revenue for FY25?"
        print(f"  Test Query: '{test_query}'")
        
        query_embedding, _ = get_embeddings([test_query])
        query_embedding = query_embedding[0]
        
        vector_str = '[' + ','.join(str(x) for x in query_embedding) + ']'
        
        cur.execute("""
            SELECT 
                ec.chunk_text,
                ed.name as document_name,
                ee.embedding <=> %s::vector as distance
            FROM enterprise_document_embeddings ee
            JOIN enterprise_document_chunks ec ON ee.chunk_id = ec.id
            JOIN enterprise_documents ed ON ec.document_id = ed.id
            WHERE ed.company_id = ANY(%s) AND ed.is_active = 1
            ORDER BY ee.embedding <=> %s::vector
            LIMIT 5
        """, (vector_str, company_ids, vector_str))
        
        results = cur.fetchall()
        
        if results:
            print(f"\n  Found {len(results)} matching enterprise chunks:")
            print(f"\n  {'Document':<35} {'Distance':>10} {'Preview':<40}")
            print("  " + "-" * 90)
            for r in results:
                doc_name = r['document_name'][:33]
                preview = r['chunk_text'][:38].replace('\n', ' ')
                similarity = 1.0 - float(r['distance'])
                print(f"  {doc_name:<35} {similarity:>10.4f} {preview:<40}")
        else:
            print("\n  No matching enterprise chunks found!")
            
    except Exception as e:
        print(f"\n  ERROR: {e}")
    
    cur.close()
    conn.close()

def test_combined_flow():
    """Test the full RAG flow as it happens in a real chat"""
    print_section("STEP 8: COMBINED RAG FLOW (AS USED IN CHAT)")
    
    print("""
    HOW IT WORKS IN A REAL CHAT:
    
    1. User creates/opens a chat
    2. User selects documents from Vault → stored in chat_documents table
    3. User asks a question
    4. System checks:
       a. Which document_ids are attached to this chat
       b. Is enterprise toggle ON for this user?
       c. What company_ids does user belong to?
    5. RAG query runs:
       a. Search personal docs (top 5) - ONLY selected docs
       b. Search enterprise docs (top 20) - IF toggle ON
       c. Merge results by similarity
    6. AI generates answer using merged chunks
    
    CRITICAL POINTS:
    - If NO documents selected → empty document_ids → NO personal search
    - If enterprise toggle OFF → NO enterprise search
    - If toggle ON but no company → NO enterprise search
    """)
    
    # Show a sample flow
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Get a sample chat with documents
    cur.execute("""
        SELECT c.id, c.title, c.user_id, u.username,
               array_agg(cd.document_id) as doc_ids,
               COUNT(cd.id) as doc_count
        FROM chats c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN chat_documents cd ON c.id = cd.chat_id
        WHERE cd.document_id IS NOT NULL
        GROUP BY c.id, c.title, c.user_id, u.username
        LIMIT 1
    """)
    
    sample = cur.fetchone()
    
    if sample:
        print(f"\n  SAMPLE CHAT FLOW:")
        print(f"  Chat: {sample['title'] or 'Untitled'}")
        print(f"  User: {sample['username']}")
        print(f"  Attached Docs: {sample['doc_count']}")
        print(f"  Document IDs: {sample['doc_ids'][:3]}...")  # First 3
        
        # Check user enterprise setting
        cur.execute("""
            SELECT enterprise_enabled, active_company_id
            FROM user_settings
            WHERE user_id = %s
        """, (sample['user_id'],))
        
        user_setting = cur.fetchone()
        if user_setting:
            print(f"  Enterprise Toggle: {'ON' if user_setting['enterprise_enabled'] else 'OFF'}")
            print(f"  Active Company: {user_setting['active_company_id'] or 'None'}")
    else:
        print("\n  No chats with attached documents found yet!")
    
    cur.close()
    conn.close()

def print_summary():
    """Print final summary"""
    print_section("SUMMARY: RAG DOCUMENT FLOW")
    
    print("""
    ┌─────────────────────────────────────────────────────────────────┐
    │                     DOCUMENT SOURCES                            │
    ├─────────────────────────────────────────────────────────────────┤
    │                                                                 │
    │  SOURCE 1: VAULT DOCUMENTS (Personal)                          │
    │  ─────────────────────────────────────────                      │
    │  • User uploads documents to /vault                             │
    │  • Stored in: documents, document_chunks, document_embeddings   │
    │  • MUST be selected in chat to be searched                      │
    │  • Selection stored in: chat_documents table                    │
    │                                                                 │
    │  SOURCE 2: ATTACHED DOCUMENTS (Same as Vault)                   │
    │  ─────────────────────────────────────────                      │
    │  • These ARE the vault documents selected for a chat            │
    │  • Shows as "Attached Documents (N)" in chat header             │
    │  • NOT a separate upload - just a reference                     │
    │                                                                 │
    │  SOURCE 3: ENTERPRISE DATA (Anaplan)                            │
    │  ─────────────────────────────────────────                      │
    │  • Admin uploads or Anaplan auto-sync                           │
    │  • Stored in: enterprise_documents, enterprise_document_chunks  │
    │  • User must toggle "Enterprise Data" ON in settings            │
    │  • User must belong to a company (company_memberships)          │
    │                                                                 │
    ├─────────────────────────────────────────────────────────────────┤
    │                     RAG QUERY FLOW                              │
    ├─────────────────────────────────────────────────────────────────┤
    │                                                                 │
    │  Question Asked → Generate Embedding → Search:                  │
    │                                                                 │
    │  1. Personal Search (if docs selected):                         │
    │     document_embeddings WHERE document_id IN (selected_ids)     │
    │     Returns: top 5 chunks                                       │
    │                                                                 │
    │  2. Enterprise Search (if toggle ON + company assigned):        │
    │     enterprise_document_embeddings WHERE company_id IN (...)    │
    │     Returns: top 20 chunks                                      │
    │                                                                 │
    │  3. Merge & Sort by similarity                                  │
    │     Combined top 20 chunks → AI Context                         │
    │                                                                 │
    └─────────────────────────────────────────────────────────────────┘
    """)

if __name__ == "__main__":
    print("\n" + "="*60)
    print("  LedgerLM RAG FLOW TEST")
    print("="*60)
    
    # Run all tests
    test_database_tables()
    personal_docs = test_personal_documents()
    test_enterprise_documents()
    test_chat_document_links()
    test_user_enterprise_settings()
    
    # Get first personal doc ID for testing
    if personal_docs:
        test_doc_ids = [personal_docs[0]['id']]
        test_rag_search_personal(document_ids=test_doc_ids)
    else:
        test_rag_search_personal(document_ids=None)
    
    test_rag_search_enterprise()
    test_combined_flow()
    print_summary()
    
    print("\n" + "="*60)
    print("  TEST COMPLETE")
    print("="*60 + "\n")
