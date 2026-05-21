import { db } from './db';
import { users, chats, companies, companyMemberships, userSettings, boardTemplates, domains, domainUsers, cubes, cubeBusinessTerms, cubeCalculationRules, cubeFilterRules, cubeQueryPatterns, cubeColumnValues } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { fixCompanyMemberships } from './migrations/fix-company-memberships';
import { 
  BOSCH_BUSINESS_TERMS, 
  BOSCH_CALCULATION_RULES, 
  BOSCH_FILTER_RULES, 
  BOSCH_QUERY_PATTERNS, 
  BOSCH_COLUMN_VALUES 
} from './seed/bosch-business-logic';

export async function seedDatabase() {
  const defaultUsername = "john.smith@example.com";
  
  // Check if companies already exist - if so, just run idempotent updates
  const existingCompanies = await db.select().from(companies).limit(1);
  if (existingCompanies.length > 0) {
    console.log('Companies already exist, skipping seed');
    await seedBoardTemplates();
    await seedDomainsIfNeeded(); // Seed domains for existing setup
    await seedBoschBusinessLogic(); // Auto-seed Bosch business logic for existing cubes
    await fixCompanyMemberships();
    return;
  }

  console.log('Seeding database with multi-tenant setup: companies, admins, and users...');

  const hashedPassword = await bcrypt.hash("password123", 10);

  // Create companies
  const [nemkoCompany] = await db.insert(companies).values({
    name: "Nemko",
    slug: "nemko",
    description: "Nemko Group AS - Testing, Inspection, and Certification",
  }).returning();

  const [ledgerlmCompany] = await db.insert(companies).values({
    name: "LedgerLM",
    slug: "ledgerlm",
    description: "LedgerLM Platform - AI-Powered Financial Analysis",
  }).returning();

  const [boschCompany] = await db.insert(companies).values({
    name: "in.bosch.com",
    slug: "in-bosch-com",
    description: "Bosch India - Engineering and Technology Company",
  }).returning();

  // Create users
  const [nemkoAdmin] = await db.insert(users).values({
    username: "nemkomatasma@nemko.com",
    password: hashedPassword,
    displayName: "Nemko Admin",
    role: "admin",
  }).returning();

  const [ledgerlmAdmin] = await db.insert(users).values({
    username: "customer@ledgerlm.ai",
    password: hashedPassword,
    displayName: "LedgerLM Customer",
    role: "admin",
  }).returning();

  const [boschAdmin] = await db.insert(users).values({
    username: "boschmatasma@in.bosch.com",
    password: hashedPassword,
    displayName: "Bosch India Admin",
    role: "admin",
  }).returning();

  const [nemkoUser] = await db.insert(users).values({
    username: defaultUsername,
    password: hashedPassword,
    displayName: "John Smith",
    role: "standard",
  }).returning();

  // Create company memberships
  await db.insert(companyMemberships).values([
    {
      userId: nemkoAdmin.id,
      companyId: nemkoCompany.id,
      role: "admin",
    },
    {
      userId: nemkoUser.id,
      companyId: nemkoCompany.id,
      role: "member",
    },
    {
      userId: ledgerlmAdmin.id,
      companyId: ledgerlmCompany.id,
      role: "admin",
    },
    {
      userId: boschAdmin.id,
      companyId: boschCompany.id,
      role: "admin",
    },
  ]);

  // Create user settings
  await db.insert(userSettings).values([
    {
      userId: nemkoAdmin.id,
      enterpriseEnabled: 1,
      activeCompanyId: nemkoCompany.id,
    },
    {
      userId: nemkoUser.id,
      enterpriseEnabled: 0,
      activeCompanyId: nemkoCompany.id,
    },
    {
      userId: ledgerlmAdmin.id,
      enterpriseEnabled: 1,
      activeCompanyId: ledgerlmCompany.id,
    },
    {
      userId: boschAdmin.id,
      enterpriseEnabled: 1,
      activeCompanyId: boschCompany.id,
    },
  ]);

  const sampleChats = [
    { title: 'Q2 Profit & Loss Summary', preview: 'Analysis of Q2 financial performance' },
    { title: 'Balance Sheet Breakdown', preview: 'Detailed breakdown of assets and liabilities' },
    { title: 'Quarterly Financial Analysis', preview: 'Comprehensive quarterly review' },
    { title: 'Year-End Financial Overview', preview: 'Annual financial summary and insights' },
    { title: 'Expense Trend Analysis', preview: 'Monthly expense tracking and trends' },
  ];

  for (const chat of sampleChats) {
    await db.insert(chats).values({
      userId: nemkoUser.id,
      title: chat.title,
      preview: chat.preview,
    });
  }

  console.log('✅ Multi-tenant database seeded successfully!');
  console.log('   🏢 Companies: Nemko, LedgerLM, in.bosch.com');
  console.log('   👤 Admins: nemkomatasma@nemko.com, customer@ledgerlm.ai (Super Admin), boschmatasma@in.bosch.com');
  console.log('   👥 Users: john.smith@example.com (Nemko member)');

  // Seed board templates
  await seedBoardTemplates();
  
  // Seed domains (Nemko, LedgerLM, Bosch)
  await seedDomains(
    nemkoCompany.id, nemkoAdmin.id,
    boschCompany.id, boschAdmin.id, 
    ledgerlmCompany.id, ledgerlmAdmin.id
  );
  
  // Auto-seed Bosch business logic (will run when cubes are created)
  await seedBoschBusinessLogic();
  
  // Fix company memberships for existing users
  await fixCompanyMemberships();
}

