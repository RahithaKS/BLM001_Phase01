# LedgerLM - AI-Powered Financial Analysis Dashboard

## Overview

LedgerLM is an AI-powered financial analysis platform designed to transform complex financial data into clear, actionable insights. It provides an intuitive dashboard for connecting, analyzing, and summarizing financial reports, balance sheets, and audits. Key capabilities include an AI-powered chat, a secure document vault, visual analysis boards, and a multi-source market intelligence system. The platform aims to deliver a comprehensive solution for financial professionals seeking to leverage AI for deeper, faster insights into their data, enhancing financial insights and market potential.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The frontend uses React 18, TypeScript, and Vite, with `shadcn/ui` components (New York style) built on Radix UI primitives. Styling is managed with Tailwind CSS, supporting light/dark modes and a custom color palette. The Inter font family is used, emphasizing a component-based, type-safe, and responsive design.

### Technical Implementations

The backend is an Express.js application on Node.js (ESM), offering a RESTful API. PostgreSQL is used for data persistence via Drizzle ORM. Authentication is passwordless, using email-based sign-in.

### Feature Specifications

*   **Document Management (Vault)**: Supports uploading, storing, and managing various document types (PDF, DOC, XLS, CSV, TXT, images) with drag-and-drop, search, and bulk actions.
*   **Cloud Drive Integration**: Allows importing documents from Google Drive, OneDrive, and Dropbox with SSRF protection, file size limits, and content validation.
*   **Board Management System**: Enables template-driven workspace creation with user customization, including predefined board templates, a `BoardEditorDialog`, and board-scoped chat thread management with secure multi-tenant isolation.
*   **Chat Conversation Interface**: Provides a ChatGPT-like experience with AI integration, including scrollable conversations, suggested prompts, and in-chat document querying.
*   **Enterprise Data System**: Allows admin users to upload company-wide financial documents accessible to all employees, featuring an admin portal, RAG integration, domain-based auto-assignment, and optimized Excel processing.
*   **Multi-Source Intelligence System**: Uses a parallel fan-out/fan-in orchestration pattern to query multiple knowledge sources (RAG, Google Search, external databases), rank evidence, and generate AI responses with citations.
*   **Anaplan Automation System**: Automates daily data synchronization from the Anaplan REST API with a configurable schedule. Includes dynamic scheduler configuration via an admin UI, version management for RAG-enabled data, comprehensive audit logging, and multi-tenant isolation.
*   **Plugin-based API Connector System**: An extensible data source integration framework with a two-tier access control model. This includes encrypted credentials, an extensible registry pattern for new connectors (e.g., Salesforce, Power BI), and separate admin and user interfaces for managing and toggling data sources.
*   **Domain Management System**: A 3-tier system for user management, incorporating domain-company linking, per-domain user quotas, multi-admin support, and per-domain Anaplan scheduler and credential configurations.
*   **Bosch Billing Kiosk**: A self-service FAQ chatbot visible only to Bosch domain users for non-MCR billing queries. It supports domain-scoped access, quick action buttons, FAQ document uploads for AI context, and real-time streaming GPT-4o responses.
*   **Business Logic System for Semantic SQL**: Introduces domain-specific business terminology, calculations, and query patterns to enhance SQL generation accuracy. This involves new database tables for business terms, calculation rules, filter rules, query patterns, and column values, with integration into the LLM context builder.
*   **Multi-Tenant Domain System**: Full domain isolation with cube-based data segregation. Each domain (e.g., Bosch, Nemko) has its own cubes, business logic, and semantic SQL configurations. The system dynamically loads domain configuration from the database with automatic cube routing based on statement type (P&L, Balance Sheet, Cash Flow). Seed scripts (`server/seed/seed-nemko.ts`, `server/seed/bosch-business-logic.ts`) initialize domain-specific configurations.
*   **Per-Domain Microsoft SSO Authentication**: Each domain independently configures its authentication method as either Email OTP (default) or Microsoft SSO. SSO uses Azure AD OAuth2 with MSAL (`@azure/msal-node`), encrypted client secret storage, CSRF state validation, and enforces the pre-invite model (users must exist in `domain_users` before SSO succeeds). The login page auto-detects the domain from the entered email and switches between OTP and Microsoft sign-in flows. Super Admins configure SSO credentials (Tenant ID, Client ID, Client Secret) per domain via the Domain Management UI. Callback URI: `/api/auth/sso/microsoft/callback`.

