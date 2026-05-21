import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration: Create business logic tables for domain-specific SQL generation
 * 
 * Tables created:
 * 1. cube_business_terms - Maps business terms to SQL conditions
 * 2. cube_calculation_rules - Defines formulas for derived metrics
 * 3. cube_query_patterns - Reusable SQL templates
 * 4. cube_filter_rules - Semantic labels to SQL predicates
 * 5. cube_column_values - Explains specific column values
 */
export async function createBusinessLogicTables() {
  console.log("🔧 Creating business logic tables for semantic SQL...");
  
  try {
    // Create cube_business_terms table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cube_business_terms (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        cube_id VARCHAR NOT NULL REFERENCES cubes(id) ON DELETE CASCADE,
        term_name TEXT NOT NULL,
        term_aliases TEXT[],
        definition TEXT NOT NULL,
        sql_filter TEXT,
        required_columns TEXT[],
        category VARCHAR(50) DEFAULT 'general',
        priority INTEGER DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Created cube_business_terms table");
    
    // Create indexes for cube_business_terms
    await db.execute(sql`CREATE INDEX IF NOT EXISTS cube_business_terms_cube_id_idx ON cube_business_terms(cube_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS cube_business_terms_term_name_idx ON cube_business_terms(term_name)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS cube_business_terms_category_idx ON cube_business_terms(category)`);
    
    // Create cube_calculation_rules table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cube_calculation_rules (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        cube_id VARCHAR NOT NULL REFERENCES cubes(id) ON DELETE CASCADE,
        calculation_name TEXT NOT NULL,
        calculation_aliases TEXT[],
        description TEXT NOT NULL,
        formula TEXT NOT NULL,
        formula_type VARCHAR(20) DEFAULT 'ratio',
        result_type VARCHAR(20) DEFAULT 'percentage',
        required_columns TEXT[],
        default_filters TEXT,
        rounding_precision INTEGER DEFAULT 2,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Created cube_calculation_rules table");
    
    // Create indexes for cube_calculation_rules
    await db.execute(sql`CREATE INDEX IF NOT EXISTS cube_calculation_rules_cube_id_idx ON cube_calculation_rules(cube_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS cube_calculation_rules_name_idx ON cube_calculation_rules(calculation_name)`);
    
    // Create cube_query_patterns table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cube_query_patterns (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        cube_id VARCHAR NOT NULL REFERENCES cubes(id) ON DELETE CASCADE,
        pattern_name TEXT NOT NULL,
        pattern_description TEXT NOT NULL,
        trigger_phrases TEXT[],
        sql_template TEXT NOT NULL,
        template_variables JSONB,
        example_question TEXT,
        example_sql TEXT,
        category VARCHAR(50) DEFAULT 'general',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Created cube_query_patterns table");
    
    // Create indexes for cube_query_patterns
    await db.execute(sql`CREATE INDEX IF NOT EXISTS cube_query_patterns_cube_id_idx ON cube_query_patterns(cube_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS cube_query_patterns_name_idx ON cube_query_patterns(pattern_name)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS cube_query_patterns_category_idx ON cube_query_patterns(category)`);
    
    // Create cube_filter_rules table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cube_filter_rules (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        cube_id VARCHAR NOT NULL REFERENCES cubes(id) ON DELETE CASCADE,
        filter_name TEXT NOT NULL,
        filter_aliases TEXT[],
        description TEXT NOT NULL,
        sql_predicate TEXT NOT NULL,
        target_column TEXT,
        is_default INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Created cube_filter_rules table");
    
    // Create indexes for cube_filter_rules
    await db.execute(sql`CREATE INDEX IF NOT EXISTS cube_filter_rules_cube_id_idx ON cube_filter_rules(cube_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS cube_filter_rules_name_idx ON cube_filter_rules(filter_name)`);
    
    // Create cube_column_values table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cube_column_values (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        cube_id VARCHAR NOT NULL REFERENCES cubes(id) ON DELETE CASCADE,
        column_name TEXT NOT NULL,
        value_name TEXT NOT NULL,
        value_description TEXT NOT NULL,
        value_aliases TEXT[],
        usage_context TEXT,
        related_values TEXT[],
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Created cube_column_values table");
    
    // Create indexes for cube_column_values
    await db.execute(sql`CREATE INDEX IF NOT EXISTS cube_column_values_cube_id_idx ON cube_column_values(cube_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS cube_column_values_column_name_idx ON cube_column_values(column_name)`);
    
    // Create unique index (with safe pattern for existing indexes)
    try {
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS cube_column_values_unique ON cube_column_values(cube_id, column_name, value_name)`);
    } catch (e) {
      // Index might already exist
    }
    
    console.log("✨ Business logic tables migration completed successfully!");
    
  } catch (error: any) {
    // Tables might already exist, check for specific error
    if (error.code === '42P07') {
      console.log("✅ Business logic tables already exist");
    } else {
      console.error("Error creating business logic tables:", error);
      throw error;
    }
  }
}