async function seedBoardTemplates() {
  const templates = [
    {
      slug: 'quarterly-pl-review',
      name: 'Quarterly P&L Review',
      description: 'Track revenue, expenses, and profit trends for each quarter with clear visual insights.',
      defaultConfig: {
        analysisPrompts: `I'll help you analyze your quarterly Profit & Loss statement. I'm configured to:
- Compare revenue vs previous quarters and identify growth trends
- Break down expense categories and flag unusual increases
- Calculate profit margins and key profitability metrics
- Highlight areas for cost optimization

Please upload your P&L statement or I can analyze your enterprise data if available.`,
        dataSources: {
          enterprise: true,
          vault: true,
          webApis: false,
          financialApis: true
        },
        settings: {
          resultLimit: 10,
          timeout: 30
        }
      }
    },
    {
      slug: 'balance-sheet-tracker',
      name: 'Balance Sheet Tracker',
      description: 'Monitor assets, liabilities, and equity breakdowns in a structured format.',
      defaultConfig: {
        analysisPrompts: `I'll help you analyze your Balance Sheet. I'm configured to:
- Analyze asset composition and liquidity ratios
- Review liability structures and debt levels
- Calculate equity changes and return metrics
- Identify balance sheet strengths and risks

Please upload your balance sheet or I can analyze your enterprise financial data.`,
        dataSources: {
          enterprise: true,
          vault: true,
          webApis: false,
          financialApis: true
        },
        settings: {
          resultLimit: 10,
          timeout: 30
        }
      }
    },
    {
      slug: 'cashflow-monitoring',
      name: 'Cashflow Monitoring',
      description: 'Stay on top of inflows and outflows, forecast liquidity, and highlight red flags.',
      defaultConfig: {
        analysisPrompts: `I'll help you monitor your cash flow. I'm configured to:
- Track operating, investing, and financing cash flows
- Forecast future liquidity based on current trends
- Identify cash flow bottlenecks and risks
- Suggest working capital improvements

Please share your cash flow statements or operational data.`,
        dataSources: {
          enterprise: true,
          vault: true,
          webApis: false,
          financialApis: true
        },
        settings: {
          resultLimit: 10,
          timeout: 30
        }
      }
    },
    {
      slug: 'financial-ratios-dashboard',
      name: 'Financial Ratios Dashboard',
      description: 'Auto-calculate solvency, liquidity, and profitability ratios with benchmarks.',
      defaultConfig: {
        analysisPrompts: `I'll calculate and analyze your key financial ratios. I'm configured to:
- Calculate liquidity ratios (current ratio, quick ratio)
- Compute solvency ratios (debt-to-equity, interest coverage)
- Analyze profitability ratios (ROE, ROA, profit margins)
- Compare against industry benchmarks

Upload your financial statements for comprehensive ratio analysis.`,
        dataSources: {
          enterprise: true,
          vault: true,
          webApis: true,
          financialApis: true
        },
        settings: {
          resultLimit: 15,
          timeout: 45
        }
      }
    },
    {
      slug: 'audit-preparation',
      name: 'Audit Preparation',
      description: 'Centralize compliance reports, audit checklists, and flagged risk items in one board.',
      defaultConfig: {
        analysisPrompts: `I'll help you prepare for your audit. I'm configured to:
- Review compliance with accounting standards
- Identify potential audit risks and red flags
- Verify documentation completeness
- Suggest corrective actions for findings

Share your financial records and I'll help ensure audit readiness.`,
        dataSources: {
          enterprise: true,
          vault: true,
          webApis: false,
          financialApis: false
        },
        settings: {
          resultLimit: 20,
          timeout: 60
        }
      }
    },
    {
      slug: 'company-research',
      name: 'Company Research',
      description: 'Collect ROC/MCA filings, competitor financials, and external data sources.',
      defaultConfig: {
        analysisPrompts: `I'll help you research company financials. I'm configured to:
- Analyze regulatory filings (ROC, MCA, SEC)
- Compare against competitor financials
- Research market trends and industry benchmarks
- Identify business risks and opportunities

Provide company names or upload financial documents for analysis.`,
        dataSources: {
          enterprise: false,
          vault: true,
          webApis: true,
          financialApis: true
        },
        settings: {
          resultLimit: 15,
          timeout: 60
        }
      }
    },
    {
      slug: 'custom-kpi-board',
      name: 'Custom KPI Board',
      description: 'Create a tailored view with metrics like gross margin, YoY growth, and cost ratios.',
      defaultConfig: {
        analysisPrompts: `I'll analyze your custom KPIs. I'm configured to:
- Track your specific performance metrics
- Calculate YoY and MoM growth rates
- Monitor gross margin and cost ratios
- Provide trend analysis and forecasts

Tell me which KPIs you want to track and I'll analyze your data accordingly.`,
        dataSources: {
          enterprise: true,
          vault: true,
          webApis: true,
          financialApis: true
        },
        settings: {
          resultLimit: 10,
          timeout: 30
        }
      }
    },
    {
      slug: 'investor-updates',
      name: 'Investor Updates',
      description: 'Prepare comprehensive investor reports with key financial metrics and growth indicators.',
      defaultConfig: {
        analysisPrompts: `I'll help you create investor updates. I'm configured to:
- Summarize key financial performance metrics
- Highlight growth indicators and milestones
- Identify risks and mitigation strategies
- Create executive summaries for stakeholders

Share your financial data and I'll help prepare compelling investor materials.`,
        dataSources: {
          enterprise: true,
          vault: true,
          webApis: true,
          financialApis: true
        },
        settings: {
          resultLimit: 10,
          timeout: 30
        }
      }
    }
  ];

  console.log('🌱 Seeding board templates...');
  
  for (const template of templates) {
    try {
      const existing = await db.query.boardTemplates.findFirst({
        where: (templates, { eq }) => eq(templates.slug, template.slug)
      });

      if (!existing) {
        await db.insert(boardTemplates).values(template);
        console.log(`✅ Created template: ${template.name}`);
      }
    } catch (error) {
      console.error(`❌ Error seeding template ${template.name}:`, error);
    }
  }
  
  console.log('✨ Board templates seeded');
}