### System Design Choices

*   **Data Layer**: PostgreSQL with Drizzle ORM, normalized schemas, and Zod validation. Automatic database migrations ensure schema consistency.
*   **Authentication**: Passwordless, email-based sign-in with bcrypt for password hashing and reactive session management.
*   **AI Integration**: Leverages OpenAI's GPT-4o model with Retrieval-Augmented Generation (RAG) via a Python backend for document-aware analysis and vector similarity search.
*   **Vector Database Optimization**: Utilizes native `pgvector` with HNSW index for efficient storage and sub-millisecond similarity search of document embeddings, supporting full text extraction and OCR.
*   **Multi-Source Query Orchestration**: A `Query Orchestrator` coordinates parallel queries across RAG, Google Search, and a database query planner, with an `Evidence Broker` ranking and normalizing evidence for AI context generation, including enterprise data.
*   **RAG Data Accuracy Optimizations**: Includes expanded chunk retrieval, fiscal year disambiguation in prompts, and metadata preservation during token splitting to improve accuracy, especially for large Excel files.
*   **Large File Support**: Increased file size limits (500MB for Excel) and optimized chunking for efficient processing of large Excel and PDF files. OCR support for large PDFs includes increased PIL image limits and adaptive DPI.
*   **Chat UX Improvements**: Implements a document processing guard, real-time streaming AI responses, and reduced response delays for a smoother user experience.
*   **PDF Text Reversal Fix**: Addresses OCR text reversal issues in visual PDFs using a `fix_reversed_text()` function with a dictionary of common reversed patterns.
*   **GPT-4 Vision KPI Dashboard Extraction**: Employs GPT-4 Vision API for accurate extraction from complex visual PDF layouts, using a Vision-first, text-fallback strategy for KPI dashboards.
*   **Query Reliability & Fast Path Optimization**: Ensures consistent KPI query results by: (1) protecting KPI terms like "internal", "offshore", "external" from being misinterpreted as entity dimension filters, (2) comprehensive trigger keyword dictionary with word-order variants sorted longest-first for specificity, (3) keyword-based fast-path matching that skips OpenAI for any matched KPI calculation (avoiding 165K+ token 429 errors), (4) trigger-dict-first matching order over database calculation names to prevent substring collisions (e.g., "Pyramid Mix" vs "Pyramid Mix By Salary Level").
*   **Critical Bug Fixes (2026-03-10)**:
    - **Unary + crash on LLM calls**: `json=+{...}` typo at `get_llm_response()` (line 24) caused `TypeError: bad operand type for unary +: 'dict'` on EVERY LLM call, silently failing all queries that reached the LLM path. Fixed to `json={...}`.
    - **Budget routing to plan_data**: `detect_plan_type()` was routing ALL "budget" queries to `cube_plan_data` (TBP data), even entity-level "Budget musd for mar 2025 by BGSW" queries that should go to `cube_fact_data` (Revenue Summary). Fixed by adding budget override logic: if "budget" is detected but no plan-version terms (tbp, cf0x) or worldwide/comparison terms exist, `is_plan_query` is overridden to False.
    - **`original_query` not propagated**: The LLM path in `parse_query_intent()` never set `intent['original_query']`, so `compile_sql()`'s budget and revenue fast-paths (which check `original_query`) could never fire for LLM-routed queries. Fixed by adding `intent['original_query'] = query` in the LLM path before return.
    - **Rephraser corrupting musd/minr**: The query rephraser was treating "musd" (million USD) as a typo and changing it to "must". Fixed by adding musd, minr, inr, usd, and all entity codes (BGSW, BGSV, etc.) to the protected abbreviations list in the rephraser system prompt.
