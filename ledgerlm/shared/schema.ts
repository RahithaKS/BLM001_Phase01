import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, index, uniqueIndex, unique, integer, jsonb, customType, doublePrecision, boolean, numeric, bigint, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Define custom vector type for pgvector
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1024)';
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password"),
  displayName: text("display_name").notNull(),
  role: varchar("role", { length: 20 }).notNull().default('standard'), // 'admin' or 'standard'
  lastLoginAt: timestamp("last_login_at"),
});

export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  token: text("token").notNull().unique(),
  invitedBy: varchar("invited_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp("expires_at").notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'), // 'pending', 'accepted', 'expired'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at"),
}, (table) => ({
  emailIdx: index("invitations_email_idx").on(table.email),
  tokenIdx: index("invitations_token_idx").on(table.token),
  statusIdx: index("invitations_status_idx").on(table.status),
  expiresAtIdx: index("invitations_expires_at_idx").on(table.expiresAt),
}));

export const otpCodes = pgTable("otp_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),
  attempts: integer("attempts").notNull().default(0),
  context: varchar("context", { length: 50 }).notNull(), // 'login', 'password_reset'
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("otp_codes_user_id_idx").on(table.userId),
  expiresAtIdx: index("otp_codes_expires_at_idx").on(table.expiresAt),
  contextIdx: index("otp_codes_context_idx").on(table.context),
}));

export const deviceTrust = pgTable("device_trust", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  deviceTokenHash: text("device_token_hash").notNull().unique(),
  deviceFingerprint: text("device_fingerprint"),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }),
  expiresAt: timestamp("expires_at").notNull(),
  lastUsedAt: timestamp("last_used_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("device_trust_user_id_idx").on(table.userId),
  deviceTokenHashIdx: index("device_trust_device_token_hash_idx").on(table.deviceTokenHash),
  expiresAtIdx: index("device_trust_expires_at_idx").on(table.expiresAt),
}));

export const chats = pgTable("chats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  preview: text("preview"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("chats_user_id_idx").on(table.userId),
}));

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").notNull().references(() => chats.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  role: text("role").notNull(), // 'user' or 'assistant'
  metadata: jsonb("metadata"), // Stores citations, sources, and other metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  chatIdIdx: index("messages_chat_id_idx").on(table.chatId),
}));

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: text("file_size").notNull(),
  fileType: text("file_type").notNull(),
  cloudSource: text("cloud_source"), // 'google_drive' | 'onedrive' | 'dropbox' | null
  cloudFileId: text("cloud_file_id"), // Original file ID from cloud provider
  cloudUrl: text("cloud_url"), // Original share link
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("documents_user_id_idx").on(table.userId),
}));

export const boardTemplates = pgTable("board_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  defaultConfig: jsonb("default_config"), // Template-specific default settings
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  slugIdx: index("board_templates_slug_idx").on(table.slug),
}));

export const boards = pgTable("boards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  templateId: varchar("template_id").references(() => boardTemplates.id, { onDelete: 'set null' }),
  title: text("title").notNull(),
  description: text("description"),
  analysisTemplate: varchar("analysis_template", { length: 50 }), // 'income_statement', 'balance_sheet', 'cash_flow', 'comparative', 'other'
  settings: jsonb("settings"), // Custom board settings and layout preferences
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("boards_user_id_idx").on(table.userId),
  templateIdIdx: index("boards_template_id_idx").on(table.templateId),
}));

export const boardThreads = pgTable("board_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: varchar("board_id").notNull().references(() => boards.id, { onDelete: 'cascade' }),
  chatId: varchar("chat_id").notNull().references(() => chats.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  boardIdIdx: index("board_threads_board_id_idx").on(table.boardId),
  chatIdIdx: index("board_threads_chat_id_idx").on(table.chatId),
  uniqueBoardChat: uniqueIndex("board_threads_unique_board_chat_idx").on(table.boardId, table.chatId),
}));

export const boardDocuments = pgTable("board_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: varchar("board_id").notNull().references(() => boards.id, { onDelete: 'cascade' }),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  boardIdIdx: index("board_documents_board_id_idx").on(table.boardId),
  documentIdIdx: index("board_documents_document_id_idx").on(table.documentId),
  uniqueBoardDoc: uniqueIndex("board_documents_unique_board_doc_idx").on(table.boardId, table.documentId),
}));

export const boardDataSources = pgTable("board_data_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: varchar("board_id").notNull().references(() => boards.id, { onDelete: 'cascade' }),
  sourceType: varchar("source_type", { length: 50 }).notNull(), // 'enterprise', 'vault', 'web', 'financial', 'external_api'
  enabled: integer("enabled").notNull().default(1), // 1 = enabled, 0 = disabled (using integer for boolean)
  resultLimit: integer("result_limit").default(10),
  timeoutSeconds: integer("timeout_seconds").default(30),
  position: integer("position").notNull().default(0), // For drag-and-drop ordering
  config: jsonb("config"), // Source-specific configuration
  manageUrl: text("manage_url"), // Link to manage this data source
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  boardIdIdx: index("board_data_sources_board_id_idx").on(table.boardId),
  positionIdx: index("board_data_sources_position_idx").on(table.boardId, table.position),
}));

export const documentChunks = pgTable("document_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: 'cascade' }),
  chunkText: text("chunk_text").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  tokenCount: integer("token_count"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  documentIdIdx: index("document_chunks_document_id_idx").on(table.documentId),
}));

export const documentEmbeddings = pgTable("document_embeddings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chunkId: varchar("chunk_id").notNull().references(() => documentChunks.id, { onDelete: 'cascade' }),
  embedding: vector("embedding"), // pgvector vector(1024) — used by Ollama/Qwen domains
  embedding3072: customType<{ data: number[]; driverData: string }>({
    dataType() { return 'vector(3072)'; },
    toDriver(value: number[]): string { return JSON.stringify(value); },
    fromDriver(value: string): number[] { return JSON.parse(value); },
  })("embedding_3072"), // pgvector vector(3072) — used by Azure OpenAI domains
  modelName: varchar("model_name", { length: 100 }).default('mxbai-embed-large'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  chunkIdIdx: index("document_embeddings_chunk_id_idx").on(table.chunkId),
}));

export const documentProcessing = pgTable("document_processing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: 'cascade' }),
  status: varchar("status", { length: 50 }).notNull().default('pending'), // pending, processing, completed, failed
  totalChunks: integer("total_chunks"),
  processedChunks: integer("processed_chunks"),
  companyName: text("company_name"), // Extracted company name
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  documentIdIdx: index("document_processing_document_id_idx").on(table.documentId),
}));

export const chatDocuments = pgTable("chat_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").notNull().references(() => chats.id, { onDelete: 'cascade' }),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  chatIdIdx: index("chat_documents_chat_id_idx").on(table.chatId),
  documentIdIdx: index("chat_documents_document_id_idx").on(table.documentId),
}));

export const dataSources = pgTable("data_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar("type", { length: 50 }).notNull(), // 'google_search', 'database', 'api'
  label: text("label").notNull(),
  config: jsonb("config").notNull(), // Source-specific configuration
  status: varchar("status", { length: 50 }).notNull().default('active'), // 'active', 'inactive', 'error'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("data_sources_user_id_idx").on(table.userId),
  typeIdx: index("data_sources_type_idx").on(table.type),
}));

export const chatSources = pgTable("chat_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").notNull().references(() => chats.id, { onDelete: 'cascade' }),
  sourceId: varchar("source_id").notNull().references(() => dataSources.id, { onDelete: 'cascade' }),
  enabled: integer("enabled").notNull().default(1), // 1 = enabled, 0 = disabled
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  chatIdIdx: index("chat_sources_chat_id_idx").on(table.chatId),
  sourceIdIdx: index("chat_sources_source_id_idx").on(table.sourceId),
}));

export const webSearchCache = pgTable("web_search_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  queryHash: varchar("query_hash", { length: 64 }).notNull().unique(),
  query: text("query").notNull(),
  results: jsonb("results").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  queryHashIdx: index("web_search_cache_query_hash_idx").on(table.queryHash),
  expiresAtIdx: index("web_search_cache_expires_at_idx").on(table.expiresAt),
}));

export const queryAudit = pgTable("query_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").notNull().references(() => chats.id, { onDelete: 'cascade' }),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: 'set null' }),
  query: text("query").notNull(),
  sourcesUsed: jsonb("sources_used").notNull(), // Array of source types that were queried
  sourcesSucceeded: jsonb("sources_succeeded"), // Array of source types that succeeded
  sourcesFailed: jsonb("sources_failed"), // Array of source types that failed
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  chatIdIdx: index("query_audit_chat_id_idx").on(table.chatId),
  messageIdIdx: index("query_audit_message_id_idx").on(table.messageId),
}));

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(), // URL-friendly identifier (e.g., "nemko")
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  slugIdx: index("companies_slug_idx").on(table.slug),
}));

