# Cube SQL Workflow Guide

## Overview: The Simple Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ADMIN SETUP (One Time)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Step 1: CREATE CUBE          Step 2: UPLOAD SCHEMA MAPPING                │
│   ┌─────────────────┐          ┌──────────────────────────────────┐         │
│   │ Cube Name:      │          │ Column 1: "Year" → dimension     │         │
│   │ "Finance Data"  │   ──►    │ Column 2: "Month" → dimension    │         │
│   │                 │          │ Column 3: "Amount" → metric (SUM)│         │
│   │ Description:    │          │ Column 4: "Region" → dimension   │         │
│   │ "Monthly P&L"   │          │ ...                              │         │
│   └─────────────────┘          └──────────────────────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA UPLOAD (Recurring)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Step 3: UPLOAD FILES                Step 4: DATA STORED IN SQL            │
│   ┌─────────────────┐                 ┌──────────────────────────────┐      │
│   │ Excel (.xlsx)   │                 │ PostgreSQL Table             │      │
│   │ CSV (.csv)      │   ──►           │ cube_fact_data               │      │
│   │ Text (.txt)     │   (ingestion)   │ ├── year: 2024              │      │
│   │                 │                 │ ├── month: January          │      │
│   │ 100,000+ rows   │                 │ ├── amount: 50000           │      │
│   └─────────────────┘                 │ └── region: India           │      │
│                                       └──────────────────────────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           QUERY (Efficient!)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Step 5: USER ASKS QUESTION          Step 6: LLM GENERATES SQL             │
│   ┌──────────────────────────┐        ┌──────────────────────────────┐      │
│   │ "What was total revenue  │        │ SELECT SUM(amount)           │      │
│   │  for India in January?"  │  ──►   │ FROM cube_fact_data          │      │
│   │                          │        │ WHERE region = 'India'       │      │
│   └──────────────────────────┘        │ AND month = 'January'        │      │
│                                       └──────────────────────────────┘      │
│                                                    │                         │
│   Step 8: LLM ANALYZES RESULT         Step 7: SQL RETURNS DATA              │
│   ┌──────────────────────────┐        ┌──────────────────────────────┐      │
│   │ "The total revenue for   │  ◄──   │ Result: 50000                │      │
│   │  India in January was    │        │ (Just this number, NOT the   │      │
│   │  $50,000."               │        │  entire 100K row Excel!)     │      │
│   └──────────────────────────┘        └──────────────────────────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Why This Approach is Better

| Old Approach | New SQL Approach |
|--------------|------------------|
| Send 100K row Excel to LLM | SQL returns only 5-10 relevant rows |
| LLM token limit problems | No token limits - SQL does the filtering |
| Slow: 30-60 seconds per query | Fast: 1-3 seconds per query |
| Expensive: High API costs | Cheap: Minimal API usage |
| Inaccurate: LLM might miss data | Accurate: SQL is precise |

---

## Database Tables Involved

### 1. `cubes` - Cube Definitions
Stores the cube name, description, and which domain it belongs to.

| Column | Purpose | Example |
|--------|---------|---------|
| `id` | Unique ID | `uuid-123-abc` |
| `domain_id` | Which domain owns this | `bosch-domain-id` |
| `name` | Cube name | "Finance Data" |
| `description` | What data is in this cube | "Monthly P&L and revenue data" |
| `source_type` | How data is added | "manual" or "anaplan" |

### 2. `cube_column_config` - Schema Mapping
Tells the system how to interpret each column in your Excel.

| Column | Purpose | Example |
|--------|---------|---------|
| `cube_id` | Which cube this belongs to | `uuid-123-abc` |
| `original_name` | Column name in Excel | "Region/Entity" |
| `display_name` | Friendly name | "Region" |
| `column_type` | How to use it | "dimension" or "metric" |
| `data_type` | What kind of data | "text" or "number" |
| `aggregation_rule` | For metrics | "sum", "avg", "count" |
| `aliases` | Other names for NLP | ["Region", "Entity", "Location"] |

### 3. `cube_fact_data` - Actual Data Storage
All your Excel rows go here as SQL records.

| Column | Purpose |
|--------|---------|
| `cube_id` | Which cube |
| `row_data` | JSON with all column values |
| `period_date` | Date for time-based queries |

### 4. `cube_ingestion_jobs` - Upload Tracking
Tracks file upload progress.

| Column | Purpose |
|--------|---------|
| `cube_id` | Which cube |
| `file_name` | Uploaded file name |
| `status` | "processing", "completed", "failed" |
| `rows_processed` | How many rows done |
| `total_rows` | Total rows in file |

---

## What You Need to Configure in Local Deployment

### Files That Need Changes

| File | What to Change | Why |
|------|----------------|-----|
| `.env` | `DATABASE_URL` | Your local PostgreSQL connection |
| `.env` | `OPENAI_API_KEY` | Your OpenAI key for LLM |
| `.env` | `PYTHON_API_URL` | Usually `http://localhost:8000` |

### Database Setup Commands

```bash
# 1. Create database (in psql)
CREATE DATABASE ledgerlm;
CREATE USER ledgerlm_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE ledgerlm TO ledgerlm_user;

# 2. Create tables (from project folder)
npm run db:push
```

### Verify Tables Created

```sql
-- In psql, run:
\c ledgerlm
\dt

-- You should see:
--  cubes
--  cube_column_config
--  cube_fact_data
--  cube_ingestion_jobs
--  cube_metadata
--  (and other tables)
```

---

## Admin Workflow: Step-by-Step

### Step 1: Create a New Cube

**Navigation:** Admin Portal → Enterprise Data → Cubes → "New Cube"

**What to Enter:**
| Field | Description | Example |
|-------|-------------|---------|
| Cube Name | Short name for data set | "Finance Q1 2024" |
| Description | What data is in this cube | "Quarterly financial data including P&L, revenue" |
| Source Type | How data will be added | "Manual" (for file uploads) |

**Result:** Cube is created with a unique ID.

---

### Step 2: Upload Schema Mapping

**Navigation:** Admin Portal → Enterprise Data → Cubes → [Your Cube] → "Configure Schema"

**Option A: Upload Schema File (JSON/CSV)**

Create a file `schema.json`:
```json
{
  "columns": [
    {
      "original_name": "Year",
      "display_name": "Fiscal Year",
      "column_type": "dimension",
      "data_type": "number"
    },
    {
      "original_name": "Month",
      "display_name": "Month",
      "column_type": "dimension",
      "data_type": "text"
    },
    {
      "original_name": "Amount in USD",
      "display_name": "Revenue USD",
      "column_type": "metric",
      "data_type": "currency",
      "aggregation_rule": "sum",
      "aliases": ["Revenue", "Sales", "Amount"]
    },
    {
      "original_name": "Region/Entity",
      "display_name": "Region",
      "column_type": "dimension",
      "data_type": "text",
      "aliases": ["Country", "Location", "Entity"]
    }
  ]
}
```

**Option B: Auto-Detect from Sample Excel**

1. Upload a small sample Excel file (first 100 rows)
2. System reads column headers
3. Admin assigns each column as "dimension", "metric", or "ignore"

---

### Step 3: Upload Data Files

**Navigation:** Admin Portal → Enterprise Data → Cubes → [Your Cube] → "Upload Data"

**Supported Files:**
| Format | Extension | Notes |
|--------|-----------|-------|
| Excel | `.xlsx`, `.xls` | All sheets processed |
| CSV | `.csv` | Comma or semicolon delimited |
| Text | `.txt` | Tab delimited |

**Upload Process:**
1. Select file(s)
2. Click "Upload"
3. Watch progress bar
4. Status changes: `queued` → `processing` → `completed`

**What Happens During Ingestion:**
```
Excel File (100,000 rows)
         │
         ▼
┌─────────────────────────┐
│ Python Backend          │
│ - Read file in chunks   │
│ - Map columns to schema │
│ - Validate data types   │
│ - Insert into SQL       │
└─────────────────────────┘
         │
         ▼
PostgreSQL cube_fact_data table
(100,000 rows stored as SQL records)
```

---

### Step 4: Query Data

**Navigation:** Chat Page → Select Cube → Ask Question

**Example Queries:**

| User Question | Generated SQL |
|---------------|---------------|
| "Total revenue by region" | `SELECT region, SUM(amount_usd) FROM cube_fact_data WHERE cube_id='...' GROUP BY region` |
| "January 2024 headcount" | `SELECT SUM(headcount) FROM cube_fact_data WHERE cube_id='...' AND month='January' AND year=2024` |
| "Compare Q1 vs Q2 costs" | `SELECT quarter, SUM(amount_usd) FROM ... WHERE quarter IN ('Q1','Q2') GROUP BY quarter` |

**Query Flow:**
```
User: "Show revenue for India"
         │
         ▼
┌─────────────────────────────┐
│ 1. Intent Parsing (LLM)    │
│    - Identify: metric=revenue │
│    - Identify: filter=India  │
│    - Identify: aggregation=SUM│
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 2. SQL Generation          │
│    SELECT SUM(amount_usd)  │
│    FROM cube_fact_data     │
│    WHERE region='India'    │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 3. SQL Execution           │
│    Result: 2,500,000       │
│    (1 row, not 100K rows!) │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 4. LLM Analysis            │
│    "The total revenue for  │
│     India is $2.5 million" │
└─────────────────────────────┘
```

---

## API Endpoints Reference

### Cube Management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/domain-admin/cubes` | List all cubes |
| `POST` | `/api/domain-admin/cubes` | Create new cube |
| `GET` | `/api/domain-admin/cubes/:id` | Get cube details |
| `DELETE` | `/api/domain-admin/cubes/:id` | Delete cube |

### Schema Configuration

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/domain-admin/cubes/:id/columns` | Get schema mapping |
| `POST` | `/api/domain-admin/cubes/:id/columns` | Save schema mapping |
| `PUT` | `/api/domain-admin/cubes/:id/columns/:colId` | Update single column |

### Data Ingestion

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v2/semantic-sql/ingest` | Upload file for ingestion |
| `GET` | `/api/v2/semantic-sql/jobs/:jobId/status` | Check ingestion progress |
| `GET` | `/api/domain-admin/cubes/:id/data/count` | Count rows in cube |

### Querying

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v2/semantic-sql/intent` | Parse user question |
| `POST` | `/api/v2/semantic-sql/compile` | Generate SQL from intent |
| `POST` | `/api/v2/semantic-sql/execute` | Run SQL and get results |
| `POST` | `/api/v2/semantic-sql/query` | Full pipeline (question → answer) |

---

## Testing Checklist

### After Deployment, Test These:

| # | Test | Command/Action | Expected Result |
|---|------|----------------|-----------------|
| 1 | Database connected | `curl localhost:5000/api/health` | `{"status":"ok"}` |
| 2 | Python backend running | `curl localhost:8000/api/v2/semantic-sql/health` | `{"status":"healthy"}` |
| 3 | Create cube | POST to `/api/domain-admin/cubes` | Cube ID returned |
| 4 | Upload schema | POST column config | Columns saved |
| 5 | Upload Excel | POST file to `/api/v2/semantic-sql/ingest` | Job ID returned |
| 6 | Check ingestion | GET job status | `status: completed` |
| 7 | Count rows | GET cube data count | Shows row count |
| 8 | Query data | POST natural language question | SQL result returned |

---

## Acceptance Criteria

### Infrastructure
- [ ] PostgreSQL running and accessible
- [ ] Node.js server running on port 5000
- [ ] Python backend running on port 8000
- [ ] All required tables created

### Cube Creation
- [ ] Can create new cube with name and description
- [ ] Cube appears in cube list
- [ ] Cube has unique ID

### Schema Mapping
- [ ] Can configure columns for cube
- [ ] Column types saved (dimension/metric)
- [ ] Aliases saved for NLP matching

### Data Ingestion
- [ ] Can upload Excel file
- [ ] Progress shown during upload
- [ ] Rows inserted into cube_fact_data
- [ ] Job status shows "completed"

### Querying
- [ ] Natural language question parsed correctly
- [ ] SQL generated is valid
- [ ] Query returns correct data
- [ ] LLM provides accurate analysis

---

## Quick Reference: Column Types

| Type | Purpose | Examples | Use In SQL |
|------|---------|----------|------------|
| `dimension` | Categories to filter/group by | Year, Month, Region, Department | WHERE, GROUP BY |
| `metric` | Numbers to calculate | Amount, Headcount, Hours | SUM(), AVG(), COUNT() |
| `period` | Time-related fields | Date, Quarter, FiscalYear | Time-series queries |
| `hierarchy` | Nested categories | BU > Section > Dept | Drill-down queries |
| `ignore` | Skip this column | Internal IDs, Notes | Not used |

---

*Last Updated: December 2025*