// Called when seeding fresh database with known IDs
async function seedDomains(
  nemkoCompanyId: string, nemkoAdminId: string,
  boschCompanyId: string, boschAdminId: string, 
  ledgerlmCompanyId?: string, ledgerlmAdminId?: string
) {
  console.log('🌱 Seeding domains...');
  
  // Seed ledgerlm.ai domain for super admin
  const existingLedgerlmDomain = await db.query.domains.findFirst({
    where: (d, { eq }) => eq(d.name, 'ledgerlm.ai')
  });
  
  if (existingLedgerlmDomain) {
    console.log('✅ ledgerlm.ai domain already exists');
  } else if (ledgerlmCompanyId && ledgerlmAdminId) {
    const [ledgerlmDomain] = await db.insert(domains).values({
      name: 'ledgerlm.ai',
      adminEmail: 'customer@ledgerlm.ai',
      companyId: ledgerlmCompanyId,
      userQuota: 1000,
      createdBy: ledgerlmAdminId,
    }).returning();
    
    console.log('✅ Created domain: ledgerlm.ai');
    
    await db.insert(domainUsers).values({
      domainId: ledgerlmDomain.id,
      email: 'customer@ledgerlm.ai',
      role: 'admin',
      invitedBy: ledgerlmAdminId,
    });
    
    console.log('✅ Created domain admin: customer@ledgerlm.ai (Super Admin - uses email OTP)');
  }
  
  // Seed nemko.com domain
  const existingNemkoDomain = await db.query.domains.findFirst({
    where: (d, { eq }) => eq(d.name, 'nemko.com')
  });
  
  if (existingNemkoDomain) {
    console.log('✅ nemko.com domain already exists');
  } else {
    const [nemkoDomain] = await db.insert(domains).values({
      name: 'nemko.com',
      adminEmail: 'nemkomatasma@nemko.com',
      companyId: nemkoCompanyId,
      userQuota: 100,
      createdBy: nemkoAdminId,
    }).returning();
    
    console.log('✅ Created domain: nemko.com');
    
    await db.insert(domainUsers).values({
      domainId: nemkoDomain.id,
      email: 'nemkomatasma@nemko.com',
      role: 'admin',
      hardcodedOtp: '123456', // Default OTP for testing
      invitedBy: nemkoAdminId,
    });
    
    console.log('✅ Created domain admin: nemkomatasma@nemko.com (OTP: 123456)');
  }
  
  // Seed in.bosch.com domain
  const existingBoschDomain = await db.query.domains.findFirst({
    where: (d, { eq }) => eq(d.name, 'in.bosch.com')
  });
  
  if (existingBoschDomain) {
    console.log('✅ in.bosch.com domain already exists');
  } else {
    const [boschDomain] = await db.insert(domains).values({
      name: 'in.bosch.com',
      adminEmail: 'boschmatasma@in.bosch.com',
      companyId: boschCompanyId,
      userQuota: 100,
      createdBy: boschAdminId,
    }).returning();
    
    console.log('✅ Created domain: in.bosch.com');
    
    await db.insert(domainUsers).values({
      domainId: boschDomain.id,
      email: 'boschmatasma@in.bosch.com',
      role: 'admin',
      hardcodedOtp: '123456', // Default OTP for testing
      invitedBy: boschAdminId,
    });
    
    console.log('✅ Created domain admin: boschmatasma@in.bosch.com (OTP: 123456)');
  }
  
  console.log('✨ Domains seeded');
}