export const companyMemberships = pgTable("company_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  role: varchar("role", { length: 20 }).notNull().default('member'), // 'admin' or 'member'
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("company_memberships_user_id_idx").on(table.userId),
  companyIdIdx: index("company_memberships_company_id_idx").on(table.companyId),
}));

export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  enterpriseEnabled: integer("enterprise_enabled").notNull().default(0), // 1 = enabled, 0 = disabled
  activeCompanyId: varchar("active_company_id").references(() => companies.id, { onDelete: 'set null' }),
  connectorPreferences: text("connector_preferences"), // JSON string: { [connectorId]: boolean }
  cubePreferences: text("cube_preferences"), // JSON string: { [cubeId]: boolean }
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("user_settings_user_id_idx").on(table.userId),
}));

export const enterpriseDocuments = pgTable("enterprise_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  domainId: varchar("domain_id").references(() => domains.id, { onDelete: 'set null' }), // Domain scoping for multi-tenant access
  cubeId: varchar("cube_id").references((): any => cubes.id, { onDelete: 'set null' }), // Data cube for granular access control
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: text("file_size").notNull(),
  fileType: text("file_type").notNull(),
  source: varchar("source", { length: 50 }).notNull().default('manual'), // 'manual' | 'anaplan_auto' | 'anaplan_manual'
  version: integer("version").notNull().default(1), // Version number (1, 2, 3...)
  isActive: integer("is_active").notNull().default(1), // 1 = active (used in RAG), 0 = archived
  previousVersionId: varchar("previous_version_id").references((): any => enterpriseDocuments.id, { onDelete: 'set null' }), // Links to previous version
  anaplanMetadata: jsonb("anaplan_metadata"), // Stores Anaplan-specific data: { processId, exportName, syncDate }
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
}, (table) => ({
  companyIdIdx: index("enterprise_documents_company_id_idx").on(table.companyId),
  domainIdIdx: index("enterprise_documents_domain_id_idx").on(table.domainId),
  cubeIdIdx: index("enterprise_documents_cube_id_idx").on(table.cubeId),
  uploadedByIdx: index("enterprise_documents_uploaded_by_idx").on(table.uploadedBy),
  sourceIdx: index("enterprise_documents_source_idx").on(table.source),
  isActiveIdx: index("enterprise_documents_is_active_idx").on(table.isActive),
  versionIdx: index("enterprise_documents_version_idx").on(table.version),
}));

export const enterpriseDocumentChunks = pgTable("enterprise_document_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => enterpriseDocuments.id, { onDelete: 'cascade' }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  cubeId: varchar("cube_id").references((): any => cubes.id, { onDelete: 'set null' }),
  chunkText: text("chunk_text").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  tokenCount: integer("token_count"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  documentIdIdx: index("enterprise_document_chunks_document_id_idx").on(table.documentId),
  companyIdIdx: index("enterprise_document_chunks_company_id_idx").on(table.companyId),
  cubeIdIdx: index("enterprise_document_chunks_cube_id_idx").on(table.cubeId),
}));

export const enterpriseDocumentEmbeddings = pgTable("enterprise_document_embeddings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chunkId: varchar("chunk_id").notNull().references(() => enterpriseDocumentChunks.id, { onDelete: 'cascade' }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  cubeId: varchar("cube_id").references((): any => cubes.id, { onDelete: 'set null' }),
  embedding: vector("embedding"), // vector(1024) — Ollama/Qwen domains
  embedding3072: customType<{ data: number[]; driverData: string }>({
    dataType() { return 'vector(3072)'; },
    toDriver(value: number[]): string { return JSON.stringify(value); },
    fromDriver(value: string): number[] { return JSON.parse(value); },
  })("embedding_3072"), // vector(3072) — Azure OpenAI domains (e.g. Bosch)
  modelName: varchar("model_name", { length: 100 }).default('mxbai-embed-large'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  chunkIdIdx: index("enterprise_document_embeddings_chunk_id_idx").on(table.chunkId),
  companyIdIdx: index("enterprise_document_embeddings_company_id_idx").on(table.companyId),
  cubeIdIdx: index("enterprise_document_embeddings_cube_id_idx").on(table.cubeId),
}));

export const enterpriseDocumentProcessing = pgTable("enterprise_document_processing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().unique().references(() => enterpriseDocuments.id, { onDelete: 'cascade' }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  status: varchar("status", { length: 50 }).notNull().default('pending'), // pending, processing, completed, failed
  totalChunks: integer("total_chunks"),
  processedChunks: integer("processed_chunks"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  documentIdIdx: index("enterprise_document_processing_document_id_idx").on(table.documentId),
  companyIdIdx: index("enterprise_document_processing_company_id_idx").on(table.companyId),
}));

export const anaplanAutomationLogs = pgTable("anaplan_automation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  status: varchar("status", { length: 50 }).notNull(), // 'success', 'partial_success', 'failed'
  triggerType: varchar("trigger_type", { length: 50 }).notNull(), // 'scheduled', 'manual'
  triggeredBy: varchar("triggered_by").references(() => users.id, { onDelete: 'set null' }), // null for scheduled
  filesDownloaded: integer("files_downloaded").default(0),
  filesProcessed: integer("files_processed").default(0),
  filesFailed: integer("files_failed").default(0),
  newVersionsCreated: integer("new_versions_created").default(0),
  archivedVersions: integer("archived_versions").default(0),
  errorMessage: text("error_message"),
  details: jsonb("details"), // Stores detailed log of what happened
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  companyIdIdx: index("anaplan_automation_logs_company_id_idx").on(table.companyId),
  statusIdx: index("anaplan_automation_logs_status_idx").on(table.status),
  triggerTypeIdx: index("anaplan_automation_logs_trigger_type_idx").on(table.triggerType),
  createdAtIdx: index("anaplan_automation_logs_created_at_idx").on(table.createdAt),
}));

export const schedulerConfig = pgTable("scheduler_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enabled: integer("enabled").notNull().default(0), // 1 = enabled, 0 = disabled
  hour: integer("hour").notNull().default(6), // 0-23 (24-hour format)
  minute: integer("minute").notNull().default(0), // 0-59
  timezone: varchar("timezone", { length: 50 }).notNull().default('Asia/Kolkata'), // IANA timezone
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id, { onDelete: 'set null' }),
});

// Super Admin Domain Management tables
export const domains = pgTable("domains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // e.g., 'in.bosch.com', 'nemko.com', 'ledgerlm.ai'
  adminEmail: text("admin_email").notNull(), // Primary domain admin email (first admin)
  companyId: varchar("company_id").references(() => companies.id, { onDelete: 'set null' }), // Link domain to company for enterprise data isolation
  userQuota: integer("user_quota").default(50), // Maximum number of users that can be invited to this domain
  defaultOtp: varchar("default_otp", { length: 10 }), // Optional default OTP for entire domain
  // Authentication method: 'otp' (default) or 'microsoft_sso'
  authMethod: varchar("auth_method", { length: 20 }).notNull().default('otp'),
  ssoTenantId: text("sso_tenant_id"),      // Azure AD Tenant ID
  ssoClientId: text("sso_client_id"),      // Azure App Registration Client ID
  ssoClientSecret: text("sso_client_secret"), // Azure Client Secret (stored encrypted)
  ssoGroupId: text("sso_group_id"),        // Azure AD Group ID — only members of this group can access
  ssoDefaultRole: varchar("sso_default_role", { length: 20 }).notNull().default('standard'), // Role assigned to auto-provisioned users
  // Email provider: 'default' (global GoDaddy), 'microsoft' (Office 365 SMTP), 'godaddy' (per-domain GoDaddy)
  emailProvider: varchar("email_provider", { length: 20 }).default('default'),
  emailSmtpUser: text("email_smtp_user"),     // Mailbox address / SMTP username
  emailSmtpPass: text("email_smtp_pass"),     // App password / SMTP password (stored encrypted)
  emailFromAddress: text("email_from_address"), // From: email address shown to recipients
  emailFromName: text("email_from_name"),       // From: display name e.g. "Bosch LedgerLM"
  // AI provider: 'ollama' (default) | 'azure_openai'
  aiProvider: varchar("ai_provider", { length: 20 }).default('ollama'),
  aiEndpoint: text("ai_endpoint"),              // Azure base URL e.g. https://xxx.openai.azure.com/
  aiApiKey: text("ai_api_key"),                 // Encrypted API key
  aiChatModel: text("ai_chat_model"),           // Azure deployment name for chat e.g. gpt-5.2-chat
  aiChatApiVersion: text("ai_chat_api_version"), // e.g. 2024-12-01-preview
  aiEmbeddingModel: text("ai_embedding_model"), // Azure deployment name for embeddings
  aiEmbeddingApiVersion: text("ai_embedding_api_version"), // e.g. 2024-02-01
  aiSystemPrompt: text("ai_system_prompt"),     // Custom system prompt (null = use default LedgerLM prompt)
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  nameIdx: index("domains_name_idx").on(table.name),
  adminEmailIdx: index("domains_admin_email_idx").on(table.adminEmail),
  companyIdIdx: index("domains_company_id_idx").on(table.companyId),
}));

