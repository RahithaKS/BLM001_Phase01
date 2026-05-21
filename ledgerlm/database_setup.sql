-- ================================================
-- LedgerLM Complete Database Setup Script
-- Run this on your Azure VM PostgreSQL database
-- ================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ================================================
-- 1. USERS (Base table - no dependencies)
-- ================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    password TEXT,
    display_name TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'standard',
    last_login_at TIMESTAMP
);

-- ================================================
-- 2. INVITATIONS
-- ================================================
CREATE TABLE IF NOT EXISTS invitations (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    token TEXT NOT NULL UNIQUE,
    invited_by VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS invitations_email_idx ON invitations(email);
CREATE INDEX IF NOT EXISTS invitations_token_idx ON invitations(token);
CREATE INDEX IF NOT EXISTS invitations_status_idx ON invitations(status);
CREATE INDEX IF NOT EXISTS invitations_expires_at_idx ON invitations(expires_at);

-- ================================================
-- 3. OTP CODES
-- ================================================
CREATE TABLE IF NOT EXISTS otp_codes (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    consumed_at TIMESTAMP,
    attempts INTEGER NOT NULL DEFAULT 0,
    context VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS otp_codes_user_id_idx ON otp_codes(user_id);
CREATE INDEX IF NOT EXISTS otp_codes_expires_at_idx ON otp_codes(expires_at);
CREATE INDEX IF NOT EXISTS otp_codes_context_idx ON otp_codes(context);

-- ================================================
-- 4. DEVICE TRUST
-- ================================================
CREATE TABLE IF NOT EXISTS device_trust (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_token_hash TEXT NOT NULL UNIQUE,
    device_fingerprint TEXT,
    user_agent TEXT,
    ip_address VARCHAR(45),
    expires_at TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS device_trust_user_id_idx ON device_trust(user_id);
CREATE INDEX IF NOT EXISTS device_trust_device_token_hash_idx ON device_trust(device_token_hash);
CREATE INDEX IF NOT EXISTS device_trust_expires_at_idx ON device_trust(expires_at);

-- ================================================
-- 5. CHATS
-- ================================================
CREATE TABLE IF NOT EXISTS chats (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    preview TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chats_user_id_idx ON chats(user_id);

-- ================================================
-- 6. MESSAGES
-- ================================================
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id VARCHAR NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    role TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_chat_id_idx ON messages(chat_id);

-- ================================================
-- 7. DOCUMENTS
-- ================================================
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size TEXT NOT NULL,
    file_type TEXT NOT NULL,
    cloud_source TEXT,
    cloud_file_id TEXT,
    cloud_url TEXT,
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id);

-- ================================================
-- 8. BOARD TEMPLATES
-- ================================================
CREATE TABLE IF NOT EXISTS board_templates (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    default_config JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS board_templates_slug_idx ON board_templates(slug);

-- ================================================
-- 9. BOARDS
-- ================================================
CREATE TABLE IF NOT EXISTS boards (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id VARCHAR REFERENCES board_templates(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    analysis_template VARCHAR(50),
    settings JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boards_user_id_idx ON boards(user_id);
CREATE INDEX IF NOT EXISTS boards_template_id_idx ON boards(template_id);

-- ================================================
-- 10. BOARD THREADS
-- ================================================
CREATE TABLE IF NOT EXISTS board_threads (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id VARCHAR NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    chat_id VARCHAR NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS board_threads_board_id_idx ON board_threads(board_id);
CREATE INDEX IF NOT EXISTS board_threads_chat_id_idx ON board_threads(chat_id);
CREATE UNIQUE INDEX IF NOT EXISTS board_threads_unique_board_chat_idx ON board_threads(board_id, chat_id);

-- ================================================
-- 11. BOARD DOCUMENTS
-- ================================================
CREATE TABLE IF NOT EXISTS board_documents (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id VARCHAR NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    document_id VARCHAR NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS board_documents_board_id_idx ON board_documents(board_id);
CREATE INDEX IF NOT EXISTS board_documents_document_id_idx ON board_documents(document_id);
CREATE UNIQUE INDEX IF NOT EXISTS board_documents_unique_board_doc_idx ON board_documents(board_id, document_id);

-- ================================================
-- 12. BOARD DATA SOURCES
-- ================================================
CREATE TABLE IF NOT EXISTS board_data_sources (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id VARCHAR NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    result_limit INTEGER DEFAULT 10,
    timeout_seconds INTEGER DEFAULT 30,
    position INTEGER NOT NULL DEFAULT 0,
    config JSONB,
    manage_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS board_data_sources_board_id_idx ON board_data_sources(board_id);
CREATE INDEX IF NOT EXISTS board_data_sources_position_idx ON board_data_sources(board_id, position);

-- ================================================
-- 13. DOCUMENT CHUNKS
-- ================================================
CREATE TABLE IF NOT EXISTS document_chunks (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id VARCHAR NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    token_count INTEGER,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks(document_id);

-- ================================================
-- 14. DOCUMENT EMBEDDINGS (with pgvector)
-- ================================================
CREATE TABLE IF NOT EXISTS document_embeddings (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id VARCHAR NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    embedding vector(1536) NOT NULL,
    model_name VARCHAR(100) DEFAULT 'text-embedding-3-small',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS document_embeddings_chunk_id_idx ON document_embeddings(chunk_id);

-- ================================================
-- 15. DOCUMENT PROCESSING
-- ================================================
CREATE TABLE IF NOT EXISTS document_processing (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id VARCHAR NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    total_chunks INTEGER,
    processed_chunks INTEGER,
    company_name TEXT,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS document_processing_document_id_idx ON document_processing(document_id);

-- ================================================
-- 16. CHAT DOCUMENTS
-- ================================================
CREATE TABLE IF NOT EXISTS chat_documents (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id VARCHAR NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    document_id VARCHAR NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_documents_chat_id_idx ON chat_documents(chat_id);
CREATE INDEX IF NOT EXISTS chat_documents_document_id_idx ON chat_documents(document_id);

-- ================================================
-- 17. DATA SOURCES
-- ================================================
CREATE TABLE IF NOT EXISTS data_sources (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    label TEXT NOT NULL,
    config JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS data_sources_user_id_idx ON data_sources(user_id);
CREATE INDEX IF NOT EXISTS data_sources_type_idx ON data_sources(type);

-- ================================================
-- 18. CHAT SOURCES
-- ================================================
CREATE TABLE IF NOT EXISTS chat_sources (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id VARCHAR NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    source_id VARCHAR NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_sources_chat_id_idx ON chat_sources(chat_id);
CREATE INDEX IF NOT EXISTS chat_sources_source_id_idx ON chat_sources(source_id);

-- ================================================
-- 19. WEB SEARCH CACHE
-- ================================================
CREATE TABLE IF NOT EXISTS web_search_cache (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    query_hash VARCHAR(64) NOT NULL UNIQUE,
    query TEXT NOT NULL,
    results JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS web_search_cache_query_hash_idx ON web_search_cache(query_hash);
CREATE INDEX IF NOT EXISTS web_search_cache_expires_at_idx ON web_search_cache(expires_at);

-- ================================================
-- 20. QUERY AUDIT
-- ================================================
CREATE TABLE IF NOT EXISTS query_audit (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id VARCHAR NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    message_id VARCHAR REFERENCES messages(id) ON DELETE SET NULL,
    query TEXT NOT NULL,
    sources_used JSONB NOT NULL,
    sources_succeeded JSONB,
    sources_failed JSONB,
    latency_ms INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS query_audit_chat_id_idx ON query_audit(chat_id);
CREATE INDEX IF NOT EXISTS query_audit_message_id_idx ON query_audit(message_id);

-- ================================================
-- 21. COMPANIES
-- ================================================
CREATE TABLE IF NOT EXISTS companies (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS companies_slug_idx ON companies(slug);

-- ================================================
-- 22. COMPANY MEMBERSHIPS
-- ================================================
CREATE TABLE IF NOT EXISTS company_memberships (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS company_memberships_user_id_idx ON company_memberships(user_id);
CREATE INDEX IF NOT EXISTS company_memberships_company_id_idx ON company_memberships(company_id);

-- ================================================
-- 23. USER SETTINGS
-- ================================================
CREATE TABLE IF NOT EXISTS user_settings (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    enterprise_enabled INTEGER NOT NULL DEFAULT 0,
    active_company_id VARCHAR REFERENCES companies(id) ON DELETE SET NULL,
    updated_at TIMESTAnoMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_settings_user_id_idx ON user_settings(user_id);

-- ================================================
-- 24. ENTERPRISE DOCUMENTS
-- ================================================
CREATE TABLE IF NOT EXISTS enterprise_documents (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    uploaded_by VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size TEXT NOT NULL,
    file_type TEXT NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'manual',
    version INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    previous_version_id VARCHAR REFERENCES enterprise_documents(id) ON DELETE SET NULL,
    anaplan_metadata JSONB,
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS enterprise_documents_company_id_idx ON enterprise_documents(company_id);
CREATE INDEX IF NOT EXISTS enterprise_documents_uploaded_by_idx ON enterprise_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS enterprise_documents_source_idx ON enterprise_documents(source);
CREATE INDEX IF NOT EXISTS enterprise_documents_is_active_idx ON enterprise_documents(is_active);
CREATE INDEX IF NOT EXISTS enterprise_documents_version_idx ON enterprise_documents(version);

-- ================================================
-- 25. ENTERPRISE DOCUMENT CHUNKS
-- ================================================
CREATE TABLE IF NOT EXISTS enterprise_document_chunks (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id VARCHAR NOT NULL REFERENCES enterprise_documents(id) ON DELETE CASCADE,
    company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    token_count INTEGER,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS enterprise_document_chunks_document_id_idx ON enterprise_document_chunks(document_id);
CREATE INDEX IF NOT EXISTS enterprise_document_chunks_company_id_idx ON enterprise_document_chunks(company_id);

-- ================================================
-- 26. ENTERPRISE DOCUMENT EMBEDDINGS (with pgvector)
-- ================================================
CREATE TABLE IF NOT EXISTS enterprise_document_embeddings (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id VARCHAR NOT NULL REFERENCES enterprise_document_chunks(id) ON DELETE CASCADE,
    company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    embedding vector(1536) NOT NULL,
    model_name VARCHAR(100) DEFAULT 'text-embedding-3-small',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS enterprise_document_embeddings_chunk_id_idx ON enterprise_document_embeddings(chunk_id);
CREATE INDEX IF NOT EXISTS enterprise_document_embeddings_company_id_idx ON enterprise_document_embeddings(company_id);

-- ================================================
-- 27. ENTERPRISE DOCUMENT PROCESSING
-- ================================================
CREATE TABLE IF NOT EXISTS enterprise_document_processing (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id VARCHAR NOT NULL UNIQUE REFERENCES enterprise_documents(id) ON DELETE CASCADE,
    company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    total_chunks INTEGER,
    processed_chunks INTEGER,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS enterprise_document_processing_document_id_idx ON enterprise_document_processing(document_id);
CREATE INDEX IF NOT EXISTS enterprise_document_processing_company_id_idx ON enterprise_document_processing(company_id);

-- ================================================
-- 28. ANAPLAN AUTOMATION LOGS
-- ================================================
CREATE TABLE IF NOT EXISTS anaplan_automation_logs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL,
    triggered_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
    files_downloaded INTEGER DEFAULT 0,
    files_processed INTEGER DEFAULT 0,
    files_failed INTEGER DEFAULT 0,
    new_versions_created INTEGER DEFAULT 0,
    archived_versions INTEGER DEFAULT 0,
    error_message TEXT,
    details JSONB,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS anaplan_automation_logs_company_id_idx ON anaplan_automation_logs(company_id);
CREATE INDEX IF NOT EXISTS anaplan_automation_logs_status_idx ON anaplan_automation_logs(status);
CREATE INDEX IF NOT EXISTS anaplan_automation_logs_trigger_type_idx ON anaplan_automation_logs(trigger_type);
CREATE INDEX IF NOT EXISTS anaplan_automation_logs_created_at_idx ON anaplan_automation_logs(created_at);

-- ================================================
-- 29. SCHEDULER CONFIG
-- ================================================
CREATE TABLE IF NOT EXISTS scheduler_config (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    enabled INTEGER NOT NULL DEFAULT 0,
    hour INTEGER NOT NULL DEFAULT 6,
    minute INTEGER NOT NULL DEFAULT 0,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by VARCHAR REFERENCES users(id) ON DELETE SET NULL
);

-- ================================================
-- SEED DATA: Create default admin user
-- ================================================
INSERT INTO users (id, username, display_name, role)
VALUES (gen_random_uuid(), 'customer@ledgerlm.ai', 'LedgerLM Admin', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Create Bosch company
INSERT INTO companies (id, name, slug, description)
VALUES (gen_random_uuid(), 'Bosch', 'bosch', 'Bosch company for bosch.com domain')
ON CONFLICT (slug) DO NOTHING;

-- Create boschmatasma user
INSERT INTO users (id, username, display_name, role)
VALUES (gen_random_uuid(), 'boschmatasma@bosch.com', 'Bosch Matasma', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Link boschmatasma to Bosch company
INSERT INTO company_memberships (id, user_id, company_id, role)
SELECT gen_random_uuid(), u.id, c.id, 'admin'
FROM users u, companies c
WHERE u.username = 'boschmatasma@bosch.com' AND c.slug = 'bosch'
ON CONFLICT DO NOTHING;

-- Create user settings for boschmatasma
INSERT INTO user_settings (id, user_id, enterprise_enabled, active_company_id)
SELECT gen_random_uuid(), u.id, 1, c.id
FROM users u, companies c
WHERE u.username = 'boschmatasma@bosch.com' AND c.slug = 'bosch'
ON CONFLICT (user_id) DO UPDATE SET 
    enterprise_enabled = 1,
    active_company_id = EXCLUDED.active_company_id;

-- ================================================
-- VERIFICATION: Check all tables created
-- ================================================
SELECT 'Tables created successfully!' as status;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