*   **Query Preprocessing Pipeline**: Two-stage query enhancement before SQL generation:
    - **Spelling Correction**: Conservative GPT-4o-mini-based typo fixing (e.g., "offshroe" → "offshore") that preserves query meaning without altering entity names or abbreviations
    - **Auto-Default Time Period**: When no time period is specified, automatically injects last 3 months context with readable display format (Dec 2025, Nov 2025, Oct 2025). Comprehensive time pattern detection includes FY25, Q1-Q4, H1/H2, YTD, MTD, and date formats.
*   **Star Schema Architecture (Nemko P&L)**: Sustainable data warehouse design for multi-tenant semantic SQL analytics:
    - **Dimension Tables**: `dim_entity`, `dim_department`, `dim_account`, `dim_time` with proper hierarchy support (hierarchy_level, parent_id)
    - **Fact Table**: `fact_financials` with foreign keys to all dimension tables, supporting FY24/FY25 amount columns
    - **Auto-Discovery**: Extracts 75+ entities with 97 aliases from actual data, eliminating manual entity configuration
    - **ETL Pipeline**: Transforms 615K rows from JSONB format to normalized star schema with proper joins
    - **Query Compilation**: Combines GPT-parsed filters (entity, month, year) with star schema joins for accurate SQL generation
    - **Design Rationale**: Star schema enables efficient aggregation queries, supports breakdown requests, and provides consistent data model for all P&L queries

## FROZEN View Filter Definitions (DO NOT MODIFY)

These filter definitions are locked. Do not modify without re-validation against source data.

### Capacity Metrics Filter Logic

| View | Filter Logic |
|------|-------------|
| **Entity View** | No sector filter, excludes Corporate: `new_service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')` |
| **MS View** | `new_service_area = 'MS' AND sector = 'BBM'` |
| **SX View** | `new_service_area = 'SX' AND sector IN ('BBE', 'BBG', 'BBI', 'OTHERS')` |
| **VM View** | `new_service_area = 'MS' AND sector = 'BBM' AND project_gb = 'VM'` |
| **PS View** | `new_service_area = 'MS' AND sector = 'BBM' AND project_gb = 'PS'` |
| **XC View** | `new_service_area = 'MS' AND sector = 'BBM' AND project_gb = 'XC'` |

### Billing Metrics Filter Logic

| View | Filter Logic | Notes |
|------|-------------|-------|
| **MS View Billing** | `sector = 'BBM'` | new_service_area is NULL in billing data |
| **SX View Billing** | `sector IN ('BBE', 'BBG', 'BBI', 'OTHERS')` | new_service_area is NULL in billing data |

### Files with Frozen Logic

- `server/seed/bosch-business-logic.ts` - BOSCH_FILTER_RULES with frozen: true flag
- `python_backend/services/semantic_sql_service.py` - detect_gb_view_filter() function

## External Dependencies

*   **Frontend Frameworks**: React 18, Vite, TypeScript
*   **Backend Frameworks**: Express.js, Node.js (ESM)
*   **UI Libraries**: Radix UI, `shadcn/ui`
*   **Database & ORM**: Drizzle ORM (PostgreSQL)
*   **AI/ML**: OpenAI (GPT-4o model)
*   **Utilities**: date-fns, clsx, tailwind-merge, class-variance-authority, cmdk, embla-carousel-react, nanoid, cron-parser
*   **Routing**: wouter
*   **Icons**: lucide-react
*   **Google Services**: Google Custom Search API
*   **Task Scheduling**: node-cron, cron-parser
*   **Cloud Storage**: @azure/storage-blob