export const domainUsers = pgTable("domain_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domainId: varchar("domain_id").notNull().references(() => domains.id, { onDelete: 'cascade' }),
  email: text("email").notNull(), // Full email address (removed unique constraint to allow same user in multiple domains in future)
  role: varchar("role", { length: 20 }).notNull().default('standard'), // 'admin' or 'standard' - multiple admins allowed per domain
  hardcodedOtp: varchar("hardcoded_otp", { length: 10 }), // Optional hardcoded OTP for this user
  invitedBy: varchar("invited_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  domainIdIdx: index("domain_users_domain_id_idx").on(table.domainId),
  emailIdx: index("domain_users_email_idx").on(table.email),
  domainEmailIdx: uniqueIndex("domain_users_domain_email_idx").on(table.domainId, table.email), // Unique per domain, not globally
}));

// Data Cubes - containers for enterprise data segregation within a domain
// sourceType: 'anaplan' | 'azure_blob' | 'manual' | 'all' - determines which data source feeds this cube
export const cubes = pgTable("cubes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domainId: varchar("domain_id").notNull().references(() => domains.id, { onDelete: 'cascade' }),
  name: text("name").notNull(), // e.g., 'KPI Metrics', 'P&L', 'Budget'
  description: text("description"),
  sourceType: varchar("source_type", { length: 20 }).notNull().default('manual'), // 'anaplan', 'azure_blob', 'manual', 'all'
  connectorId: varchar("connector_id"), // Link to domain_api_connectors.id (FK enforced at DB level)
  ingestionConfig: text("ingestion_config"), // JSON config for source-specific settings (schedule, filters, etc.)
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  domainIdIdx: index("cubes_domain_id_idx").on(table.domainId),
  nameIdx: index("cubes_name_idx").on(table.name),
  sourceTypeIdx: index("cubes_source_type_idx").on(table.sourceType),
  connectorIdIdx: index("cubes_connector_id_idx").on(table.connectorId),
  uniqueDomainName: uniqueIndex("cubes_domain_name_unique").on(table.domainId, table.name), // No duplicate cube names per domain
}));

// User access to cubes - controls which users can query data from specific cubes
export const cubeUserAccess = pgTable("cube_user_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cubeId: varchar("cube_id").notNull().references(() => cubes.id, { onDelete: 'cascade' }),
  userEmail: text("user_email").notNull(), // Domain user email
  enabled: integer("enabled").notNull().default(1), // 1 = enabled for RAG queries, 0 = disabled
  grantedBy: varchar("granted_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  cubeIdIdx: index("cube_user_access_cube_id_idx").on(table.cubeId),
  userEmailIdx: index("cube_user_access_user_email_idx").on(table.userEmail),
  uniqueCubeUser: uniqueIndex("cube_user_access_cube_user_unique").on(table.cubeId, table.userEmail), // One access record per user per cube
}));

// Cube metadata for structured data understanding - stores entities, metrics, periods for smart filtering
export const cubeMetadata = pgTable("cube_metadata", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cubeId: varchar("cube_id").notNull().references(() => cubes.id, { onDelete: 'cascade' }).unique(), // One metadata record per cube
  entities: jsonb("entities"), // Array of entity names: ["Korea", "Japan", "Taiwan", "India", ...]
  metrics: jsonb("metrics"), // Array of metric names: ["Revenue", "Operating Cash Flow", "Net Income", ...]
  periods: jsonb("periods"), // Array of period names: ["FY24", "FY25", "Q1", "Q2", "Jan 25", ...]
  customFields: jsonb("custom_fields"), // Flexible additional metadata as key-value pairs
  updatedBy: varchar("updated_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  cubeIdIdx: index("cube_metadata_cube_id_idx").on(table.cubeId),
}));

// Billing Kiosk tables for Bosch FAQ-based chatbot
export const kioskFaqDocuments = pgTable("kiosk_faq_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domainId: varchar("domain_id").notNull().references(() => domains.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: text("file_size").notNull(),
  fileType: text("file_type").notNull(),
  billingType: varchar("billing_type", { length: 100 }), // 'non_mcr_faq', 'fixed_price', 't_and_m', 'at_actuals'
  status: varchar("status", { length: 50 }).notNull().default('pending'), // pending, processing, ready, failed
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
}, (table) => ({
  domainIdIdx: index("kiosk_faq_documents_domain_id_idx").on(table.domainId),
  statusIdx: index("kiosk_faq_documents_status_idx").on(table.status),
  billingTypeIdx: index("kiosk_faq_documents_billing_type_idx").on(table.billingType),
}));

export const kioskChats = pgTable("kiosk_chats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  domainId: varchar("domain_id").notNull().references(() => domains.id, { onDelete: 'cascade' }),
  title: text("title").notNull().default('Kiosk Chat'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("kiosk_chats_user_id_idx").on(table.userId),
  domainIdIdx: index("kiosk_chats_domain_id_idx").on(table.domainId),
}));

export const kioskMessages = pgTable("kiosk_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").notNull().references(() => kioskChats.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  role: varchar("role", { length: 20 }).notNull(), // 'user' or 'assistant'
  sources: jsonb("sources"), // FAQ sources used in response
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  chatIdIdx: index("kiosk_messages_chat_id_idx").on(table.chatId),
}));

// Parsed FAQ entries from uploaded documents
export const kioskFaqEntries = pgTable("kiosk_faq_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => kioskFaqDocuments.id, { onDelete: 'cascade' }),
  domainId: varchar("domain_id").notNull().references(() => domains.id, { onDelete: 'cascade' }),
  billingCategory: text("billing_category").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  documentIdIdx: index("kiosk_faq_entries_document_id_idx").on(table.documentId),
  domainIdIdx: index("kiosk_faq_entries_domain_id_idx").on(table.domainId),
  billingCategoryIdx: index("kiosk_faq_entries_billing_category_idx").on(table.billingCategory),
}));

// Per-domain scheduler configuration for Anaplan automation
export const domainSchedulerConfig = pgTable("domain_scheduler_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domainId: varchar("domain_id").notNull().references(() => domains.id, { onDelete: 'cascade' }).unique(), // One config per domain
  enabled: integer("enabled").notNull().default(0), // 1 = enabled, 0 = disabled
  hour: integer("hour").notNull().default(6), // 0-23 (24-hour format)
  minute: integer("minute").notNull().default(0), // 0-59
  timezone: varchar("timezone", { length: 50 }).notNull().default('Asia/Kolkata'), // IANA timezone
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  domainIdIdx: index("domain_scheduler_config_domain_id_idx").on(table.domainId),
}));

export const domainApiConnectors = pgTable("domain_api_connectors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domainId: varchar("domain_id").notNull().references(() => domains.id, { onDelete: 'cascade' }),
  connectorType: varchar("connector_type", { length: 50 }).notNull(), // 'anaplan', 'azure_blob', 'salesforce', etc.
  name: varchar("name", { length: 100 }).notNull(), // Display name for the connector
  enabled: integer("enabled").notNull().default(1), // 1 = enabled for RAG, 0 = disabled
  config: jsonb("config").notNull().default({}), // Type-specific configuration (encrypted sensitive fields)
  tags: text("tags").array(), // Tags for categorization like ['#Deals', '#Marketing']
  status: varchar("status", { length: 20 }).default('pending'), // 'connected', 'error', 'pending', 'syncing'
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncResult: text("last_sync_result"),
  documentCount: integer("document_count").default(0),
  targetCubeId: varchar("target_cube_id").references(() => cubes.id, { onDelete: 'set null' }), // Target cube for synced documents
  // Per-connector scheduling fields
  scheduleEnabled: integer("schedule_enabled").notNull().default(0), // 1 = scheduled sync enabled, 0 = disabled
  scheduleHour: integer("schedule_hour").default(6), // 0-23 (24-hour format)
  scheduleMinute: integer("schedule_minute").default(0), // 0-59
  scheduleTimezone: varchar("schedule_timezone", { length: 50 }).default('Asia/Kolkata'), // IANA timezone
  blobPrefix: varchar("blob_prefix"), // Optional folder prefix filter for Azure Blob (e.g. "LedgerLM/2025/")
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  domainIdIdx: index("domain_api_connectors_domain_id_idx").on(table.domainId),
  connectorTypeIdx: index("domain_api_connectors_type_idx").on(table.connectorType),
  enabledIdx: index("domain_api_connectors_enabled_idx").on(table.enabled),
  targetCubeIdIdx: index("domain_api_connectors_target_cube_id_idx").on(table.targetCubeId),
}));