// Called when companies already exist - looks up IDs dynamically
async function seedDomainsIfNeeded() {
  // Look up Nemko company
  const nemkoCompany = await db.query.companies.findFirst({
    where: (c, { eq }) => eq(c.slug, 'nemko')
  });
  
  // Look up in.bosch.com company
  const boschCompany = await db.query.companies.findFirst({
    where: (c, { eq }) => eq(c.slug, 'in-bosch-com')
  });
  
  // Look up LedgerLM company
  const ledgerlmCompany = await db.query.companies.findFirst({
    where: (c, { eq }) => eq(c.slug, 'ledgerlm')
  });
  
  // Look up Nemko admin
  const nemkoAdmin = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.username, 'nemkomatasma@nemko.com')
  });
  
  // Look up Bosch admin
  const boschAdmin = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.username, 'boschmatasma@in.bosch.com')
  });
  
  // Look up LedgerLM admin (super admin)
  const ledgerlmAdmin = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.username, 'customer@ledgerlm.ai')
  });
  
  if (!nemkoCompany || !nemkoAdmin) {
    console.log('⚠️ Nemko company or admin not found, skipping Nemko domain seed');
  }
  
  if (!boschCompany || !boschAdmin) {
    console.log('⚠️ Bosch company or admin not found, skipping Bosch domain seed');
  }
  
  if (!ledgerlmCompany || !ledgerlmAdmin) {
    console.log('⚠️ LedgerLM company or admin not found, skipping LedgerLM domain seed');
  }
  
  // Seed domains with available data
  if (nemkoCompany && nemkoAdmin && boschCompany && boschAdmin) {
    await seedDomains(
      nemkoCompany.id, 
      nemkoAdmin.id,
      boschCompany.id, 
      boschAdmin.id, 
      ledgerlmCompany?.id, 
      ledgerlmAdmin?.id
    );
  } else if (ledgerlmCompany && ledgerlmAdmin) {
    // Fallback: at least seed ledgerlm.ai domain
    const existingLedgerlmDomain = await db.query.domains.findFirst({
      where: (d, { eq }) => eq(d.name, 'ledgerlm.ai')
    });
    
    if (!existingLedgerlmDomain) {
      const [ledgerlmDomain] = await db.insert(domains).values({
        name: 'ledgerlm.ai',
        adminEmail: 'customer@ledgerlm.ai',
        companyId: ledgerlmCompany.id,
        userQuota: 1000,
        createdBy: ledgerlmAdmin.id,
      }).returning();
      
      await db.insert(domainUsers).values({
        domainId: ledgerlmDomain.id,
        email: 'customer@ledgerlm.ai',
        role: 'admin',
        invitedBy: ledgerlmAdmin.id,
      });
      
      console.log('✅ Created domain: ledgerlm.ai (Super Admin)');
    }
  }
}

