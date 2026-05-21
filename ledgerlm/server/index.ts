import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pkg from "pg";
const { Pool } = pkg;
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedDatabase } from "./seed";
import { startPythonBackend } from "./python-backend";
import { scheduler } from "./services/scheduler";
import { multiTenantScheduler } from "./services/multiTenantScheduler";
import { createSchedulerConfig } from "./migrations/create-scheduler-config";
import { runDomainEnhancementsMigration } from "./migrations/domain-enhancements";
import { createKioskTables } from "./migrations/create-kiosk-tables";
import { addBillingTypeColumn } from "./migrations/add-billing-type-column";
import { createKioskFaqEntriesTable } from "./migrations/create-kiosk-faq-entries";
import { addDomainAnaplanCredentials } from "./migrations/add-domain-anaplan-credentials";
import { createDomainApiConnectorsTable } from "./migrations/create-domain-api-connectors";
import { createAzureBlobRegistryTable, dropAzureBlobConnectorUniqueConstraint } from "./migrations/create-azure-blob-registry";
import { runConnectorPreferencesMigration } from "./migrations/add-connector-preferences";
import { addCubeIdToChunks } from "./migrations/add-cube-id-to-chunks";
import { addTargetCubeToSchedulerConfig } from "./migrations/add-target-cube-to-scheduler";
import { createCubeMetadataTable } from "./migrations/create-cube-metadata";
import { runSemanticSqlMigration } from "./migrations/create-semantic-sql-tables";
import { runSchemaConfigMigration } from "./migrations/create-schema-config-tables";
import { createIngestionJobsTable } from "./migrations/create-ingestion-jobs";
import { createBusinessLogicTables } from "./migrations/create-business-logic-tables";
import { addSsoColumnsToDomains } from "./migrations/add-sso-columns";
import { addSsoGroupColumnsToDomains } from "./migrations/add-sso-group-columns";
import { addEmailConfigColumnsToDomains } from "./migrations/add-email-config-columns";
import { addAiConfigColumnsToDomains } from "./migrations/add-ai-config-columns";
import { fixAzureBlobConnectorSchedules } from "./migrations/fix-azure-blob-connector-schedules";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Session middleware with PostgreSQL store
const PgSession = connectPgSimple(session);

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("NEON_DATABASE_URL environment variable is required");
}

// Determine if SSL should be used (disabled for local Docker containers)
const isLocalDb = dbUrl.includes('localhost') || 
                  dbUrl.includes('ledgerlm-db') ||
                  dbUrl.includes('172.17.') ||
                  dbUrl.includes('127.0.0.1');

const sessionPool = new Pool({
  connectionString: dbUrl,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
});

app.use(session({
  store: new PgSession({
    pool: sessionPool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },
}));

(async () => {
  // Ensure scheduler_config table exists (required for scheduler service)
  await createSchedulerConfig();
  
  // Run domain enhancements migration (adds company_id, user_quota, domain_scheduler_config)
  await runDomainEnhancementsMigration();
  
  // Run kiosk tables migration (for Billing Kiosk feature)
  await createKioskTables();
  
  // Add billing_type column to kiosk_faq_documents
  await addBillingTypeColumn();
  
  // Create kiosk_faq_entries table for parsed FAQ Q&A pairs
  await createKioskFaqEntriesTable();
  
  // Add Anaplan credentials columns to domain_scheduler_config
  await addDomainAnaplanCredentials();
  
  // Create domain API connectors table for plugin-based integrations
  await createDomainApiConnectorsTable();

  // Create azure_blob_file_registry table for delta-sync tracking (new files only)
  await createAzureBlobRegistryTable();
  // Allow multiple Azure Blob connectors per domain (different folders/cubes)
  await dropAzureBlobConnectorUniqueConstraint();
  
  // Add connector_preferences column to user_settings
  await runConnectorPreferencesMigration();
  
  // Add cube_id columns to enterprise chunks and embeddings for cube-level data isolation
  await addCubeIdToChunks();
  
  // Add target_cube_id column to domain_scheduler_config for automation cube targeting
  await addTargetCubeToSchedulerConfig();
  
  // Create cube_metadata table for structured data indexing
  await createCubeMetadataTable();
  
  // Create semantic SQL tables for natural language queries on large Excel files
  await runSemanticSqlMigration();
  
  // Create schema configuration tables for domain-specific column mapping
  await runSchemaConfigMigration();
  
  // Create ingestion jobs table for tracking Excel file processing progress
  await createIngestionJobsTable();
  
  // Create business logic tables for domain-specific SQL generation
  await createBusinessLogicTables();

  // Add Microsoft SSO columns to domains table
  await addSsoColumnsToDomains();

  // Add SSO group access control columns to domains table
  await addSsoGroupColumnsToDomains();

  // Add email provider config columns to domains table
  await addEmailConfigColumnsToDomains();

  // Add AI provider config columns to domains table + embedding_3072 to embedding tables
  await addAiConfigColumnsToDomains();

  await seedDatabase();
  await fixAzureBlobConnectorSchedules();
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Start Python backend for document processing and RAG
    // In Docker (Supervisor manages Python), skip starting it here
    // Use DOCKER_ENV=true to indicate running in Docker container
    if (process.env.DOCKER_ENV !== 'true') {
      startPythonBackend();
    } else {
      log('Docker mode: Python backend managed by Supervisor');
    }
    
    // Start Anaplan automation scheduler (6 AM IST daily) - legacy global scheduler
    scheduler.start();
    
    // Start multi-tenant domain schedulers for per-domain Anaplan automation
    multiTenantScheduler.startAllDomainSchedulers();
  });
})();