// ============================================================================
// AZURE BLOB FILE REGISTRY — tracks per-file etag for delta-sync detection
// ============================================================================

export const azureBlobFileRegistry = pgTable("azure_blob_file_registry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectorId: varchar("connector_id").notNull().references(() => domainApiConnectors.id, { onDelete: 'cascade' }),
  blobName: text("blob_name").notNull(),
  etag: varchar("etag", { length: 256 }),
  lastModified: timestamp("last_modified"),
  ingestedAt: timestamp("ingested_at").notNull().defaultNow(),
  documentId: varchar("document_id"),
  jobId: varchar("job_id"),
  status: varchar("status", { length: 20 }).notNull().default('success'), // 'success' | 'failed'
}, (table) => ({
  connectorBlobIdx: uniqueIndex("azure_blob_registry_connector_blob_idx").on(table.connectorId, table.blobName),
  connectorIdx: index("azure_blob_registry_connector_idx").on(table.connectorId),
}));

export type AzureBlobFileRegistry = typeof azureBlobFileRegistry.$inferSelect;
export type InsertAzureBlobFileRegistry = typeof azureBlobFileRegistry.$inferInsert;

// ============================================================================
// DOMAIN-SPECIFIC SCHEMA CONFIGURATION SYSTEM
// ============================================================================

// Column configuration for each cube - stores column meanings, types, and descriptions
export const cubeColumnConfig = pgTable("cube_column_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cubeId: varchar("cube_id").notNull().references(() => cubes.id, { onDelete: 'cascade' }),
  columnIndex: integer("column_index").notNull(), // Position in Excel (0, 1, 2...)
  originalName: text("original_name").notNull(), // Excel header name
  displayName: text("display_name"), // User-friendly name
  columnType: varchar("column_type", { length: 20 }).notNull().default('dimension'), // 'dimension' | 'metric' | 'period' | 'hierarchy' | 'ignore'
  dataType: varchar("data_type", { length: 20 }).notNull().default('text'), // 'text' | 'number' | 'date' | 'currency' | 'boolean'
  description: text("description"), // Admin's explanation for LLM context
  aliases: text("aliases").array(), // Alternative names for NLP matching ["Op CF", "Operating Cash", "OCF"]
  aggregationRule: varchar("aggregation_rule", { length: 20 }).default('sum'), // 'sum' | 'avg' | 'count' | 'min' | 'max' | 'last'
  hierarchyRef: varchar("hierarchy_ref"), // Links to domain_hierarchy_config.id if applicable
  useForSql: integer("use_for_sql").notNull().default(1), // 1 = use for SQL queries, 0 = exclude
  useForRag: integer("use_for_rag").notNull().default(1), // 1 = include in RAG context, 0 = exclude
  sampleValues: text("sample_values").array(), // Sample values for LLM context ["Korea", "Japan", "Taiwan"]
  isNullable: integer("is_nullable").notNull().default(1), // 1 = nullable, 0 = not nullable
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  cubeIdIdx: index("cube_column_config_cube_id_idx").on(table.cubeId),
  columnIndexIdx: index("cube_column_config_column_index_idx").on(table.columnIndex),
  columnTypeIdx: index("cube_column_config_column_type_idx").on(table.columnType),
  uniqueCubeColumn: uniqueIndex("cube_column_config_cube_column_unique").on(table.cubeId, table.columnIndex),
}));

// Domain hierarchy configuration - stores organizational structures per domain
export const domainHierarchyConfig = pgTable("domain_hierarchy_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domainId: varchar("domain_id").notNull().references(() => domains.id, { onDelete: 'cascade' }),
  hierarchyName: text("hierarchy_name").notNull(), // "Organization Hierarchy", "Geographic Hierarchy"
  description: text("description"), // For LLM context
  levels: text("levels").array().notNull(), // ['ProjTop_BU', 'ProjBU', 'ProjSection', 'ProjGroup']
  columnMappings: jsonb("column_mappings"), // {"level_0": "ProjTop_BU", "level_1": "ProjBU"}
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  domainIdIdx: index("domain_hierarchy_config_domain_id_idx").on(table.domainId),
  hierarchyNameIdx: index("domain_hierarchy_config_name_idx").on(table.hierarchyName),
}));

// Schema version tracking - tracks changes between Excel uploads
export const cubeSchemaVersions = pgTable("cube_schema_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cubeId: varchar("cube_id").notNull().references(() => cubes.id, { onDelete: 'cascade' }),
  version: integer("version").notNull(),
  columnNames: text("column_names").array().notNull(), // Array of column names from Excel
  columnHash: text("column_hash").notNull(), // Hash to detect structural changes
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  cubeIdIdx: index("cube_schema_versions_cube_id_idx").on(table.cubeId),
  versionIdx: index("cube_schema_versions_version_idx").on(table.version),
}));

// Business terminology definitions - maps business terms to SQL conditions
// e.g., "YTD Revenue" → Cost Category='Revenue Summary' AND Include/Exclude='Include'
export const cubeBusinessTerms = pgTable("cube_business_terms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cubeId: varchar("cube_id").notNull().references(() => cubes.id, { onDelete: 'cascade' }),
  termName: text("term_name").notNull(), // "YTD Revenue", "Available Capacity", "Billing Utilization"
  termAliases: text("term_aliases").array(), // Alternative names: ["revenue YTD", "year to date revenue"]
  definition: text("definition").notNull(), // Human-readable explanation for LLM context
  sqlFilter: text("sql_filter"), // SQL WHERE clause: "\"Cost Category\" = 'Revenue Summary' AND \"Include/Exclude\" = 'Include'"
  requiredColumns: text("required_columns").array(), // Columns needed: ["Cost Category", "Include/Exclude", "Amount in USD"]
  category: varchar("category", { length: 50 }).default('general'), // 'revenue', 'cost', 'capacity', 'utilization', 'headcount'
  priority: integer("priority").default(0), // Higher = matched first
  isActive: integer("is_active").notNull().default(1),
  isSeeded: integer("is_seeded").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  cubeIdIdx: index("cube_business_terms_cube_id_idx").on(table.cubeId),
  termNameIdx: index("cube_business_terms_term_name_idx").on(table.termName),
  categoryIdx: index("cube_business_terms_category_idx").on(table.category),
}));

// Calculation rules - defines formulas for derived metrics
// e.g., Billing Utilization = Billed Capacity / Available Capacity
export const cubeCalculationRules = pgTable("cube_calculation_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cubeId: varchar("cube_id").notNull().references(() => cubes.id, { onDelete: 'cascade' }),
  calculationName: text("calculation_name").notNull(), // "Billing Utilization", "EBIT %", "Available Capacity"
  calculationAliases: text("calculation_aliases").array(), // Alternative names
  description: text("description").notNull(), // Human-readable explanation
  formula: text("formula").notNull(), // SQL expression: "SUM(\"Billed Capacity\") / NULLIF(SUM(\"Allocated Capacity\") + SUM(\"Not Allocated Capacity\"), 0)"
  sqlTemplate: text("sql_template"), // Full SQL template with {cube_id}, {year}, {month}, {group_by}, {extra_filters} placeholders — takes priority over hardcoded Python builders
  formulaType: varchar("formula_type", { length: 20 }).default('ratio'), // 'ratio', 'sum', 'difference', 'complex', 'sql_template'
  resultType: varchar("result_type", { length: 20 }).default('percentage'), // 'percentage', 'currency', 'number', 'fte'
  requiredColumns: text("required_columns").array(), // Columns needed for this calculation
  defaultFilters: text("default_filters"), // Default WHERE clause to apply
  roundingPrecision: integer("rounding_precision").default(2),
  isActive: integer("is_active").notNull().default(1),
  isSeeded: integer("is_seeded").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  cubeIdIdx: index("cube_calculation_rules_cube_id_idx").on(table.cubeId),
  calculationNameIdx: index("cube_calculation_rules_name_idx").on(table.calculationName),
}));