// Automatically seed Bosch business logic for all Bosch domain cubes
export async function seedBoschBusinessLogic() {
  console.log('🌱 Checking Bosch business logic seeding...');
  
  // Find Bosch domain
  const boschDomain = await db.query.domains.findFirst({
    where: (d, { eq }) => eq(d.name, 'in.bosch.com')
  });
  
  if (!boschDomain) {
    console.log('⚠️ Bosch domain not found, skipping business logic seed');
    return;
  }
  
  // Find all cubes for Bosch domain
  const boschCubes = await db.select().from(cubes).where(eq(cubes.domainId, boschDomain.id));
  
  if (boschCubes.length === 0) {
    console.log('⚠️ No Bosch cubes found, business logic will be seeded when cubes are created');
    return;
  }
  
  for (const cube of boschCubes) {
    console.log(`🔧 Seeding business logic for cube: ${cube.name}`);

    // Batch insert terms — single roundtrip, skip duplicates
    const termRows = BOSCH_BUSINESS_TERMS.map(term => ({
      cubeId: cube.id,
      termName: term.termName,
      termAliases: term.termAliases,
      definition: term.definition,
      sqlFilter: term.sqlFilter,
      requiredColumns: term.requiredColumns,
      category: term.category,
      priority: term.priority,
    }));
    let termsCreated = 0;
    if (termRows.length > 0) {
      const res = await db.insert(cubeBusinessTerms).values(termRows).onConflictDoNothing().returning({ id: cubeBusinessTerms.id });
      termsCreated = res.length;
    }

    // Batch insert calculations
    const calcRows = BOSCH_CALCULATION_RULES.map(calc => ({
      cubeId: cube.id,
      calculationName: calc.calculationName,
      calculationAliases: calc.calculationAliases,
      description: calc.description,
      formula: calc.formula,
      formulaType: calc.formulaType,
      resultType: calc.resultType,
      requiredColumns: calc.requiredColumns,
      defaultFilters: calc.defaultFilters,
      roundingPrecision: calc.roundingPrecision,
    }));
    let calculationsCreated = 0;
    if (calcRows.length > 0) {
      const res = await db.insert(cubeCalculationRules).values(calcRows).onConflictDoNothing().returning({ id: cubeCalculationRules.id });
      calculationsCreated = res.length;
    }

    // Batch insert filter rules
    const filterRows = BOSCH_FILTER_RULES.map(filter => ({
      cubeId: cube.id,
      filterName: filter.filterName,
      filterAliases: filter.filterAliases,
      description: filter.description,
      sqlPredicate: filter.sqlPredicate,
      targetColumn: filter.targetColumn,
      isDefault: filter.isDefault ? 1 : 0,
    }));
    let filtersCreated = 0;
    if (filterRows.length > 0) {
      const res = await db.insert(cubeFilterRules).values(filterRows).onConflictDoNothing().returning({ id: cubeFilterRules.id });
      filtersCreated = res.length;
    }

    // Batch insert query patterns
    const patternRows = BOSCH_QUERY_PATTERNS.map(pattern => ({
      cubeId: cube.id,
      patternName: pattern.patternName,
      patternDescription: pattern.patternDescription,
      triggerPhrases: pattern.triggerPhrases,
      sqlTemplate: pattern.sqlTemplate,
      templateVariables: pattern.templateVariables,
      exampleQuestion: pattern.exampleQuestion,
      exampleSql: pattern.exampleSql,
      category: pattern.category,
    }));
    let patternsCreated = 0;
    if (patternRows.length > 0) {
      const res = await db.insert(cubeQueryPatterns).values(patternRows).onConflictDoNothing().returning({ id: cubeQueryPatterns.id });
      patternsCreated = res.length;
    }

    // Batch insert column values
    const colValRows = BOSCH_COLUMN_VALUES.map(colVal => ({
      cubeId: cube.id,
      columnName: colVal.columnName,
      valueName: colVal.valueName,
      valueDescription: colVal.valueDescription,
      valueAliases: colVal.valueAliases,
      usageContext: colVal.usageContext,
      relatedValues: colVal.relatedValues,
    }));
    let columnValuesCreated = 0;
    if (colValRows.length > 0) {
      const res = await db.insert(cubeColumnValues).values(colValRows).onConflictDoNothing().returning({ id: cubeColumnValues.id });
      columnValuesCreated = res.length;
    }

    console.log(`✅ Cube ${cube.name}: ${termsCreated} terms, ${calculationsCreated} calculations, ${filtersCreated} filters, ${patternsCreated} patterns, ${columnValuesCreated} column values`);
  }

  console.log('✨ Bosch business logic seeding complete');
}
