/**
 * Nemko Domain Seed Script
 * 
 * This script seeds the Nemko domain, cubes, and business logic into the database.
 * Run this once to set up Nemko as a new tenant.
 * 
 * Usage: npx tsx server/seed/seed-nemko.ts
 */

import { db } from "../db";
import { 
  domains, 
  cubes, 
  cubeBusinessTerms, 
  cubeCalculationRules, 
  cubeFilterRules, 
  cubeQueryPatterns,
  cubeColumnConfig,
  domainHierarchyConfig,
  users
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { 
  NEMKO_BUSINESS_TERMS, 
  NEMKO_CALCULATION_RULES, 
  NEMKO_FILTER_RULES,
  NEMKO_QUERY_PATTERNS,
  NEMKO_HIERARCHIES,
  NEMKO_CUBE_COLUMNS,
  NEMKO_DOMAIN_CONFIG
} from "./nemko-business-logic";

async function seedNemko() {
  console.log("🚀 Starting Nemko domain seed...\n");

  try {
    // Step 1: Get or create a system user for seeding
    let systemUser = await db.select().from(users).limit(1);
    if (systemUser.length === 0) {
      console.log("❌ No users found. Please create at least one user first.");
      return;
    }
    const createdById = systemUser[0].id;
    console.log(`✅ Using system user: ${systemUser[0].username}`);

    // Step 2: Check if Nemko domain already exists
    const existingDomain = await db.select().from(domains).where(eq(domains.name, NEMKO_DOMAIN_CONFIG.domainName));
    
    let domainId: string;
    
    if (existingDomain.length > 0) {
      domainId = existingDomain[0].id;
      console.log(`✅ Nemko domain already exists (ID: ${domainId})`);
    } else {
      // Create Nemko domain
      const [newDomain] = await db.insert(domains).values({
        name: NEMKO_DOMAIN_CONFIG.domainName,
        adminEmail: NEMKO_DOMAIN_CONFIG.adminEmail,
        userQuota: NEMKO_DOMAIN_CONFIG.userQuota,
        createdBy: createdById
      }).returning();
      
      domainId = newDomain.id;
      console.log(`✅ Created Nemko domain (ID: ${domainId})`);
    }

    // Step 3: Create or get cubes
    const cubeIds: Record<string, string> = {};
    
    for (const cubeConfig of NEMKO_DOMAIN_CONFIG.cubes) {
      const existingCube = await db.select().from(cubes).where(
        and(
          eq(cubes.domainId, domainId),
          eq(cubes.name, cubeConfig.name)
        )
      );
      
      if (existingCube.length > 0) {
        cubeIds[cubeConfig.name] = existingCube[0].id;
        console.log(`✅ Cube "${cubeConfig.name}" already exists (ID: ${existingCube[0].id})`);
      } else {
        const [newCube] = await db.insert(cubes).values({
          domainId,
          name: cubeConfig.name,
          description: cubeConfig.description,
          sourceType: cubeConfig.sourceType,
          createdBy: createdById
        }).returning();
        
        cubeIds[cubeConfig.name] = newCube.id;
        console.log(`✅ Created cube "${cubeConfig.name}" (ID: ${newCube.id})`);
      }
    }

    // Step 4: Seed business terms for each cube
    console.log("\n📝 Seeding business terms...");
    
    for (const [cubeName, cubeId] of Object.entries(cubeIds)) {
      // Delete existing terms for this cube to avoid duplicates
      await db.delete(cubeBusinessTerms).where(eq(cubeBusinessTerms.cubeId, cubeId));
      
      // Filter terms based on cube type
      const relevantTerms = NEMKO_BUSINESS_TERMS.filter(term => {
        if (cubeName === "P&L") {
          return ["revenue", "cost", "profitability", "department"].includes(term.category);
        } else if (cubeName === "Balance Sheet") {
          return term.category === "balance_sheet";
        } else if (cubeName === "Cash Flow") {
          return term.category === "cash_flow" || term.termName === "Net Income";
        }
        return true;
      });
      
      for (const term of relevantTerms) {
        await db.insert(cubeBusinessTerms).values({
          cubeId,
          termName: term.termName,
          termAliases: term.termAliases,
          definition: term.definition,
          sqlFilter: term.sqlFilter,
          requiredColumns: term.requiredColumns,
          category: term.category,
          priority: term.priority,
          isActive: 1
        });
      }
      
      console.log(`  ✅ Seeded ${relevantTerms.length} terms for "${cubeName}"`);
    }

    // Step 5: Seed calculation rules
    console.log("\n📊 Seeding calculation rules...");
    
    for (const [cubeName, cubeId] of Object.entries(cubeIds)) {
      // Delete existing rules for this cube
      await db.delete(cubeCalculationRules).where(eq(cubeCalculationRules.cubeId, cubeId));
      
      // Only P&L cube gets calculation rules
      if (cubeName === "P&L") {
        for (const rule of NEMKO_CALCULATION_RULES) {
          await db.insert(cubeCalculationRules).values({
            cubeId,
            calculationName: rule.calculationName,
            calculationAliases: rule.calculationAliases,
            description: rule.description,
            formula: rule.formula,
            formulaType: rule.formulaType,
            resultType: rule.resultType,
            requiredColumns: rule.requiredColumns,
            defaultFilters: rule.defaultFilters,
            roundingPrecision: rule.roundingPrecision,
            isActive: 1
          });
        }
        console.log(`  ✅ Seeded ${NEMKO_CALCULATION_RULES.length} calculation rules for "${cubeName}"`);
      }
    }

    // Step 6: Seed filter rules
    console.log("\n🔍 Seeding filter rules...");
    
    for (const [cubeName, cubeId] of Object.entries(cubeIds)) {
      // Delete existing filters for this cube
      await db.delete(cubeFilterRules).where(eq(cubeFilterRules.cubeId, cubeId));
      
      for (const filter of NEMKO_FILTER_RULES) {
        await db.insert(cubeFilterRules).values({
          cubeId,
          filterName: filter.filterName,
          filterAliases: filter.filterAliases,
          description: filter.description,
          sqlPredicate: filter.sqlPredicate,
          targetColumn: filter.targetColumn,
          isDefault: filter.isDefault ? 1 : 0,
          isActive: 1
        });
      }
      
      console.log(`  ✅ Seeded ${NEMKO_FILTER_RULES.length} filter rules for "${cubeName}"`);
    }

    // Step 7: Seed query patterns
    console.log("\n📋 Seeding query patterns...");
    
    for (const [cubeName, cubeId] of Object.entries(cubeIds)) {
      // Delete existing patterns for this cube
      await db.delete(cubeQueryPatterns).where(eq(cubeQueryPatterns.cubeId, cubeId));
      
      for (const pattern of NEMKO_QUERY_PATTERNS) {
        await db.insert(cubeQueryPatterns).values({
          cubeId,
          patternName: pattern.patternName,
          patternDescription: pattern.patternDescription,
          triggerPhrases: pattern.triggerPhrases,
          sqlTemplate: pattern.sqlTemplate,
          templateVariables: pattern.templateVariables,
          exampleQuestion: pattern.exampleQuestion,
          exampleSql: pattern.exampleSql,
          category: pattern.category,
          isActive: 1
        });
      }
      
      console.log(`  ✅ Seeded ${NEMKO_QUERY_PATTERNS.length} query patterns for "${cubeName}"`);
    }

    // Step 8: Seed column configurations
    console.log("\n📐 Seeding column configurations...");
    
    const columnMappings = {
      "P&L": NEMKO_CUBE_COLUMNS.pl,
      "Balance Sheet": NEMKO_CUBE_COLUMNS.bs,
      "Cash Flow": NEMKO_CUBE_COLUMNS.cf
    };
    
    for (const [cubeName, cubeId] of Object.entries(cubeIds)) {
      // Delete existing column configs for this cube
      await db.delete(cubeColumnConfig).where(eq(cubeColumnConfig.cubeId, cubeId));
      
      const columns = columnMappings[cubeName as keyof typeof columnMappings];
      if (columns) {
        for (const col of columns) {
          await db.insert(cubeColumnConfig).values({
            cubeId,
            columnIndex: col.columnIndex,
            jsonKey: (col as any).jsonKey || col.originalName,  // Use jsonKey if defined, else originalName
            originalName: col.originalName,
            displayName: col.displayName,
            columnType: col.columnType,
            dataType: col.dataType,
            description: col.description,
            aliases: col.aliases || [],
            useForSql: 1,
            useForRag: 1
          });
        }
        console.log(`  ✅ Seeded ${columns.length} columns for "${cubeName}"`);
      }
    }

    // Step 9: Seed hierarchy configurations
    console.log("\n🏗️ Seeding hierarchy configurations...");
    
    // Delete existing hierarchies for this domain
    await db.delete(domainHierarchyConfig).where(eq(domainHierarchyConfig.domainId, domainId));
    
    for (const [key, hierarchy] of Object.entries(NEMKO_HIERARCHIES)) {
      await db.insert(domainHierarchyConfig).values({
        domainId,
        hierarchyName: hierarchy.name,
        description: hierarchy.description,
        levels: hierarchy.levels,
        columnMappings: hierarchy.mappings
      });
      console.log(`  ✅ Seeded "${hierarchy.name}" hierarchy`);
    }

    console.log("\n✨ Nemko domain seed completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   Domain: ${NEMKO_DOMAIN_CONFIG.domainName} (ID: ${domainId})`);
    console.log(`   Cubes: ${Object.keys(cubeIds).join(", ")}`);
    console.log(`   Business Terms: ${NEMKO_BUSINESS_TERMS.length}`);
    console.log(`   Calculation Rules: ${NEMKO_CALCULATION_RULES.length}`);
    console.log(`   Filter Rules: ${NEMKO_FILTER_RULES.length}`);
    console.log(`   Query Patterns: ${NEMKO_QUERY_PATTERNS.length}`);
    console.log(`   Hierarchies: ${Object.keys(NEMKO_HIERARCHIES).length}`);

  } catch (error) {
    console.error("❌ Error seeding Nemko domain:", error);
    throw error;
  }
}

// Run if executed directly
seedNemko()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