// Query patterns - reusable SQL templates for common business questions
// e.g., "Month-on-Month Revenue" → LAG-based SQL pattern
export const cubeQueryPatterns = pgTable("cube_query_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cubeId: varchar("cube_id").notNull().references(() => cubes.id, { onDelete: 'cascade' }),
  patternName: text("pattern_name").notNull(), // "Month-on-Month", "Entity Breakdown", "YTD Comparison"
  patternDescription: text("pattern_description").notNull(), // When to use this pattern
  triggerPhrases: text("trigger_phrases").array(), // Phrases that trigger this pattern: ["month on month", "MoM", "monthly trend"]
  sqlTemplate: text("sql_template").notNull(), // SQL template with placeholders: "SELECT {{columns}} FROM {{table}} WHERE {{filters}} GROUP BY {{group_by}}"
  templateVariables: jsonb("template_variables"), // Variable definitions: {"columns": "required", "filters": "optional"}
  exampleQuestion: text("example_question"), // "What is the month-on-month revenue for 2024?"
  exampleSql: text("example_sql"), // Fully filled example
  category: varchar("category", { length: 50 }).default('general'), // 'temporal', 'comparison', 'breakdown', 'trend'
  isActive: integer("is_active").notNull().default(1),
  isSeeded: integer("is_seeded").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  cubeIdIdx: index("cube_query_patterns_cube_id_idx").on(table.cubeId),
  patternNameIdx: index("cube_query_patterns_name_idx").on(table.patternName),
  categoryIdx: index("cube_query_patterns_category_idx").on(table.category),
}));

// Filter rules - maps semantic labels to SQL predicates
// e.g., "MS View" → Sector IN ('BBM')
export const cubeFilterRules = pgTable("cube_filter_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cubeId: varchar("cube_id").notNull().references(() => cubes.id, { onDelete: 'cascade' }),
  filterName: text("filter_name").notNull(), // "MS View", "SX View", "Internal Only", "Exclude Long Leave"
  filterAliases: text("filter_aliases").array(), // Alternative names
  description: text("description").notNull(), // Human-readable explanation
  sqlPredicate: text("sql_predicate").notNull(), // SQL: "TRIM(\"Sector\") IN ('BBM')"
  targetColumn: text("target_column"), // Primary column this filter applies to
  isDefault: integer("is_default").notNull().default(0), // Auto-apply this filter
  isActive: integer("is_active").notNull().default(1),
  isSeeded: integer("is_seeded").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  cubeIdIdx: index("cube_filter_rules_cube_id_idx").on(table.cubeId),
  filterNameIdx: index("cube_filter_rules_name_idx").on(table.filterName),
}));

// Column value mappings - explains what specific values mean
// e.g., Cost Category "Revenue Summary" → "Use this for all revenue queries"
export const cubeColumnValues = pgTable("cube_column_values", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cubeId: varchar("cube_id").notNull().references(() => cubes.id, { onDelete: 'cascade' }),
  columnName: text("column_name").notNull(), // "Cost Category", "Resource Type", "Sector"
  valueName: text("value_name").notNull(), // "Revenue Summary", "Cost Summary"
  valueDescription: text("value_description").notNull(), // What this value means
  valueAliases: text("value_aliases").array(), // Alternative names in questions
  usageContext: text("usage_context"), // When to use this value
  relatedValues: text("related_values").array(), // Other values often used together
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  cubeIdIdx: index("cube_column_values_cube_id_idx").on(table.cubeId),
  columnNameIdx: index("cube_column_values_column_name_idx").on(table.columnName),
  uniqueColumnValue: uniqueIndex("cube_column_values_unique").on(table.cubeId, table.columnName, table.valueName),
}));

// Column relationships — maps how columns relate to each other to form metrics
// e.g., "Billed Capacity" is the numerator of "Billing Utilization"
export const cubeColumnRelationships = pgTable("cube_column_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cubeId: varchar("cube_id").notNull().references(() => cubes.id, { onDelete: 'cascade' }),
  fromColumn: text("from_column").notNull(),        // e.g. "Billed Capacity"
  toColumn: text("to_column").notNull(),            // e.g. "Allocated Capacity"
  relationshipType: varchar("relationship_type", { length: 30 }).notNull(),
    // 'formula_component' | 'filter_dimension' | 'hierarchy' | 'aggregation_base'
  role: varchar("role", { length: 30 }),            // 'numerator' | 'denominator' | 'filter' | 'groupby' | 'addend' | 'subtractor'
  metricName: text("metric_name"),                  // e.g. "Billing Utilization" — which metric this supports
  description: text("description").notNull(),        // human-readable explanation for LLM
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  cubeIdIdx: index("cube_col_rel_cube_id_idx").on(table.cubeId),
  fromColIdx: index("cube_col_rel_from_col_idx").on(table.fromColumn),
  metricIdx: index("cube_col_rel_metric_idx").on(table.metricName),
}));

// Plan/Budget data - stores CTG override values from Manual inputs MBR Master
// Used for Plan vs Actual comparisons and dynamic CTG values
// Extended to support multi-tenant (Bosch, Nemko) with different statement types (P&L, BS, Cash)
export const cubePlanData = pgTable("cube_plan_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cubeId: varchar("cube_id").notNull().references(() => cubes.id, { onDelete: 'cascade' }),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  planType: varchar("plan_type", { length: 50 }).notNull(), // 'Actual', 'CF02 2025', 'CF05 2025', 'TBP 2025', 'YTD Forecast', 'Budget FY25', 'Forecast FY25'
  entity: varchar("entity", { length: 100 }), // Bosch: 'BGSW', 'BGSV', 'NE-MX', 'Worldwide'
  gb: varchar("gb", { length: 100 }), // GB column if present (Bosch)
  particulars: varchar("particulars", { length: 255 }), // KPI Metric: 'Offshore Capacity', 'Budget (mUSD)', etc.
  subCategory: varchar("sub_category", { length: 100 }), // 'Average', 'End', 'Onsite', 'Offshore', 'Outsourcing'
  costValue: text("cost_value"), // The CTG Override numeric value (stored as text for precision)
  valuePercent: text("value_percent"), // Percentage value
  page: varchar("page", { length: 100 }), // Page reference
  sourceFile: varchar("source_file", { length: 255 }), // Original file name
  ingestedAt: timestamp("ingested_at").defaultNow(),
  // Multi-tenant and multi-statement type support (Nemko, etc.)
  companyId: varchar("company_id", { length: 255 }), // Company ID for multi-tenant isolation
  statementType: varchar("statement_type", { length: 50 }), // 'P&L', 'BS', 'Cash' - identifies file type
  viewType: varchar("view_type", { length: 50 }), // 'Location', 'Subsidiary' - view perspective
  subsidiary: varchar("subsidiary", { length: 255 }), // Nemko: 'E1 Nemko Foundation', 'E7 Nemko Group AS'
  location: varchar("location", { length: 255 }), // Nemko: 'E1 Nemko Foundation (Oslo)'
  ds: varchar("ds", { length: 255 }), // Nemko P&L: Department/Service 'S106 Safety', 'S107 Energy'
  accountCode: varchar("account_code", { length: 100 }), // Account code '30000', '20600'
  accountName: varchar("account_name", { length: 500 }), // Account name 'External Revenue', 'VAT Payables'
  bsCategory: varchar("bs_category", { length: 255 }), // Balance Sheet category 'Other equity', 'VAT Payables'
  cashCategory: varchar("cash_category", { length: 255 }), // Cash flow category
  amountLc: doublePrecision("amount_lc"), // Amount in local currency
  fxRate: doublePrecision("fx_rate"), // Exchange rate
  amountUsd: doublePrecision("amount_usd"), // Amount in USD
}, (table) => ({
  cubeIdIdx: index("cube_plan_data_cube_id_idx").on(table.cubeId),
  planTypeIdx: index("cube_plan_data_plan_type_idx").on(table.planType),
  entityIdx: index("cube_plan_data_entity_idx").on(table.entity),
  particularsIdx: index("cube_plan_data_particulars_idx").on(table.particulars),
  yearMonthIdx: index("cube_plan_data_year_month_idx").on(table.year, table.month),
  statementTypeIdx: index("cube_plan_data_statement_type_idx").on(table.statementType),
  companyIdIdx: index("cube_plan_data_company_id_idx").on(table.companyId),
}));

