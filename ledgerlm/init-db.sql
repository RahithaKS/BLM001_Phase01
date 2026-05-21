-- ================================
-- LedgerLM Database Initialization
-- ================================
-- This script runs automatically when the PostgreSQL container starts
-- for the first time (via docker-entrypoint-initdb.d)

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Keycloak database (if using Keycloak for SSO)
CREATE DATABASE keycloak;
GRANT ALL PRIVILEGES ON DATABASE keycloak TO ledgerlm;

-- Note: The main application tables are created automatically by 
-- Drizzle ORM when the Node.js application starts.
-- The admin user will be inserted after tables are created.

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'LedgerLM database initialized with pgvector extension';
END $$;
