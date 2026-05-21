/**
 * Migration: Create Semantic SQL Tables for Bosch Finance Data
 * 
 * This creates dimension and fact tables to enable SQL-like queries on
 * large financial Excel files (600K+ rows) through natural language.
 */
import { db } from "../db";
import { sql } from "drizzle-orm";

export async function runSemanticSqlMigration() {
  console.log("🔧 Running semantic SQL tables migration...");
  
  try {
    // 1. Create cube_cost_categories dimension table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cube_cost_categories (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        cube_id VARCHAR(255) NOT NULL REFERENCES cubes(id) ON DELETE CASCADE,
        name VARCHAR(500) NOT NULL,
        is_summary BOOLEAN DEFAULT FALSE,
        report_type VARCHAR(255),
        relevant_columns JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ Created cube_cost_categories table");

    // 2. Create cube_dimensions table (entities, projects, etc.)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cube_dimensions (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        cube_id VARCHAR(255) NOT NULL REFERENCES cubes(id) ON DELETE CASCADE,
        dimension_type VARCHAR(100) NOT NULL,
        code VARCHAR(255) NOT NULL,
        name VARCHAR(500),
        parent_code VARCHAR(255),
        metadata JSONB DEFAULT '{}',
        UNIQUE(cube_id, dimension_type, code)
      )
    `);
    console.log("✅ Created cube_dimensions table");

    // 3. Create cube_fact_data table (the actual financial data)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cube_fact_data (
        id BIGSERIAL PRIMARY KEY,
        cube_id VARCHAR(255) NOT NULL REFERENCES cubes(id) ON DELETE CASCADE,
        cost_category VARCHAR(500),
        year INTEGER,
        month INTEGER,
        -- Dimension columns (for filtering/grouping)
        region_entity VARCHAR(255),
        onsite_offshore VARCHAR(100),
        sector VARCHAR(255),
        project_gb VARCHAR(255),
        planning_gb VARCHAR(255),
        section VARCHAR(255),
        resource_type VARCHAR(100),
        employee_number VARCHAR(100),
        employee_name VARCHAR(500),
        salary_level VARCHAR(100),
        project_id VARCHAR(255),
        cost_center VARCHAR(255),
        gl_account VARCHAR(255),
        split_itrams_sds VARCHAR(255),
        order_reason VARCHAR(255),
        fund VARCHAR(255),
        proj_top_bu VARCHAR(255),
        proj_bu VARCHAR(255),
        proj_top_section VARCHAR(255),
        proj_section VARCHAR(255),
        proj_dept VARCHAR(255),
        proj_group VARCHAR(255),
        rate_classification VARCHAR(255),
        skillset_classification VARCHAR(255),
        service_area VARCHAR(255),
        attrition VARCHAR(255),
        attrition_type VARCHAR(255),
        version VARCHAR(100),
        include_exclude VARCHAR(50),
        -- New dimension columns (Phase 2 additions for New Service Area support)
        new_service_area VARCHAR(255),
        proj_sub_service_area VARCHAR(255),
        res_sub_service_area VARCHAR(255),
        vkm_code VARCHAR(255),
        res_dept VARCHAR(255),
        cost_type VARCHAR(255),
        cost_category_class VARCHAR(255),
        sub_cost_category VARCHAR(255),
        profit_center VARCHAR(255),
        prft_flag VARCHAR(50),
        rdate VARCHAR(100),
        released_status VARCHAR(100),
        project_nonproject VARCHAR(100),
        effort_type VARCHAR(255),
        res_bu VARCHAR(255),
        res_section VARCHAR(255),
        report VARCHAR(255),
        -- Metric columns (for aggregation)
        billed_capacity DECIMAL(18,6),
        allocated_capacity DECIMAL(18,6),
        vkm_capacity DECIMAL(18,6),
        ms_capacity DECIMAL(18,6),
        not_allocated_capacity DECIMAL(18,6),
        non_linear_capacity DECIMAL(18,6),
        sl2_allocated_capacity DECIMAL(18,6),
        sl2_not_allocated_capacity DECIMAL(18,6),
        not_billed_not_allocated DECIMAL(18,6),
        not_billed_allocated DECIMAL(18,6),
        investment_capacity DECIMAL(18,6),
        total_hours DECIMAL(18,6),
        billable_hours DECIMAL(18,6),
        headcount DECIMAL(18,6),
        capacity DECIMAL(18,6),
        amount_usd DECIMAL(18,2),
        amount_inr DECIMAL(18,2),
        srn_payable_pmo DECIMAL(18,6),
        payable_allocated_cap DECIMAL(18,6),
        payable_ms_cap DECIMAL(18,6),
        payable_vkm_cap DECIMAL(18,6),
        payable_not_allocated_cap DECIMAL(18,6),
        payable_non_linear_cap DECIMAL(18,6),
        payable_investment_cap DECIMAL(18,6),
        payable_not_billed_allocated DECIMAL(18,6),
        payable_not_billed_not_allocated DECIMAL(18,6),
        payable_unbilled_cap_with_po DECIMAL(18,6),
        -- Timestamps
        ingested_at TIMESTAMP DEFAULT NOW(),
        source_row_number INTEGER
      )
    `);
    console.log("✅ Created cube_fact_data table");

    // 4. Create indexes for fast queries
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_cube_fact_cube_id ON cube_fact_data(cube_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_cube_fact_cost_cat ON cube_fact_data(cost_category)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_cube_fact_period ON cube_fact_data(year, month)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_cube_fact_entity ON cube_fact_data(region_entity)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_cube_fact_project ON cube_fact_data(project_gb)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_cube_cost_cat_cube ON cube_cost_categories(cube_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_cube_dim_type ON cube_dimensions(cube_id, dimension_type)
    `);
    console.log("✅ Created indexes");

    // 5. Create query_jobs table for async execution tracking
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cube_query_jobs (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        cube_id VARCHAR(255) REFERENCES cubes(id) ON DELETE CASCADE,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        query_text TEXT NOT NULL,
        intent_json JSONB,
        generated_sql TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        result_count INTEGER,
        result_data JSONB,
        execution_ms INTEGER,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);
    console.log("✅ Created cube_query_jobs table");

    // 6. Create cost category column mappings table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cube_column_mappings (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        cube_id VARCHAR(255) NOT NULL REFERENCES cubes(id) ON DELETE CASCADE,
        cost_category VARCHAR(500) NOT NULL,
        column_name VARCHAR(255) NOT NULL,
        column_type VARCHAR(50) DEFAULT 'dimension',
        db_column_name VARCHAR(255),
        UNIQUE(cube_id, cost_category, column_name)
      )
    `);
    console.log("✅ Created cube_column_mappings table");

    console.log("✨ Semantic SQL migration completed successfully!");
  } catch (error: any) {
    console.error("Error running semantic SQL migration:", error.message);
  }
}