// Cube fact data - main table for storing ingested cube data
export const cubeFactData = pgTable("cube_fact_data", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  cubeId: varchar("cube_id", { length: 255 }).notNull().references(() => cubes.id, { onDelete: 'cascade' }),
  costCategory: varchar("cost_category", { length: 500 }),
  year: integer("year"),
  month: integer("month"),
  regionEntity: varchar("region_entity", { length: 255 }),
  onsiteOffshore: varchar("onsite_offshore", { length: 100 }),
  sector: varchar("sector", { length: 255 }),
  projectGb: varchar("project_gb", { length: 255 }),
  planningGb: varchar("planning_gb", { length: 255 }),
  section: varchar("section", { length: 255 }),
  resourceType: varchar("resource_type", { length: 100 }),
  employeeNumber: varchar("employee_number", { length: 100 }),
  employeeName: varchar("employee_name", { length: 500 }),
  salaryLevel: varchar("salary_level", { length: 100 }),
  projectId: varchar("project_id", { length: 255 }),
  costCenter: varchar("cost_center", { length: 255 }),
  glAccount: varchar("gl_account", { length: 255 }),
  splitItramsSds: varchar("split_itrams_sds", { length: 255 }),
  orderReason: varchar("order_reason", { length: 255 }),
  fund: varchar("fund", { length: 255 }),
  projTopBu: varchar("proj_top_bu", { length: 255 }),
  projBu: varchar("proj_bu", { length: 255 }),
  projTopSection: varchar("proj_top_section", { length: 255 }),
  projSection: varchar("proj_section", { length: 255 }),
  projDept: varchar("proj_dept", { length: 255 }),
  projGroup: varchar("proj_group", { length: 255 }),
  rateClassification: varchar("rate_classification", { length: 255 }),
  skillsetClassification: varchar("skillset_classification", { length: 255 }),
  serviceArea: varchar("service_area", { length: 255 }),
  attrition: varchar("attrition", { length: 255 }),
  attritionType: varchar("attrition_type", { length: 255 }),
  version: varchar("version", { length: 100 }),
  billedCapacity: numeric("billed_capacity"),
  allocatedCapacity: numeric("allocated_capacity"),
  vkmCapacity: numeric("vkm_capacity"),
  msCapacity: numeric("ms_capacity"),
  notAllocatedCapacity: numeric("not_allocated_capacity"),
  nonLinearCapacity: numeric("non_linear_capacity"),
  sl2AllocatedCapacity: numeric("sl2_allocated_capacity"),
  sl2NotAllocatedCapacity: numeric("sl2_not_allocated_capacity"),
  notBilledNotAllocated: numeric("not_billed_not_allocated"),
  notBilledAllocated: numeric("not_billed_allocated"),
  investmentCapacity: numeric("investment_capacity"),
  totalHours: numeric("total_hours"),
  billableHours: numeric("billable_hours"),
  headcount: numeric("headcount"),
  capacity: numeric("capacity"),
  amountUsd: numeric("amount_usd"),
  amountInr: numeric("amount_inr"),
  srnPayablePmo: numeric("srn_payable_pmo"),
  payableAllocatedCap: numeric("payable_allocated_cap"),
  payableMsCap: numeric("payable_ms_cap"),
  payableVkmCap: numeric("payable_vkm_cap"),
  payableNotAllocatedCap: numeric("payable_not_allocated_cap"),
  payableNonLinearCap: numeric("payable_non_linear_cap"),
  payableInvestmentCap: numeric("payable_investment_cap"),
  payableNotBilledAllocated: numeric("payable_not_billed_allocated"),
  payableNotBilledNotAllocated: numeric("payable_not_billed_not_allocated"),
  payableUnbilledCapWithPo: numeric("payable_unbilled_cap_with_po"),
  ingestedAt: timestamp("ingested_at").defaultNow(),
  sourceRowNumber: integer("source_row_number"),
  rowData: jsonb("row_data"),
  includeExclude: varchar("include_exclude", { length: 50 }),
  newServiceArea: varchar("new_service_area", { length: 255 }),
  projSubServiceArea: varchar("proj_sub_service_area", { length: 255 }),
  resSubServiceArea: varchar("res_sub_service_area", { length: 255 }),
  vkmCode: varchar("vkm_code", { length: 255 }),
  resDept: varchar("res_dept", { length: 255 }),
  costType: varchar("cost_type", { length: 255 }),
  costCategoryClass: varchar("cost_category_class", { length: 255 }),
  subCostCategory: varchar("sub_cost_category", { length: 255 }),
  profitCenter: varchar("profit_center", { length: 255 }),
  prftFlag: varchar("prft_flag", { length: 50 }),
  rdate: varchar("rdate", { length: 100 }),
  releasedStatus: varchar("released_status", { length: 100 }),
  projectNonproject: varchar("project_nonproject", { length: 100 }),
  effortType: varchar("effort_type", { length: 255 }),
  resBu: varchar("res_bu", { length: 255 }),
  resSection: varchar("res_section", { length: 255 }),
  report: varchar("report", { length: 255 }),
  bpRate: numeric("bp_rate"),
  entityCategory: varchar("entity_category", { length: 255 }),
  entitySubCategory: varchar("entity_sub_category", { length: 255 }),
}, (table) => ({
  cubeIdIdx: index("cube_fact_data_cube_id_idx").on(table.cubeId),
  yearMonthIdx: index("cube_fact_data_year_month_idx").on(table.year, table.month),
  costCategoryIdx: index("cube_fact_data_cost_category_idx").on(table.costCategory),
  sectorIdx: index("cube_fact_data_sector_idx").on(table.sector),
}));

// Cube column mappings - maps source columns to standardized names
export const cubeColumnMappings = pgTable("cube_column_mappings", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  cubeId: varchar("cube_id", { length: 255 }).notNull().references(() => cubes.id, { onDelete: 'cascade' }),
  columnName: varchar("column_name", { length: 255 }).notNull(),
  columnType: varchar("column_type", { length: 50 }).default('dimension'),
  dbColumnName: varchar("db_column_name", { length: 255 }),
}, (table) => ({
  cubeIdIdx: index("cube_column_mappings_cube_id_idx").on(table.cubeId),
}));

// Cube cost categories - defines cost category hierarchy and properties
export const cubeCostCategories = pgTable("cube_cost_categories", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  cubeId: varchar("cube_id", { length: 255 }).notNull().references(() => cubes.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 500 }).notNull(),
  isSummary: boolean("is_summary").default(false),
  reportType: varchar("report_type", { length: 255 }),
  relevantColumns: jsonb("relevant_columns").default([]),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  cubeIdIdx: index("cube_cost_categories_cube_id_idx").on(table.cubeId),
  nameIdx: index("cube_cost_categories_name_idx").on(table.name),
  cubeNameUnique: unique("cube_cost_categories_cube_name_unique").on(table.cubeId, table.name),
}));

// Cube dimensions - stores dimension hierarchies for cubes
export const cubeDimensions = pgTable("cube_dimensions", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  cubeId: varchar("cube_id", { length: 255 }).notNull().references(() => cubes.id, { onDelete: 'cascade' }),
  dimensionType: varchar("dimension_type", { length: 100 }).notNull(),
  code: varchar("code", { length: 255 }).notNull(),
  name: varchar("name", { length: 500 }),
  parentCode: varchar("parent_code", { length: 255 }),
  metadata: jsonb("metadata").default({}),
}, (table) => ({
  cubeIdIdx: index("cube_dimensions_cube_id_idx").on(table.cubeId),
  dimensionTypeIdx: index("cube_dimensions_type_idx").on(table.dimensionType),
  codeIdx: index("cube_dimensions_code_idx").on(table.code),
  cubeDimCodeUnique: unique("cube_dimensions_cube_dim_code_unique").on(table.cubeId, table.dimensionType, table.code),
}));

// Cube ingestion jobs - tracks data ingestion progress
export const cubeIngestionJobs = pgTable("cube_ingestion_jobs", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  cubeId: varchar("cube_id", { length: 255 }).notNull().references(() => cubes.id, { onDelete: 'cascade' }),
  documentId: varchar("document_id", { length: 255 }),
  status: varchar("status", { length: 20 }).notNull().default('queued'),
  totalRows: integer("total_rows").default(0),
  processedRows: integer("processed_rows").default(0),
  errorMessage: text("error_message"),
  fileName: varchar("file_name", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => ({
  cubeIdIdx: index("cube_ingestion_jobs_cube_id_idx").on(table.cubeId),
  statusIdx: index("cube_ingestion_jobs_status_idx").on(table.status),
}));

// Cube query jobs - tracks query execution
export const cubeQueryJobs = pgTable("cube_query_jobs", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  cubeId: varchar("cube_id", { length: 255 }).references(() => cubes.id, { onDelete: 'cascade' }),
  userId: varchar("user_id", { length: 255 }).references(() => users.id, { onDelete: 'set null' }),
  queryText: text("query_text").notNull(),
  intentJson: jsonb("intent_json"),
  generatedSql: text("generated_sql"),
  status: varchar("status", { length: 50 }).default('pending'),
  resultCount: integer("result_count"),
  resultData: jsonb("result_data"),
  executionMs: integer("execution_ms"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  cubeIdIdx: index("cube_query_jobs_cube_id_idx").on(table.cubeId),
  userIdIdx: index("cube_query_jobs_user_id_idx").on(table.userId),
  statusIdx: index("cube_query_jobs_status_idx").on(table.status),
}));

// Geography mappings - maps text patterns to geographic locations
export const geographyMappings = pgTable("geography_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  pattern: text("pattern").notNull(),
  geography: text("geography").notNull(),
  matchType: varchar("match_type", { length: 20 }).notNull().default('contains'),
  priority: integer("priority").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  companyIdIdx: index("geography_mappings_company_id_idx").on(table.companyId),
  patternIdx: index("geography_mappings_pattern_idx").on(table.pattern),
}));

// Session table - stores user sessions (used by express-session)
export const sessions = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire").notNull(),
}, (table) => ({
  expireIdx: index("session_expire_idx").on(table.expire),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
  acceptedAt: true,
});

export const insertChatSchema = createInsertSchema(chats).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
});

export const insertBoardTemplateSchema = createInsertSchema(boardTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertBoardSchema = createInsertSchema(boards).omit({
  id: true,
  createdAt: true,
});

export const insertBoardThreadSchema = createInsertSchema(boardThreads).omit({
  id: true,
  createdAt: true,
});

export const insertBoardDocumentSchema = createInsertSchema(boardDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertBoardDataSourceSchema = createInsertSchema(boardDataSources).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentChunkSchema = createInsertSchema(documentChunks).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentEmbeddingSchema = createInsertSchema(documentEmbeddings).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentProcessingSchema = createInsertSchema(documentProcessing).omit({
  id: true,
  createdAt: true,
});

export const insertChatDocumentSchema = createInsertSchema(chatDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertDataSourceSchema = createInsertSchema(dataSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatSourceSchema = createInsertSchema(chatSources).omit({
  id: true,
  createdAt: true,
});

export const insertWebSearchCacheSchema = createInsertSchema(webSearchCache).omit({
  id: true,
  createdAt: true,
});

export const insertQueryAuditSchema = createInsertSchema(queryAudit).omit({
  id: true,
  createdAt: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

export const insertCompanyMembershipSchema = createInsertSchema(companyMemberships).omit({
  id: true,
  createdAt: true,
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertEnterpriseDocumentSchema = createInsertSchema(enterpriseDocuments).omit({
  id: true,
  uploadedAt: true,
});

export const insertEnterpriseDocumentChunkSchema = createInsertSchema(enterpriseDocumentChunks).omit({
  id: true,
  createdAt: true,
});

export const insertEnterpriseDocumentEmbeddingSchema = createInsertSchema(enterpriseDocumentEmbeddings).omit({
  id: true,
  createdAt: true,
});

export const insertEnterpriseDocumentProcessingSchema = createInsertSchema(enterpriseDocumentProcessing).omit({
  id: true,
  createdAt: true,
});

export const insertSchedulerConfigSchema = createInsertSchema(schedulerConfig).omit({
  id: true,
  updatedAt: true,
});

// Kiosk schemas
export const insertKioskFaqDocumentSchema = createInsertSchema(kioskFaqDocuments).omit({
  id: true,
  uploadedAt: true,
});

export const insertKioskChatSchema = createInsertSchema(kioskChats).omit({
  id: true,
  createdAt: true,
});

export const insertKioskMessageSchema = createInsertSchema(kioskMessages).omit({
  id: true,
  createdAt: true,
});

export const insertKioskFaqEntrySchema = createInsertSchema(kioskFaqEntries).omit({
  id: true,
  createdAt: true,
});

// Domain management schemas
export const insertDomainSchema = createInsertSchema(domains).omit({
  id: true,
  createdAt: true,
});

export const insertDomainSchedulerConfigSchema = createInsertSchema(domainSchedulerConfig).omit({
  id: true,
  updatedAt: true,
});

export const insertDomainUserSchema = createInsertSchema(domainUsers).omit({
  id: true,
  createdAt: true,
});

// Cube schemas
export const insertCubeSchema = createInsertSchema(cubes).omit({
  id: true,
  createdAt: true,
});

export const insertCubeUserAccessSchema = createInsertSchema(cubeUserAccess).omit({
  id: true,
  createdAt: true,
});

export const insertCubeMetadataSchema = createInsertSchema(cubeMetadata).omit({
  id: true,
  updatedAt: true,
});

export const insertCubePlanDataSchema = createInsertSchema(cubePlanData).omit({
  id: true,
  ingestedAt: true,
});

export const insertCubeFactDataSchema = createInsertSchema(cubeFactData).omit({
  ingestedAt: true,
});

export const insertCubeColumnMappingSchema = createInsertSchema(cubeColumnMappings).omit({
  id: true,
});

export const insertCubeCostCategorySchema = createInsertSchema(cubeCostCategories).omit({
  id: true,
  createdAt: true,
});

export const insertCubeDimensionSchema = createInsertSchema(cubeDimensions).omit({
  id: true,
});

export const insertCubeIngestionJobSchema = createInsertSchema(cubeIngestionJobs).omit({
  id: true,
  createdAt: true,
});

export const insertCubeQueryJobSchema = createInsertSchema(cubeQueryJobs).omit({
  id: true,
  createdAt: true,
});

export const insertGeographyMappingSchema = createInsertSchema(geographyMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitations.$inferSelect;
export type InsertChat = z.infer<typeof insertChatSchema>;
export type Chat = typeof chats.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertBoardTemplate = z.infer<typeof insertBoardTemplateSchema>;
export type BoardTemplate = typeof boardTemplates.$inferSelect;
export type InsertBoard = z.infer<typeof insertBoardSchema>;
export type Board = typeof boards.$inferSelect;
export type InsertBoardThread = z.infer<typeof insertBoardThreadSchema>;
export type BoardThread = typeof boardThreads.$inferSelect;
export type InsertBoardDocument = z.infer<typeof insertBoardDocumentSchema>;
export type BoardDocument = typeof boardDocuments.$inferSelect;
export type InsertBoardDataSource = z.infer<typeof insertBoardDataSourceSchema>;
export type BoardDataSource = typeof boardDataSources.$inferSelect;
export type InsertDocumentChunk = z.infer<typeof insertDocumentChunkSchema>;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentEmbedding = z.infer<typeof insertDocumentEmbeddingSchema>;
export type DocumentEmbedding = typeof documentEmbeddings.$inferSelect;
export type InsertDocumentProcessing = z.infer<typeof insertDocumentProcessingSchema>;
export type DocumentProcessing = typeof documentProcessing.$inferSelect;
export type InsertChatDocument = z.infer<typeof insertChatDocumentSchema>;
export type ChatDocument = typeof chatDocuments.$inferSelect;
export type InsertDataSource = z.infer<typeof insertDataSourceSchema>;
export type DataSource = typeof dataSources.$inferSelect;
export type InsertChatSource = z.infer<typeof insertChatSourceSchema>;
export type ChatSource = typeof chatSources.$inferSelect;
export type InsertWebSearchCache = z.infer<typeof insertWebSearchCacheSchema>;
export type WebSearchCache = typeof webSearchCache.$inferSelect;
export type InsertQueryAudit = z.infer<typeof insertQueryAuditSchema>;
export type QueryAudit = typeof queryAudit.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompanyMembership = z.infer<typeof insertCompanyMembershipSchema>;
export type CompanyMembership = typeof companyMemberships.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertEnterpriseDocument = z.infer<typeof insertEnterpriseDocumentSchema>;
export type EnterpriseDocument = typeof enterpriseDocuments.$inferSelect;
export type InsertEnterpriseDocumentChunk = z.infer<typeof insertEnterpriseDocumentChunkSchema>;
export type EnterpriseDocumentChunk = typeof enterpriseDocumentChunks.$inferSelect;
export type InsertEnterpriseDocumentEmbedding = z.infer<typeof insertEnterpriseDocumentEmbeddingSchema>;
export type EnterpriseDocumentEmbedding = typeof enterpriseDocumentEmbeddings.$inferSelect;
export type InsertEnterpriseDocumentProcessing = z.infer<typeof insertEnterpriseDocumentProcessingSchema>;
export type EnterpriseDocumentProcessing = typeof enterpriseDocumentProcessing.$inferSelect;
export type InsertSchedulerConfig = z.infer<typeof insertSchedulerConfigSchema>;
export type SchedulerConfig = typeof schedulerConfig.$inferSelect;

// Domain management types
export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type Domain = typeof domains.$inferSelect;
export type InsertDomainUser = z.infer<typeof insertDomainUserSchema>;
export type DomainUser = typeof domainUsers.$inferSelect;
export type InsertDomainSchedulerConfig = z.infer<typeof insertDomainSchedulerConfigSchema>;
export type DomainSchedulerConfig = typeof domainSchedulerConfig.$inferSelect;

// Cube types
export type InsertCube = z.infer<typeof insertCubeSchema>;
export type Cube = typeof cubes.$inferSelect;
export type InsertCubeUserAccess = z.infer<typeof insertCubeUserAccessSchema>;
export type CubeUserAccess = typeof cubeUserAccess.$inferSelect;
export type InsertCubeMetadata = z.infer<typeof insertCubeMetadataSchema>;
export type CubeMetadata = typeof cubeMetadata.$inferSelect;
export type InsertCubePlanData = z.infer<typeof insertCubePlanDataSchema>;
export type CubePlanData = typeof cubePlanData.$inferSelect;
export type InsertCubeFactData = z.infer<typeof insertCubeFactDataSchema>;
export type CubeFactData = typeof cubeFactData.$inferSelect;
export type InsertCubeColumnMapping = z.infer<typeof insertCubeColumnMappingSchema>;
export type CubeColumnMapping = typeof cubeColumnMappings.$inferSelect;
export type InsertCubeCostCategory = z.infer<typeof insertCubeCostCategorySchema>;
export type CubeCostCategory = typeof cubeCostCategories.$inferSelect;
export type InsertCubeDimension = z.infer<typeof insertCubeDimensionSchema>;
export type CubeDimension = typeof cubeDimensions.$inferSelect;
export type InsertCubeIngestionJob = z.infer<typeof insertCubeIngestionJobSchema>;
export type CubeIngestionJob = typeof cubeIngestionJobs.$inferSelect;
export type InsertCubeQueryJob = z.infer<typeof insertCubeQueryJobSchema>;
export type CubeQueryJob = typeof cubeQueryJobs.$inferSelect;
export type InsertGeographyMapping = z.infer<typeof insertGeographyMappingSchema>;
export type GeographyMapping = typeof geographyMappings.$inferSelect;
export type Session = typeof sessions.$inferSelect;

// Domain API Connectors
export const insertDomainApiConnectorSchema = createInsertSchema(domainApiConnectors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDomainApiConnector = z.infer<typeof insertDomainApiConnectorSchema>;
export type DomainApiConnector = typeof domainApiConnectors.$inferSelect;

// Connector type definitions
export const CONNECTOR_TYPES = {
  ANAPLAN: 'anaplan',
  AZURE_BLOB: 'azure_blob',
  SALESFORCE: 'salesforce',
  POWER_BI: 'power_bi',
  TABLEAU: 'tableau',
} as const;

export type ConnectorType = typeof CONNECTOR_TYPES[keyof typeof CONNECTOR_TYPES];

// Connector config schemas for validation
export const anaplanConfigSchema = z.object({
  workspace_id: z.string().min(1, 'Workspace ID is required'),
  model_id: z.string().min(1, 'Model ID is required'),
  process_id: z.string().min(1, 'Process ID is required'),
  username: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password is required'),
});

export const azureBlobConfigSchema = z.object({
  account_name: z.string().min(1, 'Storage account name is required'),
  // Auth mode 1: Shared Key
  account_key: z.string().optional().nullable(),
  // Auth mode 2: Account-SAS token
  sas_token: z.string().optional().nullable(),
  // Auth mode 3: Azure AD service principal
  tenant_id: z.string().optional().nullable(),
  client_id: z.string().optional().nullable(),
  client_secret: z.string().optional().nullable(),
  container_name: z.string().min(1, 'Container name is required'),
  endpoint_suffix: z.string().default('core.windows.net'),
  blob_prefix: z.string().optional().nullable(),
});

export type AnaplanConfig = z.infer<typeof anaplanConfigSchema>;
export type AzureBlobConfig = z.infer<typeof azureBlobConfigSchema>;

// Kiosk types
export type InsertKioskFaqDocument = z.infer<typeof insertKioskFaqDocumentSchema>;
export type KioskFaqDocument = typeof kioskFaqDocuments.$inferSelect;
export type InsertKioskChat = z.infer<typeof insertKioskChatSchema>;
export type KioskChat = typeof kioskChats.$inferSelect;
export type InsertKioskMessage = z.infer<typeof insertKioskMessageSchema>;
export type KioskMessage = typeof kioskMessages.$inferSelect;
export type InsertKioskFaqEntry = z.infer<typeof insertKioskFaqEntrySchema>;
export type KioskFaqEntry = typeof kioskFaqEntries.$inferSelect;

// ============================================================================
// SCHEMA CONFIGURATION TYPES
// ============================================================================

// Column type enum for validation
export const COLUMN_TYPES = ['dimension', 'metric', 'period', 'hierarchy', 'ignore'] as const;
export type ColumnType = typeof COLUMN_TYPES[number];

// Data type enum for validation
export const DATA_TYPES = ['text', 'number', 'date', 'currency', 'boolean'] as const;
export type DataTypeOption = typeof DATA_TYPES[number];

// Aggregation rule enum for validation
export const AGGREGATION_RULES = ['sum', 'avg', 'count', 'min', 'max', 'last'] as const;
export type AggregationRule = typeof AGGREGATION_RULES[number];

// Insert schemas for new tables
export const insertCubeColumnConfigSchema = createInsertSchema(cubeColumnConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDomainHierarchyConfigSchema = createInsertSchema(domainHierarchyConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCubeSchemaVersionSchema = createInsertSchema(cubeSchemaVersions).omit({
  id: true,
  createdAt: true,
});

// Types for new tables
export type InsertCubeColumnConfig = z.infer<typeof insertCubeColumnConfigSchema>;
export type CubeColumnConfig = typeof cubeColumnConfig.$inferSelect;

export type InsertDomainHierarchyConfig = z.infer<typeof insertDomainHierarchyConfigSchema>;
export type DomainHierarchyConfig = typeof domainHierarchyConfig.$inferSelect;

export type InsertCubeSchemaVersion = z.infer<typeof insertCubeSchemaVersionSchema>;
export type CubeSchemaVersion = typeof cubeSchemaVersions.$inferSelect;

// OTP Codes schemas
export const insertOtpCodeSchema = createInsertSchema(otpCodes).omit({
  id: true,
  createdAt: true,
});

export type InsertOtpCode = z.infer<typeof insertOtpCodeSchema>;
export type OtpCode = typeof otpCodes.$inferSelect;

// Device Trust schemas
export const insertDeviceTrustSchema = createInsertSchema(deviceTrust).omit({
  id: true,
  createdAt: true,
});

export type InsertDeviceTrust = z.infer<typeof insertDeviceTrustSchema>;
export type DeviceTrust = typeof deviceTrust.$inferSelect;

// Password validation helpers
export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
} as const;

export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
} => {
  const errors: string[] = [];
  
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`);
  }
  
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (PASSWORD_REQUIREMENTS.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  const isValid = errors.length === 0;
  
  // Calculate strength
  let score = 0;
  if (password.length >= PASSWORD_REQUIREMENTS.minLength) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
  
  let strength: 'weak' | 'medium' | 'strong';
  if (score <= 2) strength = 'weak';
  else if (score <= 4) strength = 'medium';
  else strength = 'strong';
  
  return { isValid, errors, strength };
};

// Zod schema for password validation
export const strongPasswordSchema = z.string()
  .min(PASSWORD_REQUIREMENTS.minLength, `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`)
  .refine((password) => /[A-Z]/.test(password), 'Password must contain at least one uppercase letter')
  .refine((password) => /[a-z]/.test(password), 'Password must contain at least one lowercase letter')
  .refine((password) => /[0-9]/.test(password), 'Password must contain at least one number')
  .refine((password) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password), 'Password must contain at least one special character');
