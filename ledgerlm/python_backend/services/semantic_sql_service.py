"""
Semantic SQL Service for Bosch Finance Data

This service enables natural language queries on large financial Excel files
by parsing user intent, generating SQL, and executing against fact tables.
"""
import os
import re
import json
import logging
import pandas as pd
from typing import Dict, List, Optional, Any
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values
import requests
from config import settings

def get_llm_response(prompt: str, ai_config: dict = None):
    """
    Call the LLM for intent parsing.
    If ai_config contains Azure OpenAI credentials, uses Azure.
    Otherwise falls back to the Ollama proxy.
    """
    use_azure = (
        ai_config is not None
        and ai_config.get("provider") == "azure_openai"
        and ai_config.get("endpoint")
        and ai_config.get("api_key")
        and ai_config.get("chat_model")
    )

    if use_azure:
        try:
            from services.rag_engine import get_ai_completion
            return get_ai_completion(prompt, ai_config=ai_config)
        except Exception as e:
            logger.warning(f"Azure OpenAI intent call failed, falling back to Ollama: {e}")
            # Fall through to Ollama below

    base_url = settings.OLLAMA_BASE_URL.replace("/v1", "").rstrip("/")
    response = requests.post(
        f"{base_url}/generate",
        json={
            "model": settings.OLLAMA_CHAT_MODEL,
            "prompt": prompt,
            "stream": False
        },
        headers={
            "x-api-key": settings.OLLAMA_API_KEY
        },
        verify=False
    )
    response.raise_for_status()
    return response.json().get("response", "")

# Import schema context builder for dynamic column configurations
try:
    from services.schema_context_builder import schema_context_builder
    SCHEMA_CONTEXT_AVAILABLE = True
except ImportError:
    SCHEMA_CONTEXT_AVAILABLE = False

logger = logging.getLogger(__name__)

# ============================================================================
# PLAN DATA METADATA REGISTRY
# Complete column mappings for cube_plan_data queries
# Based on Manual_inputs_MBR_master Excel structure
# ============================================================================

PLAN_TYPE_MAPPING = {
    # Actuals
    'actual': 'Actual',
    'actuals': 'Actual',
    # YTD Forecast
    'forecast': 'YTD Forecast',
    'ytd forecast': 'YTD Forecast',
    # TBP (Budget)
    'budget 2024': 'TBP 2024',
    'tbp 2024': 'TBP 2024',
    'budget 2025': 'TBP 2025',
    'tbp 2025': 'TBP 2025',
    'budget': 'TBP 2025',  # Default to 2025
    'tbp': 'TBP 2025',
    # CF02
    'cf02 2024': 'CF02 2024',
    'cf02': 'CF02 2024',
    'cf02 2025': 'CF02 2025',
    # CF05
    'cf05 2024': 'CF05 2024',
    'cf05': 'CF05 2024',
    'cf05 2025': 'CF05 2025',
    # CF09
    'cf09 2024': 'CF09 2024',
    'cf09': 'CF09 2024',
    'cf09 2025': 'CF09 2025',
    # CF11
    'cf11 2024': 'CF11 2024',
    'cf11': 'CF11 2024',
    'cf11 2025': 'CF11 2025',
}

PAGE_VIEW_MAPPING = {
    # World Wide
    'world wide': 'World Wide',
    'worldwide': 'World Wide',
    'ww': 'World Wide',
    # Entity View
    'entity': 'Entity',
    'entity view': 'Entity',
    # MS View
    'ms view': 'MS  View',
    'ms': 'MS  View',
    # MS GB
    'ms gb': 'MS GB',
    'mb view': 'MS GB',
    # SX View
    'sx view': 'SX  View',
    'sx': 'SX  View',
    # NE-MM
    'ne-mm': 'NE-MM',
}

ENTITY_MAPPING = {
    # World Wide variants
    'worldwide': 'Worlwide',
    'ww': 'Worlwide',
    'world wide': 'World Wide',
    # Specific entity codes
    'bgsw': 'BGSW',
    'bgsv': 'BGSV',
    'bgsj': 'BGSJ',
    'bgsg': 'BGSG',
    'ne-mx': 'BGSW/NE-MX',
    'ebs-pl': 'BGSW/EBS-PL',
    # Country name aliases
    'india': 'BGSW',
    'vietnam': 'BGSV',
    'japan': 'BGSJ',
    'germany': 'BGSG',
    'mexico': 'BGSW/NE-MX',
    'ebs': 'BGSW/EBS-PL',
    'poland': 'BGSW/EBS-PL',
}

GB_MAPPING = {
    # GB filters for MS GB views
    'vm': 'VM',
    'vm view': 'VM',
    'ps': 'PS',
    'ps view': 'PS',
    'xc': 'XC',
    'xc view': 'XC',
}

PARTICULARS_MAPPING = {
    # Capacity metrics
    'offshore capacity': 'Offshore Capacity',
    'outsourcing capacity': 'Outsourcing Capacity',
    'outsourcing': 'Outsourcing',
    'onsite capacity': 'Onsite Capacity',
    'capacity': 'Capacity',
    # Budget metrics
    'budget': 'Budget (mUSD)',
    'budget musd': 'Budget (mUSD)',
    'budget/avg capacity': 'Budget/Avg Capacity (USD)',
    'budget avg capacity': 'Budget/Avg Capacity (USD)',
    # Other metrics
    'attrition': 'Attrition',
    'price mix ratio': 'Price mix Ratio',
    'price mix': 'Price Mix Ratio',
    'pyramid mix': 'Pyramid Mix',
    'internal utilization': 'Internal Utilization (%)',
    'outsourcing utilization': 'Outsourcing Utilization (%)',
}

SUB_CATEGORY_MAPPING = {
    # Main sub-categories
    'average': 'Average',
    'avg': 'Average',
    'end': 'End',
    # Location-based
    'offshore': 'Offshore',
    'outsourcing': 'Outsourcing',
    'onsite': 'Onsite',
    # Billing status
    'billed': 'Billed',
    'allocated not billed': 'Allocated but not billed',
    'not allocated': 'Not allocated',
    # Pyramid levels
    '48-51': '48-51',
    '52-53': '52-53',
    '54-55': '54-55',
    '56-above': '56-Above',
    'e2': 'E2',
    'e3': 'E3',
    'e4': 'E4',
    'slx': 'SLX',
}

# Keywords that indicate a plan query (vs actuals query)
PLAN_KEYWORDS = [
    'forecast',
    'ytd forecast',
    'budget',
    'tbp',
    'cf02',
    'cf05',
    'cf09',
    'cf11',
    'tbp 2024',
    'tbp 2025',
    'budget 2024',
    'budget 2025',
]

# ============================================================================
# CURRENCY DETECTION
# Detects whether user wants INR or USD from their query.
# Default is USD if no currency is mentioned.
# ============================================================================
INR_KEYWORDS = [
    'in inr', 'in rupees', 'in indian rupees', 'in rs',
    'amount in inr', 'amount inr', 'inr amount',
    'revenue inr', 'inr revenue', 'cost inr', 'inr cost',
    'budget inr', 'inr budget', 'ebit inr', 'inr ebit',
    'margin inr', 'inr margin',
    '(inr)', 'rupees', 'indian rupees',
    'minr', 'in minr', 'million inr', 'million rupees', 'mn inr', 'mn rupees',
]

def detect_currency(query: str) -> str:
    """Detect currency preference from user query. Returns 'inr' or 'usd'."""
    query_lower = query.lower().strip()
    for keyword in INR_KEYWORDS:
        if keyword in query_lower:
            return 'inr'
    if re.search(r'\binr\b', query_lower):
        return 'inr'
    return 'usd'

def get_amount_column(currency: str) -> str:
    """Get the database column name for the given currency."""
    return 'amount_inr' if currency == 'inr' else 'amount_usd'

def get_currency_label(currency: str) -> str:
    """Get the display label for the given currency."""
    return 'INR' if currency == 'inr' else 'USD'

# ============================================================================
# LLM-POWERED METRIC CATALOG
# Source of truth for all metrics - maps metric_id to builder function
# LLM will select from these exact metric_ids based on user query
# ============================================================================

METRIC_CATALOG = {
    # Pyramid Mix Metrics
    "pyramid_mix": {
        "builder":
        "_build_pyramid_mix_sql",
        "description":
        "Junior level (SL48-51) percentage of total offshore internal capacity",
        "examples": [
            "pyramid mix", "junior mix", "sl 48-51 percentage",
            "junior capacity ratio"
        ],
        "column_used":
        "capacity",
        "cost_category":
        "GB Wise END Capacity"
    },
    "pyramid_mix_individual_levels": {
        "builder":
        "_build_pyramid_mix_individual_levels_sql",
        "description":
        "Breakdown showing each salary level (48, 49, 50, 51) separately with their percentages",
        "examples": [
            "pyramid by salary level", "pyramid breakdown",
            "pyramid salarylevel", "individual sl", "pyramid per level"
        ],
        "column_used":
        "capacity",
        "cost_category":
        "GB Wise END Capacity"
    },
    "pyramid_mix_by_salary_level": {
        "builder": "_build_pyramid_mix_by_salary_level_sql",
        "description": "Pyramid mix grouped by salary level categories",
        "examples": ["pyramid grouped by sl", "pyramid mix by level"],
        "column_used": "capacity",
        "cost_category": "GB Wise END Capacity"
    },

    # Capacity Metrics
    "offshore_capacity_end": {
        "builder":
        "_build_offshore_capacity_end_sql",
        "description":
        "End of month offshore internal capacity headcount",
        "examples":
        ["offshore capacity", "offshore end capacity", "offshore headcount"],
        "column_used":
        "capacity",
        "cost_category":
        "GB Wise END Capacity"
    },
    "offshore_capacity_avg": {
        "builder":
        "_build_offshore_capacity_avg_sql",
        "description":
        "Average offshore internal capacity over the period",
        "examples":
        ["offshore average capacity", "offshore avg", "average offshore"],
        "column_used":
        "capacity",
        "cost_category":
        "GB Wise END Capacity"
    },
    "outsourcing_capacity_end": {
        "builder":
        "_build_outsourcing_capacity_end_sql",
        "description":
        "End of month outsourcing/external capacity headcount",
        "examples":
        ["outsourcing capacity", "external capacity", "outsourcing end"],
        "column_used":
        "capacity",
        "cost_category":
        "GB Wise END Capacity"
    },
    "outsourcing_capacity_avg": {
        "builder": "_build_outsourcing_capacity_avg_sql",
        "description": "Average outsourcing/external capacity over the period",
        "examples": ["outsourcing average", "external avg capacity"],
        "column_used": "capacity",
        "cost_category": "GB Wise END Capacity"
    },
    "total_capacity_end": {
        "builder": "_build_total_capacity_end_sql",
        "description": "Total end of month capacity (internal + external)",
        "examples": ["total capacity", "total headcount", "all capacity end"],
        "column_used": "capacity",
        "cost_category": "GB Wise END Capacity"
    },
    "total_capacity_avg": {
        "builder": "_build_total_capacity_avg_sql",
        "description": "Average total capacity over the period",
        "examples": ["average total capacity", "total avg capacity"],
        "column_used": "capacity",
        "cost_category": "GB Wise END Capacity"
    },
    "available_capacity": {
        "builder": "_build_available_capacity_sql",
        "description":
        "Available capacity = Allocated + Not Allocated + M/S + VKM - Non Linear",
        "examples":
        ["available capacity", "availability", "capacity available"],
        "column_used":
        "allocated_capacity, not_allocated_capacity, ms_capacity, vkm_capacity, non_linear_capacity",
        "cost_category": "Billing Utilization"
    },

    # Capacity Mix Metrics
    "internal_capacity_mix": {
        "builder":
        "_build_internal_capacity_mix_sql",
        "description":
        "Internal capacity as percentage of total capacity",
        "examples":
        ["internal mix", "internal capacity mix", "internal percentage"],
        "column_used":
        "capacity",
        "cost_category":
        "GB Wise END Capacity"
    },
    "external_capacity_mix": {
        "builder": "_build_external_capacity_mix_sql",
        "description":
        "External/outsourcing capacity as percentage of total capacity",
        "examples": ["external mix", "outsourcing mix", "external percentage"],
        "column_used": "capacity",
        "cost_category": "GB Wise END Capacity"
    },

    # Billing & Utilization Metrics
    "billing_utilization": {
        "builder":
        "_build_billing_utilization_sql",
        "description":
        "Billing utilization percentage = billed capacity / allocated capacity * 100",
        "examples": [
            "billing utilization", "utilization rate", "billing percentage",
            "utilization"
        ],
        "column_used":
        "billed_capacity, allocated_capacity",
        "cost_category":
        "Billing Utilization"
    },

    # Revenue Metrics
    "revenue": {
        "builder": "_build_revenue_sql",
        "description": "Revenue in USD for the period",
        "examples":
        ["revenue", "revenue mtd", "total revenue", "revenue in usd"],
        "column_used": "amount_usd",
        "cost_category": "Revenue"
    },

    # P&L Revenue Metrics (YTD, with order_reason + GL account exclusions)
    "gb_pl_revenue": {
        "builder": "_build_gb_pl_revenue_sql",
        "description":
        "GB P&L Revenue YTD — SUM(amount) WHERE cost_category='Revenue Summary' AND month<=N, excluding order reasons YEH/YEI/YEJ/YEK/YN2 and GL accounts starting with 139",
        "examples": [
            "gb p&l revenue", "gb pl revenue", "gb p&l revenue for bgsw",
            "gb wise p&l revenue"
        ],
        "column_used": "amount_usd",
        "cost_category": "Revenue Summary"
    },
    "entity_pl_revenue": {
        "builder": "_build_entity_pl_revenue_sql",
        "description":
        "Entity P&L Revenue YTD — SUM(amount) WHERE cost_category='Revenue Summary' AND month<=N, excluding order reasons YEH/YEI/YEJ/YEK/YN2 and GL accounts starting with 139",
        "examples": [
            "entity p&l revenue", "entity pl revenue",
            "entity p&l revenue for bgsw", "o&l revenue"
        ],
        "column_used": "amount_usd",
        "cost_category": "Revenue Summary"
    },

    # Budget Metrics
    "budget_per_capacity": {
        "builder": "_build_budget_per_capacity_sql",
        "description": "Budget divided by capacity",
        "examples": ["budget per capacity", "budget per head"],
        "column_used": "amount_usd, capacity",
        "cost_category": "Revenue, GB Wise END Capacity"
    },
    "budget_per_avg_capacity_entity": {
        "builder":
        "_build_budget_per_avg_capacity_entity_sql",
        "description":
        "Budget/revenue per average capacity broken down by entity",
        "examples": [
            "budget per avg capacity by entity", "revenue per capacity entity",
            "entity budget capacity"
        ],
        "column_used":
        "amount_usd, capacity",
        "cost_category":
        "Revenue, GB Wise END Capacity"
    },
    "budget_per_avg_capacity_ww": {
        "builder":
        "_build_budget_per_avg_capacity_ww_sql",
        "description":
        "Worldwide total budget/revenue per average capacity",
        "examples": [
            "budget per avg capacity worldwide", "ww budget capacity",
            "total budget per capacity"
        ],
        "column_used":
        "amount_usd, capacity",
        "cost_category":
        "Revenue, GB Wise END Capacity"
    },
    "budget_total_ww": {
        "builder":
        "_build_budget_total_ww_sql",
        "description":
        "Worldwide total WW budget KPI in millions USD/INR (Include filter, no Y36). Use ONLY for explicit worldwide/WW/global budget queries. Do NOT use for entity-level or plain revenue queries.",
        "examples": [
            "worldwide budget", "WW budget", "global budget", "total budget musd",
            "budget musd worldwide", "ww budget total"
        ],
        "column_used":
        "amount_usd",
        "cost_category":
        "Revenue Summary"
    },
    "budget_offshore": {
        "builder":
        "_build_budget_offshore_sql",
        "description":
        "Worldwide offshore budget in millions USD. Formula: (Non-External revenue - Non-Offshore revenue) / 1M",
        "examples": [
            "offshore budget", "budget offshore", "worldwide budget offshore",
            "WW budget offshore"
        ],
        "column_used":
        "amount_usd",
        "cost_category":
        "Revenue Summary"
    },
    "budget_outsourcing": {
        "builder":
        "_build_budget_outsourcing_sql",
        "description":
        "Worldwide outsourcing (external) budget in millions USD. Filters Resource Type = External.",
        "examples": [
            "outsourcing budget", "budget outsourcing", "external budget",
            "worldwide budget outsourcing", "WW budget outsourcing"
        ],
        "column_used":
        "amount_usd",
        "cost_category":
        "Revenue Summary"
    },

    # Other KPI Metrics
    "attrition_pct": {
        "builder":
        "_build_attrition_pct_sql",
        "description":
        "Annualized attrition rate percentage",
        "examples": [
            "attrition", "attrition rate", "attrition percentage",
            "turnover rate"
        ],
        "column_used":
        "capacity",
        "cost_category":
        "Attrition, GB Wise END Capacity"
    },
    "ebit": {
        "builder": "_build_ebit_sql",
        "description": "EBIT (Earnings Before Interest and Taxes)",
        "examples": ["ebit", "earnings", "profit"],
        "column_used": "amount_usd",
        "cost_category": "Revenue, Cost Summary"
    },
    "price_mix": {
        "builder": "_build_price_mix_sql",
        "description": "Price mix ratio across different pricing categories",
        "examples": ["price mix", "pricing ratio", "rate mix"],
        "column_used": "amount_usd",
        "cost_category": "Revenue"
    },
    "travel_cost": {
        "builder": "_build_travel_cost_sql",
        "description": "Travel cost breakdown by SubCostCategory",
        "examples": ["travel cost", "travel expense", "travel cost breakdown"],
        "column_used": "amount_usd",
        "cost_category": "Cost Summary"
    },
    "direct_cost": {
        "builder": "_build_direct_cost_sql",
        "description":
        "Total Direct Cost = Resource Cost + Travel Cost + Other Direct Cost",
        "examples": ["direct cost", "total direct cost", "direct expenses"],
        "column_used": "amount_usd",
        "cost_category": "Cost Summary"
    },
    "indirect_cost": {
        "builder": "_build_indirect_cost_sql",
        "description":
        "Indirect Cost = Corporate Cost from CostCategory_Class",
        "examples": ["indirect cost", "corporate cost", "indirect expenses"],
        "column_used": "amount_usd",
        "cost_category": "Cost Summary"
    },
    "gross_margin": {
        "builder": "_build_gross_margin_sql",
        "description":
        "Gross Margin = Revenue - (Total Direct Cost + Total Indirect Cost)",
        "examples": ["gross margin", "gross profit", "margin"],
        "column_used": "amount_usd",
        "cost_category": "Revenue Summary, Cost Summary"
    },
    "resource_cost": {
        "builder": "_build_resource_cost_sql",
        "description": "Resource Cost from CostCategory_Class",
        "examples": ["resource cost", "resource expense"],
        "column_used": "amount_usd",
        "cost_category": "Cost Summary"
    },
    "other_direct_cost": {
        "builder": "_build_other_direct_cost_sql",
        "description": "Other Direct Cost from CostCategory_Class",
        "examples": ["other direct cost", "other direct expense"],
        "column_used": "amount_usd",
        "cost_category": "Cost Summary"
    }
}

# List of all metric IDs for LLM prompt
METRIC_IDS = list(METRIC_CATALOG.keys())

# ============================================================================
# MULTI-TENANT CONFIGURATION
# Company/domain-specific cube and plan type mappings
# ============================================================================

# Fallback company configurations (used when database lookup fails)
COMPANY_CONFIG = {
    'bosch': {
        'company_id': '1a548be5-b6bf-45df-8a11-678c7ca1c311',
        'domains': ['in.bosch.com', 'bosch.com'],
        'cube_id': 'a979dfa9-16d9-418b-a4c3-db3f75831a00',
        'plan_data_table': 'cube_plan_data',
        'fact_data_table': 'cube_fact_data',
    },
    'nemko': {
        'company_id': None,  # Will be fetched from database
        'domains': ['nemko.com'],
        'cube_id': None,  # Will be fetched from database
        'plan_data_table': 'cube_plan_data',
        'fact_data_table':
        'cube_plan_data',  # Nemko uses plan_data for all data with scenario dimension
    }
}

# Cache for domain configurations fetched from database
_domain_config_cache: Dict[str, Dict[str, Any]] = {}


def get_domain_config_from_db(domain_name: str) -> Optional[Dict[str, Any]]:
    """
    Fetch domain and cube configuration from the database.
    Returns None if domain not found.
    """
    global _domain_config_cache

    # Check cache first
    cache_key = domain_name.lower()
    if cache_key in _domain_config_cache:
        return _domain_config_cache[cache_key]

    try:
        conn = psycopg2.connect(os.environ.get('DATABASE_URL'))
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Find domain by name
            cur.execute(
                """
                SELECT d.id as domain_id, d.name as domain_name, d.company_id
                FROM domains d
                WHERE LOWER(d.name) = LOWER(%s)
            """, (domain_name, ))

            domain_row = cur.fetchone()
            if not domain_row:
                conn.close()
                return None

            # Get cubes for this domain
            cur.execute(
                """
                SELECT c.id, c.name, c.description, c.source_type
                FROM cubes c
                WHERE c.domain_id = %s
                ORDER BY c.name
            """, (domain_row['domain_id'], ))

            cubes = cur.fetchall()
            conn.close()

            # Build cube map by name for easy lookup
            cube_map = {}
            default_cube_id = None
            for cube in cubes:
                cube_map[cube['name'].lower()] = {
                    'id': cube['id'],
                    'name': cube['name'],
                    'description': cube['description'],
                    'source_type': cube['source_type']
                }
                if default_cube_id is None:
                    default_cube_id = cube['id']

            config = {
                'domain_id': domain_row['domain_id'],
                'domain_name': domain_row['domain_name'],
                'company_id': domain_row['company_id'],
                'cube_id': default_cube_id,  # Default to first cube
                'cubes': cube_map,
                'plan_data_table': 'cube_plan_data',
                'fact_data_table': 'cube_fact_data',
            }

            # Cache the result
            _domain_config_cache[cache_key] = config
            return config

    except Exception as e:
        logger.warning(f"Could not fetch domain config from database: {e}")
        return None


def get_cube_for_statement_type(domain_config: Dict[str, Any],
                                statement_type: str) -> Optional[str]:
    """
    Get the appropriate cube ID for a given statement type.
    Maps statement types (P&L, Balance Sheet, Cash Flow) to cube IDs.
    """
    if not domain_config or 'cubes' not in domain_config:
        return domain_config.get('cube_id') if domain_config else None

    cubes = domain_config.get('cubes', {})
    statement_lower = statement_type.lower() if statement_type else ''

    # Map statement types to cube names
    statement_cube_mapping = {
        'p&l': ['p&l', 'profit and loss', 'income statement'],
        'bs': ['balance sheet', 'bs'],
        'cash': ['cash flow', 'cf', 'cash'],
    }

    for cube_key, cube_info in cubes.items():
        for stmt_type, keywords in statement_cube_mapping.items():
            if any(kw in cube_key for kw in keywords):
                if any(kw in statement_lower for kw in keywords):
                    return cube_info['id']

    # Fallback to default cube
    return domain_config.get('cube_id')


# Nemko-specific plan type mappings
NEMKO_PLAN_TYPE_MAPPING = {
    # Actuals
    'actual fy22': 'Actual FY22',
    'actual fy23': 'Actual FY23',
    'actual fy24': 'Actual FY24',
    'actual fy25': 'Actual FY25',
    'actuals fy22': 'Actual FY22',
    'actuals fy23': 'Actual FY23',
    'actuals fy24': 'Actual FY24',
    'actuals fy25': 'Actual FY25',
    'actual 2022': 'Actual FY22',
    'actual 2023': 'Actual FY23',
    'actual 2024': 'Actual FY24',
    'actual 2025': 'Actual FY25',
    # Budget
    'budget fy24': 'Budget FY24',
    'budget fy25': 'Budget FY25',
    'budget 2024': 'Budget FY24',
    'budget 2025': 'Budget FY25',
    'fy24 budget': 'Budget FY24',
    'fy25 budget': 'Budget FY25',
    # Forecast
    'forecast fy24': 'Forecast FY24',
    'forecast fy25': 'Forecast FY25',
    'forecast 2024': 'Forecast FY24',
    'forecast 2025': 'Forecast FY25',
    'fy24 forecast': 'Forecast FY24',
    'fy25 forecast': 'Forecast FY25',
}

# Nemko statement type detection keywords
NEMKO_STATEMENT_KEYWORDS = {
    'P&L': [
        'p&l', 'profit and loss', 'profit & loss', 'income statement',
        'revenue', 'expense', 'sales'
    ],
    'BS': ['balance sheet', 'bs ', 'assets', 'liabilities', 'equity'],
    'Cash': ['cash flow', 'cash ', 'operating cash', 'financing'],
}

# Nemko subsidiary mappings
NEMKO_SUBSIDIARY_MAPPING = {
    'nemko foundation': 'E1 Nemko Foundation',
    'e1': 'E1 Nemko Foundation',
    'nemko group': 'E7 Nemko Group AS',
    'e7': 'E7 Nemko Group AS',
    'group elimination': 'E8 Nemko Group AS Elimination',
    'e8': 'E8 Nemko Group AS Elimination',
    'group total': 'E0 Group Total',
    'e0': 'E0 Group Total',
}


def get_company_by_domain(domain: str) -> dict:
    """
    Get company configuration by domain name.
    First tries database lookup for dynamic domain configuration,
    then falls back to hardcoded COMPANY_CONFIG.
    """
    if not domain:
        return COMPANY_CONFIG.get('bosch')  # Default to Bosch

    domain_lower = domain.lower()

    # Try database lookup first for dynamic configuration
    db_config = get_domain_config_from_db(domain_lower)
    if db_config:
        logger.debug(
            f"Using database configuration for domain: {domain_lower}")
        return db_config

    # Fallback to hardcoded config
    for company_key, config in COMPANY_CONFIG.items():
        if any(d in domain_lower for d in config['domains']):
            return config

    return COMPANY_CONFIG.get('bosch')  # Default to Bosch


def is_nemko_domain(domain: str) -> bool:
    """Check if domain is a Nemko domain."""
    if not domain:
        return False
    domain_lower = domain.lower()

    # Check database config first
    db_config = get_domain_config_from_db(domain_lower)
    if db_config:
        return 'nemko' in db_config.get('domain_name', '').lower()

    # Fallback to hardcoded check
    nemko_config = COMPANY_CONFIG.get('nemko', {})
    return any(d in domain_lower for d in nemko_config.get('domains', []))


def detect_nemko_plan_type(query: str) -> str:
    """Detect Nemko-specific plan type from query."""
    query_lower = ' ' + query.lower() + ' '

    # Check Nemko-specific mappings first
    for pattern, plan_type in NEMKO_PLAN_TYPE_MAPPING.items():
        if pattern in query_lower:
            return plan_type

    # Fallback to general keywords with default year (FY25)
    if 'budget' in query_lower:
        return 'Budget FY25'
    if 'forecast' in query_lower:
        return 'Forecast FY25'
    if 'actual' in query_lower:
        return 'Actual FY25'

    return None


def detect_nemko_statement_type(query: str) -> str:
    """Detect statement type (P&L, BS, Cash) from query."""
    query_lower = query.lower()

    for stmt_type, keywords in NEMKO_STATEMENT_KEYWORDS.items():
        for keyword in keywords:
            if keyword in query_lower:
                return stmt_type

    return 'P&L'  # Default to P&L


def detect_nemko_subsidiary(query: str) -> str:
    """Detect Nemko subsidiary from query."""
    query_lower = query.lower()

    for pattern, subsidiary in NEMKO_SUBSIDIARY_MAPPING.items():
        if pattern in query_lower:
            return subsidiary

    return None


# ============================================================================
# LLM-POWERED QUERY PARSER
# Uses GPT-4o-mini to understand user intent and select the correct metric
# ============================================================================


def build_metric_prompt() -> str:
    """Build the prompt showing all available metrics for LLM to choose from."""
    prompt_lines = []
    for metric_id, info in METRIC_CATALOG.items():
        examples = ", ".join(info["examples"][:3])
        prompt_lines.append(
            f"- {metric_id}: {info['description']} (e.g., {examples})")
    return "\n".join(prompt_lines)


LLM_METRIC_PARSER_PROMPT = """You are a financial metric classifier for Bosch enterprise data.

Given a user query, identify:
1. Which metric they want (from the catalog below)
2. Time period (year and month)
3. How to group results (entity, salary_level, sector, etc.)
4. Any filters to apply (including view filters)

METRIC CATALOG (choose one or more metric_ids — include ALL metrics the user asks about):
{metrics}

VIEW FILTERS (add to filters if user mentions these):
- MS View: new_service_area=MS, sector=BBM (keywords: "MS", "MS view")
- SX View: new_service_area=SX, sector=BBE|BBG|BBI|OTHERS (keywords: "SX", "SX view")
- VM View: new_service_area=MS, sector=BBM, project_gb=VM (keywords: "VM", "VM view", "MSGB VM")
- PS View: new_service_area=MS, sector=BBM, project_gb=PS (keywords: "PS", "PS view", "PS GB" ,  "MSGB PS")
- XC View: new_service_area=MS, sector=BBM, project_gb=XC (keywords: "XC", "XC view", "MSGB XC")
- Entity View: No sector filter (keywords: "entity view", "by entity")

GROUPING OPTIONS:
- entity: Group by region_entity (BGSW, BGSV, etc.)
- salary_level: Group by individual salary levels (48, 49, 50, 51, etc.)
- sector: Group by sector (BBM, BBE, BBG, etc.)
- project_gb: Group by project GB (VM, PS, XC, etc.)
- worldwide: No grouping, show total only

IMPORTANT RULES:
1. If user mentions "by salary level", "salarylevel", "breakdown", "individual sl", "per level" → set group_by to include "salary_level"
2. If user mentions specific entity (BGSW, BGSV) → add to filters, not group_by
3. Default group_by is ["entity"] unless user specifies differently
4. If user says "worldwide" or "ww" or "total" → set group_by to ["worldwide"]
5. For pyramid queries asking about each level separately → use "pyramid_mix_individual_levels"
6. If user mentions MS, SX, VM, PS, XC → add appropriate view filters
7. MSGB means MS view with project_gb grouping (VM/PS/XC)

DISAMBIGUATION RULES — apply when the user's phrasing is ambiguous:
8.  "offshore capacity" without "avg" or "average" → use offshore_capacity_end
9.  "offshore capacity" with "avg" or "average"    → use offshore_capacity_avg
10. "outsourcing capacity" or "external capacity" without "avg"/"average" → use outsourcing_capacity_end
11. "outsourcing capacity" or "external capacity" with "avg"/"average"    → use outsourcing_capacity_avg
12. "total capacity" or "headcount" without "avg"/"average" → use total_capacity_end
13. "total capacity" or "headcount" with "avg"/"average"    → use total_capacity_avg
14. "capacity mix" or bare "mix" without "internal"/"external" → use internal_capacity_mix
15. "offshore mix" or "outsourcing mix" or "external mix" → use external_capacity_mix
16. "budget" alone (no "per", "offshore", "outsourcing") → use budget_per_avg_capacity
17. "P&L revenue" or "pl revenue" without "entity" prefix → use gb_pl_revenue
18. "P&L cost" or "pl cost" without "entity" prefix → use direct_cost

MONTH AND QUARTER RULES:
- Single month: "jan 2025" → "month": 1
- Month range: "jan to mar 2025" or "january to march" → "month": [1, 2, 3]  (ALL months inclusive)
- Quarter Q1 → "month": [1, 2, 3], Q2 → [4, 5, 6], Q3 → [7, 8, 9], Q4 → [10, 11, 12]
- YTD (no specific month) → "month": null
- When month is a list, also add "month" to group_by so results show per-month breakdown.

Respond with ONLY valid JSON (no markdown, no explanation):
{{
  "metrics": ["<metric_id_1>", "<metric_id_2_if_requested>"],
  "year": <number>,
  "month": <single number, list of numbers, or null for YTD>,
  "group_by": ["<grouping columns>"],
  "filters": {{"column": "value"}},
  "view": "<MS|SX|VM|PS|XC|Entity or null>",
  "confidence": <0.0 to 1.0>
}}

IMPORTANT: "metrics" is ALWAYS an array, even for a single metric.
If the user asks for multiple metrics (e.g. "offshore capacity AND budget"), list ALL of them.
If the user asks for ONE metric, still use an array with one element: ["metric_id"].

USER QUERY: {query}"""


def parse_query_with_llm(query: str, openai_client=None) -> Dict[str, Any]:
    try:
        metrics_text = build_metric_prompt()
        prompt = LLM_METRIC_PARSER_PROMPT.format(metrics=metrics_text, query=query)
        result_text = get_llm_response(prompt).strip()
        if result_text.startswith("```"):
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"): result_text = result_text[4:]
            result_text = result_text.strip()
        parsed = json.loads(result_text)
        # Support both "metrics": [...] (new) and "metric": "..." (legacy backward compat)
        raw_metrics = parsed.get("metrics")
        if not raw_metrics:
            legacy = parsed.get("metric", "")
            raw_metrics = [legacy] if legacy else []
        if not raw_metrics:
            return {"success": False, "error": "No metric returned by LLM", "raw_response": parsed}
        # Validate all metric IDs — keep only known ones
        valid_metrics = [m for m in raw_metrics if m in METRIC_CATALOG]
        if not valid_metrics:
            return {"success": False, "error": f"Unknown metric(s): {raw_metrics}", "raw_response": parsed}
        # Primary metric (first valid) for backward compat fields
        metric_id = valid_metrics[0]
        parsed["metric"] = metric_id
        parsed["metrics"] = valid_metrics
        parsed["builder"] = METRIC_CATALOG[metric_id]["builder"]
        parsed["success"] = True
        view = parsed.get("view", "").upper() if parsed.get("view") else None
        if view:
            filters = parsed.get("filters", {})
            if isinstance(filters, list):
                filters = {f.get("column", ""): f.get("value", "") for f in filters if isinstance(f, dict)}
            if view == "MS":
                filters["new_service_area"] = "MS"
                filters["sector"] = "BBM"
            elif view == "SX":
                filters["new_service_area"] = "SX"
            parsed["filters"] = filters
        return parsed
    except Exception as e:
        logger.error(f"LLM parsing failed: {e}")
        return {"success": False, "error": str(e)}
    """
    Find the best fuzzy match for a search term among known values.
    Uses simple substring matching and Levenshtein-like scoring.
    """
    if not search_term or not known_values:
        return None

    search_lower = search_term.lower().strip()
    best_match = None
    best_score = 0.0

    for value in known_values:
        if not value:
            continue
        value_lower = value.lower().strip()

        # Exact match
        if search_lower == value_lower:
            return value

        # Substring match (search term in value or vice versa)
        if search_lower in value_lower:
            score = len(search_lower) / len(value_lower)
            if score > best_score:
                best_score = score
                best_match = value
        elif value_lower in search_lower:
            score = len(value_lower) / len(search_lower)
            if score > best_score:
                best_score = score
                best_match = value
        else:
            # Character-based similarity
            common = sum(1 for c in search_lower if c in value_lower)
            score = common / max(len(search_lower), len(value_lower))
            if score > best_score:
                best_score = score
                best_match = value

    return best_match if best_score >= threshold else None


def get_column_mapping(excel_col: str) -> Optional[str]:
    """
    Case-insensitive lookup for Excel column to database column mapping.
    This prevents data ingestion failures due to Excel column casing variations.
    
    Args:
        excel_col: The Excel column name (any case)
    
    Returns:
        The database column name, or None if not found
    """
    excel_col_lower = excel_col.lower().strip()
    for key, value in _COLUMN_MAPPING.items():
        if key.lower() == excel_col_lower:
            return value
    return None


# Column name mapping from Excel to database (case-insensitive lookup via get_column_mapping())
_COLUMN_MAPPING = {
    'Year': 'year',
    'Month': 'month',
    'Employee Number': 'employee_number',
    'Employee Name': 'employee_name',
    'SALARYLEVEL': 'salary_level',
    'Project ID': 'project_id',
    'Region/Entity': 'region_entity',
    'Onsite/Offshore': 'onsite_offshore',
    'Split_of_iTraMs/SDS': 'split_itrams_sds',
    'Order reason': 'order_reason',
    'Sector': 'sector',
    'ProjectGB': 'project_gb',
    'PlanningGB': 'planning_gb',
    'Section': 'section',
    'Billed Capacity': 'billed_capacity',
    'Allocated Capacity': 'allocated_capacity',
    'VKM Capacity': 'vkm_capacity',
    'M/S Capacity': 'ms_capacity',
    'Not Allocated Capacity': 'not_allocated_capacity',
    'Non Linear capacity': 'non_linear_capacity',
    'SL2 Allocated Capacity': 'sl2_allocated_capacity',
    'SL2 NotAllocated Capacity': 'sl2_not_allocated_capacity',
    'Not Billed Not Allocated': 'not_billed_not_allocated',
    'Not Billed Allocated': 'not_billed_allocated',
    'Investment Capacity': 'investment_capacity',
    'Total Hours': 'total_hours',
    'Billable Hours': 'billable_hours',
    'HeadCount': 'headcount',
    'Capacity': 'capacity',
    'Amount in USD': 'amount_usd',
    'Amount in INR': 'amount_inr',
    'Cost Center': 'cost_center',
    'GL Account': 'gl_account',
    'Cost Category': 'cost_category',
    'Resource Type': 'resource_type',
    'Version': 'version',
    'Fund': 'fund',
    'ProjTop_BU': 'proj_top_bu',
    'ProjBU': 'proj_bu',
    'ProjTop_Section': 'proj_top_section',
    'ProjSection': 'proj_section',
    'ProjDept': 'proj_dept',
    'ProjGroup': 'proj_group',
    'RATE CLASSIFICATION': 'rate_classification',
    'SKILLSET_CLASSIFICATION': 'skillset_classification',
    'SRN Payable PMO': 'srn_payable_pmo',
    'PAYABLE_ALLOCATED_CAP': 'payable_allocated_cap',
    'PAYABLE_M/S_CAP': 'payable_ms_cap',
    'PAYABLE_VKM_CAP': 'payable_vkm_cap',
    'PAYABLE_NOTALLOCATED_CAP': 'payable_not_allocated_cap',
    'PAYABLE_NONLINEAR_CAP': 'payable_non_linear_cap',
    'PAYABLE_INVESTMENT_CAP': 'payable_investment_cap',
    'PAYABLE_NOT_BILLED_ALLOCATED': 'payable_not_billed_allocated',
    'PAYABLE_NOT_BILLED_NOT_ALLOCATED': 'payable_not_billed_not_allocated',
    'PAYABLE_UNBILLED_CAP_WITH_PO': 'payable_unbilled_cap_with_po',
    'Attrition': 'attrition',
    'Attrition Type': 'attrition_type',
    'Service Area': 'service_area',
    'Include/Exclude': 'include_exclude',
    # New columns from updated Excel (Phase 1 additions)
    'New Service Area': 'new_service_area',
    'ProjSubServiceArea': 'proj_sub_service_area',
    'ResSubServiceArea': 'res_sub_service_area',
    'VKM Code': 'vkm_code',
    'ResDept': 'res_dept',
    'CostType': 'cost_type',
    'CostCatergory_Class': 'cost_category_class',
    'SubCostCategory': 'sub_cost_category',
    'ProfitCenter': 'profit_center',
    'PRFT_FLAG': 'prft_flag',
    'RDATE': 'rdate',
    'RELEASED_STATUS': 'released_status',
    'Section': 'section',
    'Project/NonProject': 'project_nonproject',
    'Effort Type': 'effort_type',
    'ResBU': 'res_bu',
    'ResSection': 'res_section',
    'Report': 'report',
    'BP_Rate': 'bp_rate',
    'Entity_Category': 'entity_category',
    'Entity_Sub_Category': 'entity_sub_category',
}

# Backward compatibility: COLUMN_MAPPING for direct dict access
COLUMN_MAPPING = _COLUMN_MAPPING

# Metric columns (can be aggregated with SUM, AVG, etc.)
METRIC_COLUMNS = [
    'billed_capacity',
    'allocated_capacity',
    'vkm_capacity',
    'ms_capacity',
    'not_allocated_capacity',
    'non_linear_capacity',
    'sl2_allocated_capacity',
    'sl2_not_allocated_capacity',
    'not_billed_not_allocated',
    'not_billed_allocated',
    'investment_capacity',
    'total_hours',
    'billable_hours',
    'headcount',
    'capacity',
    'amount_usd',
    'amount_inr',
    'srn_payable_pmo',
    'payable_allocated_cap',
    'payable_ms_cap',
    'payable_vkm_cap',
    'payable_not_allocated_cap',
    'payable_non_linear_cap',
    'payable_investment_cap',
    'payable_not_billed_allocated',
    'payable_not_billed_not_allocated',
    'payable_unbilled_cap_with_po',
    'attrition',  # Added: attrition column (value=1.0) for COUNT aggregation
    'bp_rate'
]

# Cost Category to Metric Column Mapping
# Different cost categories store their values in different metric columns
# Covers all 19 Bosch cost categories from MV_GB_INSIGHTS_ALL dataset
COST_CATEGORY_METRIC_MAP = {
    # Financial categories (use amount_usd)
    'Revenue': 'amount_usd',
    'Revenue Summary': 'amount_usd',
    'Cost Summary': 'amount_usd',
    # TBP-Revenue/Capacity categories (use amount_usd)
    'OFFSHORE_TBP-Revenue/Capacity': 'amount_usd',
    'OUTSOURCING_TBP-Revenue/Capacity': 'amount_usd',
    'BILLING AT ACTUALS_TBP-Revenue/Capacity': 'amount_usd',
    'ONSITE_TBP-Revenue/Capacity': 'amount_usd',
    'OFFSHORE - THROUGH ICT_TBP-Revenue/Capacity': 'amount_usd',
    '_TBP-Revenue/Capacity': 'amount_usd',
    'SOFTWARE CLUSTER (SWC)_TBP-Revenue/Capacity': 'amount_usd',
    'BGSV (PASS THROUGH BUSINESS)_TBP-Revenue/Capacity': 'amount_usd',
    'OUTSOURCING - THROUGH ICT_TBP-Revenue/Capacity': 'amount_usd',
    # Attrition categories (use attrition column for COUNT)
    'Attrition': 'attrition',
    'Attrition Pipeline': 'attrition',
    # Headcount categories (use headcount column)
    'Head Count': 'headcount',
    # WW Employee uses Billed Capacity column (not HeadCount)
    'WW Employee': 'billed_capacity',
    'WW Employee Summary': 'billed_capacity',
    # Billing Utilization uses Billed Capacity (not Capacity)
    'Billing Utilization': 'billed_capacity',
    'Billing Utilization Summary': 'billed_capacity',
    # GB Wise END Capacity has actual Capacity column
    'GB Wise END Capacity': 'capacity',
}

# MTD vs YTD Category Classification
# Summary categories contain Year-To-Date cumulative values
# Non-Summary categories contain Month-To-Date (single month) values
CATEGORY_TIME_AGGREGATION = {
    # YTD (Year-To-Date) - Cumulative values, do NOT sum across months
    'Revenue Summary': 'YTD',
    'WW Employee Summary': 'YTD',
    'Billing Utilization Summary': 'YTD',
    # MTD (Month-To-Date) - Single month values, can sum across months
    'Revenue': 'MTD',
    'Cost Summary': 'MTD',
    'Attrition': 'MTD',
    'Attrition Pipeline': 'MTD',
    'Head Count': 'MTD',
    'WW Employee': 'MTD',
    'Billing Utilization': 'MTD',
    'GB Wise END Capacity': 'MTD',
    # TBP categories are MTD
    'OFFSHORE_TBP-Revenue/Capacity': 'MTD',
    'OUTSOURCING_TBP-Revenue/Capacity': 'MTD',
    'BILLING AT ACTUALS_TBP-Revenue/Capacity': 'MTD',
    'ONSITE_TBP-Revenue/Capacity': 'MTD',
    'OFFSHORE - THROUGH ICT_TBP-Revenue/Capacity': 'MTD',
    '_TBP-Revenue/Capacity': 'MTD',
    'SOFTWARE CLUSTER (SWC)_TBP-Revenue/Capacity': 'MTD',
    'BGSV (PASS THROUGH BUSINESS)_TBP-Revenue/Capacity': 'MTD',
    'OUTSOURCING - THROUGH ICT_TBP-Revenue/Capacity': 'MTD',
}


def get_category_time_type(cost_category: str) -> str:
    """Returns 'YTD' or 'MTD' for the given cost category"""
    return CATEGORY_TIME_AGGREGATION.get(cost_category, 'MTD')


def is_ytd_category(cost_category: str) -> bool:
    """Returns True if the cost category contains YTD cumulative data"""
    return get_category_time_type(cost_category) == 'YTD'


def detect_time_scope_from_query(query: str) -> str:
    """
    Detect the time scope intent from user query.
    
    Returns:
    - 'all_available': User wants all available months (e.g., "all available months", "all data")
    - 'compare_years': User wants year-over-year comparison (e.g., "compare 2024 and 2025")
    - 'specific': User specified specific month/year (LLM will extract these)
    - 'default': No time specification - apply last 3 months default
    """
    query_lower = query.lower()

    # Check for "all available" patterns
    all_patterns = [
        'all available', 'all months', 'all data', 'entire year', 'full year',
        'complete data', 'everything available', 'show all', 'all time',
        'every month', 'all periods'
    ]
    for pattern in all_patterns:
        if pattern in query_lower:
            return 'all_available'

    # Check for year comparison patterns
    compare_patterns = [
        'compare year', 'year over year', 'yoy', 'year-over-year',
        'vs last year', 'compared to last year', 'versus last year',
        '2024 vs 2025', '2024 and 2025', '2023 vs 2024', '2023 and 2024',
        'compare 2024', 'compare 2025', 'both years'
    ]
    for pattern in compare_patterns:
        if pattern in query_lower:
            return 'compare_years'

    # Check for quarter patterns: Q1, Q2, Q3, Q4 / first quarter / second quarter etc.
    quarter_patterns = [
        r'\bq[1-4]\b', r'\bquarter [1-4]\b', r'\b(first|second|third|fourth) quarter\b',
        r'\bq1\b', r'\bq2\b', r'\bq3\b', r'\bq4\b'
    ]
    for qp in quarter_patterns:
        if re.search(qp, query_lower):
            return 'specific'  # handled inside intent builders with month IN

    # Check if specific year or month is mentioned
    # Year patterns: 2024, 2025, etc.
    year_match = re.search(r'\b20[0-9]{2}\b', query_lower)
    # Month patterns: January, Jan, month 1, etc.
    month_names = [
        'january', 'february', 'march', 'april', 'may', 'june', 'july',
        'august', 'september', 'october', 'november', 'december', 'jan', 'feb',
        'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
    ]
    has_month = any(m in query_lower for m in month_names)

    if year_match or has_month:
        return 'specific'

    # Default: no time specification
    return 'default'


def is_gb_pl_query(query: str) -> bool:
    """Check if the query contains 'GB P&L' trigger phrases.

    Handles: 'gb p&l', 'gb pl', 'gb pnl', 'gb p & l', 'gb p and l',
             'gb profit and loss', 'by gb p&l', 'by gb pl'
    Does NOT match bare 'gb' — too broad (conflicts with 'GB Wise END Capacity').
    """
    query_lower = query.lower()
    exact_triggers = [
        'gb p&l', 'gb pl', 'gb pnl', 'gb p & l',
        'gb p and l', 'gb profit and loss',
        'by gb p&l', 'by gb pl', 'gb pn l',
    ]
    if any(t in query_lower for t in exact_triggers):
        return True
    # fuzzy: 'gb' + any P&L synonym (space-separated to avoid 'RGB', 'MGB', etc.)
    has_gb = bool(re.search(r'\bgb\b', query_lower))
    has_pl = any(t in query_lower for t in [
        'p&l', 'p & l', 'pnl', 'p and l', 'profit and loss',
    ])
    if has_gb and has_pl:
        return True
    return False


def is_gb_pl_summary_query(query: str) -> bool:
    """Detect 'GB P&L summary / overview / report' queries.

    Fires when BOTH conditions hold:
      1. A GB P&L or entity P&L trigger phrase is present
      2. A summary-intent word is present

    Summary-intent words (explicit only — avoids false positives on 'full year'):
      summarise, summarize, summary, overview, report, all metrics,
      breakdown, complete p&l, full p&l, full report, complete pl
    """
    query_lower = query.lower()
    summary_triggers = [
        'summarise', 'summarize', 'summary', 'overview',
        'all metrics', 'breakdown',
        'full p&l', 'full pl', 'full report',
        'complete p&l', 'complete pl', 'complete report',
    ]
    if not any(t in query_lower for t in summary_triggers):
        return False
    # Must also carry a P&L trigger (GB or entity)
    if is_gb_pl_query(query):
        return True
    # entity P&L check inline (avoids circular dependency via is_entity_pl_query)
    has_entity = 'entity' in query_lower
    has_pl = any(t in query_lower for t in [
        'p&l', 'p & l', 'pnl', 'p and l', 'profit and loss', ' pl ', ' pl,', ' pl.'
    ])
    return has_entity and has_pl


def is_entity_pl_query(query: str) -> bool:
    """Check if the query contains 'entity P&L' or 'GB P&L' trigger phrases.
    
    Handles various natural phrasings:
    - 'by entity P&L', 'entity P&L', 'entity PL'
    - 'for entity by P&L', 'entity by P&L' (words separated by prepositions)
    - 'entity pnl', 'entity profit and loss'
    - 'gb p&l', 'gb pl', 'gb pnl' and variants (see is_gb_pl_query)
    """
    if is_gb_pl_query(query):
        return True

    query_lower = query.lower()
    exact_triggers = [
        'entity p&l', 'entity pl', 'entity p & l', 'by entity p&l',
        'by entity pl', 'entity pnl', 'entity p and l',
        'entity profit and loss'
    ]
    if any(t in query_lower for t in exact_triggers):
        return True

    has_entity = 'entity' in query_lower
    has_pl = any(t in query_lower for t in [
        'p&l', 'p & l', 'p&l', 'pnl', 'p and l', 'profit and loss', ' pl ',
        ' pl,', ' pl.'
    ])
    if has_entity and has_pl:
        return True

    return False


def detect_entity_category_from_query(query: str) -> Optional[str]:
    """Detect entity_category from user query using ENTITY_CATEGORY_MAPPING.
    
    Only activates when query contains 'entity P&L' trigger.
    Matches longest phrases first to avoid partial matches.
    Returns the exact entity_category value (e.g., 'Outsourcing cost') or None.
    """
    if not is_entity_pl_query(query):
        return None
    query_lower = query.lower().strip()
    sorted_keys = sorted(ENTITY_CATEGORY_MAPPING.keys(), key=len, reverse=True)
    for key in sorted_keys:
        if key in query_lower:
            return ENTITY_CATEGORY_MAPPING[key]
    return None


def detect_cost_class_from_query(query: str) -> Optional[str]:
    """Detect cost category class from user query using COST_CLASS_MAPPING.
    
    Matches longest phrases first to avoid partial matches.
    Returns the exact cost_category_class value (e.g., 'Resource Cost') or None.
    Skips if query is an entity P&L query (those use entity_category instead).
    """
    if is_entity_pl_query(query):
        return None
    query_lower = query.lower().strip()
    sorted_keys = sorted(COST_CLASS_MAPPING.keys(), key=len, reverse=True)
    for key in sorted_keys:
        if key in query_lower:
            return COST_CLASS_MAPPING[key]
    return None


# Dimension columns (used for filtering and grouping)
DIMENSION_COLUMNS = [
    'year',
    'month',
    'region_entity',
    'onsite_offshore',
    'sector',
    'project_gb',
    'planning_gb',
    'section',
    'resource_type',
    'employee_number',
    'employee_name',
    'salary_level',
    'project_id',
    'cost_center',
    'gl_account',
    'cost_category',
    'split_itrams_sds',
    'order_reason',
    'fund',
    'proj_top_bu',
    'proj_bu',
    'proj_top_section',
    'proj_section',
    'proj_dept',
    'proj_group',
    'rate_classification',
    'skillset_classification',
    'service_area',
    'attrition',
    'attrition_type',
    'version',
    'include_exclude',
    # New dimension columns (Phase 1 additions)
    'new_service_area',
    'proj_sub_service_area',
    'res_sub_service_area',
    'vkm_code',
    'res_dept',
    'cost_type',
    'cost_category_class',
    'sub_cost_category',
    'profit_center',
    'prft_flag',
    'released_status',
    'project_nonproject',
    'effort_type',
    'res_bu',
    'res_section',
    'report',
    'entity_category',
    'entity_sub_category'
]

# Cost category column relevance mapping (from Insights_All_Document)
# Each cost category maps to its relevant columns based on Y/N flags in the document
COST_CATEGORY_COLUMNS = {
    'Billing Utilization': [
        'Year', 'Month', 'Employee Number', 'Employee Name', 'SALARYLEVEL',
        'Project ID', 'Region/Entity', 'Onsite/Offshore',
        'Split_of_iTraMs/SDS', 'Order reason', 'Sector', 'ProjectGB',
        'PlanningGB', 'Billed Capacity', 'Allocated Capacity', 'VKM Capacity',
        'M/S Capacity', 'Not Allocated Capacity', 'Non Linear capacity',
        'SL2 Allocated Capacity', 'SL2 NotAllocated Capacity',
        'Not Billed Not Allocated', 'Not Billed Allocated',
        'Investment Capacity', 'Resource Type', 'ProjTop_BU', 'ProjBU',
        'ProjTop_Section', 'ProjSection', 'ProjDept', 'ProjGroup',
        'SKILLSET_CLASSIFICATION', 'SRN Payable PMO', 'PAYABLE_ALLOCATED_CAP',
        'PAYABLE_M/S_CAP', 'PAYABLE_VKM_CAP', 'PAYABLE_NOTALLOCATED_CAP',
        'PAYABLE_NONLINEAR_CAP', 'New Service Area'
    ],
    'Billing Utilization Summary': [
        'Year', 'Month', 'Region/Entity', 'Onsite/Offshore',
        'Split_of_iTraMs/SDS', 'Sector', 'ProjectGB', 'PlanningGB',
        'Billed Capacity', 'Allocated Capacity', 'VKM Capacity',
        'M/S Capacity', 'Not Allocated Capacity', 'Non Linear capacity',
        'SL2 Allocated Capacity', 'SL2 NotAllocated Capacity',
        'Not Billed Not Allocated', 'Not Billed Allocated',
        'Investment Capacity', 'Resource Type', 'Fund', 'ProjTop_BU', 'ProjBU',
        'ProjTop_Section', 'ProjSection', 'ProjDept', 'ProjGroup',
        'RATE CLASSIFICATION', 'SRN Payable PMO', 'PAYABLE_ALLOCATED_CAP',
        'PAYABLE_M/S_CAP', 'PAYABLE_VKM_CAP', 'PAYABLE_NOTALLOCATED_CAP',
        'PAYABLE_NONLINEAR_CAP', 'PAYABLE_INVESTMENT_CAP',
        'PAYABLE_NOT_BILLED_ALLOCATED', 'PAYABLE_NOT_BILLED_NOT_ALLOCATED',
        'PAYABLE_UNBILLED_CAP_WITH_PO', 'ProjSubServiceArea',
        'ResSubServiceArea', 'ResDept', 'New Service Area'
    ],
    'WW Employee': [
        'Year', 'Month', 'Employee Number', 'SALARYLEVEL', 'Project ID',
        'Region/Entity', 'Onsite/Offshore', 'Sector', 'ProjectGB',
        'PlanningGB', 'Billed Capacity', 'Resource Type', 'ProjBU',
        'ProjTop_Section', 'ProjSection', 'ProjDept', 'ProjGroup',
        'RATE CLASSIFICATION', 'New Service Area'
    ],
    'WW Employee Summary': [
        'Year', 'Month', 'Region/Entity', 'Sector', 'ProjectGB', 'PlanningGB',
        'Billed Capacity', 'Resource Type', 'ProjBU', 'ProjTop_Section',
        'ProjSection', 'ProjDept', 'ProjGroup', 'RATE CLASSIFICATION',
        'VKM Code', 'New Service Area'
    ],
    'GB Wise END Capacity': [
        'Year', 'Month', 'Employee Number', 'Employee Name', 'SALARYLEVEL',
        'Project ID', 'Region/Entity', 'Onsite/Offshore', 'Sector',
        'ProjectGB', 'PlanningGB', 'Capacity', 'Resource Type', 'ProjTop_BU',
        'ProjBU', 'ProjTop_Section', 'ProjSection', 'ProjDept', 'ProjGroup',
        'SKILLSET_CLASSIFICATION', 'Service Area', 'New Service Area'
    ],
    'Cost Summary': [
        'Year', 'Month', 'Project ID', 'Region/Entity', 'Sector', 'ProjectGB',
        'PlanningGB', 'Cost Center', 'GL Account', 'Amount in USD',
        'Amount in INR', 'BP_Rate', 'Fund', 'ProjBU', 'ProjTop_Section',
        'ProjSection', 'ProjDept', 'ProjGroup', 'CostType',
        'CostCatergory_Class', 'SubCostCategory', 'ProfitCenter', 'PRFT_FLAG',
        'New Service Area', 'Entity_Category', 'Entity_Sub_Category'
    ],
    'Attrition': [
        'Year', 'Month', 'Employee Number', 'Employee Name', 'SALARYLEVEL',
        'Project ID', 'Region/Entity', 'Onsite/Offshore', 'Sector',
        'ProjectGB', 'PlanningGB', 'Attrition', 'Resource Type', 'ProjTop_BU',
        'ProjBU', 'ProjTop_Section', 'ProjSection', 'ProjDept', 'ProjGroup',
        'SKILLSET_CLASSIFICATION', 'New Service Area'
    ],
    'Attrition Pipeline': [
        'Year', 'Month', 'Employee Number', 'Employee Name', 'SALARYLEVEL',
        'Project ID', 'Region/Entity', 'Onsite/Offshore', 'Sector',
        'ProjectGB', 'PlanningGB', 'Attrition', 'Attrition Type',
        'Resource Type', 'ProjTop_BU', 'ProjBU', 'ProjTop_Section',
        'ProjSection', 'ProjDept', 'ProjGroup', 'SKILLSET_CLASSIFICATION',
        'New Service Area'
    ],
    'Head Count': [
        'Year', 'Month', 'Employee Number', 'Employee Name', 'SALARYLEVEL',
        'Region/Entity', 'Attrition', 'HeadCount', 'Resource Type',
        'SKILLSET_CLASSIFICATION', 'New Service Area'
    ],
    'Revenue': [
        'Year', 'Month', 'Project ID', 'Region/Entity', 'Onsite/Offshore',
        'Split_of_iTraMs/SDS', 'Order reason', 'Sector', 'ProjectGB',
        'PlanningGB', 'Cost Center', 'GL Account', 'Amount in USD',
        'Amount in INR', 'Resource Type', 'ProjBU', 'ProjTop_Section',
        'ProjSection', 'ProjDept', 'ProjGroup', 'Include/Exclude',
        'New Service Area'
    ],
    'Revenue Summary': [
        'Year', 'Month', 'Region/Entity', 'Onsite/Offshore',
        'Split_of_iTraMs/SDS', 'Order reason', 'Sector', 'ProjectGB',
        'PlanningGB', 'Amount in USD', 'Amount in INR', 'BP_Rate',
        'Resource Type', 'ProjBU', 'ProjTop_Section', 'ProjSection',
        'ProjDept', 'ProjGroup', 'Include/Exclude', 'New Service Area'
    ],
    'TBP-Revenue/Capacity': [
        'Year', 'Month', 'Region/Entity', 'Onsite/Offshore', 'Sector',
        'ProjectGB', 'PlanningGB', 'Section', 'Capacity', 'Amount in USD',
        'Resource Type', 'Version', 'ProjBU', 'ProjSection', 'New Service Area'
    ]
}

# Cost Category Class mapping - maps user-friendly terms to exact cost_category_class values
# Used for queries like "resource cost by entity" → cost_category_class = 'Resource Cost'
COST_CLASS_MAPPING = {
    'resource cost': 'Resource Cost',
    'resource costs': 'Resource Cost',
    'resource': 'Resource Cost',
    'travel cost': 'Travel Cost',
    'travel costs': 'Travel Cost',
    'travel expenses': 'Travel Cost',
    'travel': 'Travel Cost',
    'other direct cost': 'Other Direct Cost',
    'other direct costs': 'Other Direct Cost',
    'other direct': 'Other Direct Cost',
}
# NOTE: COST_CLASS_MAPPING is intentionally kept as-is.
# For entity P&L queries, cost_class detection is bypassed entirely (see compile_sql).
# 'travel expenses' here routes to cost_category_class='Travel Cost' (GB P&L only).
# 'travel expenses' in ENTITY_CATEGORY_MAPPING routes to entity_category='Travel expenses' (Entity P&L only).

# Entity Category mapping - maps user-friendly terms to exact entity_category values
# Used for "by entity P&L" queries: "outsourcing cost by entity P&L" → entity_category = 'Outsourcing cost'
# Groups by entity_sub_category instead of sub_cost_category
ENTITY_CATEGORY_MAPPING = {
    'outsourcing cost': 'Outsourcing cost',
    'outsourcing costs': 'Outsourcing cost',
    'outsourcing': 'Outsourcing cost',
    'consultancy charges': 'Consultancy Charges',
    'consultancy': 'Consultancy Charges',
    'consulting': 'Consultancy Charges',
    'depreciation': 'Depreciation',
    'employee benefit': 'Employee Benefit',
    'employee benefits': 'Employee Benefit',
    'employee cost': 'Employee Benefit',
    'salary': 'Employee Benefit',
    'salary and wages': 'Employee Benefit',
    'facility cost': 'Facility Cost',
    'facility costs': 'Facility Cost',
    'facilities': 'Facility Cost',
    'material cost': 'Material cost',
    'material costs': 'Material cost',
    'other expenses': 'Other Expenses',
    'other expense': 'Other Expenses',
    'revenue hardware': 'Revenue Hardware',
    'hardware revenue': 'Revenue Hardware',
    'revenue software': 'Revenue Software',
    'software revenue': 'Revenue Software',
    'travel expenses': 'Travel expenses',
    'travel cost': 'Travel expenses',
    'travel costs': 'Travel expenses',
    'welfare cost': 'Welfare Cost',
    'welfare costs': 'Welfare Cost',
    'welfare': 'Welfare Cost',
    'revenue': 'Revenue',
    'revenues': 'Revenue',
    'revenue total': 'Revenue',
    'total revenue': 'Revenue',
}

# Column fallback mapping - when a column is not available for a cost category, use the fallback
# Format: {column_db_name: fallback_column_db_name}
COLUMN_FALLBACKS = {
    'new_service_area':
    'service_area',  # If new_service_area not available, use service_area
    'service_area':
    'new_service_area',  # If service_area not available, use new_service_area
}


def get_column_for_cost_category(db_col: str, cost_category: str) -> str:
    """
    Check if a column is available for a cost category, and return a fallback if not.
    
    Args:
        db_col: The database column name (e.g., 'new_service_area')
        cost_category: The cost category name (e.g., 'GB Wise END Capacity')
    
    Returns:
        The original column if available, or a fallback column if available, or the original column
    """
    if not cost_category or not db_col:
        return db_col

    # Find matching cost category columns (case-insensitive partial match)
    cost_category_lower = cost_category.lower()
    available_columns = None

    for cat_key, cols in COST_CATEGORY_COLUMNS.items():
        if cat_key.lower(
        ) in cost_category_lower or cost_category_lower in cat_key.lower():
            available_columns = cols
            break

    if not available_columns:
        return db_col

    # Convert Excel column names to db column names for checking (case-insensitive)
    available_db_cols = set()
    for excel_col in available_columns:
        db_name = get_column_mapping(excel_col) or excel_col.lower().replace(
            ' ', '_').replace('/', '_')
        available_db_cols.add(db_name)

    # Check if the requested column is available
    if db_col in available_db_cols:
        return db_col

    # Check if there's a fallback available
    fallback = COLUMN_FALLBACKS.get(db_col)
    if fallback and fallback in available_db_cols:
        logger.info(
            f"Column fallback: '{db_col}' not available for '{cost_category}', using '{fallback}'"
        )
        return fallback

    # Return original column (will likely result in empty/null data)
    logger.warning(
        f"Column '{db_col}' not available for '{cost_category}' and no fallback found"
    )
    return db_col


class SemanticSQLService:
    """Service for semantic SQL queries on financial data"""

    def __init__(self):
        self.client = None # Using get_llm_response instead
        self.db_url = os.environ.get('DATABASE_URL')

    def get_db_connection(self):
        """Get database connection"""
        return psycopg2.connect(self.db_url)

    def rephrase_user_query(self,
                            query: str,
                            cube_id: str = None) -> Dict[str, Any]:
        """
        Use LLM to rephrase and correct user query before processing.
        Fixes misspellings, normalizes entity names, and clarifies business terms.
        
        Args:
            query: The raw user query (may contain typos)
            cube_id: Optional cube_id for loading business context
            
        Returns:
            Dict with 'rephrased_query' (cleaned query) and 'original_query'
        """
        try:
            # Load business context for entity/term normalization
            business_context = ""
            if cube_id:
                try:
                    business_logic = self.load_business_logic_context(cube_id)
                    if business_logic.get('column_values'):
                        entities = []
                        terms = []
                        for cv in business_logic.get('column_values', []):
                            if cv.get('column_name') in [
                                    'Region/Entity', 'region_entity'
                            ]:
                                entities.extend(cv.get('known_values', []))
                            terms.extend(cv.get('known_values', []))
                        if entities:
                            business_context += f"\nKnown entities: {', '.join(entities[:20])}"
                        if terms:
                            business_context += f"\nKnown business terms: {', '.join(terms[:30])}"
                except Exception as e:
                    logger.warning(
                        f"Could not load business context for rephrasing: {e}")

            system_prompt = f"""You are a CONSERVATIVE query correction assistant for a financial analytics system.
Your ONLY job is to fix OBVIOUS spelling errors. DO NOT change the meaning or add information.

STRICT RULES:
1. ONLY fix obvious spelling mistakes in common words:
   - offshroe/ofshore -> offshore
   - onsight/oniste -> onsite  
   - capcity/capicity -> capacity
   - outsorsing/outsouricng/oustorucing/outsourcign/outsourcng -> outsourcing
   - attrition/atrittion/attriton -> attrition
   - utiliztion/utilisation/utlization -> utilization
   - headcount/head count/hedcount -> headcount
   - revnue/reveneu/reveune -> revenue
   - billig/billling/billng -> billing
   - utilizaton/utilizaiton -> utilization
2. DO NOT change entity names unless they are obviously misspelled (e.g., "BGWS" -> "BGSW")
3. DO NOT interpret abbreviations (keep "bg sw" as-is, don't change to "BGSW")
4. NEVER add, remove, or reorder words
5. Keep ALL numbers, dates, years, and codes EXACTLY as-is
6. Return ONLY the corrected query text, nothing else
7. If uncertain about a correction, DO NOT make it
8. If query looks correct, return it UNCHANGED
9. NEVER expand or change these financial abbreviations - keep them EXACTLY as written:
   - P&L must stay P&L (never change to "profit and loss" or "P and L" or "P & L")
   - EBIT stays EBIT, EBITDA stays EBITDA
   - YTD stays YTD, MTD stays MTD, YoY stays YoY, MoM stays MoM
   - ROI, KPI, CAGR, IRR, NPV — all stay unchanged
   - Entity P&L stays exactly as "entity P&L"
   - musd stays musd (million USD), minr stays minr (million INR)
   - inr stays inr (Indian Rupee), usd stays usd
   - BGSW, BGSV, BGW, BGI, BGP, BGGC, BGPRD — all entity codes stay unchanged

{business_context}

IMPORTANT: When in doubt, preserve the original text. Only fix clear typos."""

            prompt = f"system: {system_prompt}\nuser: Correct this query: {query}\nassistant:"
            response = get_llm_response(prompt, ai_config=ai_config)

            rephrased = response.strip()

            # Remove quotes if LLM wrapped the response
            if rephrased.startswith('"') and rephrased.endswith('"'):
                rephrased = rephrased[1:-1]
            if rephrased.startswith("'") and rephrased.endswith("'"):
                rephrased = rephrased[1:-1]

            # Safety check: if the model dropped or changed critical financial trigger keywords,
            # revert to the original query so that keyword-based fast paths still trigger
            CRITICAL_TRIGGERS = ['p&l', 'entity p&l', 'entity pl', 'ebit', 'ebitda', 'ytd', 'mtd']
            query_lower = query.lower()
            rephrased_lower = rephrased.lower()
            for trigger in CRITICAL_TRIGGERS:
                if trigger in query_lower and trigger not in rephrased_lower:
                    logger.warning(
                        f"Rephrasing removed trigger '{trigger}', reverting to original query"
                    )
                    rephrased = query
                    break

            # Log if query was changed
            if rephrased.lower() != query.lower():
                logger.info(f"Query rephrased: '{query}' -> '{rephrased}'")

            return {
                'success': True,
                'rephrased_query': rephrased,
                'original_query': query,
                'was_modified': rephrased.lower() != query.lower()
            }

        except Exception as e:
            logger.warning(f"Query rephrasing failed, using original: {e}")
            return {
                'success': True,
                'rephrased_query': query,
                'original_query': query,
                'was_modified': False
            }

    def inject_default_time_period(self, query: str) -> Dict[str, Any]:
        """
        Detect if user query has no time period specified, and if so,
        inject default last 3 months context.
        
        Args:
            query: The user's query
            
        Returns:
            Dict with:
                - 'query': possibly augmented query
                - 'default_months': list of (month, year) tuples if defaults were added
                - 'has_time_period': whether original query had time period
        """
        # Comprehensive patterns that indicate time period is already specified
        time_patterns = [
            r'\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\b',
            r'\b(january|february|march|april|may|june|july|august|september|october|november|december)\b',
            r'\b20\d{2}\b',  # Years like 2024, 2025
            r'\bfy\s*\d{2,4}\b',  # Fiscal years: FY25, FY2025, FY 25
            r'\b[hq][1-4]\s*\d{0,4}\b',  # H1, H2, Q1 2025, Q4
            r'\bq[1-4]\b',  # Quarters
            r'\b(month|year|ytd|mtd|yoy)\b',  # YTD, MTD, YoY
            r'\blast\s*(3|three|6|six|12|twelve|1|one|2|two)\s*months?\b',
            r'\bmonth\s*=?\s*\d+\b',
            r'\b(this|last|previous|current|prior)\s*(month|year|quarter|week|fy|fiscal)\b',
            r'\b\d{4}[-/]\d{1,2}\b',  # 2025-01, 2025/11
            r'\byear[\s-]to[\s-]date\b',  # Year-to-date
            r'\bfiscal\s*(year|quarter)\b',  # Fiscal year/quarter
            r'\b(first|second|third|fourth)\s*(half|quarter)\b',  # First half, third quarter
            r'\b(h1|h2)\s*\d{0,4}\b',  # H1 2025, H2
        ]

        query_lower = query.lower()
        has_time_period = any(
            re.search(pattern, query_lower, re.IGNORECASE)
            for pattern in time_patterns)

        if has_time_period:
            return {
                'query': query,
                'default_months': None,
                'has_time_period': True,
                'time_context': None
            }

        # Calculate last 3 months from current date
        now = datetime.now()
        months = []
        month_names = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
            'Oct', 'Nov', 'Dec'
        ]

        for i in range(3):
            # Go back i months from current month
            month_offset = now.month - 1 - i
            year = now.year
            while month_offset < 0:
                month_offset += 12
                year -= 1
            month_num = month_offset + 1
            months.append({
                'month': month_num,
                'year': year,
                'display': f"{month_names[month_num - 1]} {year}"
            })

        # Create time context string for display
        time_displays = [m['display'] for m in months]
        time_context = f"Showing data for: {', '.join(time_displays)}"

        # Create structured time clause that the LLM parser can understand
        # Using explicit year and month format for reliable parsing
        year = months[0]['year']
        month_nums = [str(m['month']) for m in months]
        month_clause = f"for year {year} months {', '.join(month_nums)}"
        augmented_query = f"{query} {month_clause}"

        logger.info(
            f"No time period in query, adding defaults: {time_context}")

        return {
            'query': augmented_query,
            'default_months': months,
            'has_time_period': False,
            'time_context': time_context
        }

    def format_month_display(self, month: int, year: int) -> str:
        """Format month/year as readable string like 'Dec 2025'"""
        month_names = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
            'Oct', 'Nov', 'Dec'
        ]
        if 1 <= month <= 12:
            return f"{month_names[month - 1]} {year}"
        return f"Month {month} {year}"

    def get_ctg_value(self,
                      cube_id: str,
                      particulars: str,
                      sub_category: str = None,
                      entity: str = 'World Wide',
                      year: int = None,
                      month: int = None,
                      default_value: float = 0) -> float:
        """
        Get CTG (Cost Target Guidance) adjustment value from cube_plan_data.
        
        These values come from the Manual inputs MBR Master file and replace hardcoded constants.
        
        Args:
            cube_id: The cube ID to query
            particulars: The metric type (e.g., 'Offshore Capacity', 'Outsourcing Capacity', 'Total Capacity')
            sub_category: 'Average' or 'End' for capacity metrics
            entity: 'World Wide', 'Worlwide', or specific entity name
            year: Optional year filter
            month: Optional month filter
            default_value: Default if no CTG found (previously hardcoded values)
            
        Returns:
            CTG adjustment value as float, or default_value if not found
        """
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()

            # Build query for CTG value - try multiple entity spellings
            entities_to_try = [entity]
            if entity == 'World Wide':
                entities_to_try = ['World Wide', 'Worlwide', 'WW', 'Worldwide']
            elif entity == 'Worlwide':
                entities_to_try = ['Worlwide', 'World Wide', 'WW', 'Worldwide']

            # Query for the CTG value with "Actual" plan_type (current actuals from MBR file)
            base_query = """
                SELECT cost_value 
                FROM cube_plan_data 
                WHERE cube_id = %s 
                  AND LOWER(particulars) = LOWER(%s)
                  AND plan_type = 'Actual'
                  AND entity IN %s
            """
            params = [cube_id, particulars, tuple(entities_to_try)]

            if sub_category:
                base_query += " AND LOWER(sub_category) = LOWER(%s)"
                params.append(sub_category)

            if year:
                base_query += " AND year = %s"
                params.append(year)

            if month:
                base_query += " AND month = %s"
                params.append(month)

            # Get latest value (highest year/month)
            base_query += " ORDER BY year DESC, month DESC LIMIT 1"

            cursor.execute(base_query, params)
            row = cursor.fetchone()
            cursor.close()
            conn.close()

            if row and row[0]:
                try:
                    ctg_value = float(row[0])
                    logger.info(
                        f"CTG value from MBR: {particulars}/{sub_category} for {entity} = {ctg_value}"
                    )
                    return ctg_value
                except (ValueError, TypeError):
                    logger.warning(f"Invalid CTG value format: {row[0]}")
                    return default_value
            else:
                logger.info(
                    f"No CTG value found for {particulars}/{sub_category} ({entity}), using default: {default_value}"
                )
                return default_value

        except Exception as e:
            logger.warning(
                f"Error getting CTG value for {particulars}/{sub_category}: {e}"
            )
            return default_value

    def get_ctg_value_sync(self,
                           cube_id: str,
                           particulars: str,
                           sub_category: str = None,
                           entity: str = 'World Wide',
                           default_value: float = 0) -> float:
        """
        Synchronously get CTG value from cube_plan_data for use in calculations.
        This is the safe, parameterized version that avoids SQL injection.
        
        Args:
            cube_id: The cube ID (validated UUID from database)
            particulars: The metric type (e.g., 'Offshore Capacity', 'Outsourcing Capacity')
            sub_category: 'Average' or 'End' for capacity metrics
            entity: 'World Wide', 'Worlwide', or specific entity name
            default_value: Default if no CTG found
            
        Returns:
            CTG adjustment value as float
        """
        return self.get_ctg_value(cube_id,
                                  particulars,
                                  sub_category,
                                  entity,
                                  year=None,
                                  month=None,
                                  default_value=default_value)

    def _expand_month_filter_for_ytd(self, where_parts: List[str],
                                     params: List) -> tuple:
        """
        Expand month filter for YTD (Year-to-Date) calculations.
        
        If WHERE has 'month = 2', expands to 'month IN (1, 2)' to get Jan+Feb data.
        Returns (new_where_parts, new_params, max_month) tuple.
        
        YTD Average Formula:
        - Feb query: (Jan + Feb) / 2
        - Aug query: (Jan + ... + Aug) / 8
        
        This ensures we sum all months from January to the requested month,
        then divide by that month number.
        """
        new_where_parts = []
        new_params = []
        max_month = 1  # Default to 1 if no month found
        params_consumed = 0  # Track how many params we've processed

        for i, part in enumerate(where_parts):
            part_lower = part.lower()
            placeholders_in_part = part.count('%s')

            # Check if this is a single month filter (month = X) - NOT an IN clause
            if 'month' in part_lower and '=' in part and 'in' not in part_lower:
                # First try: Find literal month value in the part (e.g., "month = '2'" or "month = 2")
                literal_match = re.search(r"month\s*=\s*['\"]?(\d{1,2})['\"]?",
                                          part, re.IGNORECASE)
                if literal_match:
                    try:
                        max_month = int(literal_match.group(1))
                        if 1 <= max_month <= 12:  # Valid month range
                            # Expand to month IN (1, 2, ..., max_month)
                            month_list = list(range(1, max_month + 1))
                            month_list_str = ', '.join(
                                [f"'{m}'" for m in month_list])
                            new_where_parts.append(
                                f"month IN ({month_list_str})")
                            # Skip params for this part since we're replacing the literal
                            params_consumed += placeholders_in_part
                            logger.info(
                                f"Expanded literal month={max_month} to month IN ({month_list}) for YTD calculation"
                            )
                            continue
                    except (ValueError, TypeError):
                        pass

                # Second try: Find the corresponding placeholder parameter
                if placeholders_in_part > 0 and params_consumed < len(params):
                    month_value = params[params_consumed]
                    try:
                        max_month = int(month_value)
                        if 1 <= max_month <= 12:  # Valid month range
                            # Expand to month IN (1, 2, ..., max_month)
                            month_list = list(range(1, max_month + 1))
                            placeholders = ', '.join(['%s'] * len(month_list))
                            new_where_parts.append(
                                f"month IN ({placeholders})")
                            new_params.extend(month_list)
                            params_consumed += placeholders_in_part
                            logger.info(
                                f"Expanded placeholder month={max_month} to month IN ({month_list}) for YTD calculation"
                            )
                            continue
                    except (ValueError, TypeError):
                        pass

            # Check for month IN (...) - extract max month from the IN clause
            if 'month' in part_lower and ' in' in part_lower:
                # Split on 'IN' case-insensitively and get the part with parentheses
                in_split = re.split(r'\bIN\b', part, flags=re.IGNORECASE)
                if len(in_split) > 1:
                    # Extract only numbers from inside the parentheses
                    paren_match = re.search(r'\(([^)]+)\)', in_split[1])
                    if paren_match:
                        paren_content = paren_match.group(1)
                        # Extract all numbers (1-2 digits for months)
                        literal_months = re.findall(r"['\"]?(\d{1,2})['\"]?",
                                                    paren_content)
                        if literal_months:
                            try:
                                extracted_months = [
                                    int(m) for m in literal_months
                                    if 1 <= int(m) <= 12
                                ]
                                if extracted_months:
                                    max_month = max(extracted_months)
                                    logger.info(
                                        f"Detected max_month={max_month} from literal IN clause: {paren_content}"
                                    )
                            except (ValueError, TypeError):
                                pass
                        elif placeholders_in_part > 0:
                            # Placeholders in IN clause - extract from params
                            month_params = params[
                                params_consumed:params_consumed +
                                placeholders_in_part]
                            try:
                                extracted_months = [
                                    int(m) for m in month_params
                                    if 1 <= int(m) <= 12
                                ]
                                if extracted_months:
                                    max_month = max(extracted_months)
                                    logger.info(
                                        f"Detected max_month={max_month} from placeholder IN clause"
                                    )
                            except (ValueError, TypeError):
                                pass

            # Copy the part as-is and track its params
            new_where_parts.append(part)
            if placeholders_in_part > 0:
                new_params.extend(params[params_consumed:params_consumed +
                                         placeholders_in_part])
                params_consumed += placeholders_in_part

        # If no month filter was found, return original
        if not new_where_parts:
            return where_parts, params, max_month

        logger.info(
            f"_expand_month_filter_for_ytd: Returning max_month={max_month}")
        return new_where_parts, new_params, max_month

    def _apply_ytd_fallback(
            self,
            ytd_where_parts: List[str],
            ytd_params: List,
            original_where_parts: List[str],
            original_params: List,
            max_month: int,
            builder_name: str = '') -> tuple:
        """Fallback for when _expand_month_filter_for_ytd returns max_month=1 (failed detection).

        Extracts the actual requested month from the original where_parts/params,
        then re-expands ytd_where_parts so COUNT(DISTINCT month) in avg SQL sees
        ALL months from 1..N instead of only the single requested month.

        Without this, COUNT(DISTINCT month) = 1 → avg equals end value.

        Returns (ytd_where_parts, ytd_params, max_month).
        """
        if max_month != 1:
            return ytd_where_parts, ytd_params, max_month

        # Step 1: Extract the actual month from original where_parts (literal) or params
        where_str = " ".join(original_where_parts)
        m = re.search(r"month\s*=\s*['\"]?(\d{1,2})['\"]?", where_str, re.IGNORECASE)
        if m:
            try:
                max_month = int(m.group(1))
            except (ValueError, TypeError):
                pass
        if max_month == 1 and original_params:
            for p in original_params:
                try:
                    v = int(p)
                    if 2 <= v <= 12:
                        max_month = v
                        break
                except (ValueError, TypeError):
                    continue

        if max_month <= 1:
            return ytd_where_parts, ytd_params, max_month

        logger.info(
            f"{builder_name}: YTD fallback extracted max_month={max_month}; "
            f"re-expanding ytd_where_parts so COUNT(DISTINCT month) sees months 1..{max_month}"
        )

        # Step 2: Re-expand ytd_where_parts — replace 'month = X' with literal
        # 'month IN (1..N)' and remove the corresponding %s param so params stay aligned.
        month_list_str = ', '.join([f"'{mn}'" for mn in range(1, max_month + 1)])
        new_parts: List[str] = []
        new_params: List = list(ytd_params)
        params_offset = 0

        for part in ytd_where_parts:
            placeholders = part.count('%s')
            if ('month' in part.lower()
                    and '=' in part
                    and ' in' not in part.lower()):
                # Replace with literal expanded IN clause (no %s → remove param)
                new_parts.append(f"month IN ({month_list_str})")
                del new_params[params_offset:params_offset + placeholders]
                # params_offset stays the same (deleted from list)
            else:
                new_parts.append(part)
                params_offset += placeholders

        return new_parts, new_params, max_month

    def detect_plan_type(self,
                         query: str,
                         domain: str = None) -> Dict[str, Any]:
        """
        Detect if query is asking for Plan data (Budget/Forecast/CF) vs Actuals.
        Uses the PLAN_TYPE_MAPPING, PAGE_VIEW_MAPPING, etc. registries for normalization.
        Supports multi-tenant: uses domain to select company-specific mappings.
        
        Returns dict with:
        - is_plan_query: bool - True if should query cube_plan_data
        - plan_type: str or None - The plan_type filter value (normalized)
        - page: str or None - The page/view filter value (normalized)
        - entity: str or None - The entity filter value (normalized)
        - gb: str or None - The GB filter value (for MS GB view)
        - particulars: str or None - The metric/particulars filter (normalized)
        - sub_category: str or None - Average/End filter (normalized)
        - year: int or None - Extracted year filter
        - month: int or None - Extracted month filter
        - company: str or None - Detected company (bosch/nemko)
        - cube_id: str or None - Company-specific cube ID
        - statement_type: str or None - Nemko statement type (P&L, BS, Cash)
        - subsidiary: str or None - Nemko subsidiary
        """
        query_lower = ' ' + query.lower(
        ) + ' '  # Add spaces for word boundary matching

        # Get company configuration based on domain
        company_config = get_company_by_domain(domain)
        is_nemko = is_nemko_domain(domain) if domain else False

        result = {
            'is_plan_query': False,
            'plan_type': None,
            'page': None,
            'entity': None,
            'gb': None,
            'particulars': None,
            'sub_category': None,
            'year': None,
            'month': None,
            'company': 'nemko' if is_nemko else 'bosch',
            'cube_id': company_config.get('cube_id'),
            'statement_type': None,
            'subsidiary': None,
        }

        if is_nemko:
            # Nemko-specific plan type detection
            nemko_plan_type = detect_nemko_plan_type(query)
            if nemko_plan_type:
                result['plan_type'] = nemko_plan_type
                result['is_plan_query'] = not nemko_plan_type.startswith(
                    'Actual')

            # Nemko statement type detection
            result['statement_type'] = detect_nemko_statement_type(query)

            # Nemko subsidiary detection
            result['subsidiary'] = detect_nemko_subsidiary(query)

            # Route to correct cube based on statement type (P&L, Balance Sheet, Cash Flow)
            statement_specific_cube = get_cube_for_statement_type(
                company_config, result['statement_type'])
            if statement_specific_cube:
                result['cube_id'] = statement_specific_cube
                logger.debug(
                    f"Routed Nemko query to cube {statement_specific_cube} for statement type {result['statement_type']}"
                )

            logger.info(
                f"Nemko plan type detection: plan_type={result['plan_type']}, "
                f"statement_type={result['statement_type']}, subsidiary={result['subsidiary']}, cube_id={result['cube_id']}"
            )
        else:
            # Bosch-specific plan type detection (original logic)
            # Plan Type Detection - check longer patterns first (more specific)
            sorted_plan_types = sorted(PLAN_TYPE_MAPPING.items(),
                                       key=lambda x: -len(x[0]))
            for pattern, plan_type in sorted_plan_types:
                if pattern in query_lower or f' {pattern} ' in query_lower:
                    result['plan_type'] = plan_type
                    result['is_plan_query'] = plan_type != 'Actual'
                    break

            # Also check PLAN_KEYWORDS for is_plan_query detection
            if not result['is_plan_query']:
                for keyword in PLAN_KEYWORDS:
                    if keyword in query_lower:
                        result['is_plan_query'] = True
                        # Try to infer plan_type from keyword
                        if keyword in PLAN_TYPE_MAPPING:
                            result['plan_type'] = PLAN_TYPE_MAPPING[keyword]
                        break

        # Page/View Detection - check longer patterns first
        sorted_pages = sorted(PAGE_VIEW_MAPPING.items(),
                              key=lambda x: -len(x[0]))
        for pattern, page in sorted_pages:
            if pattern in query_lower or f' {pattern} ' in query_lower:
                result['page'] = page
                break

        # Entity Detection
        sorted_entities = sorted(ENTITY_MAPPING.items(),
                                 key=lambda x: -len(x[0]))
        for pattern, entity in sorted_entities:
            # Avoid matching 'worldwide' when looking for entity-specific values
            if pattern in ['worldwide', 'ww', 'world wide']:
                continue
            if pattern in query_lower or f' {pattern} ' in query_lower:
                result['entity'] = entity
                break

        # GB Detection (for MS GB view)
        sorted_gb = sorted(GB_MAPPING.items(), key=lambda x: -len(x[0]))
        for pattern, gb in sorted_gb:
            if pattern in query_lower or f' {pattern} ' in query_lower:
                result['gb'] = gb
                break

        # Particulars Detection - check longer patterns first
        sorted_particulars = sorted(PARTICULARS_MAPPING.items(),
                                    key=lambda x: -len(x[0]))
        for pattern, particulars in sorted_particulars:
            if pattern in query_lower:
                result['particulars'] = particulars
                break

        # Sub Category Detection - skip if the sub_cat keyword is already part of detected particulars
        detected_particulars_lower = (result.get('particulars') or '').lower()
        sorted_sub_cat = sorted(SUB_CATEGORY_MAPPING.items(),
                                key=lambda x: -len(x[0]))
        for pattern, sub_cat in sorted_sub_cat:
            # Skip if this sub_category pattern is already part of the particulars value
            if pattern in detected_particulars_lower:
                continue
            if pattern in query_lower or f' {pattern} ' in query_lower:
                result['sub_category'] = sub_cat
                break

        # Year/Month extraction
        year_match = re.search(r'\b(2024|2025|2026)\b', query_lower)
        if year_match:
            result['year'] = int(year_match.group(1))

        month_map = {
            'jan': 1,
            'feb': 2,
            'mar': 3,
            'apr': 4,
            'may': 5,
            'jun': 6,
            'jul': 7,
            'aug': 8,
            'sep': 9,
            'oct': 10,
            'nov': 11,
            'dec': 12
        }
        month_match = re.search(
            r'\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\b',
            query_lower)
        if month_match:
            month_key = month_match.group(1)[:3]
            result['month'] = month_map.get(month_key)

        logger.info(
            f"Plan type detection: is_plan={result['is_plan_query']}, plan_type={result['plan_type']}, "
            f"page={result['page']}, particulars={result['particulars']}, year={result['year']}, month={result['month']}"
        )
        return result

    def get_available_time_periods(self, cube_id: str) -> Dict[str, Any]:
        """
        Get available year and month values from cube_fact_data.
        Returns dict with 'years' and 'months' lists sorted descending.
        """
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            cursor.execute(
                """
                SELECT DISTINCT year, month 
                FROM cube_fact_data 
                WHERE cube_id = %s AND year IS NOT NULL AND month IS NOT NULL
                ORDER BY year DESC, month DESC
            """, (cube_id, ))

            rows = cursor.fetchall()
            cursor.close()
            conn.close()

            years = sorted(set(r['year'] for r in rows if r['year']),
                           reverse=True)
            months = rows  # Keep year-month pairs for more precise filtering

            return {
                'years': years,
                'year_months': [(r['year'], r['month']) for r in rows],
                'latest_year': years[0] if years else None,
                'latest_month': rows[0]['month'] if rows else None
            }
        except Exception as e:
            logger.warning(f"Could not get available time periods: {e}")
            return {
                'years': [],
                'year_months': [],
                'latest_year': None,
                'latest_month': None
            }

    def apply_default_time_filters(self, intent: Dict[str, Any], cube_id: str,
                                   time_scope: str) -> Dict[str, Any]:
        """
        Apply default time filters based on time_scope and available data.
        
        - 'default': Apply last 3 available months filter
        - 'all_available': No filter (show all data)
        - 'compare_years': Add both years to filter
        - 'specific': LLM already extracted filters, don't modify
        """
        if time_scope in ['specific', 'all_available']:
            # Either user specified time, or wants all data - don't add defaults
            logger.info(
                f"Time scope '{time_scope}': Skipping default time filter")
            return intent

        filters = intent.get('filters', [])

        # Check if year or month filter already exists
        has_year_filter = any(f.get('column') == 'year' for f in filters)
        has_month_filter = any(f.get('column') == 'month' for f in filters)

        if has_year_filter or has_month_filter:
            logger.info("Year/month filter already present, skipping default")
            return intent

        # Get available time periods
        time_periods = self.get_available_time_periods(cube_id)
        year_months = time_periods.get('year_months', [])

        if not year_months:
            logger.warning("No time periods available in data")
            return intent

        if time_scope == 'compare_years':
            # Add both available years for comparison
            years = time_periods.get('years', [])
            if len(years) >= 2:
                filters.append({
                    'column': 'year',
                    'operator': 'IN',
                    'value': years[:2]  # Last 2 years
                })
                logger.info(
                    f"Applied compare_years filter: years IN {years[:2]}")
            elif years:
                filters.append({
                    'column': 'year',
                    'operator': '=',
                    'value': years[0]
                })
                logger.info(f"Only one year available: {years[0]}")
        else:
            # Default: last 3 available months - stay within LATEST YEAR ONLY
            # to avoid cross-year tuple issues (e.g., Feb 2025, Jan 2025, Dec 2024)
            latest_year = time_periods.get('latest_year')
            if not latest_year:
                return intent

            # Filter to only the latest year's months
            latest_year_months = [(y, m) for y, m in year_months
                                  if y == latest_year]

            # Take up to 3 months from the latest year
            months_to_use = latest_year_months[:3]

            if not months_to_use:
                return intent

            # Add year filter (single year for simplicity)
            filters.append({
                'column': 'year',
                'operator': '=',
                'value': latest_year
            })

            # Add month filter
            unique_months = list(set(m for _, m in months_to_use))
            if len(unique_months) == 1:
                filters.append({
                    'column': 'month',
                    'operator': '=',
                    'value': unique_months[0]
                })
            else:
                filters.append({
                    'column': 'month',
                    'operator': 'IN',
                    'value': unique_months
                })

            logger.info(
                f"Applied default last-3-months filter for year {latest_year}: months {unique_months}"
            )

        intent['filters'] = filters
        return intent

    def _inject_time_from_query(self, intent: Dict[str, Any],
                                 query: str) -> Dict[str, Any]:
        """
        Explicitly extract year and month from query text and inject into intent filters.

        Used by fast-path sub-paths that bypass the LLM, because apply_default_time_filters
        skips 'specific' time_scope (assuming the LLM already parsed it).
        This fills that gap so "for mar 2025" becomes year=2025, month=3 in the filters.
        Only adds a filter if that column is not already present.
        """
        filters = intent.setdefault('filters', [])
        existing_cols = {f.get('column') for f in filters}

        # Year
        if 'year' not in existing_cols:
            yr_m = re.search(r'\b(20\d{2})\b', query)
            if yr_m:
                filters.append({
                    'column': 'year',
                    'operator': '=',
                    'value': int(yr_m.group(1))
                })
                logger.info(
                    f"_inject_time_from_query: injected year={yr_m.group(1)}")

        # Month — collect ALL months mentioned (longer names first to avoid partial matches).
        # When multiple months are detected, use IN operator and add month+year to group_by.
        if 'month' not in existing_cols:
            _MONTH_MAP = {
                'january': 1, 'february': 2, 'march': 3, 'april': 4,
                'may': 5, 'june': 6, 'july': 7, 'august': 8,
                'september': 9, 'october': 10, 'november': 11, 'december': 12,
                'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4,
                'jun': 6, 'jul': 7, 'aug': 8, 'sep': 9,
                'oct': 10, 'nov': 11, 'dec': 12,
            }
            q_lower = query.lower()
            _seen_months: set = set()
            for mname, mnum in sorted(_MONTH_MAP.items(), key=lambda x: -len(x[0])):
                if re.search(r'\b' + mname + r'\b', q_lower) and mnum not in _seen_months:
                    _seen_months.add(mnum)
            _detected_months = sorted(_seen_months)
            if len(_detected_months) == 1:
                filters.append({
                    'column': 'month',
                    'operator': '=',
                    'value': _detected_months[0]
                })
                logger.info(
                    f"_inject_time_from_query: injected month={_detected_months[0]}")
            elif len(_detected_months) > 1:
                filters.append({
                    'column': 'month',
                    'operator': 'IN',
                    'value': _detected_months
                })
                # Auto-add month and year to group_by so each month appears as its own row
                _gb = intent.setdefault('group_by', ['region_entity'])
                if 'month' not in _gb:
                    intent['group_by'] = ['month'] + _gb
                if 'year' not in intent.get('group_by', []):
                    intent['group_by'] = intent.get('group_by', []) + ['year']
                logger.info(
                    f"_inject_time_from_query: injected month IN {_detected_months}, added month+year to group_by")

        intent['filters'] = filters
        return intent

    def load_business_logic_context(self, cube_id: str) -> Dict[str, Any]:
        """
        Load business logic context for a cube including:
        - Business terms with SQL filters
        - Calculation formulas
        - Filter rules
        - Known column values for entity matching
        """
        if not SCHEMA_CONTEXT_AVAILABLE:
            return {
                "context": "",
                "column_values": {},
                "calculations": [],
                "filters": []
            }

        try:
            # Get business logic context text for LLM
            business_context = schema_context_builder.build_business_logic_context(
                cube_id)

            # Get column values for fuzzy matching
            all_logic = schema_context_builder.get_all_business_logic(cube_id)

            # Build column value lookup for fuzzy matching
            column_values = {}
            for cv in all_logic.get("column_values", []):
                col = cv.get("column_name", "")
                val = cv.get("value_name", "")
                aliases = cv.get("value_aliases", []) or []

                if col not in column_values:
                    column_values[col] = []
                column_values[col].append({
                    "value":
                    val,
                    "aliases":
                    aliases,
                    "description":
                    cv.get("value_description", "")
                })

            return {
                "context": business_context,
                "column_values": column_values,
                "calculations": all_logic.get("calculations", []),
                "filters": all_logic.get("filters", []),
                "terms": all_logic.get("terms", []),
                "patterns": all_logic.get("patterns", [])
            }
        except Exception as e:
            logger.warning(f"Could not load business logic context: {e}")
            return {
                "context": "",
                "column_values": {},
                "calculations": [],
                "filters": []
            }

    def resolve_entity_from_query(
            self,
            query: str,
            business_logic: Dict[str, Any],
            dimension_values: Dict[str, List] = None) -> List[Dict[str, Any]]:
        """
        Extract entity filters from query by matching against known column values.
        Falls back to dimension_values if business logic column_values is empty.
        Returns list of filters to apply.
        """
        filters = []
        query_lower = query.lower()

        kpi_protected_terms = {
            'internal': [
                'internal capacity mix', 'internal mix', 'internal capacity',
                'internal utilization', 'internal headcount'
            ],
            'external': [
                'external capacity mix', 'external mix', 'external capacity',
                'outsourcing capacity', 'outsourcing mix', 'outsourcing ratio'
            ],
            'offshore': [
                'offshore capacity', 'offshore avg', 'offshore end',
                'offshore average', 'offshore budget', 'onsite offshore'
            ],
        }

        # Cost-type phrases: when user says "corporate cost", "resource cost", etc.
        # the words "corporate", "resource", "travel", "direct", "indirect" must NOT
        # be matched as new_service_area / sector / entity_category aliases.
        _cost_type_phrases = [
            'corporate cost', 'corporate costs',
            'resource cost', 'resource costs',
            'travel cost', 'travel costs',
            'direct cost', 'direct costs', 'total direct cost',
            'indirect cost', 'indirect costs',
            'other direct cost', 'other direct costs',
            'gross margin', 'gross profit',
            'ebit',
        ]
        _is_cost_type_query = any(phrase in query_lower for phrase in _cost_type_phrases)

        skip_columns_for_kpi = set()
        for term, phrases in kpi_protected_terms.items():
            if any(phrase in query_lower for phrase in phrases):
                skip_columns_for_kpi.add('resource type')
                skip_columns_for_kpi.add('resource_type')
                skip_columns_for_kpi.add('sector')
                skip_columns_for_kpi.add('onsite_offshore')
                skip_columns_for_kpi.add('onsite/offshore')

        # For cost-type queries: skip new_service_area, entity_category, and sector
        # to prevent "corporate" → new_service_area=CORPORATE false-positive matches.
        if _is_cost_type_query:
            skip_columns_for_kpi.add('new_service_area')
            skip_columns_for_kpi.add('new service area')
            skip_columns_for_kpi.add('entity_category')
            skip_columns_for_kpi.add('entity category')
            skip_columns_for_kpi.add('sector')

        column_values = business_logic.get("column_values", {})

        # Short common words / pronouns that must never be matched as entity codes
        _STOPWORDS = {
            "me", "my", "i", "we", "us", "our", "you", "your", "it", "its",
            "he", "she", "him", "her", "they", "them", "is", "am", "are",
            "be", "do", "on", "in", "at", "to", "of", "or", "an", "a",
        }

        def _term_in_query(term: str, q: str) -> bool:
            """Match term in query. Short terms (< 4 chars) require whole-word match."""
            if not term:
                return False
            if term.lower() in _STOPWORDS:
                return False
            if len(term) < 4:
                return bool(re.search(r'\b' + re.escape(term) + r'\b', q, re.IGNORECASE))
            return term in q

        for column_name, values in column_values.items():
            if column_name.lower() in skip_columns_for_kpi:
                continue

            for val_info in values:
                val = val_info.get("value", "")
                aliases = val_info.get("aliases", []) or []

                # Check if value or any alias is mentioned in query
                val_lower = val.lower() if val else ""
                if val_lower and _term_in_query(val_lower, query_lower):
                    if column_name.lower() in ('region_entity',
                                               'region/entity'):
                        filters.append({
                            "column": column_name,
                            "operator": "=",
                            "value": val,
                            "matched_term": val
                        })
                        # Don't break — multiple entities (e.g. BGSW + BGSV) can
                        # appear in the same query ("Compare BGSW and BGSV …").
                        # Prefix-dedup in the D1 block below removes false extras
                        # like 'BGSW' when 'BGSW/NE-MX' was already matched.
                        continue
                    else:
                        filters.append({
                            "column": column_name,
                            "operator": "ILIKE",
                            "value": f"%{val}%",
                            "matched_term": val
                        })
                    break

                for alias in aliases:
                    alias_lower = alias.lower() if alias else ""
                    if alias_lower and _term_in_query(alias_lower, query_lower):
                        if column_name.lower() in ('region_entity',
                                                   'region/entity'):
                            filters.append({
                                "column": column_name,
                                "operator": "=",
                                "value": val,
                                "matched_term": alias
                            })
                        else:
                            filters.append({
                                "column": column_name,
                                "operator": "ILIKE",
                                "value": f"%{val}%",
                                "matched_term": alias
                            })
                        break

        # Fallback: if no business logic column values, use dimension_values from cube
        if not filters and dimension_values:
            region_entities = dimension_values.get("region_entity", [])
            sorted_entities = sorted(region_entities,
                                     key=lambda x: len(str(x)),
                                     reverse=True)
            for entity in sorted_entities:
                if entity and str(entity).lower() in query_lower:
                    filters.append({
                        "column": "region_entity",
                        "operator": "=",
                        "value": str(entity),
                        "matched_term": entity
                    })
                    break

        # Supplement with common entity abbreviations.
        # Always runs — even when column_values already produced region_entity filters —
        # so entities absent from column_values (e.g. BGSV not seeded) are still caught.
        # List is longest-first so prefix-dedup below correctly handles BGSW vs BGSW/NE-MX.
        _common_entities = [
            "bgsw/ne-mx", "bgsw/ebs-pl", "bgsw", "bgsv", "bgw"
        ]
        _existing_re_vals_lower = {
            f['value'].lower() for f in filters
            if f.get('column', '').lower() in ('region_entity', 'region/entity')
        }
        for abbrev in _common_entities:
            if abbrev not in query_lower:
                continue
            if abbrev in _existing_re_vals_lower:
                continue  # Already found via column_values path — skip
            # Skip if this abbrev is a prefix of a longer already-collected value
            # e.g. skip 'bgsw' when 'bgsw/ne-mx' was already added
            if any(existing.startswith(abbrev) and existing != abbrev
                   for existing in _existing_re_vals_lower):
                continue
            filters.append({
                "column": "region_entity",
                "operator": "=",
                "value": abbrev.upper(),
                "matched_term": abbrev
            })
            _existing_re_vals_lower.add(abbrev)

        # D1: Consolidate multiple region_entity scalar filters into a single IN filter.
        # Multiple "= X" filters for the same column are deduplicated by most WHERE-clause
        # builders (only the first survives), so we merge them here before returning.
        # Also removes prefix duplicates: 'BGSW' is dropped when 'BGSW/NE-MX' was matched.
        _re_fs = [
            f for f in filters
            if f.get('column', '').lower() in ('region_entity', 'region/entity')
        ]
        _other_fs = [
            f for f in filters
            if f.get('column', '').lower() not in ('region_entity', 'region/entity')
        ]
        if len(_re_fs) > 1:
            _re_vals_lower = [f['value'].lower() for f in _re_fs]
            # Prefix-dedup: remove a value if a longer matched value starts with it
            _re_fs = [
                f for f in _re_fs
                if not any(
                    other.startswith(f['value'].lower()) and other != f['value'].lower()
                    for other in _re_vals_lower
                )
            ]
        if len(_re_fs) > 1:
            _entity_vals = [f['value'] for f in _re_fs]
            filters = _other_fs + [{
                'column': 'region_entity',
                'operator': 'IN',
                'value': _entity_vals
            }]
        else:
            filters = _other_fs + _re_fs

        return filters

    def detect_gb_view_filter(self, query: str) -> Optional[Dict[str, Any]]:
        """
        Detect GB/Project view filters from query for MS, SX, and GB views.
        Returns filter dict with sector, new_service_area, or project_gb column based on view type.
        
        ============================================
        FROZEN VIEW FILTER DEFINITIONS - DO NOT MODIFY
        ============================================
        
        FROZEN Business Logic for Views (Capacity Metrics):
        - Entity View: No sector filter, excludes Corporate service areas
        - MS View: new_service_area = 'MS' AND sector = 'BBM'
        - SX View: new_service_area = 'SX' AND sector IN ('BBE', 'BBG', 'BBI', 'OTHERS')
        - GB View - VM: new_service_area = 'MS' AND sector = 'BBM' AND project_gb = 'VM'
        - GB View - PS: new_service_area = 'MS' AND sector = 'BBM' AND project_gb = 'PS'
        - GB View - XC: new_service_area = 'MS' AND sector = 'BBM' AND project_gb = 'XC'
        
        FROZEN Business Logic for Views (Billing Metrics):
        - MS View Billing: sector = 'BBM' (new_service_area is NULL in billing data)
        - SX View Billing: sector IN ('BBE', 'BBG', 'BBI', 'OTHERS')
        
        Query Patterns Detected:
        - "for MS View", "for SX View", "for VM View" (suffix)
        - "MS offshore capacity...", "SX offshore capacity..." (prefix)
        - "for MB PS View", "for MB PV View"
        ============================================
        """
        query_lower = query.lower()
        # Normalize multiple consecutive spaces to a single space
        # (prevents double-space queries like "PS  Revenue" from missing triggers like " ps revenue")
        query_norm = re.sub(r'\s+', ' ', query_lower).strip()

        # MS/GB specific views (check first as they're more specific)
        # These are subsets of MS view (Sector = BBM) filtered by specific project_gb
        gb_view_triggers = {
            # VM view — "ms gb vm", "ms vm", "gb vm", plus KPI phrases
            'vm view': 'VM',
            'by vm': 'VM',
            'for vm': 'VM',
            'vm gb': 'VM',
            'vm project': 'VM',
            'ms gb vm': 'VM',
            'ms vm': 'VM',
            'gb vm': 'VM',
            ' vm outsourcing': 'VM',
            ' vm capacity': 'VM',
            ' vm revenue': 'VM',
            ' vm offshore': 'VM',
            ' vm headcount': 'VM',
            ' vm billing': 'VM',
            ' vm utilization': 'VM',
            ' vm attrition': 'VM',
            ' vm budget': 'VM',
            ' vm ebit': 'VM',
            ' vm pyramid': 'VM',
            ' vm mix': 'VM',
            ' vm price mix': 'VM',
            # PS view — "ms gb ps", "ms ps", "gb ps", plus KPI phrases
            'ps view': 'PS',
            'by ps': 'PS',
            'for ps': 'PS',
            'ps gb': 'PS',
            'ps project': 'PS',
            'for mb ps view': 'PS',
            'mb ps view': 'PS',
            'for mb pv view': 'PS',
            'mb pv view': 'PS',
            'ms gb ps': 'PS',
            'ms ps': 'PS',
            'gb ps': 'PS',
            ' ps outsourcing': 'PS',
            ' ps capacity': 'PS',
            ' ps revenue': 'PS',
            ' ps offshore': 'PS',
            ' ps headcount': 'PS',
            ' ps billing': 'PS',
            ' ps utilization': 'PS',
            ' ps attrition': 'PS',
            ' ps budget': 'PS',
            ' ps ebit': 'PS',
            ' ps pyramid': 'PS',
            ' ps mix': 'PS',
            ' ps price mix': 'PS',
            # XC view (excl CVO) — "ms gb xc", "ms xc", "xc cvo", plus KPI phrases
            'xc view': 'XC',
            'by xc': 'XC',
            'for xc': 'XC',
            'xc gb': 'XC',
            'xc excl cvo': 'XC',
            'xc excl': 'XC',
            'xc cvo': 'XC',
            'xc project': 'XC',
            'ms gb xc': 'XC',
            'ms xc': 'XC',
            'gb xc': 'XC',
            ' xc outsourcing': 'XC',
            ' xc capacity': 'XC',
            ' xc revenue': 'XC',
            ' xc offshore': 'XC',
            ' xc headcount': 'XC',
            ' xc billing': 'XC',
            ' xc utilization': 'XC',
            ' xc attrition': 'XC',
            ' xc budget': 'XC',
            ' xc ebit': 'XC',
            ' xc pyramid': 'XC',
            ' xc mix': 'XC',
            ' xc price mix': 'XC',
        }

        for trigger, gb_value in gb_view_triggers.items():
            if trigger in query_norm:
                logger.info(
                    f"FROZEN: Detected GB view filter: new_service_area='MS' AND project_gb='{gb_value}' AND include_exclude='Include' from trigger '{trigger}'"
                )
                # FROZEN: GB-specific views (PS/VM/XC)
                # SQL: WHERE new_service_area='MS' AND include_exclude='Include' AND project_gb='{gb_value}'
                # GROUP BY project_gb
                # NO sector filter (per spec SQL — only new_service_area='MS' is needed)
                # include_exclude='Include' is added automatically via is_ww_query logic in _fix_cost_category_and_metrics
                return {
                    "column": "new_service_area",
                    "operator": "=",
                    "value": "MS",
                    "view_type": f"{gb_value} View",
                    "project_gb_filter": {
                        "column": "project_gb",
                        "operator": "=",
                        "value": gb_value
                    },
                    "group_by_hint": ["project_gb"]
                }

        # ============================================
        # FROZEN: MS View Filter Logic
        # Uses: new_service_area = 'MS' AND sector = 'BBM'
        # ============================================
        ms_triggers = [
            'ms view', 'ms delivery', 'for ms', 'by ms delivery', 'ms sector',
            'the ms', 'ms offshore', 'ms capacity', 'ms revenue', 'ms budget',
            'ms billing', 'ms attrition', 'ms utilization', 'ms headcount',
            'ms pyramid', 'ms mix', 'ms price mix'
        ]
        for trigger in ms_triggers:
            if trigger in query_norm:
                logger.info(
                    f"FROZEN: Detected MS view filter: new_service_area='MS' AND sector='BBM' AND project_gb NOT IN ('CVO') from trigger '{trigger}'"
                )
                return {
                    "column": "new_service_area",
                    "operator": "=",
                    "value": "MS",
                    "view_type": "MS View",
                    "sector_filter": {
                        "column": "sector",
                        "operator": "=",
                        "value": "BBM"
                    # },
                    # "cvo_exclusion_filter": {
                    #     "column": "project_gb",
                    #     "operator": "NOT IN",
                    #     "value": ["CVO"]
                    }
                }

        # MS prefix pattern: query starts with "ms " (e.g., "MS offshore capacity end by entity")
        if re.match(r'^ms\s+\w', query_lower):
            logger.info(
                f"FROZEN: Detected MS view filter from prefix pattern: query starts with 'MS ' — excluding CVO"
            )
            return {
                "column": "new_service_area",
                "operator": "=",
                "value": "MS",
                "view_type": "MS View",
                "sector_filter": {
                    "column": "sector",
                    "operator": "=",
                    "value": "BBM"
                # },
                # "cvo_exclusion_filter": {
                #     "column": "project_gb",
                #     "operator": "NOT IN",
                #     "value": ["CVO"]
                }
            }

        # ============================================
        # FROZEN: SX View Filter Logic
        # Uses: new_service_area = 'SX' AND sector IN ('BBE', 'BBG', 'BBI', 'OTHERS')
        # ============================================
        sx_triggers = [
            'sx view', 'sx delivery', 'for sx', 'by sx delivery', 'sx sector',
            'the sx', 'sx offshore', 'sx capacity', 'sx revenue', 'sx budget',
            'sx billing', 'sx attrition', 'sx utilization', 'sx headcount',
            'sx pyramid', 'sx mix', 'sx price mix'
        ]
        for trigger in sx_triggers:
            if trigger in query_norm:
                logger.info(
                    f"FROZEN: Detected SX view filter: new_service_area='SX' AND sector IN ('BBE','BBG','BBI','OTHERS') from trigger '{trigger}'"
                )
                return {
                    "column": "new_service_area",
                    "operator": "=",
                    "value": "SX",
                    "view_type": "SX View",
                    "sector_filter": {
                        "column": "sector",
                        "operator": "IN",
                        "value": ["BBE", "BBG", "BBI", "OTHERS"]
                    }
                }

        # SX prefix pattern: query starts with "sx " (e.g., "SX offshore capacity end by entity")
        if re.match(r'^sx\s+\w', query_lower):
            logger.info(
                f"FROZEN: Detected SX view filter from prefix pattern: query starts with 'SX '"
            )
            return {
                "column": "new_service_area",
                "operator": "=",
                "value": "SX",
                "view_type": "SX View",
                "sector_filter": {
                    "column": "sector",
                    "operator": "IN",
                    "value": ["BBE", "BBG", "BBI", "OTHERS"]
                }
            }

        # MS/GB combined view - all BBM sector data grouped by project_gb
        if 'ms/gb view' in query_norm or 'ms gb view' in query_norm:
            logger.info(
                "Detected MS/GB combined view - sector = 'BBM' grouped by project_gb"
            )
            return {
                "column": "sector",
                "operator": "=",
                "value": "BBM",
                "view_type": "MS/GB View",
                "group_by_gb": True
            }

        # ================================================================
        # REGEX FALLBACK: word-boundary match for standalone PS/VM/XC
        # Last resort — fires only if no MS/SX trigger matched.
        # Catches: "ps revenue for mar 2025" (no leading space / prefix),
        #          "PS capacity", "what is PS budget" etc.
        # Requires a KPI keyword to avoid false-positives.
        # ================================================================
        _gb_regex_map = [
            (r'\bps\b', 'PS'),
            (r'\bvm\b', 'VM'),
            (r'\bxc\b', 'XC'),
        ]
        _kpi_keywords = [
            'revenue', 'capacity', 'budget', 'billing', 'utilization',
            'headcount', 'attrition', 'offshore', 'ebit', 'outsourcing',
            'pyramid', 'mix', 'price mix'
        ]
        if any(kw in query_norm for kw in _kpi_keywords):
            for _gb_pat, gb_value in _gb_regex_map:
                if re.search(_gb_pat, query_norm):
                    logger.info(
                        f"FROZEN: Detected GB view filter via word-boundary regex (last resort): "
                        f"new_service_area='MS' AND project_gb='{gb_value}' from pattern '{_gb_pat}'"
                    )
                    return {
                        "column": "new_service_area",
                        "operator": "=",
                        "value": "MS",
                        "view_type": f"{gb_value} View",
                        "project_gb_filter": {
                            "column": "project_gb",
                            "operator": "=",
                            "value": gb_value
                        },
                        "group_by_hint": ["project_gb"]
                    }

        return None

    def get_matching_calculation(
            self, query: str,
            business_logic: Dict[str, Any],
            return_all: bool = False):
        """
        Find a matching calculation rule for the query.
        Detects KPI keywords like 'billing utilization', 'price mix', 'attrition rate', etc.

        If return_all=True, returns a List[Dict] of ALL distinct matching calcs found in the
        query (used for multi-metric detection).  Otherwise returns the first match or None.
        """
        query_lower = query.lower()

        # Check trigger keywords FIRST (sorted longest-first for specificity)
        # This ensures "pyramid mix by salary level" matches before "pyramid mix"
        # Additional trigger keyword detection for common KPI phrases
        kpi_triggers = {
            'price mix': 'Price Mix Ratio',
            'pricing mix': 'Price Mix Ratio',
            'premium ratio': 'Price Mix Ratio',
            'rate classification': 'Price Mix Ratio',
            'attrition rate': 'Attrition Percentage',
            'attrition %': 'Attrition Percentage',
            'attrition percent': 'Attrition Percentage',
            'employee churn': 'Attrition Percentage',
            'churn rate': 'Attrition Percentage',
            'attrition': 'Attrition Percentage',
            'billing utilization': 'Billing Utilization',
            'capacity utilization': 'Billing Utilization',
            'utilization rate': 'Billing Utilization',
            'utilization %': 'Billing Utilization',
            'ebit': 'EBIT Percentage',
            'profit margin': 'EBIT Percentage',
            'operating margin': 'EBIT Percentage',
            'pyramid mix': 'Pyramid Mix',
            'skill pyramid': 'Pyramid Mix',
            'junior-senior mix': 'Pyramid Mix',
            'sl48': 'Pyramid Mix',
            'pyramid mix by salary level': 'Pyramid Mix By Salary Level',
            'pyramid by salary level': 'Pyramid Mix By Salary Level',
            'pyramid salary level': 'Pyramid Mix By Salary Level',
            'pyramid mix salary': 'Pyramid Mix By Salary Level',
            'pyramid individual': 'Pyramid Mix Individual Levels',
            'pyramid breakdown': 'Pyramid Mix Individual Levels',
            'pyramid by sl': 'Pyramid Mix Individual Levels',
            'pyramid mix breakdown': 'Pyramid Mix Individual Levels',
            'pyramid mix individual': 'Pyramid Mix Individual Levels',
            'pyramid 48 49 50 51': 'Pyramid Mix Individual Levels',
            'pyramid salarylevel': 'Pyramid Mix Individual Levels',
            'pyramid by salarylevel': 'Pyramid Mix Individual Levels',
            'pyramid and salarylevel': 'Pyramid Mix Individual Levels',
            'pyramid mix salarylevel': 'Pyramid Mix Individual Levels',
            'internal capacity mix': 'Internal Capacity Mix',
            'internal mix': 'Internal Capacity Mix',
            'external capacity mix': 'External Capacity Mix',
            'external mix': 'External Capacity Mix',
            'outsourcing mix': 'External Capacity Mix',
            'outsourcing ratio': 'External Capacity Mix',
            'budget per capacity': 'Budget per Capacity',
            'revenue per capacity': 'Budget per Capacity',
            'budget efficiency': 'Budget per Capacity',
            # New WW KPIs
            'offshore budget': 'Budget Offshore',
            'budget offshore': 'Budget Offshore',
            'offshore revenue': 'Budget Offshore',
            'outsourcing budget': 'Budget Outsourcing',
            'budget outsourcing': 'Budget Outsourcing',
            'outsourcing revenue': 'Budget Outsourcing',
            'total capacity avg': 'Total Capacity Avg',
            'total avg capacity': 'Total Capacity Avg',
            'average total capacity': 'Total Capacity Avg',
            'ww total capacity': 'Total Capacity Avg',
            'total capacity end': 'Total Capacity End',
            'total end capacity': 'Total Capacity End',
            'end total capacity': 'Total Capacity End',
            'ww end capacity': 'Total Capacity End',
            'offshore capacity avg': 'Offshore Capacity Avg',
            'offshore avg capacity': 'Offshore Capacity Avg',
            'average offshore capacity': 'Offshore Capacity Avg',
            'offshore average capacity': 'Offshore Capacity Avg',
            'offshore capacity average': 'Offshore Capacity Avg',
            'avg offshore capacity': 'Offshore Capacity Avg',
            'offshore capacity end': 'Offshore Capacity End',
            'offshore end capacity': 'Offshore Capacity End',
            'end offshore capacity': 'Offshore Capacity End',
            'outsourcing capacity avg': 'Outsourcing Capacity Avg',
            'outsourcing avg capacity': 'Outsourcing Capacity Avg',
            'average outsourcing capacity': 'Outsourcing Capacity Avg',
            'outsourcing average capacity': 'Outsourcing Capacity Avg',
            'outsourcing capacity average': 'Outsourcing Capacity Avg',
            'avg outsourcing capacity': 'Outsourcing Capacity Avg',
            'outsourcing capacity end': 'Outsourcing Capacity End',
            'outsourcing end capacity': 'Outsourcing Capacity End',
            # Bare terms — no end/avg qualifier → default to end (point-in-time)
            'outsourcing capacity': 'Outsourcing Capacity End',
            'offshore capacity': 'Offshore Capacity End',
            'total capacity': 'Total Capacity End',
            # Bare mix terms
            'capacity mix': 'Internal Capacity Mix',
            'offshore mix': 'External Capacity Mix',
            # WW triggers — only when user explicitly says worldwide/ww/global
            'budget per avg capacity worldwide': 'Budget Per Avg Capacity WW',
            'budget per average capacity worldwide': 'Budget Per Avg Capacity WW',
            'worldwide budget per avg capacity': 'Budget Per Avg Capacity WW',
            'worldwide budget per average capacity': 'Budget Per Avg Capacity WW',
            'world wide budget per avg capacity': 'Budget Per Avg Capacity WW',
            'ww budget per avg capacity': 'Budget Per Avg Capacity WW',
            'ww budget avg capacity': 'Budget Per Avg Capacity WW',
            'global budget per avg capacity': 'Budget Per Avg Capacity WW',
            'global budget avg capacity': 'Budget Per Avg Capacity WW',
            'budget avg capacity worldwide': 'Budget Per Avg Capacity WW',
            'budget avg capacity ww': 'Budget Per Avg Capacity WW',
            'budget avg capacity global': 'Budget Per Avg Capacity WW',
            'budget per avg capacity ww': 'Budget Per Avg Capacity WW',
            'budget per avg capacity global': 'Budget Per Avg Capacity WW',
            'budget/avg capacity worldwide': 'Budget Per Avg Capacity WW',
            'budget/avg capacity ww': 'Budget Per Avg Capacity WW',
            'budget/avg capacity global': 'Budget Per Avg Capacity WW',
            'worldwide budget avg capacity': 'Budget Per Avg Capacity WW',
            'world wide budget avg capacity': 'Budget Per Avg Capacity WW',
            # Entity View triggers — default for all other budget/avg capacity queries
            'budget per avg capacity by entity': 'Budget Per Avg Capacity Entity',
            'budget per average capacity by entity': 'Budget Per Avg Capacity Entity',
            'budget per avg capacity entity': 'Budget Per Avg Capacity Entity',
            'budget per average capacity entity': 'Budget Per Avg Capacity Entity',
            'entity budget per avg capacity': 'Budget Per Avg Capacity Entity',
            'entity budget per average capacity': 'Budget Per Avg Capacity Entity',
            'budget avg capacity by entity': 'Budget Per Avg Capacity Entity',
            'budget/avg capacity by entity': 'Budget Per Avg Capacity Entity',
            'budget/ avg capacity by entity': 'Budget Per Avg Capacity Entity',
            # Generic budget/avg capacity → Entity by default (entity-level is the common case)
            'budget per avg capacity': 'Budget Per Avg Capacity Entity',
            'budget per average capacity': 'Budget Per Avg Capacity Entity',
            'budget avg capacity': 'Budget Per Avg Capacity Entity',
            'budget/avg capacity': 'Budget Per Avg Capacity Entity',
            'budget/ avg capacity': 'Budget Per Avg Capacity Entity',
            'average capacity budget': 'Budget Per Avg Capacity Entity',
            'budget average capacity': 'Budget Per Avg Capacity Entity',
            'budget capacity avg': 'Budget Per Avg Capacity Entity',
            # CTG Adjustment triggers
            'ctg adjustment': 'CTG Adjustment',
            'ctg': 'CTG Adjustment',
            'ctg value': 'CTG Adjustment',
            'cost target guidance': 'CTG Adjustment',
            'capacity target guidance': 'CTG Adjustment',
            'plan adjustment': 'CTG Adjustment',
            'plan vs actual': 'Plan vs Actual Comparison',
            'plan actual': 'Plan vs Actual Comparison',
            'plan versus actual': 'Plan vs Actual Comparison',
            'actual vs plan': 'Plan vs Actual Comparison',
            # Revenue Summary triggers
            'revenue summary': 'Revenue Summary',
            'total revenue': 'Revenue Summary',
            'revenue by entity': 'Revenue Summary',
            'revenue by region': 'Revenue Summary',
            'revenue for': 'Revenue Summary',
            'revenue in': 'Revenue Summary',
            'revenue this': 'Revenue Summary',
            'what is revenue': 'Revenue Summary',
            'what was revenue': 'Revenue Summary',
            'worldwide revenue': 'Revenue Summary',
            'world wide revenue': 'Revenue Summary',
            'ww revenue': 'Revenue Summary',
            'global revenue': 'Revenue Summary',
            'world revenue': 'Revenue Summary',
            'revenue worldwide': 'Revenue Summary',
            'revenue global': 'Revenue Summary',
            'revenue ww': 'Revenue Summary',
            'Budget': 'Revenue Summary',
            # Available Capacity triggers - uses correct formula: Allocated + Not Allocated + M/S + VKM - Non Linear
            'available capacity': 'Available Capacity',
            'availability capacity': 'Available Capacity',
            'total available capacity': 'Available Capacity',
            'capacity available': 'Available Capacity',
            'available cap': 'Available Capacity',
            'travel cost breakdown': 'Travel Cost',
            'travel cost by subcategory': 'Travel Cost',
            'travel cost': 'Travel Cost',
            'travel expense': 'Travel Cost',
            'travel expenses': 'Travel Cost',
            'total direct cost': 'Direct Cost',
            'direct cost breakdown': 'Direct Cost',
            'direct cost': 'Direct Cost',
            'direct expenses': 'Direct Cost',
            'direct expense': 'Direct Cost',
            'total indirect cost': 'Indirect Cost',
            'indirect cost breakdown': 'Indirect Cost',
            'indirect cost': 'Indirect Cost',
            'indirect expenses': 'Indirect Cost',
            'indirect expense': 'Indirect Cost',
            'corporate cost': 'Indirect Cost',
            'corporate expenses': 'Indirect Cost',
            'gross margin breakdown': 'Gross Margin',
            'gross margin': 'Gross Margin',
            'gross profit': 'Gross Margin',
            'resource cost breakdown': 'Resource Cost',
            'resource cost': 'Resource Cost',
            'resource expense': 'Resource Cost',
            'resource expenses': 'Resource Cost',
            'other direct cost breakdown': 'Other Direct Cost',
            'other direct cost': 'Other Direct Cost',
            'other direct expense': 'Other Direct Cost',
            'other direct expenses': 'Other Direct Cost'
        }

        # Sort triggers by length (longest first) to match more specific triggers first
        # e.g., "budget per avg capacity" should match before "budget per capacity"
        sorted_triggers = sorted(kpi_triggers.items(),
                                 key=lambda x: len(x[0]),
                                 reverse=True)

        # ── return_all mode: collect EVERY distinct calc name that fires ──────
        if return_all:
            seen_names: Dict[str, Any] = {}  # calc_name → calc dict (dedup)
            for trigger, calc_name in sorted_triggers:
                if trigger in query_lower and calc_name not in seen_names:
                    # Look up full calc object
                    for calc in business_logic.get("calculations", []):
                        if calc.get("calculation_name", "").lower() == calc_name.lower():
                            seen_names[calc_name] = calc
                            break
                    else:
                        seen_names[calc_name] = {"calculation_name": calc_name, "triggered_by": trigger}
            return list(seen_names.values())

        # ── normal mode: return first match (existing behaviour) ──────────────

        # First pass: Exact substring match
        for trigger, calc_name in sorted_triggers:
            if trigger in query_lower:
                logger.info(
                    f"Matched calculation by trigger '{trigger}': {calc_name}")
                # Find the full calculation object
                for calc in business_logic.get("calculations", []):
                    if calc.get("calculation_name",
                                "").lower() == calc_name.lower():
                        return calc
                # Return minimal info if not found in business_logic
                return {"calculation_name": calc_name, "triggered_by": trigger}

        # Second pass: Fuzzy matching for typos (only if no exact match found)
        # Use word-level similarity to catch misspellings
        fuzzy_match = self._fuzzy_match_calculation(query_lower,
                                                    sorted_triggers,
                                                    business_logic)
        if fuzzy_match:
            return fuzzy_match

        # Third pass: Check database calculation names as fallback
        # Sorted by name length (longest first) for specificity
        sorted_calcs = sorted(business_logic.get("calculations", []),
                              key=lambda c: len(c.get("calculation_name", "")),
                              reverse=True)
        for calc in sorted_calcs:
            calc_name = calc.get("calculation_name", "").lower()
            if calc_name and calc_name in query_lower:
                logger.info(
                    f"Matched calculation by name: {calc.get('calculation_name')}"
                )
                return calc

            for alias in (calc.get("calculation_aliases") or []):
                if alias and alias.lower() in query_lower:
                    logger.info(
                        f"Matched calculation by alias '{alias}': {calc.get('calculation_name')}"
                    )
                    return calc

        return None

    def _fuzzy_match_calculation(
            self, query_lower: str, sorted_triggers: list,
            business_logic: Dict) -> Optional[Dict[str, Any]]:
        """
        Fuzzy matching for calculation triggers to handle typos.
        Uses word-level similarity comparison.
        """
        from difflib import SequenceMatcher

        # WW budget metrics must NEVER fuzzy-match — they are highly specific WW-only metrics.
        # "budget for BGSW" should not fuzzy-match to "budget offshore" just because
        # "for" and "offshore" share the characters f, o, r (giving ~0.55 similarity).
        # These calcs require an exact trigger match; fuzzy is too loose.
        _exact_match_only_calcs = {
            'Budget Offshore', 'Budget Outsourcing', 'Budget Total WW',
            'Budget Per Avg Capacity WW'
        }

        # View-trigger words: when any of these appear in the query, WW-budget metrics
        # must also be skipped (belt-and-suspenders with the exact-match-only guard above).
        _view_trigger_words = {'sx', 'ms', 'vm', 'ps', 'xc'}
        _ww_budget_calcs = _exact_match_only_calcs
        query_has_view_trigger = any(
            bool(re.search(r'\b' + re.escape(vt) + r'\b', query_lower))
            for vt in _view_trigger_words
        )

        query_words = query_lower.split()
        best_match = None
        best_score = 0.0
        threshold = 0.75  # Minimum similarity for a match

        for trigger, calc_name in sorted_triggers:
            # ALWAYS skip exact-match-only calcs from fuzzy matching — they are too specific
            # and too prone to false positives (e.g. "budget for BGSW" → "budget offshore").
            if calc_name in _exact_match_only_calcs:
                continue
            # Also skip WW budget metrics when a view trigger is present (belt-and-suspenders)
            if query_has_view_trigger and calc_name in _ww_budget_calcs:
                continue
            trigger_words = trigger.split()

            # Try to find a contiguous sequence of words that match the trigger
            for start_idx in range(len(query_words)):
                # Extract window of same length as trigger
                end_idx = min(start_idx + len(trigger_words), len(query_words))
                window_words = query_words[start_idx:end_idx]

                if len(window_words) != len(trigger_words):
                    continue

                # Calculate word-by-word similarity
                total_similarity = 0.0
                for qw, tw in zip(window_words, trigger_words):
                    # Use SequenceMatcher for character-level similarity
                    ratio = SequenceMatcher(None, qw, tw).ratio()
                    total_similarity += ratio

                avg_similarity = total_similarity / len(trigger_words)

                # Prefer longer matches with high similarity
                weighted_score = avg_similarity * len(trigger_words)

                if avg_similarity >= threshold and weighted_score > best_score:
                    best_score = weighted_score
                    best_match = (trigger, calc_name, avg_similarity)

        if best_match:
            trigger, calc_name, similarity = best_match
            logger.info(
                f"Fuzzy matched calculation '{trigger}' (similarity: {similarity:.2f}): {calc_name}"
            )

            # Find the full calculation object
            for calc in business_logic.get("calculations", []):
                if calc.get("calculation_name",
                            "").lower() == calc_name.lower():
                    return calc
            # Return minimal info if not found in business_logic
            return {
                "calculation_name": calc_name,
                "triggered_by": trigger,
                "fuzzy_match": True
            }

        return None

    def create_ingestion_job(self,
                             cube_id: str,
                             document_id: str = None,
                             file_name: str = None) -> str:
        """Create a new ingestion job and return job_id"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO cube_ingestion_jobs (cube_id, document_id, file_name, status)
                VALUES (%s, %s, %s, 'queued')
                RETURNING id
            """, (cube_id, document_id, file_name))
            job_id = cursor.fetchone()[0]
            conn.commit()
            cursor.close()
            conn.close()
            logger.info(f"Created ingestion job {job_id} for cube {cube_id}")
            return job_id
        except Exception as e:
            logger.error(f"Failed to create ingestion job: {e}")
            return None

    def get_ingestion_job(self, job_id: str) -> Dict[str, Any]:
        """Get ingestion job status by ID"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                """
                SELECT id, cube_id, document_id, status, total_rows, processed_rows, 
                       error_message, file_name, created_at, started_at, completed_at
                FROM cube_ingestion_jobs WHERE id = %s
            """, (job_id, ))
            job = cursor.fetchone()
            cursor.close()
            conn.close()
            return dict(job) if job else None
        except Exception as e:
            logger.error(f"Failed to get ingestion job: {e}")
            return None

    def get_cube_ingestion_jobs(self,
                                cube_id: str,
                                limit: int = 5) -> List[Dict[str, Any]]:
        """Get recent ingestion jobs for a cube"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                """
                SELECT id, cube_id, document_id, status, total_rows, processed_rows, 
                       error_message, file_name, created_at, started_at, completed_at
                FROM cube_ingestion_jobs 
                WHERE cube_id = %s 
                ORDER BY created_at DESC 
                LIMIT %s
            """, (cube_id, limit))
            jobs = [dict(row) for row in cursor.fetchall()]
            cursor.close()
            conn.close()
            return jobs
        except Exception as e:
            logger.error(f"Failed to get cube ingestion jobs: {e}")
            return []

    def update_ingestion_job(self,
                             job_id: str,
                             status: str = None,
                             processed_rows: int = None,
                             total_rows: int = None,
                             error_message: str = None):
        """Update ingestion job progress in database"""
        if not job_id:
            return
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()

            updates = []
            params = []

            if status:
                updates.append("status = %s")
                params.append(status)
                if status == 'running':
                    updates.append("started_at = NOW()")
                elif status in ('succeeded', 'failed', 'cancelled'):
                    updates.append("completed_at = NOW()")

            if processed_rows is not None:
                updates.append("processed_rows = %s")
                params.append(processed_rows)

            if total_rows is not None:
                updates.append("total_rows = %s")
                params.append(total_rows)

            if error_message:
                updates.append("error_message = %s")
                params.append(error_message)

            if updates:
                params.append(job_id)
                cursor.execute(
                    f"UPDATE cube_ingestion_jobs SET {', '.join(updates)} WHERE id = %s",
                    params)
                conn.commit()

            cursor.close()
            conn.close()
        except Exception as e:
            logger.error(f"Failed to update ingestion job {job_id}: {e}")

    def validate_cube_exists(self, cube_id: str) -> bool:
        """Check if cube_id exists in cubes table"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM cubes WHERE id = %s", (cube_id, ))
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            return result is not None
        except Exception as e:
            logger.error(f"Error validating cube: {e}")
            return False

    def get_available_cubes(self) -> List[Dict[str, str]]:
        """Get list of available cubes for ingestion"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id, name FROM cubes ORDER BY name")
            cubes = [{
                'id': row[0],
                'name': row[1]
            } for row in cursor.fetchall()]
            cursor.close()
            conn.close()
            return cubes
        except Exception as e:
            logger.error(f"Error getting cubes: {e}")
            return []

    def ingest_excel_to_facts(self,
                              file_path: str,
                              cube_id: str,
                              batch_size: int = 50000,
                              job_id: str = None) -> Dict[str, Any]:
        """
        Ingest Excel file into cube_fact_data table
        Handles 600K+ rows with batch processing
        Supports both mapped columns AND generic JSONB storage for any Excel
        Optionally tracks progress via job_id for frontend status display
        """
        logger.info(
            f"Starting Excel ingestion: {file_path} for cube {cube_id}, job_id: {job_id}"
        )
        start_time = datetime.now()

        try:
            # CRITICAL: Validate cube_id exists before any operations
            if not self.validate_cube_exists(cube_id):
                available_cubes = self.get_available_cubes()
                cube_list = ", ".join(
                    [f"{c['name']} ({c['id']})" for c in available_cubes[:5]])
                return {
                    'success':
                    False,
                    'error':
                    f"Cube ID '{cube_id}' does not exist. Available cubes: {cube_list}"
                }

            # Read all sheets and concatenate (handles 10-lakh+ row files split across multiple sheets)
            xl = pd.ExcelFile(file_path, engine='openpyxl')
            sheet_frames = []
            for sheet in xl.sheet_names:
                sheet_df = pd.read_excel(xl, sheet_name=sheet)
                sheet_frames.append(sheet_df)
                logger.info(f"Sheet '{sheet}': {len(sheet_df)} rows")
            df = pd.concat(sheet_frames, ignore_index=True)
            total_rows = len(df)
            excel_columns = list(df.columns)
            logger.info(
                f"Total across {len(xl.sheet_names)} sheet(s): {total_rows} rows, {len(excel_columns)} columns: {excel_columns[:10]}..."
            )

            # Try to map column names to database columns (case-insensitive)
            df_mapped = pd.DataFrame()
            mapped_cols = []
            # Build a lowercase lookup for Excel columns
            excel_cols_lower = {col.lower(): col for col in df.columns}
            for excel_col, db_col in COLUMN_MAPPING.items():
                # Case-insensitive column matching
                actual_col = excel_cols_lower.get(excel_col.lower())
                if actual_col:
                    df_mapped[db_col] = df[actual_col]
                    mapped_cols.append(actual_col)

            # If no columns matched, use JSONB storage for generic Excel files
            use_jsonb = len(df_mapped.columns) == 0

            if use_jsonb:
                logger.info(
                    f"No columns matched COLUMN_MAPPING, using JSONB storage for all {len(excel_columns)} columns"
                )
                # Convert DataFrame to list of dicts efficiently, then to JSON strings
                import json
                # Convert NaN/NaT to None and all values to strings for JSON compatibility
                df_clean = df.fillna('').astype(str)
                records = df_clean.to_dict(orient='records')
                df_mapped['row_data'] = [json.dumps(rec) for rec in records]
                logger.info(f"Converted {len(records)} rows to JSONB format")
            else:
                logger.info(
                    f"Mapped {len(df_mapped.columns)} columns to schema: {list(df_mapped.columns)}"
                )
                # Convert NaN/NaT to None for proper NULL storage in PostgreSQL
                df_mapped = df_mapped.astype(object).where(
                    pd.notna(df_mapped), None)

            df_mapped['cube_id'] = cube_id

            # Get unique cost categories
            cost_categories = df_mapped['cost_category'].unique().tolist(
            ) if 'cost_category' in df_mapped.columns else []

            # Get unique dimensions for metadata
            dimensions = {}
            for dim_col in [
                    'region_entity', 'sector', 'project_gb', 'planning_gb'
            ]:
                if dim_col in df_mapped.columns:
                    dimensions[dim_col] = df_mapped[dim_col].dropna().unique(
                    ).tolist()

            # For JSONB data, extract dimensions from the original DataFrame
            if use_jsonb:
                for col in excel_columns:
                    if df[col].dtype == 'object':
                        unique_vals = df[col].dropna().unique().tolist()
                        if len(
                                unique_vals
                        ) <= 100:  # Only store if reasonable number of unique values
                            dimensions[
                                col] = unique_vals[:
                                                   50]  # Limit to 50 for metadata

            # Batch insert into database with per-batch commits
            # This ensures partial data is saved even if we hit storage limits
            conn = self.get_db_connection()
            cursor = conn.cursor()

            inserted_rows = 0
            errors = []
            storage_limit_hit = False

            # ADDITIVE INGESTION: Do NOT delete existing data
            # Multiple files can be uploaded to the same cube (e.g., different months)
            # Each file's data is added without removing previous data
            # To remove duplicates or re-upload, user should delete via document management
            logger.info(
                f"Additive ingestion mode: preserving existing data for cube {cube_id}"
            )

            # Mark job as running if job_id provided
            if job_id:
                self.update_ingestion_job(job_id,
                                          status='running',
                                          total_rows=total_rows,
                                          processed_rows=0)

            # Insert in batches using execute_values with per-batch commits
            columns = list(df_mapped.columns)
            insert_sql = f"INSERT INTO cube_fact_data ({', '.join(columns)}) VALUES %s"

            batch_num = 0
            for i in range(0, len(df_mapped), batch_size):
                if storage_limit_hit:
                    break

                batch = df_mapped.iloc[i:i + batch_size]
                batch_data = [tuple(row) for row in batch.values]

                try:
                    # execute_values is 10-100x faster than executemany for bulk inserts
                    execute_values(cursor,
                                   insert_sql,
                                   batch_data,
                                   page_size=5000)
                    conn.commit()  # Commit each batch to persist partial data
                    inserted_rows += len(batch_data)
                    batch_num += 1
                    logger.info(
                        f"Inserted {inserted_rows}/{total_rows} rows...")

                    # Update job progress every 5 batches to reduce DB round-trips
                    if job_id and batch_num % 5 == 0:
                        self.update_ingestion_job(job_id,
                                                  processed_rows=inserted_rows)
                except Exception as e:
                    error_msg = str(e)
                    conn.rollback()  # Rollback failed batch only

                    # Check for storage limit error
                    if 'project size limit' in error_msg.lower(
                    ) or 'max_cluster_size' in error_msg:
                        storage_limit_hit = True
                        logger.warning(
                            f"Storage limit reached after {inserted_rows} rows. Stopping ingestion."
                        )
                        errors.append(
                            f"Storage limit reached - {inserted_rows}/{total_rows} rows saved"
                        )
                    else:
                        errors.append(f"Batch {i//batch_size}: {error_msg}")
                        logger.error(f"Error inserting batch: {e}")

            cursor.close()
            conn.close()

            # Store dimensions in cube_dimensions table
            self._store_dimensions(cube_id, dimensions)

            # Store cost categories
            self._store_cost_categories(cube_id, cost_categories)

            elapsed = (datetime.now() - start_time).total_seconds()

            if storage_limit_hit:
                logger.warning(
                    f"Partial ingestion: {inserted_rows}/{total_rows} rows in {elapsed:.1f}s (storage limit reached)"
                )
            else:
                logger.info(
                    f"Ingestion complete: {inserted_rows} rows in {elapsed:.1f}s"
                )

            # Mark job as succeeded
            if job_id:
                warning_msg = f"Storage limit reached. Only {inserted_rows}/{total_rows} rows were saved." if storage_limit_hit else None
                self.update_ingestion_job(job_id,
                                          status='succeeded',
                                          processed_rows=inserted_rows,
                                          error_message=warning_msg)

            return {
                'success':
                True,
                'partial':
                storage_limit_hit,
                'rows_processed':
                total_rows,
                'rows_inserted':
                inserted_rows,
                'cost_categories':
                cost_categories,
                'dimensions':
                dimensions,
                'elapsed_seconds':
                elapsed,
                'errors':
                errors if errors else None,
                'warning':
                f"Storage limit reached. Only {inserted_rows}/{total_rows} rows were saved."
                if storage_limit_hit else None
            }

        except Exception as e:
            logger.error(f"Ingestion failed: {e}")
            # Mark job as failed
            if job_id:
                self.update_ingestion_job(job_id,
                                          status='failed',
                                          error_message=str(e))
            return {'success': False, 'error': str(e)}

    def _store_dimensions(self, cube_id: str, dimensions: Dict[str, List]):
        """Store unique dimension values for the cube"""
        conn = self.get_db_connection()
        cursor = conn.cursor()

        try:
            for dim_type, values in dimensions.items():
                for value in values:
                    if value and str(value).strip():
                        cursor.execute(
                            """
                            INSERT INTO cube_dimensions (cube_id, dimension_type, code, name)
                            VALUES (%s, %s, %s, %s)
                            ON CONFLICT (cube_id, dimension_type, code) DO NOTHING
                        """, (cube_id, dim_type, str(value), str(value)))
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def _store_cost_categories(self, cube_id: str, categories: List[str]):
        """Store cost categories with their relevant columns"""
        conn = self.get_db_connection()
        cursor = conn.cursor()

        try:
            for cat in categories:
                if not cat or pd.isna(cat):
                    continue
                is_summary = 'Summary' in str(cat)

                # Find matching column config
                relevant_cols = []
                for cat_key, cols in COST_CATEGORY_COLUMNS.items():
                    if cat_key in str(cat):
                        relevant_cols = cols
                        break

                cursor.execute(
                    """
                    INSERT INTO cube_cost_categories (cube_id, name, is_summary, relevant_columns)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """,
                    (cube_id, str(cat), is_summary, json.dumps(relevant_cols)))
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def ingest_plan_data(self,
                         file_path: str,
                         cube_id: str,
                         sheet_name: str = 'Plan,Actual',
                         source_file: str = None,
                         batch_size: int = 1000) -> Dict[str, Any]:
        """
        Ingest Plan/Budget data from Manual inputs MBR Master Excel file.
        Loads data into cube_plan_data table for Plan vs Actual comparisons.
        Uses batch insertion with transaction safety for 20K+ row files.
        """
        from psycopg2.extras import execute_values

        logger.info(
            f"Starting Plan data ingestion: {file_path} for cube {cube_id}")
        start_time = datetime.now()

        conn = None
        try:
            # Validate cube exists
            if not self.validate_cube_exists(cube_id):
                return {
                    'success': False,
                    'error': f"Cube ID '{cube_id}' does not exist"
                }

            # Read Excel file with specific sheet
            df = pd.read_excel(file_path,
                               sheet_name=sheet_name,
                               engine='openpyxl')
            total_rows = len(df)
            logger.info(f"Read {total_rows} rows from sheet '{sheet_name}'")
            logger.info(f"Columns: {list(df.columns)}")

            # Build lowercase lookup for Excel columns
            excel_cols_lower = {col.lower().strip(): col for col in df.columns}

            # Map columns (with validation)
            col_map = {
                'year': excel_cols_lower.get('year'),
                'month': excel_cols_lower.get('month'),
                'plan_type': excel_cols_lower.get('plan/actual'),
                'entity': excel_cols_lower.get('entity'),
                'gb': excel_cols_lower.get('gb'),
                'particulars': excel_cols_lower.get('particulars'),
                'sub_category':
                excel_cols_lower.get('particulars sub category'),
                'cost_value': excel_cols_lower.get('cost value'),
                'value_percent': excel_cols_lower.get('value %'),
                'page': excel_cols_lower.get('page')
            }

            # Validate required columns exist
            required = ['year', 'month', 'plan_type', 'particulars']
            missing = [k for k in required if col_map.get(k) is None]
            if missing:
                return {
                    'success': False,
                    'error': f"Missing required columns: {missing}"
                }

            # Helper to safely get value
            def safe_get(row, key):
                col = col_map.get(key)
                if col is None:
                    return None
                val = row.get(col)
                if pd.isna(val):
                    return None
                return val

            # Helper to normalize strings (trim and title case for consistency)
            def normalize_str(val):
                if val is None:
                    return None
                return str(val).strip()

            # Helper to parse numeric
            def parse_numeric(val):
                if val is None:
                    return None
                try:
                    return float(val)
                except (ValueError, TypeError):
                    return None

            # Prepare batch data with normalization
            batch_data = []
            skipped_rows = 0
            file_name = source_file or os.path.basename(file_path)

            for idx, row in df.iterrows():
                try:
                    year_val = safe_get(row, 'year')
                    month_val = safe_get(row, 'month')
                    plan_type = safe_get(row, 'plan_type')
                    particulars = safe_get(row, 'particulars')

                    # Skip rows without required fields
                    if year_val is None or month_val is None or plan_type is None or particulars is None:
                        skipped_rows += 1
                        continue

                    # Parse and normalize values
                    year_int = int(year_val)
                    month_int = int(month_val)
                    plan_type_str = normalize_str(plan_type)
                    entity = normalize_str(safe_get(row, 'entity'))
                    gb = normalize_str(safe_get(row, 'gb'))
                    particulars_str = normalize_str(particulars)
                    sub_category = normalize_str(safe_get(row, 'sub_category'))
                    page = normalize_str(safe_get(row, 'page'))

                    # Parse numeric values
                    cost_val = parse_numeric(safe_get(row, 'cost_value'))
                    value_pct = parse_numeric(safe_get(row, 'value_percent'))

                    # Store as string for database but preserve precision
                    cost_value_str = str(
                        cost_val) if cost_val is not None else None
                    value_percent_str = str(
                        value_pct) if value_pct is not None else None

                    batch_data.append(
                        (cube_id, year_int, month_int, plan_type_str, entity,
                         gb, particulars_str, sub_category, cost_value_str,
                         value_percent_str, page, file_name))
                except Exception as e:
                    skipped_rows += 1
                    logger.debug(f"Row {idx} skipped: {e}")

            if not batch_data:
                return {
                    'success': False,
                    'error': 'No valid rows to insert after processing'
                }

            # Transaction-safe batch insert
            conn = self.get_db_connection()
            cursor = conn.cursor()

            try:
                # Clear existing plan data for this cube (within transaction)
                cursor.execute("DELETE FROM cube_plan_data WHERE cube_id = %s",
                               (cube_id, ))
                deleted_count = cursor.rowcount
                logger.info(f"Cleared {deleted_count} existing plan data rows")

                # Insert in batches
                inserted_rows = 0
                for i in range(0, len(batch_data), batch_size):
                    batch = batch_data[i:i + batch_size]
                    execute_values(
                        cursor,
                        """
                        INSERT INTO cube_plan_data (cube_id, year, month, plan_type, entity, gb, 
                                                    particulars, sub_category, cost_value, value_percent, 
                                                    page, source_file)
                        VALUES %s
                    """,
                        batch,
                        template=
                        "(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)")
                    inserted_rows += len(batch)
                    logger.info(
                        f"Inserted batch {i//batch_size + 1}: {len(batch)} rows"
                    )

                # Commit only if all batches succeeded
                conn.commit()

            except Exception as e:
                # Rollback on any error to preserve existing data
                conn.rollback()
                logger.error(f"Ingestion failed, rolling back: {e}")
                raise
            finally:
                cursor.close()

            elapsed = (datetime.now() - start_time).total_seconds()
            logger.info(
                f"Plan data ingestion complete: {inserted_rows} rows in {elapsed:.2f}s"
            )

            return {
                'success': True,
                'rows_inserted': inserted_rows,
                'rows_skipped': skipped_rows,
                'total_rows': total_rows,
                'elapsed_seconds': elapsed
            }

        except Exception as e:
            logger.error(f"Plan data ingestion failed: {e}")
            return {'success': False, 'error': str(e)}
        finally:
            if conn:
                conn.close()

    def ingest_nemko_anaplan_pl(self,
                                file_path: str,
                                cube_id: str,
                                sheet_name: str = 'Sheet 1',
                                source_file: str = None,
                                statement_type: str = 'P&L',
                                batch_size: int = 1000) -> Dict[str, Any]:
        """
        Ingest Nemko Anaplan P&L export (wide-format) into cube_plan_data.

        Expected Excel structure (Anaplan export):
          Col 1: Location   - entity/location name
          Col 2: DS         - Department/Service (e.g. 'S106 Safety')
          Col 3: LIS:…      - P&L line item (particulars)
          Col 4: Versions   - 'Actual' | 'Budget' | 'Forecast'
          Col 5: Line Items - always 'LC Amount [Incl Elimination]' (skipped)
          Col 6+: monthly   - 'Jan 24', 'Feb 24', … 'FY24', 'Jan 25', … FY26

        Months are unpivoted: each (row × month-column) → one DB row.
        FY totals (FY24, FY25, FY26) are skipped.
        """
        from psycopg2.extras import execute_values

        MONTH_ABBR = {
            'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
            'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
        }

        logger.info(f"[Nemko Anaplan] Starting P&L ingestion: {file_path} for cube {cube_id}")
        start_time = datetime.now()
        conn = None

        try:
            if not self.validate_cube_exists(cube_id):
                return {'success': False, 'error': f"Cube ID '{cube_id}' does not exist"}

            df = pd.read_excel(file_path, sheet_name=sheet_name, engine='openpyxl', header=0)
            logger.info(f"[Nemko Anaplan] Read {len(df)} rows, {len(df.columns)} columns")
            logger.info(f"[Nemko Anaplan] Columns: {list(df.columns)[:10]} ...")

            cols = list(df.columns)

            # Identify month columns and parse year/month from header like "Jan 24", "Dec 25"
            month_cols = []
            for col in cols[5:]:  # skip first 5 fixed columns
                col_str = str(col).strip()
                parts = col_str.split()
                if len(parts) == 2 and parts[0] in MONTH_ABBR:
                    try:
                        yr = int('20' + parts[1]) if len(parts[1]) == 2 else int(parts[1])
                        month_cols.append((col, MONTH_ABBR[parts[0]], yr))
                    except ValueError:
                        pass
                # Skip FY totals (FY24, FY25, FY26)

            if not month_cols:
                return {'success': False, 'error': 'No monthly columns found (expected "Jan 24", "Feb 25" format)'}

            logger.info(f"[Nemko Anaplan] Found {len(month_cols)} month columns: "
                        f"{month_cols[0]} … {month_cols[-1]}")

            file_name = source_file or os.path.basename(file_path)
            batch_data = []
            skipped_rows = 0
            rows_inserted = 0
            errors = []

            conn = self.get_db_connection()
            cursor = conn.cursor()

            INSERT_SQL = """
                INSERT INTO cube_plan_data
                    (cube_id, year, month, plan_type, location, ds, particulars,
                     amount_lc, statement_type, source_file)
                VALUES %s
                ON CONFLICT DO NOTHING
            """

            for idx, row in df.iterrows():
                location  = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else None
                ds        = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else None
                particulars = str(row.iloc[2]).strip() if pd.notna(row.iloc[2]) else None
                plan_type = str(row.iloc[3]).strip() if pd.notna(row.iloc[3]) else None

                if not plan_type or not particulars:
                    skipped_rows += 1
                    continue

                for (col_name, month_num, year_num) in month_cols:
                    raw_val = row[col_name]
                    if pd.isna(raw_val):
                        continue
                    try:
                        amount_lc = float(raw_val)
                    except (ValueError, TypeError):
                        continue

                    batch_data.append((
                        cube_id, year_num, month_num, plan_type,
                        location, ds, particulars,
                        amount_lc, statement_type, file_name
                    ))

                    if len(batch_data) >= batch_size:
                        execute_values(cursor, INSERT_SQL, batch_data)
                        conn.commit()
                        rows_inserted += len(batch_data)
                        logger.info(f"[Nemko Anaplan] Inserted batch: {rows_inserted} rows so far")
                        batch_data = []

            # Final batch
            if batch_data:
                execute_values(cursor, INSERT_SQL, batch_data)
                conn.commit()
                rows_inserted += len(batch_data)

            elapsed = (datetime.now() - start_time).total_seconds()
            logger.info(f"[Nemko Anaplan] Done — {rows_inserted} rows inserted in {elapsed:.1f}s")
            return {
                'success': True,
                'rows_inserted': rows_inserted,
                'rows_skipped': skipped_rows,
                'total_rows': len(df),
                'month_columns': len(month_cols),
                'elapsed_seconds': elapsed,
                'errors': errors,
            }

        except Exception as e:
            logger.error(f"[Nemko Anaplan] Ingestion failed: {e}", exc_info=True)
            if conn:
                conn.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            if conn:
                conn.close()

    def get_plan_data(self,
                      cube_id: str,
                      plan_type: str = None,
                      entity: str = None,
                      particulars: str = None,
                      year: int = None,
                      month: int = None) -> List[Dict]:
        """
        Query plan data for a specific cube with optional filters.
        Returns plan/budget values for calculations.
        """
        conn = self.get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        try:
            query = "SELECT * FROM cube_plan_data WHERE cube_id = %s"
            params = [cube_id]

            if plan_type:
                query += " AND plan_type = %s"
                params.append(plan_type)
            if entity:
                query += " AND entity ILIKE %s"
                params.append(f"%{entity}%")
            if particulars:
                query += " AND particulars ILIKE %s"
                params.append(f"%{particulars}%")
            if year:
                query += " AND year = %s"
                params.append(year)
            if month:
                query += " AND month = %s"
                params.append(month)

            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            cursor.close()
            conn.close()

    def get_plan_value(self,
                       cube_id: str,
                       particulars: str,
                       entity: str = None,
                       plan_type: str = 'Actual',
                       year: int = None,
                       month: int = None,
                       sub_category: str = None) -> Optional[float]:
        """
        Get a specific plan value for use in calculations.
        Returns the cost_value as a float for the matching criteria.
        """
        conn = self.get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        try:
            query = """
                SELECT cost_value FROM cube_plan_data 
                WHERE cube_id = %s AND particulars ILIKE %s
            """
            params = [cube_id, f"%{particulars}%"]

            if entity:
                query += " AND entity ILIKE %s"
                params.append(f"%{entity}%")
            if plan_type:
                query += " AND plan_type = %s"
                params.append(plan_type)
            if year:
                query += " AND year = %s"
                params.append(year)
            if month:
                query += " AND month = %s"
                params.append(month)
            if sub_category:
                query += " AND sub_category ILIKE %s"
                params.append(f"%{sub_category}%")

            query += " ORDER BY ingested_at DESC LIMIT 1"

            cursor.execute(query, tuple(params))
            row = cursor.fetchone()

            if row and row['cost_value']:
                try:
                    return float(row['cost_value'])
                except (ValueError, TypeError):
                    return None
            return None
        finally:
            cursor.close()
            conn.close()

    def parse_query_intent(self,
                           query: str,
                           cube_id: str,
                           cube_metadata: Dict = None,
                           domain_id: str = None,
                           ai_config: dict = None) -> Dict[str, Any]:
        """
        Parse natural language query into structured intent using LLM.
        Uses dynamic schema context from cube_column_config when available.
        Includes business logic context for domain-specific term resolution.
        """
        # Get available dimensions and metrics for this cube
        conn = self.get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Get unique dimension values
        cursor.execute(
            """
            SELECT dimension_type, array_agg(DISTINCT code) as values
            FROM cube_dimensions WHERE cube_id = %s
            GROUP BY dimension_type
        """, (cube_id, ))
        dimension_values = {
            row['dimension_type']: row['values']
            for row in cursor.fetchall()
        }

        # Get cost categories
        cursor.execute(
            """
            SELECT name, is_summary FROM cube_cost_categories WHERE cube_id = %s
        """, (cube_id, ))
        cost_categories = [{
            'name': row['name'],
            'is_summary': row['is_summary']
        } for row in cursor.fetchall()]

        cursor.close()
        conn.close()

        # Load business logic context (terms, calculations, filters, column values)
        business_logic = self.load_business_logic_context(cube_id)
        business_logic_context = business_logic.get("context", "")

        # query_lower used throughout fast-paths and view-filter detection below
        query_lower = query.lower()

        # Detect entity filters from query using known column values (with dimension_values fallback)
        entity_filters = self.resolve_entity_from_query(
            query, business_logic, dimension_values)

        # Strip false-positive Cost Category ILIKE filters.
        # e.g. "Revenue" in "what is Revenue by entity" is a KPI keyword, not an entity.
        # cost_category is handled internally by every SQL builder and must NOT come from entity resolution.
        entity_filters = [
            ef for ef in entity_filters
            if ef.get('column', '').lower().replace(' ', '_') != 'cost_category'
        ]

        # Consolidate multiple region_entity = 'X' scalar filters into one IN filter.
        # resolve_entity_from_query returns one filter per matched entity; the WHERE
        # clause builder deduplicates by column (keeping only the first), so merge them
        # here before passing downstream so all entities survive.
        _re_filters  = [ef for ef in entity_filters if ef.get('column', '').lower() == 'region_entity']
        _other_ef    = [ef for ef in entity_filters if ef.get('column', '').lower() != 'region_entity']
        if len(_re_filters) > 1:
            _entity_vals = [ef['value'] for ef in _re_filters]
            entity_filters = _other_ef + [{'column': 'region_entity', 'operator': 'IN', 'value': _entity_vals}]

        if entity_filters:
            logger.info(
                f"Detected entity filters from query: {entity_filters}")

        # Detect GB/Project view filters (MS, SX, VM, PS, XC views)
        # FROZEN: These filters follow the frozen view definitions
        gb_view_filter = self.detect_gb_view_filter(query)
        # Capture view_type before it gets stripped by .pop() calls below
        detected_view_type = gb_view_filter.get('view_type') if gb_view_filter else None
        # group_by_hint: set by GB views (PS/VM/XC) to override default group_by to ['project_gb']
        _gb_group_by_hint = None
        if gb_view_filter:
            # Remove any conflicting sector/new_service_area ILIKE entity filters that were
            # added by resolve_entity_from_query via alias matching (e.g., "SX" → sector ILIKE '%BBE%').
            # The view filter's sector IN clause and new_service_area = 'SX' supersede them.
            before_count = len(entity_filters)
            entity_filters = [
                ef for ef in entity_filters
                if not (
                    ef.get('column', '').lower().replace(' ', '_') in ('sector', 'new_service_area')
                    and ef.get('operator', '').upper() == 'ILIKE'
                )
            ]
            removed = before_count - len(entity_filters)
            if removed:
                logger.info(
                    f"FROZEN: Removed {removed} conflicting sector/new_service_area ILIKE filter(s) "
                    f"— superseded by view filter"
                )

            # Extract sector filter (MS/SX views have sector; PS/VM/XC do NOT per spec)
            sector_filter = gb_view_filter.pop('sector_filter', None)
            if sector_filter:
                entity_filters.append(sector_filter)
                logger.info(
                    f"FROZEN: Added sector constraint: {sector_filter}")
            # Extract project_gb filter (PS/VM/XC views: project_gb = 'PS'/'VM'/'XC')
            project_gb_filter = gb_view_filter.pop('project_gb_filter', None)
            if project_gb_filter:
                entity_filters.append(project_gb_filter)
                logger.info(
                    f"FROZEN: Added project_gb constraint: {project_gb_filter}"
                )
            # Extract CVO exclusion filter (MS View total — excludes project_gb='CVO')
            cvo_exclusion_filter = gb_view_filter.pop('cvo_exclusion_filter', None)
            if cvo_exclusion_filter:
                entity_filters.append(cvo_exclusion_filter)
                logger.info(
                    f"FROZEN: Added CVO exclusion: project_gb NOT IN ('CVO')"
                )
            # Extract group_by_hint (PS/VM/XC views group by project_gb, not region_entity)
            _gb_group_by_hint = gb_view_filter.pop('group_by_hint', None)  # assigns to outer var
            if _gb_group_by_hint:
                logger.info(
                    f"FROZEN: View group_by hint: {_gb_group_by_hint}"
                )
            # Add the main filter (new_service_area)
            entity_filters.append(gb_view_filter)
            logger.info(f"FROZEN: Applied view filter: {gb_view_filter}")

        # Check for matching calculation (e.g., "billing utilization")
        matching_calc = self.get_matching_calculation(query, business_logic)
        if matching_calc:
            logger.info(
                f"Matched calculation: {matching_calc.get('calculation_name')}"
            )

        # Try to get dynamic schema context from configuration
        schema_context = ""
        if SCHEMA_CONTEXT_AVAILABLE:
            try:
                schema_context = schema_context_builder.build_sql_context(
                    cube_id, domain_id)
                logger.info(f"Using dynamic schema context for cube {cube_id}")
            except Exception as e:
                logger.warning(f"Could not load schema context: {e}")

        # Build context for LLM - always include explicit metric column names
        metrics_list = """IMPORTANT: Use ONLY these exact metric column names (not cost category names):
- billed_capacity: Billed capacity hours
- allocated_capacity: Allocated capacity hours  
- vkm_capacity: VKM capacity
- ms_capacity: M/S capacity
- not_allocated_capacity: Not allocated capacity
- non_linear_capacity: Non-linear capacity
- amount_usd: Revenue in USD
- amount_inr: Revenue in INR
- headcount: Employee headcount
- total_hours: Total hours
- billable_hours: Billable hours
- capacity: Overall capacity"""

        # Build business logic section for prompt
        business_section = ""
        if business_logic_context:
            business_section = f"""
{business_logic_context}

IMPORTANT ENTITY MATCHING RULES:
- When user mentions an entity like "BGSW", "BGSV", "BGW" etc., ALWAYS add a filter on region_entity column
- Use exact match operator for entity names: {{"column": "region_entity", "operator": "=", "value": "BGSW"}}
- Known entities: BGSW, BGSV, BGSW/NE-MX, BGSW/EBS-PL - always use exact match to avoid substring collisions
"""

        # Combine all context
        base_context = f"""
You are a financial data query parser for Bosch finance data. Parse the user's question into a structured SQL intent.

CRITICAL ANTI-HALLUCINATION RULES:
- ONLY use data that EXISTS in the database - NEVER make up, estimate, or fabricate values
- If the query cannot be answered with available data, return an empty result instead of guessing
- NEVER speculate about values not in the database
- Only return columns and values that actually exist in the cube_fact_data table
- If a year/month combination doesn't exist, DO NOT estimate or interpolate
- When unsure about data availability, prefer returning "no data found" over incorrect data

{schema_context if schema_context else ""}

{business_section}

{metrics_list}

Available dimension columns for filtering and GROUP BY:
- region_entity: Known values include {dimension_values.get('region_entity', ['BGSW', 'BGSV', 'BGSW/NE-MX'])}
- sector: {dimension_values.get('sector', ['BBM', 'BBG'])}
- project_gb: {dimension_values.get('project_gb', ['VM', 'PS'])}
- planning_gb: {dimension_values.get('planning_gb', [])}
- onsite_offshore: ['Onsite', 'Offshore']
- new_service_area: Service area grouping (CORPORATE, MS, RBEI_BD, etc.) - USE THIS for "service area" grouping
- service_area: Original service area column
- res_sub_service_area: Resource sub-service area
- proj_sub_service_area: Project sub-service area
- res_dept: Resource department
- cost_type: Type of cost
- sub_cost_category: Sub-category classification
- profit_center: Profit center code
- year: [2024, 2025]
- month: [1-12]
- cost_category: Filter for different data views (Revenue Summary, Cost Summary, etc.)

CRITICAL COST CATEGORY RULES (MOST IMPORTANT):
The "cost_category" column determines what type of data each row contains. You MUST add the correct cost_category filter based on what the user is asking:

**SMART COST CATEGORY SELECTION:**
- When user asks to GROUP BY a column like "new_service_area", check which cost_category has that column available
- "Billing Utilization" (detailed) has more columns than "Billing Utilization Summary" - prefer it when user needs detailed breakdowns
- Use "Summary" categories ONLY for high-level aggregations (by entity, by sector, totals)

**EMPLOYEE-LEVEL vs AGGREGATE vs DETAILED BREAKDOWN QUERIES:**
- EMPLOYEE-level (by name, employee number): Use DETAIL cost_category (without "Summary")
- DETAILED BREAKDOWN (by new_service_area, by department, etc.): Use DETAIL cost_category (e.g., "Billing Utilization")
- HIGH-LEVEL AGGREGATE (total by entity, by sector): Use SUMMARY cost_category

1. For REVENUE queries:
   - Aggregate: {{"column": "cost_category", "operator": "=", "value": "Revenue Summary"}}
   - Employee-level: {{"column": "cost_category", "operator": "=", "value": "Revenue"}}
   - Also add: {{"column": "include_exclude", "operator": "=", "value": "Include"}}
   
2. For BILLING UTILIZATION queries (utilization %, BU%, capacity, bench, billed hours):
   - **HIGH-LEVEL (by entity/sector only)**: {{"column": "cost_category", "operator": "=", "value": "Billing Utilization Summary"}}
   - **DETAILED/BREAKDOWN (by service area, department, employee)**: {{"column": "cost_category", "operator": "=", "value": "Billing Utilization"}}
   - When user asks "by new service area" or "by department", use "Billing Utilization" NOT "Billing Utilization Summary"
   - For employee queries, add employee filter: {{"column": "employee_name", "operator": "ILIKE", "value": "%EmployeeName%"}}
   - Or by number: {{"column": "employee_number", "operator": "=", "value": "12345678"}}
   
3. For COST queries (cost, expenses, cost summary, New Service Area):
   - Add filter: {{"column": "cost_category", "operator": "=", "value": "Cost Summary"}}
   - IMPORTANT: "New Service Area" column is ONLY available in Cost Summary - route service area queries to Cost Summary
   - Also has: CostType, CostCatergory_Class, SubCostCategory, ProfitCenter, PRFT_FLAG
   
4. For HEADCOUNT queries (headcount, end capacity, HC, GB capacity):
   - Aggregate: {{"column": "cost_category", "operator": "=", "value": "GB Wise END Capacity"}}
   - Employee-level: {{"column": "cost_category", "operator": "=", "value": "GB Wise END Capacity"}}
   - Usually also filter: {{"column": "resource_type", "operator": "IN", "value": ["Internal", "External"]}}
   
5. For ATTRITION queries (attrition, turnover, separations):
   - Add filter: {{"column": "cost_category", "operator": "=", "value": "Attrition"}}
   - Use metric: {{"name": "attrition", "aggregation": "COUNT"}}
   - Has: employee_number, employee_name, region_entity, sector, attrition

6. For EMPLOYEE queries (employee count, employee data, employee summary, WW employee, price mix, billed capacity):
   - Always use: {{"column": "cost_category", "operator": "=", "value": "WW Employee"}}
   - Use metric: {{"name": "billed_capacity", "aggregation": "SUM"}} or COUNT(*)

7. For HEAD COUNT queries (headcount, HC, personnel count):
   - Use: {{"column": "cost_category", "operator": "=", "value": "Head Count"}}
   - Has: employee_number, employee_name, headcount column

8. For EBIT queries (EBIT, EBIT %, profitability, operating margin):
   - Set: "use_calculation": "EBIT %"
   - This triggers a special calculation: EBIT % = (Revenue - Cost) / Revenue * 100
   - Add year/month filters as requested by user
   - Add group_by for entity/sector breakdowns if requested

AVAILABLE CALCULATIONS (use_calculation field):
When user asks about these KPIs, set the "use_calculation" field to trigger specialized SQL formulas.
These handle complex multi-step calculations that cannot be done with simple SUM/AVG.

| Trigger Keywords (even with typos) | use_calculation value |
|-----------------------------------|----------------------|
| EBIT, EBIT %, profit margin, operating margin | "EBIT %" |
| billing utilization, utilization rate, BU% | "Billing Utilization" |
| price mix, pricing mix, premium ratio | "Price Mix Ratio" |
| attrition rate, attrition %, employee churn | "Attrition Percentage" |
| pyramid mix, skill pyramid, junior-senior mix | "Pyramid Mix" |
| internal capacity mix, internal mix | "Internal Capacity Mix" |
| external capacity mix, external mix, outsourcing mix | "External Capacity Mix" |
| budget per capacity, revenue per capacity | "Budget per Capacity" |
| offshore budget, budget offshore | "Budget Offshore" |
| outsourcing budget, budget outsourcing | "Budget Outsourcing" |
| total capacity avg, average total capacity | "Total Capacity Avg" |
| total capacity end, end total capacity | "Total Capacity End" |
| offshore capacity avg, average offshore capacity | "Offshore Capacity Avg" |
| offshore capacity end, end offshore capacity | "Offshore Capacity End" |
| outsourcing capacity avg, average outsourcing capacity | "Outsourcing Capacity Avg" |
| outsourcing capacity end, end outsourcing capacity | "Outsourcing Capacity End" |
| budget per avg capacity, budget/avg capacity | "Budget Per Avg Capacity WW" |
| budget per avg capacity entity, entity budget per avg capacity | "Budget Per Avg Capacity Entity" |
| available capacity, capacity available | "Available Capacity" |
| CTG, ctg adjustment, cost target guidance | "CTG Adjustment" |

IMPORTANT: Set use_calculation even if the user has typos in their query!
Example: "outsorcign capacty end" → use_calculation: "Outsourcing Capacity End"

COLUMN-TO-COST-CATEGORY ROUTING:
- "New Service Area" → ONLY in Cost Summary (use cost_category="Cost Summary")
- "Service Area" → ONLY in GB Wise END Capacity (use cost_category="GB Wise END Capacity")
- "ProjSubServiceArea", "ResSubServiceArea", "ResDept" → ONLY in Billing Utilization Summary

GROUPING EXAMPLES:
- "costs by new service area" → cost_category="Cost Summary", group_by=["new_service_area"]
- "amount USD by new service area" → cost_category="Cost Summary", group_by=["new_service_area"]
- "capacity by service area" → cost_category="GB Wise END Capacity", group_by=["service_area"]
- "billing utilization by ResSubServiceArea" → cost_category="Billing Utilization Summary", group_by=["res_sub_service_area"]
- "break down by department" → cost_category="Billing Utilization", group_by=["res_dept"]

EMPLOYEE FILTER EXAMPLES:
- "billing utilization for Jagadeeshaprasad Hyati" → cost_category="Billing Utilization", employee_name ILIKE "%Jagadeeshaprasad Hyati%"
- "employee number 31015375" → cost_category="Billing Utilization", employee_number = "31015375"
- "billed hours for emp: John Doe" → cost_category="Billing Utilization", employee_name ILIKE "%John Doe%"

ENTITY MATCHING RULES:
6. When user mentions an entity like "BGSW", "BGSV", "BGW" etc., ALWAYS add a region_entity filter
7. Use exact match for entity names: "=", "BGSW" - do NOT use ILIKE with wildcards for region_entity
8. For "YTD" queries, also filter year appropriately

Return a JSON object with:
{{
  "query_type": "aggregation" | "comparison" | "trend" | "detail",
  "metrics": [{{ "name": "exact_column_name", "aggregation": "SUM" | "AVG" | "COUNT" }}],
  "filters": [{{ "column": "column_name", "operator": "=" | "IN" | "ILIKE" | ">" | "<", "value": "..." }}],
  "group_by": ["column1", "column2"],
  "order_by": {{ "column": "...", "direction": "ASC" | "DESC" }},
  "limit": 100,
  "use_calculation": "calculation_name_if_applicable"
}}
"""
        context = base_context

        # FAST PATH: Entity P&L / GB P&L queries
        # "entity P&L" uses entity_category + entity_sub_category columns.
        # "GB P&L" is an alias — same routing. Cost-class terms (resource cost /
        # travel cost / other direct cost) are checked first so that queries like
        # "resource cost by GB P&L" go to the cost-class path, not entity-category.
        if is_entity_pl_query(query):
            query_lower_pl = query.lower()

            # Sub-path 0: Full GB P&L Summary — fires FIRST before any other sub-path
            # Triggered by: "summarise GB P&L", "GB P&L overview", "GB P&L report", etc.
            if is_gb_pl_summary_query(query):
                logger.info("FAST PATH: GB/Entity P&L Summary query detected")
                time_scope = detect_time_scope_from_query(query)
                intent = self._build_gb_pl_summary_intent(query)
                intent = self.apply_default_time_filters(intent, cube_id, time_scope)
                intent['original_query'] = query
                return {
                    'success': True,
                    'intent': intent,
                    'raw_query': query,
                    'matched_calculation': None,
                    'business_logic': business_logic,
                    'time_scope': time_scope,
                    'view_type': detected_view_type
                }

            # Sub-path: EBIT / EBIT% — must be checked BEFORE general entity P&L
            # so that 'ebit' in query doesn't fall through to the regular Bosch EBIT builder.
            # GB P&L EBIT queries ("GB P&L Ebit", "GB P&L Ebit%") → GB P&L EBIT builder (_build_ebit_sql)
            # Entity P&L EBIT queries ("Entity P&L Ebit") → Entity P&L EBIT builder (_build_entity_pl_ebit_sql)
            if 'ebit' in query_lower_pl:
                _ebit_is_gb_pl = is_gb_pl_query(query)
                is_pct = any(t in query_lower_pl for t in [
                    'ebit%', 'ebit %', 'ebit percentage', 'ebit percent', 'ebit pct'
                ])

                if _ebit_is_gb_pl:
                    # Route to GB P&L EBIT builder — same as plain "Ebit%" query
                    _ebit_calc = 'ebit percentage' if is_pct else 'ebit'
                    logger.info(
                        f"FAST PATH: GB P&L EBIT query detected → GB P&L EBIT builder (calc='{_ebit_calc}')"
                    )
                    time_scope = detect_time_scope_from_query(query)
                    _ebit_entity_filters = self.resolve_entity_from_query(query, business_logic)
                    _ebit_currency = detect_currency(query)
                    _ebit_amt_col = get_amount_column(_ebit_currency)
                    intent = {
                        'query_type': 'aggregation',
                        'metrics': [{'name': _ebit_amt_col, 'aggregation': 'SUM'}],
                        'filters': _ebit_entity_filters,
                        'group_by': ['region_entity'],
                        'order_by': {'column': 'ebit_percentage', 'direction': 'DESC'},
                        'limit': 100,
                        'use_calculation': _ebit_calc,
                        'currency': _ebit_currency,
                    }
                    intent = self.apply_default_time_filters(intent, cube_id, time_scope)
                    intent = self._inject_time_from_query(intent, query)
                    intent['original_query'] = query
                    return {
                        'success': True,
                        'intent': intent,
                        'raw_query': query,
                        'matched_calculation': None,
                        'business_logic': business_logic,
                        'time_scope': time_scope,
                        'view_type': detected_view_type
                    }
                else:
                    # Entity P&L EBIT — existing behaviour unchanged
                    calc_type = 'entity_pl_ebit_pct' if is_pct else 'entity_pl_ebit'
                    logger.info(
                        f"FAST PATH: Entity P&L EBIT query detected, calc_type='{calc_type}'"
                    )
                    time_scope = detect_time_scope_from_query(query)
                    intent = self._build_entity_pl_ebit_intent(query, calc_type)
                    intent = self.apply_default_time_filters(intent, cube_id, time_scope)
                    intent['original_query'] = query
                    return {
                        'success': True,
                        'intent': intent,
                        'raw_query': query,
                        'matched_calculation': None,
                        'business_logic': business_logic,
                        'time_scope': time_scope,
                        'view_type': detected_view_type
                    }

            # GB P&L helper: detect whether query is explicitly GB-level
            # (project_gb grouping) vs entity-level (region_entity grouping).
            # These sub-paths ONLY activate for GB P&L — entity P&L uses
            # entity_category column and falls through to the default sub-path.
            _is_gb_pl_query = any(kw in query_lower_pl for kw in [
                'gb p&l', 'gb pl', 'gb p and l', 'project gb p&l',
                'gb wise p&l', 'gb-wise p&l'
            ])

            # Sub-path: GB P&L Total Direct Cost (Resource + Travel + Other Direct)
            # ONLY fires for GB P&L — entity P&L falls through to entity_category path.
            if _is_gb_pl_query and any(kw in query_lower_pl for kw in [
                'total direct cost', 'total direct costs', 'direct cost total'
            ]):
                logger.info(
                    "FAST PATH: GB P&L Total Direct Cost → _build_direct_cost_sql"
                )
                time_scope = detect_time_scope_from_query(query)
                _tdc_entity_filters = self.resolve_entity_from_query(query, business_logic)
                _tdc_currency = detect_currency(query)
                _tdc_amt_col = get_amount_column(_tdc_currency)
                intent = {
                    'query_type': 'aggregation',
                    'metrics': [{'name': _tdc_amt_col, 'aggregation': 'SUM'}],
                    'filters': _tdc_entity_filters,
                    'group_by': ['project_gb'],
                    'order_by': {'column': 'total_direct_cost', 'direction': 'DESC'},
                    'limit': 100,
                    'use_calculation': 'gb p&l total direct cost',
                    'currency': _tdc_currency,
                }
                intent = self.apply_default_time_filters(intent, cube_id, time_scope)
                intent = self._inject_time_from_query(intent, query)
                intent['original_query'] = query
                return {
                    'success': True,
                    'intent': intent,
                    'raw_query': query,
                    'matched_calculation': None,
                    'business_logic': business_logic,
                    'time_scope': time_scope,
                    'view_type': detected_view_type
                }

            # Sub-path: GB P&L Corporate Cost / Indirect Cost
            # ONLY fires for GB P&L — entity P&L falls through to entity_category path.
            if _is_gb_pl_query and any(kw in query_lower_pl for kw in [
                'corporate cost', 'corporate costs', 'indirect cost', 'indirect costs'
            ]):
                logger.info(
                    "FAST PATH: GB P&L Corporate/Indirect Cost → _build_indirect_cost_sql"
                )
                time_scope = detect_time_scope_from_query(query)
                _corp_entity_filters = self.resolve_entity_from_query(query, business_logic)
                _corp_currency = detect_currency(query)
                _corp_amt_col = get_amount_column(_corp_currency)
                intent = {
                    'query_type': 'aggregation',
                    'metrics': [{'name': _corp_amt_col, 'aggregation': 'SUM'}],
                    'filters': _corp_entity_filters,
                    'group_by': ['project_gb'],
                    'order_by': {'column': 'indirect_cost', 'direction': 'DESC'},
                    'limit': 100,
                    'use_calculation': 'gb p&l corporate cost',
                    'currency': _corp_currency,
                }
                intent = self.apply_default_time_filters(intent, cube_id, time_scope)
                intent = self._inject_time_from_query(intent, query)
                intent['original_query'] = query
                return {
                    'success': True,
                    'intent': intent,
                    'raw_query': query,
                    'matched_calculation': None,
                    'business_logic': business_logic,
                    'time_scope': time_scope,
                    'view_type': detected_view_type
                }

            # Sub-path: GB P&L Gross Margin / Gross Margin %
            # ONLY fires for GB P&L — entity P&L falls through to entity_category path.
            # apply_pl_exclusions=True ensures revenue excludes order_reason YEH/YEI/YEJ/YEK/YN2
            # and gl_account starting with '139'.
            if _is_gb_pl_query and any(kw in query_lower_pl for kw in [
                'gross margin', 'gross profit'
            ]):
                logger.info(
                    "FAST PATH: GB P&L Gross Margin → _build_gross_margin_sql [P&L exclusions ON]"
                )
                time_scope = detect_time_scope_from_query(query)
                _gm_entity_filters = self.resolve_entity_from_query(query, business_logic)
                _gm_currency = detect_currency(query)
                _gm_amt_col = get_amount_column(_gm_currency)
                intent = {
                    'query_type': 'aggregation',
                    'metrics': [{'name': _gm_amt_col, 'aggregation': 'SUM'}],
                    'filters': _gm_entity_filters,
                    'group_by': ['project_gb'],
                    'order_by': {'column': 'gross_margin', 'direction': 'DESC'},
                    'limit': 100,
                    'use_calculation': 'gb p&l gross margin',
                    'currency': _gm_currency,
                }
                intent = self.apply_default_time_filters(intent, cube_id, time_scope)
                intent = self._inject_time_from_query(intent, query)
                intent['original_query'] = query
                return {
                    'success': True,
                    'intent': intent,
                    'raw_query': query,
                    'matched_calculation': None,
                    'business_logic': business_logic,
                    'time_scope': time_scope,
                    'view_type': detected_view_type
                }

            # Sub-path: Cost Class (resource cost / travel cost / other direct cost)
            # Checked directly here (bypassing detect_cost_class_from_query's entity-pl gate)
            # so that "resource cost by GB P&L" → Path C, not Path A.
            # BUT: pure "entity P&L" queries ALWAYS use entity_category — never cost_category_class.
            # e.g. "entity P&L travel expenses" → entity_category='Travel expenses',
            # NOT cost_category_class='Travel Cost'.  Skip cost_class for entity P&L queries.
            # GB P&L queries with a cost-class term (e.g. "GB P&L resource cost") SHOULD
            # still detect the cost class and route to sub_cost_category breakdown.
            _sorted_cost_keys = sorted(COST_CLASS_MAPPING.keys(), key=len, reverse=True)
            _detected_cost_class_pl = None if (is_entity_pl_query(query) and not _is_gb_pl_query) else next(
                (COST_CLASS_MAPPING[k] for k in _sorted_cost_keys if k in query_lower_pl),
                None
            )
            if _detected_cost_class_pl:
                logger.info(
                    f"FAST PATH: GB/Entity P&L cost-class query detected, "
                    f"class='{_detected_cost_class_pl}' from query"
                )
                _entity_filters_pl = self.resolve_entity_from_query(query, business_logic)
                intent = self._build_cost_class_intent(
                    query, _detected_cost_class_pl, _entity_filters_pl
                )
                time_scope = detect_time_scope_from_query(query)
                intent = self.apply_default_time_filters(intent, cube_id, time_scope)
                intent['original_query'] = query
                return {
                    'success': True,
                    'intent': intent,
                    'raw_query': query,
                    'matched_calculation': None,
                    'business_logic': business_logic,
                    'time_scope': time_scope,
                    'view_type': detected_view_type
                }

            # Sub-path: P&L Revenue (standalone revenue with P&L exclusions)
            # Checked BEFORE the generic entity-category breakdown so that
            # "gb p&l revenue for mar 2025" / "entity p&l revenue" route to
            # the dedicated revenue builders, not the entity_category drill-down.
            _is_pl_revenue = any(kw in query_lower_pl for kw in [
                'p&l revenue', 'pl revenue', 'p and l revenue', 'p&l rev',
                'o&l revenue', 'o&l rev'
            ])
            # 'Revenue Software' and 'Revenue Hardware' are entity P&L cost categories
            # whose names start with "revenue" — they must NOT trigger the revenue builder.
            _is_revenue_entity_category = any(kw in query_lower_pl for kw in [
                'revenue software', 'revenue hardware'
            ])
            if _is_revenue_entity_category:
                _is_pl_revenue = False
            if _is_pl_revenue:
                _is_gb_level = any(kw in query_lower_pl for kw in [
                    ' gb ', 'project gb', 'project_gb', 'gb p&l', 'gb pl',
                    'gb wise', 'gb-wise'
                ])
                _pl_rev_calc = 'gb p&l revenue' if _is_gb_level else 'entity p&l revenue'
                logger.info(
                    f"FAST PATH: P&L Revenue query → use_calculation='{_pl_rev_calc}'"
                )
                time_scope = detect_time_scope_from_query(query)
                entity_filters_pl_rev = self.resolve_entity_from_query(
                    query, business_logic)
                intent = {
                    'query_type': 'aggregation',
                    'metrics': [{'name': 'pl_revenue', 'aggregation': 'SUM'}],
                    'filters': entity_filters_pl_rev,
                    'group_by': [],
                    'order_by': {'column': 'pl_revenue', 'direction': 'DESC'},
                    'limit': 100,
                    'use_calculation': _pl_rev_calc,
                }
                intent = self.apply_default_time_filters(intent, cube_id,
                                                        time_scope)
                intent = self._inject_time_from_query(intent, query)
                intent['original_query'] = query
                return {
                    'success': True,
                    'intent': intent,
                    'raw_query': query,
                    'matched_calculation': _pl_rev_calc,
                    'business_logic': business_logic,
                    'time_scope': time_scope,
                    'view_type': detected_view_type
                }

            # Default sub-path: route by P&L type
            # GB P&L  → group by sub_cost_category (GB P&L cost line items)
            # Entity P&L → group by entity_sub_category (entity-level cost line items)
            if _is_gb_pl_query:
                logger.info(
                    "FAST PATH: GB P&L cost breakdown → _build_gb_pl_cost_breakdown_intent"
                )
                intent = self._build_gb_pl_cost_breakdown_intent(query)
            else:
                detected_entity_category = detect_entity_category_from_query(query)
                logger.info(
                    f"FAST PATH: Entity P&L query detected, category='{detected_entity_category}' from query"
                )
                intent = self._build_entity_pl_intent(query,
                                                      detected_entity_category)
            time_scope = detect_time_scope_from_query(query)
            intent = self.apply_default_time_filters(intent, cube_id,
                                                     time_scope)
            intent['original_query'] = query
            return {
                'success': True,
                'intent': intent,
                'raw_query': query,
                'matched_calculation': None,
                'business_logic': business_logic,
                'time_scope': time_scope,
                'view_type': detected_view_type
            }

        # FAST PATH: Cost Category Class queries (resource cost, travel cost, etc.)
        # Detect cost class from query and build intent without LLM
        detected_cost_class = detect_cost_class_from_query(query)
        if detected_cost_class:
            logger.info(
                f"FAST PATH: Detected cost class '{detected_cost_class}' from query"
            )
            entity_filters_for_cost = self.resolve_entity_from_query(
                query, business_logic)
            intent = self._build_cost_class_intent(query, detected_cost_class,
                                                   entity_filters_for_cost)
            time_scope = detect_time_scope_from_query(query)
            intent = self.apply_default_time_filters(intent, cube_id,
                                                     time_scope)
            intent['original_query'] = query
            return {
                'success': True,
                'intent': intent,
                'raw_query': query,
                'matched_calculation': None,
                'business_logic': business_logic,
                'time_scope': time_scope,
                'view_type': detected_view_type
            }

        # FAST PATH: Skip OpenAI if we've already matched a KPI calculation
        # This avoids token limit issues (429 errors) for known KPI queries
        # Any matched calculation from get_matching_calculation (DB or trigger dict) is trusted
        _multi_metric_calcs: list = []  # set below when 2+ distinct calcs detected
        kpi_keywords = [
            'capacity', 'pyramid', 'mix', 'attrition', 'billing',
            'utilization', 'budget', 'ebit', 'revenue', 'price', 'available',
            'offshore', 'outsourcing', 'ctg', 'plan vs actual', 'travel cost',
            'direct cost', 'indirect cost', 'gross margin', 'resource cost',
            'other direct cost'
        ]

        if matching_calc:
            calc_name = matching_calc.get('calculation_name', '')
            calc_lower = calc_name.lower()
            if any(kpi in calc_lower for kpi in kpi_keywords):
                # ── MULTI-METRIC CHECK ────────────────────────────────────────
                # If the query triggers 2+ distinct calculations, skip the fast
                # path so LLM routing (which supports metrics[]) can handle it.
                all_matched = self.get_matching_calculation(
                    query, business_logic, return_all=True)
                all_unique_names = list(
                    dict.fromkeys(
                        c.get('calculation_name', '') for c in all_matched
                        if c.get('calculation_name')
                    )
                )
                if len(all_unique_names) > 1:
                    logger.info(
                        f"MULTI-METRIC: {len(all_unique_names)} calcs detected "
                        f"{all_unique_names} — skipping fast path, routing to LLM"
                    )
                    _multi_metric_calcs = all_unique_names
                    # Fall through to LLM routing (do NOT return here)
                else:
                    logger.info(
                        f"FAST PATH: Skipping OpenAI for KPI calculation: {calc_name}"
                    )
                    # Build minimal intent with extracted year/month and group_by from query
                    intent = self._build_kpi_intent_fast(query, calc_name,
                                                         entity_filters,
                                                         group_by_hint=_gb_group_by_hint)

                    # Apply time scope and default filters
                    time_scope = detect_time_scope_from_query(query)
                    logger.info(f"Detected time scope: {time_scope}")
                    intent = self.apply_default_time_filters(
                        intent, cube_id, time_scope)
                    intent['use_calculation'] = calc_name
                    intent['original_query'] = query

                    # POST-PROCESSING: Fix cost_category exact matching, metrics, and
                    # include_exclude filter (adds 'Include' for WW revenue queries).
                    # This was previously only called on the LLM path — fast-path needs it too.
                    intent = self._fix_cost_category_and_metrics(intent, query)

                    # Return in the same format as OpenAI path
                    return {
                        'success': True,
                        'intent': intent,
                        'raw_query': query,
                        'matched_calculation': matching_calc,
                        'business_logic': business_logic,
                        'time_scope': time_scope,
                        'view_type': detected_view_type
                    }

        # FAST PATH: View-trigger budget queries (e.g. "SX Budget", "MS Budget")
        # When a view trigger is present and the query mentions "budget" or "revenue",
        # skip the LLM entirely — route as a revenue query with the view filter applied.
        _view_triggers_fp = {'sx', 'ms', 'vm', 'ps', 'xc'}
        _query_has_view_fp = any(
            bool(re.search(r'\b' + re.escape(_vt) + r'\b', query_lower))
            for _vt in _view_triggers_fp
        )
        _query_has_budget_fp = any(kw in query_lower for kw in ['budget', 'revenue', 'plan'])
        # FAST PATH 1: View-trigger budget queries (e.g. "SX Budget", "MS Budget")
        if _query_has_view_fp and _query_has_budget_fp and not matching_calc:
            logger.info(
                f"FAST PATH: View-trigger budget/revenue query detected (no calc matched), "
                f"routing as revenue, view_type={detected_view_type}"
            )
            _fp_intent = self._build_kpi_intent_fast(query, 'revenue', entity_filters,
                                                    group_by_hint=_gb_group_by_hint)
            _fp_time_scope = detect_time_scope_from_query(query)
            _fp_intent = self.apply_default_time_filters(_fp_intent, cube_id, _fp_time_scope)
            _fp_intent['use_calculation'] = 'revenue'
            _fp_intent['original_query'] = query
            _fp_intent = self._fix_cost_category_and_metrics(_fp_intent, query)
            return {
                'success': True,
                'intent': _fp_intent,
                'raw_query': query,
                'matched_calculation': None,
                'business_logic': business_logic,
                'time_scope': _fp_time_scope,
                'view_type': detected_view_type
            }

        # FAST PATH 2: Entity budget/revenue queries (e.g. "budget for BGSW in mar 2025")
        # When entity_filters has a region_entity and query mentions budget/revenue (no WW keywords),
        # skip the LLM and route directly as revenue with entity filter.
        _has_entity_filter = any(
            ef.get('column', '').lower() == 'region_entity'
            for ef in entity_filters
        )
        _ww_keywords = {'worldwide', 'world wide', ' ww ', 'global', 'ww budget', 'total ww'}
        _query_is_ww = any(kw in query_lower for kw in _ww_keywords)
        _query_has_by_entity = 'by entity' in query_lower or 'entity wise' in query_lower or 'entity-wise' in query_lower

        if (_has_entity_filter or _query_has_by_entity) and _query_has_budget_fp and not matching_calc and not _query_is_ww:
            logger.info(
                f"FAST PATH: Entity budget/revenue query detected (no calc matched, entity present), "
                f"routing as revenue with entity filter"
            )
            _fp2_intent = self._build_kpi_intent_fast(query, 'revenue', entity_filters,
                                                      group_by_hint=_gb_group_by_hint)
            _fp2_time_scope = detect_time_scope_from_query(query)
            _fp2_intent = self.apply_default_time_filters(_fp2_intent, cube_id, _fp2_time_scope)
            _fp2_intent['use_calculation'] = 'revenue'
            _fp2_intent['original_query'] = query
            return {
                'success': True,
                'intent': _fp2_intent,
                'raw_query': query,
                'matched_calculation': None,
                'business_logic': business_logic,
                'time_scope': _fp2_time_scope,
                'view_type': detected_view_type
            }

        try:
            # Truncate prompt to avoid 413 "Request Entity Too Large" from Ollama
            _MAX_PROMPT_CHARS = 12000
            _raw_prompt = f"system: {context}\nuser: Parse this query: {query}\nRespond with ONLY valid JSON, no explanation.\nassistant:"
            if len(_raw_prompt) > _MAX_PROMPT_CHARS:
                _context_budget = _MAX_PROMPT_CHARS - len(query) - 200
                _truncated_context = context[:max(0, _context_budget)]
                logger.warning(
                    f"LLM prompt truncated: {len(_raw_prompt)} → {_MAX_PROMPT_CHARS} chars"
                )
                llm_prompt = f"system: {_truncated_context}\nuser: Parse this query: {query}\nRespond with ONLY valid JSON, no explanation.\nassistant:"
            else:
                llm_prompt = _raw_prompt
            raw_response = get_llm_response(llm_prompt, ai_config=ai_config)
            # Extract JSON from response (model may wrap in markdown or add explanation)
            import re as _re
            json_match = _re.search(r'\{[\s\S]*\}', raw_response)
            if not json_match:
                raise ValueError(f"No JSON found in LLM response: {raw_response[:200]}")
            response = json_match.group(0)

            intent = json.loads(response)

            # Merge detected entity filters into intent if not already present
            if entity_filters:
                existing_filters = intent.get('filters', [])
                existing_cols = {f.get('column') for f in existing_filters}
                for ef in entity_filters:
                    if ef['column'] not in existing_cols:
                        existing_filters.append({
                            'column': ef['column'],
                            'operator': ef['operator'],
                            'value': ef['value']
                        })
                    # Handle group_by_gb flag for MS/GB combined view
                    if ef.get('group_by_gb'):
                        existing_group_by = intent.get('group_by', [])
                        if 'project_gb' not in existing_group_by:
                            existing_group_by.append('project_gb')
                            intent['group_by'] = existing_group_by
                            logger.info(
                                f"Added project_gb to group_by for GB combined view"
                            )
                intent['filters'] = existing_filters
                logger.info(
                    f"Added entity filters to intent: {entity_filters}")

            # POST-PROCESSING: Fix cost_category for employee-level queries
            # If query contains employee filters, switch from Summary to Detail cost_category
            intent = self._fix_employee_level_cost_category(intent, query)

            # POST-PROCESSING: Fix cost_category exact matching and Attrition metrics
            # Converts ILIKE filters to exact = matching, routes Attrition to use correct column
            intent = self._fix_cost_category_and_metrics(intent, query)

            # POST-PROCESSING: Expand month ranges and quarters from query
            # Overrides LLM single-month result when query has "jan to mar" or "Q1" etc.
            intent = self._expand_month_range_from_query(intent, query)

            # POST-PROCESSING: Apply default time filters if no year/month specified
            # Detect time scope from query (all_available, compare_years, specific, default)
            time_scope = detect_time_scope_from_query(query)
            logger.info(f"Detected time scope: {time_scope}")
            intent = self.apply_default_time_filters(intent, cube_id,
                                                     time_scope)

            # POST-PROCESSING: Set use_calculation (or multi_metric_calcs) if matching calc found
            # When 2+ distinct calcs detected, store all names so compile_sql can run each
            # independently via _compile_multi_metric_sql instead of picking just one.
            if _multi_metric_calcs and len(_multi_metric_calcs) > 1:
                intent['multi_metric_calcs'] = _multi_metric_calcs
                # Remove any single use_calculation the LLM may have set
                intent.pop('use_calculation', None)
                logger.info(
                    f"Set multi_metric_calcs in intent: {_multi_metric_calcs}")
            elif matching_calc and not intent.get('use_calculation'):
                calc_name = matching_calc.get('calculation_name', '')
                if calc_name:
                    intent['use_calculation'] = calc_name
                    logger.info(
                        f"Set use_calculation from matched calc: {calc_name}")

            # Always propagate original query so compile_sql fast-paths can fire
            if 'original_query' not in intent:
                intent['original_query'] = query

            return {
                'success': True,
                'intent': intent,
                'raw_query': query,
                'matched_calculation': matching_calc,
                'business_logic': business_logic,
                'time_scope': time_scope,
                'view_type': detected_view_type
            }

        except Exception as e:
            logger.exception(f"Intent parsing failed: {e}")
            return {'success': False, 'error': str(e)}

    def _build_kpi_intent_fast(self, query: str, calc_name: str,
                               entity_filters: List[Dict],
                               group_by_hint: List[str] = None) -> Dict[str, Any]:
        """
        Build a minimal intent for KPI calculations without calling OpenAI.
        Extracts year, month, and group_by from query using regex patterns.
        This is used when we've already matched a known KPI calculation.

        group_by_hint: override the default ['region_entity'] group_by.
          PS/VM/XC GB views pass ['project_gb'] so results group by project GB.
          Query-level "by entity" / "by month" patterns still take priority over the hint.
        """
        query_lower = query.lower()

        # Determine the default group_by dimension:
        # - PS/VM/XC views pass group_by_hint=['project_gb'] → default to project_gb
        # - All other views/queries default to region_entity
        _default_group_by = group_by_hint if group_by_hint else ['region_entity']

        # Initialize intent with defaults
        intent = {
            'query_type': 'aggregation',
            'metrics': [],
            'filters': [],
            'group_by': _default_group_by,
            'limit': 100
        }

        # Extract year from query
        year_match = re.search(r'\b(20\d{2})\b', query)
        if year_match:
            intent['filters'].append({
                'column': 'year',
                'operator': '=',
                'value': int(year_match.group(1))
            })

        # Extract month from query (Jan=1, Feb=2, etc.)
        month_names = {
            'jan': 1,
            'january': 1,
            'feb': 2,
            'february': 2,
            'mar': 3,
            'march': 3,
            'apr': 4,
            'april': 4,
            'may': 5,
            'jun': 6,
            'june': 6,
            'jul': 7,
            'july': 7,
            'aug': 8,
            'august': 8,
            'sep': 9,
            'september': 9,
            'oct': 10,
            'october': 10,
            'nov': 11,
            'november': 11,
            'dec': 12,
            'december': 12
        }

        # Quarter detection first: Q1→[1,2,3], Q2→[4,5,6], Q3→[7,8,9], Q4→[10,11,12]
        _quarter_map = {
            'q1': [1, 2, 3], 'q2': [4, 5, 6],
            'q3': [7, 8, 9], 'q4': [10, 11, 12]
        }
        _fkpi_text_quarter_patterns = [
            (r'\b(?:first|1st)\s+quarter\b', [1, 2, 3]),
            (r'\b(?:second|2nd)\s+quarter\b', [4, 5, 6]),
            (r'\b(?:third|3rd)\s+quarter\b', [7, 8, 9]),
            (r'\b(?:fourth|4th)\s+quarter\b', [10, 11, 12]),
        ]
        _fkpi_all_q_months: List[int] = []
        _fkpi_qrange = re.search(r'\bq([1-4])\s*(?:to|through|thru|\-)\s*q([1-4])\b', query_lower)
        if _fkpi_qrange:
            _qs, _qe = int(_fkpi_qrange.group(1)), int(_fkpi_qrange.group(2))
            for _qi in range(min(_qs, _qe), max(_qs, _qe) + 1):
                _fkpi_all_q_months.extend(_quarter_map[f'q{_qi}'])
        else:
            for _q_key, _q_months in _quarter_map.items():
                if re.search(r'\b' + _q_key + r'\b', query_lower):
                    _fkpi_all_q_months.extend(_q_months)
            if not _fkpi_all_q_months:
                for _tpat, _tqm in _fkpi_text_quarter_patterns:
                    if re.search(_tpat, query_lower):
                        _fkpi_all_q_months.extend(_tqm)
        _quarter_detected = bool(_fkpi_all_q_months)
        if _quarter_detected:
            _fkpi_q_months = sorted(set(_fkpi_all_q_months))
            intent['filters'].append({
                'column': 'month',
                'operator': 'IN',
                'value': _fkpi_q_months
            })
            if 'month' not in intent.get('group_by', []):
                intent['group_by'] = ['month'] + intent.get('group_by', ['region_entity'])
            logger.info(f"Fast KPI: quarters detected → months {_fkpi_q_months}")

        if not _quarter_detected:
            # Range detection: "jan to mar", "january to march", "jan - mar", "jan thru mar"
            _month_abbrevs = '|'.join([
                'jan(?:uary)?', 'feb(?:ruary)?', 'mar(?:ch)?', 'apr(?:il)?',
                'may', 'jun(?:e)?', 'jul(?:y)?', 'aug(?:ust)?',
                'sep(?:tember)?', 'oct(?:ober)?', 'nov(?:ember)?', 'dec(?:ember)?'
            ])
            _range_match = re.search(
                r'\b(' + _month_abbrevs + r')\s+(?:\d{4}\s+)?(?:to|through|thru|-)\s+(' + _month_abbrevs + r')\b',
                query_lower
            )
            if _range_match:
                _start_key = _range_match.group(1)[:3]
                _end_key = _range_match.group(2)[:3]
                _start_num = month_names.get(_start_key, 0)
                _end_num = month_names.get(_end_key, 0)
                if _start_num and _end_num and _start_num <= _end_num:
                    _range_months = list(range(_start_num, _end_num + 1))
                    if len(_range_months) == 1:
                        intent['filters'].append({
                            'column': 'month', 'operator': '=', 'value': _range_months[0]
                        })
                    else:
                        intent['filters'].append({
                            'column': 'month', 'operator': 'IN', 'value': _range_months
                        })
                    logger.info(f"Fast KPI: month range detected → months {_range_months}")
                else:
                    # Fallback: detect all individually mentioned months
                    _detected_months = []
                    for _mn, _mv in month_names.items():
                        if re.search(r'\b' + _mn + r'\b', query_lower) and _mv not in _detected_months:
                            _detected_months.append(_mv)
                    _detected_months.sort()
                    if len(_detected_months) == 1:
                        intent['filters'].append({'column': 'month', 'operator': '=', 'value': _detected_months[0]})
                    elif len(_detected_months) > 1:
                        intent['filters'].append({'column': 'month', 'operator': 'IN', 'value': _detected_months})
            else:
                # No range: detect ALL individually mentioned months (not just the first)
                _detected_months = []
                for _mn, _mv in month_names.items():
                    if re.search(r'\b' + _mn + r'\b', query_lower) and _mv not in _detected_months:
                        _detected_months.append(_mv)
                _detected_months.sort()
                if len(_detected_months) == 1:
                    intent['filters'].append({'column': 'month', 'operator': '=', 'value': _detected_months[0]})
                elif len(_detected_months) > 1:
                    intent['filters'].append({'column': 'month', 'operator': 'IN', 'value': _detected_months})
                    if 'month' not in intent.get('group_by', []):
                        intent['group_by'] = ['month'] + intent.get('group_by', ['region_entity'])

        # Entity codes + country name aliases → canonical entity codes
        _entity_aliases = {
            'bgsw/ne-mx':  'BGSW/NE-MX',
            'bgsw/ebs-pl': 'BGSW/EBS-PL',
            'bgsw':        'BGSW',
            'bgsv':        'BGSV',
            'bgsj':        'BGSJ',
            'bgsg':        'BGSG',
            'bgw':         'BGW',
            'bgv':         'BGSV',   # informal alias for BGSV
            # Country name aliases
            'india':       'BGSW',
            'vietnam':     'BGSV',
            'japan':       'BGSJ',
            'germany':     'BGSG',
            'mexico':      'BGSW/NE-MX',
            'ebs':         'BGSW/EBS-PL',
            'poland':      'BGSW/EBS-PL',
        }
        # Match longest alias first to avoid partial overlaps (e.g. 'bgsw/ne-mx' before 'bgsw')
        _pl_detected_entities_set = []
        for alias in sorted(_entity_aliases, key=len, reverse=True):
            if re.search(r'\b' + re.escape(alias) + r'\b', query_lower):
                canonical = _entity_aliases[alias]
                if canonical not in _pl_detected_entities_set:
                    _pl_detected_entities_set.append(canonical)
        _pl_detected_entities = _pl_detected_entities_set
        if len(_pl_detected_entities) == 1:
            intent['filters'].append({
                'column': 'region_entity',
                'operator': '=',
                'value': _pl_detected_entities[0]
            })
        elif len(_pl_detected_entities) > 1:
            intent['filters'].append({
                'column': 'region_entity',
                'operator': 'IN',
                'value': _pl_detected_entities
            })
            if 'region_entity' not in intent['group_by']:
                intent['group_by'] = ['region_entity'] + intent['group_by']

        # Detect group_by from query
        # Multi-dimensional grouping for fast KPI path
        _fkpi_dims: List[str] = []
        if any(p in query_lower for p in ['by entity', 'by entities', 'entity wise', 'entity-wise']):
            _fkpi_dims.append('region_entity')
        if any(p in query_lower for p in ['by project gb', 'by gb', 'by project', 'project gb wise', 'gb wise', 'project wise']):
            _fkpi_dims.append('project_gb')
        if any(p in query_lower for p in ['by sector', 'sector wise', 'sector-wise']):
            _fkpi_dims.append('sector')
        if any(p in query_lower for p in ['by service area', 'service area wise']):
            _fkpi_dims.append('new_service_area')
        if any(p in query_lower for p in ['by month', 'monthly', 'month wise', 'month-wise', 'monthwise', 'month by month']):
            _fkpi_dims.append('month')
        if any(p in query_lower for p in ['by year', 'yearly', 'year wise', 'year-wise', 'annual']):
            _fkpi_dims.append('year')
        if _fkpi_dims:
            intent['group_by'] = _fkpi_dims
        elif 'worldwide' in query_lower or 'world wide' in query_lower:
            intent['group_by'] = []  # No grouping for worldwide

        # Merge entity filters from pre-detection
        if entity_filters:
            for ef in entity_filters:
                intent['filters'].append({
                    'column': ef['column'],
                    'operator': ef['operator'],
                    'value': ef['value']
                })

        logger.info(
            f"Built fast KPI intent: year={[f['value'] for f in intent['filters'] if f['column']=='year']}, month={[f['value'] for f in intent['filters'] if f['column']=='month']}, group_by={intent['group_by']}"
        )
        return intent

    def _build_cost_class_intent(self, query: str, cost_class: str,
                                 entity_filters: List[Dict]) -> Dict[str, Any]:
        """Build intent for cost category class queries (resource cost, travel cost, etc.).
        
        Always filters cost_category='Cost Summary' and cost_category_class=<detected class>.
        Always groups by sub_cost_category for the breakdown.
        Optionally also groups by region_entity if user says 'by entity'.
        """
        query_lower = query.lower()

        # Multi-dimensional grouping: each dimension detected independently
        # so "by entity and month", "by sector and month", etc. all work
        _ccl_dims: List[str] = []
        if any(p in query_lower for p in ['by entity', 'by entities', 'entity wise', 'entity-wise']):
            _ccl_dims.append('region_entity')
        if any(p in query_lower for p in ['by sector', 'sector wise', 'sector-wise']):
            _ccl_dims.append('sector')
        if any(p in query_lower for p in ['by service area', 'by new service area']):
            _ccl_dims.append('new_service_area')
        if any(p in query_lower for p in ['by project', 'by projectgb']):
            _ccl_dims.append('project_gb')
        if any(p in query_lower for p in ['by month', 'monthly', 'month wise', 'month-wise', 'monthwise', 'month by month']):
            _ccl_dims.append('month')
        if any(p in query_lower for p in ['by year', 'yearly', 'year wise', 'year-wise', 'annual']):
            _ccl_dims.append('year')
        group_by = _ccl_dims + ['sub_cost_category'] if _ccl_dims else ['sub_cost_category']

        entities = [
            'bgsw/ne-mx', 'bgsw/ebs-pl', 'bgsw', 'bgsv', 'bgsj', 'bgsg',
            'bhcs', 'rbna', 'rbmi', 'rbks', 'rbgb', 'bgv'
        ]
        _ccl_canonical = {'bgv': 'BGSV'}
        _all_entity_matches = [e for e in entities if e in query_lower]
        # Remove shorter entities that are a substring of a longer matched entity
        # e.g. "bgsw/ne-mx" in query → don't also add "bgsw"
        _all_entity_matches = [
            e for e in _all_entity_matches
            if not any(e != other and e in other for other in _all_entity_matches)
        ]
        detected_entities = [_ccl_canonical.get(e, e.upper()) for e in _all_entity_matches]

        _cost_class_currency = detect_currency(query)
        _cost_class_amt_col = get_amount_column(_cost_class_currency)

        intent = {
            'query_type':
            'aggregation',
            'metrics': [{
                'name': _cost_class_amt_col,
                'aggregation': 'SUM'
            }],
            'filters': [{
                'column': 'cost_category',
                'operator': '=',
                'value': 'Cost Summary'
            }, {
                'column': 'cost_category_class',
                'operator': '=',
                'value': cost_class
            }],
            'group_by':
            group_by,
            'order_by': {
                'column': _cost_class_amt_col,
                'direction': 'DESC'
            },
            'limit':
            100,
            'currency':
            _cost_class_currency
        }

        year_match = re.search(r'\b(20\d{2})\b', query)
        if year_match:
            intent['filters'].append({
                'column': 'year',
                'operator': '=',
                'value': int(year_match.group(1))
            })

        month_names = {
            'jan': 1,
            'january': 1,
            'feb': 2,
            'february': 2,
            'mar': 3,
            'march': 3,
            'apr': 4,
            'april': 4,
            'may': 5,
            'jun': 6,
            'june': 6,
            'jul': 7,
            'july': 7,
            'aug': 8,
            'august': 8,
            'sep': 9,
            'september': 9,
            'oct': 10,
            'october': 10,
            'nov': 11,
            'november': 11,
            'dec': 12,
            'december': 12
        }
        # Collect ALL months mentioned (longer names first to avoid partial matches).
        # When multiple months are detected, use IN operator and add month+year to group_by.
        _ccl_seen_months: set = set()
        for month_name, month_num in sorted(month_names.items(),
                                            key=lambda x: len(x[0]),
                                            reverse=True):
            if re.search(r'\b' + month_name + r'\b', query_lower) and month_num not in _ccl_seen_months:
                _ccl_seen_months.add(month_num)
        _ccl_detected_months = sorted(_ccl_seen_months)
        if len(_ccl_detected_months) == 1:
            intent['filters'].append({
                'column': 'month',
                'operator': '=',
                'value': _ccl_detected_months[0]
            })
        elif len(_ccl_detected_months) > 1:
            intent['filters'].append({
                'column': 'month',
                'operator': 'IN',
                'value': _ccl_detected_months
            })
            # Add month and year to group_by so each month appears as its own column
            if 'month' not in intent['group_by']:
                intent['group_by'] = ['month'] + intent['group_by']
            if 'year' not in intent['group_by']:
                intent['group_by'] = intent['group_by'] + ['year']

        # Quarter detection: Q1→[1,2,3], Q2→[4,5,6], Q3→[7,8,9], Q4→[10,11,12]
        # Collect ALL quarters mentioned (ranges, individual Q1/Q2/Q3/Q4, text-based)
        _quarter_map = {'q1': [1,2,3], 'q2': [4,5,6], 'q3': [7,8,9], 'q4': [10,11,12]}
        _llm_text_qp = [
            (r'\b(?:first|1st)\s+quarter\b', [1,2,3]),
            (r'\b(?:second|2nd)\s+quarter\b', [4,5,6]),
            (r'\b(?:third|3rd)\s+quarter\b', [7,8,9]),
            (r'\b(?:fourth|4th)\s+quarter\b', [10,11,12]),
        ]
        _llm_all_q_months: List[int] = []
        _llm_qrange = re.search(r'\bq([1-4])\s*(?:to|through|thru|\-)\s*q([1-4])\b', query_lower)
        if _llm_qrange:
            _qs, _qe = int(_llm_qrange.group(1)), int(_llm_qrange.group(2))
            for _qi in range(min(_qs, _qe), max(_qs, _qe) + 1):
                _llm_all_q_months.extend(_quarter_map[f'q{_qi}'])
        else:
            for _q, _months in _quarter_map.items():
                if re.search(r'\b' + _q + r'\b', query_lower):
                    _llm_all_q_months.extend(_months)
            if not _llm_all_q_months:
                for _tpat, _tqm in _llm_text_qp:
                    if re.search(_tpat, query_lower):
                        _llm_all_q_months.extend(_tqm)
        if _llm_all_q_months:
            _combined_q = sorted(set(_llm_all_q_months))
            # Remove any single-month filter added by the month loop above
            intent['filters'] = [f for f in intent['filters'] if f.get('column') != 'month']
            intent['filters'].append({
                'column': 'month',
                'operator': 'IN',
                'value': _combined_q
            })
            # Group by month so each month appears as its own row
            if 'month' not in intent['group_by']:
                intent['group_by'] = ['month'] + intent['group_by']

        # Multi-entity filter: use IN for multiple, = for single
        if len(detected_entities) == 1:
            intent['filters'].append({
                'column': 'region_entity',
                'operator': '=',
                'value': detected_entities[0]
            })
        elif len(detected_entities) > 1:
            intent['filters'].append({
                'column': 'region_entity',
                'operator': 'IN',
                'value': detected_entities
            })
            # Show each entity as its own row
            if 'region_entity' not in intent['group_by']:
                intent['group_by'] = ['region_entity'] + intent['group_by']

        if entity_filters:
            for ef in entity_filters:
                ef_col = ef.get('column')
                ef_val = ef.get('value')
                # Skip region_entity if already handled by local detection
                if ef_col == 'region_entity':
                    existing_vals = [
                        f.get('value') for f in intent['filters']
                        if f.get('column') == 'region_entity'
                    ]
                    ef_val_clean = ef_val.strip('%') if isinstance(ef_val, str) else ef_val
                    if ef_val_clean not in existing_vals and ef_val not in existing_vals:
                        intent['filters'].append({
                            'column': 'region_entity',
                            'operator': '=',
                            'value': ef_val_clean
                        })
                else:
                    intent['filters'].append({
                        'column': ef_col,
                        'operator': ef.get('operator', '='),
                        'value': ef_val
                    })

        # Auto-add month to group_by when multiple months are in the filter
        # (e.g. "jan to mar" → IN [1,2,3]) so results show one row per month
        _ccl_month_f = next((f for f in intent['filters'] if f.get('column') == 'month'), None)
        if _ccl_month_f and isinstance(_ccl_month_f.get('value'), list) and len(_ccl_month_f['value']) > 1:
            if 'month' not in intent['group_by']:
                intent['group_by'] = ['month'] + intent['group_by']

        logger.info(
            f"Built cost class intent: class='{cost_class}', group_by={intent['group_by']}, entities={detected_entities}"
        )
        return intent

    def _build_entity_pl_intent(
            self, query: str,
            entity_category: Optional[str]) -> Dict[str, Any]:
        """Build intent for entity P&L queries using entity_category/entity_sub_category columns.
        
        Triggered by 'entity P&L' in the query.
        Always groups by region_entity as the primary dimension for entity-level breakdown.
        Entity (BGSW, BGSV etc.) is applied as a WHERE filter when specified.
        When no specific category matched, also groups by entity_category.
        """
        query_lower = query.lower()

        entities = [
            'bgsw/ne-mx', 'bgsw/ebs-pl', 'bgsw', 'bgsv', 'bgsj', 'bgsg',
            'bhcs', 'rbna', 'rbmi', 'rbks', 'rbgb', 'bgv'
        ]
        _epl_canonical = {'bgv': 'BGSV'}
        _epl_matches = [e for e in entities if e in query_lower]
        _epl_matches = [
            e for e in _epl_matches
            if not any(e != other and e in other for other in _epl_matches)
        ]
        detected_entities_epl = [_epl_canonical.get(e, e.upper()) for e in _epl_matches]

        _is_total_cost = any(
            t in query_lower for t in ['total cost', 'total costs', 'all cost', 'all costs']
        )
        if entity_category:
            group_by = ['region_entity', 'entity_category', 'entity_sub_category']
        elif _is_total_cost:
            # "total cost by entity P&L" → one row per entity+category pair (no sub_category noise)
            group_by = ['region_entity', 'entity_category']
        else:
            group_by = ['region_entity', 'entity_sub_category']

        filters = [{
            'column': 'cost_category',
            'operator': '=',
            'value': 'Cost Summary'
        }]
        if entity_category:
            filters.append({
                'column': 'entity_category',
                'operator': '=',
                'value': entity_category
            })
        elif any(t in query_lower for t in ['total cost', 'total costs', 'all cost', 'all costs']):
            # "total cost by entity P&L" = sum of all cost rows, excluding Revenue
            filters.append({
                'column': 'entity_category',
                'operator': '!=',
                'value': 'Revenue'
            })

        _entity_pl_currency = detect_currency(query)
        _entity_pl_amt_col = get_amount_column(_entity_pl_currency)

        intent = {
            'query_type': 'aggregation',
            'metrics': [{
                'name': _entity_pl_amt_col,
                'aggregation': 'SUM'
            }],
            'filters': filters,
            'group_by': group_by,
            'order_by': {
                'column': _entity_pl_amt_col,
                'direction': 'DESC'
            },
            'limit': 100,
            'currency': _entity_pl_currency
        }

        year_match = re.search(r'\b(20\d{2})\b', query)
        if year_match:
            intent['filters'].append({
                'column': 'year',
                'operator': '=',
                'value': int(year_match.group(1))
            })

        month_names = {
            'jan': 1,
            'january': 1,
            'feb': 2,
            'february': 2,
            'mar': 3,
            'march': 3,
            'apr': 4,
            'april': 4,
            'may': 5,
            'jun': 6,
            'june': 6,
            'jul': 7,
            'july': 7,
            'aug': 8,
            'august': 8,
            'sep': 9,
            'september': 9,
            'oct': 10,
            'october': 10,
            'nov': 11,
            'november': 11,
            'dec': 12,
            'december': 12
        }
        # Collect ALL months mentioned (longer names first to avoid partial matches).
        # When multiple months are detected, use IN operator and add month+year to group_by.
        _ebit_seen_months: set = set()
        for month_name, month_num in sorted(month_names.items(),
                                            key=lambda x: len(x[0]),
                                            reverse=True):
            if re.search(r'\b' + month_name + r'\b', query_lower) and month_num not in _ebit_seen_months:
                _ebit_seen_months.add(month_num)
        _ebit_detected_months = sorted(_ebit_seen_months)
        if len(_ebit_detected_months) == 1:
            intent['filters'].append({
                'column': 'month',
                'operator': '=',
                'value': _ebit_detected_months[0]
            })
        elif len(_ebit_detected_months) > 1:
            intent['filters'].append({
                'column': 'month',
                'operator': 'IN',
                'value': _ebit_detected_months
            })
            # Add month and year to group_by so each month appears as its own column
            if 'month' not in intent['group_by']:
                intent['group_by'] = ['month'] + intent['group_by']
            if 'year' not in intent['group_by']:
                intent['group_by'] = intent['group_by'] + ['year']

        if len(detected_entities_epl) == 1:
            intent['filters'].append({
                'column': 'region_entity',
                'operator': '=',
                'value': detected_entities_epl[0]
            })
        elif len(detected_entities_epl) > 1:
            intent['filters'].append({
                'column': 'region_entity',
                'operator': 'IN',
                'value': detected_entities_epl
            })
            if 'region_entity' not in intent['group_by']:
                intent['group_by'] = ['region_entity'] + intent['group_by']

        # Time-based grouping for entity P&L
        if any(p in query_lower for p in ['by month', 'monthly', 'month wise', 'month-wise', 'monthwise']):
            if 'month' not in intent['group_by']:
                intent['group_by'] = ['month'] + intent['group_by']
        if any(p in query_lower for p in ['by year', 'yearly', 'year wise', 'year-wise', 'annual']):
            if 'year' not in intent['group_by']:
                intent['group_by'] = ['year'] + intent['group_by']
        # Auto-add month grouping when multiple months are filtered
        _epl_month_f = next((f for f in intent['filters'] if f.get('column') == 'month'), None)
        if _epl_month_f and isinstance(_epl_month_f.get('value'), list) and len(_epl_month_f['value']) > 1:
            if 'month' not in intent['group_by']:
                intent['group_by'] = ['month'] + intent['group_by']

        logger.info(
            f"Built entity P&L intent: category='{entity_category}', group_by={intent['group_by']}, entities={detected_entities_epl}"
        )
        return intent

    def _build_gb_pl_cost_breakdown_intent(self, query: str) -> Dict[str, Any]:
        """Build intent for GB P&L cost breakdown queries.

        Groups by sub_cost_category (the GB P&L cost line dimension) instead of
        entity_sub_category (the Entity P&L cost line dimension).

        Triggered by 'GB P&L' in the query when no specific cost class, EBIT,
        gross margin, or revenue keyword is detected — i.e., the user is asking
        for a general cost breakdown in the GB P&L view.

        Uses cost_category = 'Cost Summary' (same underlying data as Entity P&L)
        but the sub_cost_category column gives the GB-level breakdown.
        Entity mention (e.g. 'BGSW') is applied as a WHERE filter, not GROUP BY.
        """
        query_lower = query.lower()

        # Entity detection — same list as _build_entity_pl_intent
        entities = [
            'bgsw/ne-mx', 'bgsw/ebs-pl', 'bgsw', 'bgsv', 'bgsj', 'bgsg',
            'bhcs', 'rbna', 'rbmi', 'rbks', 'rbgb', 'bgv'
        ]
        _canonical = {'bgv': 'BGSV'}
        _matches = [e for e in entities if e in query_lower]
        # Remove shorter matches that are substrings of a longer match
        _matches = [e for e in _matches
                    if not any(e != o and e in o for o in _matches)]
        detected_entities = [_canonical.get(e, e.upper()) for e in _matches]

        # Currency
        _currency = detect_currency(query)
        _amt_col = get_amount_column(_currency)

        # Group-by dimensions
        _group_by: List[str] = []
        if any(p in query_lower for p in ['by entity', 'by entities', 'entity wise', 'entity-wise']):
            _group_by.append('region_entity')
        if any(p in query_lower for p in ['by sector', 'sector wise', 'sector-wise']):
            _group_by.append('sector')
        if any(p in query_lower for p in ['by month', 'monthly', 'month wise', 'month-wise', 'monthwise']):
            _group_by.append('month')
        if any(p in query_lower for p in ['by year', 'yearly', 'year wise', 'year-wise', 'annual']):
            _group_by.append('year')
        # Always break down by sub_cost_category (the GB P&L cost line column)
        _group_by.append('sub_cost_category')

        filters: List[Dict[str, Any]] = [
            {'column': 'cost_category', 'operator': '=', 'value': 'Cost Summary'}
        ]

        # Apply entity as a WHERE filter
        if len(detected_entities) == 1:
            filters.append({
                'column': 'region_entity',
                'operator': '=',
                'value': detected_entities[0]
            })
        elif len(detected_entities) > 1:
            filters.append({
                'column': 'region_entity',
                'operator': 'IN',
                'value': detected_entities
            })
            if 'region_entity' not in _group_by:
                _group_by = ['region_entity'] + _group_by

        # Inline time filters from query text
        year_match = re.search(r'\b(20\d{2})\b', query)
        if year_match:
            filters.append({
                'column': 'year',
                'operator': '=',
                'value': int(year_match.group(1))
            })

        month_names = {
            'jan': 1, 'january': 1, 'feb': 2, 'february': 2,
            'mar': 3, 'march': 3, 'apr': 4, 'april': 4,
            'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
            'aug': 8, 'august': 8, 'sep': 9, 'september': 9,
            'oct': 10, 'october': 10, 'nov': 11, 'november': 11,
            'dec': 12, 'december': 12
        }
        _seen_months: set = set()
        for mn, mv in sorted(month_names.items(), key=lambda x: len(x[0]), reverse=True):
            if re.search(r'\b' + mn + r'\b', query_lower) and mv not in _seen_months:
                _seen_months.add(mv)
        _detected_months = sorted(_seen_months)
        if len(_detected_months) == 1:
            filters.append({'column': 'month', 'operator': '=', 'value': _detected_months[0]})
        elif len(_detected_months) > 1:
            filters.append({'column': 'month', 'operator': 'IN', 'value': _detected_months})
            if 'month' not in _group_by:
                _group_by = ['month'] + _group_by

        intent: Dict[str, Any] = {
            'query_type': 'aggregation',
            'metrics': [{'name': _amt_col, 'aggregation': 'SUM'}],
            'filters': filters,
            'group_by': _group_by,
            'order_by': {'column': _amt_col, 'direction': 'DESC'},
            'limit': 100,
            'currency': _currency
        }

        logger.info(
            f"Built GB P&L cost breakdown intent: group_by={_group_by}, "
            f"entities={detected_entities}, months={_detected_months}"
        )
        return intent

    def _build_entity_pl_ebit_intent(self, query: str,
                                     calc_type: str) -> Dict[str, Any]:
        """Build intent for Entity P&L EBIT / EBIT% queries.

        Triggers when the query contains both 'entity p&l' AND 'ebit'.
        Returns a lightweight intent carrying only the filters needed for
        _build_entity_pl_ebit_sql — the actual SQL is built in compile_sql.

        calc_type:
          'entity_pl_ebit'     → return revenue, total_cost, ebit, ebit_pct columns
          'entity_pl_ebit_pct' → same columns (% is always included for context)
        """
        query_lower = query.lower()
        currency = detect_currency(query)

        # Entity filter (BGSW, BGSV …) — collect ALL matches, no break
        entities = [
            'bgsw/ne-mx', 'bgsw/ebs-pl', 'bgsw', 'bgsv', 'bgsj', 'bgsg',
            'bhcs', 'rbna', 'rbmi', 'rbks', 'rbgb', 'bgv'
        ]
        _eeit_canonical = {'bgv': 'BGSV'}
        _eeit_matches = [e for e in entities if e in query_lower]
        _eeit_matches = [
            e for e in _eeit_matches
            if not any(e != other and e in other for other in _eeit_matches)
        ]
        detected_entities_eeit = [_eeit_canonical.get(e, e.upper()) for e in _eeit_matches]

        filters: List[Dict] = []

        # Month / year parsed from query text
        year_match = re.search(r'\b(20\d{2})\b', query)
        if year_match:
            filters.append({'column': 'year', 'operator': '=', 'value': int(year_match.group(1))})

        month_names = {
            'january': 1, 'jan': 1, 'february': 2, 'feb': 2,
            'march': 3, 'mar': 3, 'april': 4, 'apr': 4,
            'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
            'august': 8, 'aug': 8, 'september': 9, 'sep': 9,
            'october': 10, 'oct': 10, 'november': 11, 'nov': 11,
            'december': 12, 'dec': 12
        }
        # Collect ALL months mentioned (longer names first to avoid partial matches).
        # When multiple months are detected, use IN operator and add month+year to group_by.
        _epleit_seen: set = set()
        for mname, mnum in sorted(month_names.items(), key=lambda x: len(x[0]), reverse=True):
            if mname in query_lower and mnum not in _epleit_seen:
                _epleit_seen.add(mnum)
        _epleit_months = sorted(_epleit_seen)
        if len(_epleit_months) == 1:
            filters.append({'column': 'month', 'operator': '=', 'value': _epleit_months[0]})
        elif len(_epleit_months) > 1:
            filters.append({'column': 'month', 'operator': 'IN', 'value': _epleit_months})

        # Entity filter — MUST be applied so entity EBIT only sums that entity's rows
        if len(detected_entities_eeit) == 1:
            filters.append({'column': 'region_entity', 'operator': '=', 'value': detected_entities_eeit[0]})
        elif len(detected_entities_eeit) > 1:
            filters.append({'column': 'region_entity', 'operator': 'IN', 'value': detected_entities_eeit})

        # "by entity" without naming specific entities → return one row per entity (GROUP BY region_entity)
        group_by_all_entities = (
            len(detected_entities_eeit) == 0
            and any(p in query_lower for p in [
                'by entity', 'by entities', 'all entities', 'each entity',
                'per entity', 'entity breakdown', 'entity level', 'entity wise',
                'entity-wise', 'entitywise',
            ])
        )

        intent = {
            'query_type': 'aggregation',
            'calculation_type': calc_type,
            'metrics': [{'name': 'amount_usd', 'aggregation': 'SUM'}],
            'filters': filters,
            'group_by': ['entity_sub_category'],
            'order_by': {'column': 'ebit', 'direction': 'DESC'},
            'limit': 100,
            'currency': currency,
        }

        if group_by_all_entities:
            intent['group_by_all_entities'] = True

        # Multi-month: add month and year to group_by so each month appears as its own column
        if len(_epleit_months) > 1:
            if 'month' not in intent['group_by']:
                intent['group_by'] = ['month'] + intent['group_by']
            if 'year' not in intent['group_by']:
                intent['group_by'] = intent['group_by'] + ['year']

        # Month-wise breakdown
        if any(p in query_lower for p in ['by month', 'monthly', 'month wise', 'month-wise', 'monthwise']):
            if 'month' not in intent['group_by']:
                intent['group_by'] = ['month'] + intent['group_by']

        logger.info(
            f"Built entity P&L EBIT intent: calc_type='{calc_type}', entity={detected_entities_eeit}, currency={currency}"
        )
        return intent

    def _build_entity_pl_ebit_sql(self, intent: Dict[str, Any],
                                  cube_id: str) -> Dict[str, Any]:
        """Generate the SQL for Entity P&L EBIT / EBIT% calculation.

        Data model:
          Revenue   = cost_category='Revenue', excluding order_reason IN (YEH/YEI/YEJ/YEK/YN2)
                      and gl_account LIKE '139%' — SUM all qualifying rows (company-wide)
          TotalCost = cost_category='Cost Summary', entity_category NOT blank,
                      entity_sub_category NOT blank
                      → GROUP BY entity_category
          EBIT      = Revenue - SUM(all costs)
          EBIT%     = EBIT / Revenue × 100

        Revenue and cost use DIFFERENT cost_category values — the two WHERE clauses
        are built independently.
        """
        rounding = 2
        currency = intent.get('currency', 'usd')
        amt_col = 'amount_inr' if currency == 'inr' else 'amount_usd'

        # Extract year / month / region_entity from intent filters
        year_val         = None
        month_val        = None
        region_entity_val = None
        for f in intent.get('filters', []):
            col = f.get('column')
            val = f.get('value')
            if col == 'year':
                year_val = val
            elif col == 'month':
                month_val = val
            elif col == 'region_entity':
                region_entity_val = val

        # Base filter shared by both revenue and cost CTEs.
        # month_val / year_val can be a single int OR a list (e.g. Q1 = [1,2,3]).
        # Always use IN(...) to avoid psycopg2 converting lists to ARRAY[].
        time_parts: List[str] = ['cube_id = %s']
        time_params: List     = [cube_id]
        if year_val is not None:
            if isinstance(year_val, list):
                placeholders = ', '.join(['%s'] * len(year_val))
                time_parts.append(f'year IN ({placeholders})')
                time_params.extend(year_val)
            else:
                time_parts.append('year = %s')
                time_params.append(year_val)
        if month_val is not None:
            if isinstance(month_val, list):
                placeholders = ', '.join(['%s'] * len(month_val))
                time_parts.append(f'month IN ({placeholders})')
                time_params.extend(month_val)
            else:
                time_parts.append('month = %s')
                time_params.append(month_val)
        # Build entity filter clause separately from time_filter so both CTEs can
        # share it and so we can support single (=) and multi-entity (IN) queries.
        entity_filter_clause = ''
        entity_params: List = []
        if region_entity_val is not None:
            if isinstance(region_entity_val, list) and len(region_entity_val) > 1:
                placeholders = ', '.join(['%s'] * len(region_entity_val))
                entity_filter_clause = f' AND region_entity IN ({placeholders})'
                entity_params.extend(region_entity_val)
            else:
                entity_filter_clause = ' AND region_entity = %s'
                entity_params.append(region_entity_val)

        time_filter = ' AND '.join(time_parts)

        # Revenue WHERE: cost_category='Revenue', excluding specific order reasons + GL accounts
        # NOTE: '139%%' uses %% so psycopg2 treats it as a literal '%' (not a param placeholder)
        rev_where = (
            f"{time_filter}{entity_filter_clause} AND cost_category = 'Revenue Summary'"
            " AND COALESCE(TRIM(order_reason), 'x') NOT IN ('YEH','YEI','YEJ','YEK','YN2')"
            " AND COALESCE(TRIM(gl_account), 'x') NOT LIKE '139%%'"
        )

        # Cost WHERE: Cost Summary — exclude blank entity_category / entity_sub_category
        cost_where = (
            f"{time_filter}{entity_filter_clause} AND cost_category = 'Cost Summary'"
            " AND TRIM(COALESCE(entity_category, '')) != ''"
            " AND TRIM(COALESCE(entity_sub_category, '')) != ''"
        )

        # params: (time_params + entity_params) for rev CTE + same for costs CTE
        params = list(time_params) + list(entity_params) + list(time_params) + list(entity_params)

        # Also use the per-entity GROUP BY path when the user said "by entity" without
        # specifying individual entities — returns one row per entity across all data.
        group_by_all_entities = intent.get('group_by_all_entities', False)
        is_multi_entity_eeit = (
            (isinstance(region_entity_val, list) and len(region_entity_val) > 1)
            or (group_by_all_entities and region_entity_val is None)
        )

        if is_multi_entity_eeit:
            # Multi-entity: GROUP BY region_entity in both CTEs, FULL OUTER JOIN.
            # Returns one row per entity — revenue, cost, ebit, ebit_pct.
            sql = f"""
                WITH
                rev AS (
                    SELECT region_entity, COALESCE(SUM({amt_col}), 0) AS total_revenue
                    FROM cube_fact_data
                    WHERE {rev_where}
                    GROUP BY region_entity
                ),
                costs AS (
                    SELECT region_entity, COALESCE(SUM({amt_col}), 0) AS total_cost
                    FROM cube_fact_data
                    WHERE {cost_where}
                    GROUP BY region_entity
                )
                SELECT
                    COALESCE(r.region_entity, c.region_entity)                          AS region_entity,
                    ROUND(COALESCE(r.total_revenue, 0)::numeric, {rounding})            AS revenue,
                    ROUND(COALESCE(c.total_cost,   0)::numeric, {rounding})             AS total_cost,
                    ROUND(
                        (COALESCE(r.total_revenue, 0) - COALESCE(c.total_cost, 0))::numeric,
                        {rounding})                                                      AS ebit,
                    ROUND(
                        100.0 * (COALESCE(r.total_revenue, 0) - COALESCE(c.total_cost, 0))
                        / NULLIF(COALESCE(r.total_revenue, 0), 0),
                        {rounding})                                                      AS ebit_pct
                FROM rev r
                FULL OUTER JOIN costs c ON c.region_entity = r.region_entity
                ORDER BY COALESCE(r.region_entity, c.region_entity)
            """
        else:
            # Single entity or no entity — scalar CTEs, literal entity_label.
            entity_label = region_entity_val if region_entity_val else 'All Entities'
            sql = f"""
                WITH
                rev AS (
                    SELECT COALESCE(SUM({amt_col}), 0) AS total_revenue
                    FROM cube_fact_data
                    WHERE {rev_where}
                ),
                costs AS (
                    SELECT COALESCE(SUM({amt_col}), 0) AS total_cost
                    FROM cube_fact_data
                    WHERE {cost_where}
                )
                SELECT
                    '{entity_label}'                                              AS region_entity,
                    ROUND((SELECT total_revenue FROM rev)::numeric, {rounding})  AS revenue,
                    ROUND((SELECT total_cost   FROM costs)::numeric, {rounding}) AS total_cost,
                    ROUND(
                        ((SELECT total_revenue FROM rev)
                         - (SELECT total_cost FROM costs))::numeric,
                        {rounding})                                               AS ebit,
                    ROUND(
                        100.0
                        * ((SELECT total_revenue FROM rev)
                           - (SELECT total_cost FROM costs))
                        / NULLIF((SELECT total_revenue FROM rev), 0),
                        {rounding})                                               AS ebit_pct
            """

        logger.info(
            f"Entity P&L EBIT SQL built: single-summary-row, currency={currency}, "
            f"calc_type={intent.get('calculation_type')}"
        )
        return {
            'success': True,
            'sql': sql,
            'params': params,
            'calculation_type': intent.get('calculation_type', 'entity_pl_ebit'),
        }

    # ================================================================
    # GB P&L SUMMARY BUILDER
    # ================================================================

    def _build_gb_pl_summary_intent(self, query: str) -> Dict[str, Any]:
        """Build lightweight intent for GB P&L full summary queries.

        Extracts year / month / entity from query text only — no LLM needed.
        SQL is generated by _build_gb_pl_summary_sql at compile_sql time.
        """
        query_lower = query.lower()
        currency = detect_currency(query)

        filters: List[Dict] = []

        # Year
        year_match = re.search(r'\b(20\d{2})\b', query)
        if year_match:
            filters.append({'column': 'year', 'operator': '=', 'value': int(year_match.group(1))})

        # Month — collect ALL months mentioned (longer names first to avoid partial matches).
        # When multiple months are detected, use IN operator and add month+year to group_by.
        month_names = {
            'january': 1, 'jan': 1, 'february': 2, 'feb': 2,
            'march': 3, 'mar': 3, 'april': 4, 'apr': 4,
            'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
            'august': 8, 'aug': 8, 'september': 9, 'sep': 9,
            'october': 10, 'oct': 10, 'november': 11, 'nov': 11,
            'december': 12, 'dec': 12,
        }
        _gbsum_seen: set = set()
        for mname, mnum in sorted(month_names.items(), key=lambda x: len(x[0]), reverse=True):
            if re.search(r'\b' + mname + r'\b', query_lower) and mnum not in _gbsum_seen:
                _gbsum_seen.add(mnum)
        _gbsum_months = sorted(_gbsum_seen)
        if len(_gbsum_months) == 1:
            filters.append({'column': 'month', 'operator': '=', 'value': _gbsum_months[0]})
        elif len(_gbsum_months) > 1:
            filters.append({'column': 'month', 'operator': 'IN', 'value': _gbsum_months})

        # Entity filter (BGSW, BGSV, …) — collect ALL matches, no break
        entities = [
            'bgsw/ne-mx', 'bgsw/ebs-pl', 'bgsw', 'bgsv', 'bgsj', 'bgsg',
            'bhcs', 'rbna', 'rbmi', 'rbks', 'rbgb', 'bgv',
        ]
        _gbsum_canonical = {'bgv': 'BGSV'}
        _gbsum_entity_matches = [e for e in entities if e in query_lower]
        _gbsum_entity_matches = [
            e for e in _gbsum_entity_matches
            if not any(e != other and e in other for other in _gbsum_entity_matches)
        ]
        _gbsum_detected = [_gbsum_canonical.get(e, e.upper()) for e in _gbsum_entity_matches]
        if len(_gbsum_detected) == 1:
            filters.append({'column': 'region_entity', 'operator': '=', 'value': _gbsum_detected[0]})
        elif len(_gbsum_detected) > 1:
            filters.append({'column': 'region_entity', 'operator': 'IN', 'value': _gbsum_detected})

        logger.info(
            f"Built GB P&L Summary intent: filters={filters}, currency={currency}"
        )
        return {
            'query_type': 'aggregation',
            'calculation_type': 'gb_pl_summary',
            'metrics': [{'name': 'amount_usd', 'aggregation': 'SUM'}],
            'filters': filters,
            'group_by': ['region_entity'],
            'order_by': {'column': 'revenue', 'direction': 'DESC'},
            'limit': 100,
            'currency': currency,
        }

    def _build_gb_pl_summary_sql(self, intent: Dict[str, Any],
                                  cube_id: str) -> Dict[str, Any]:
        """Full GB P&L Summary SQL.

        Returns one row per entity with all P&L line items:
          Revenue | Resource Cost | Travel Cost | Other Direct Cost
          | Total Direct Cost | Corporate (Indirect) Cost
          | Gross Margin | Gross Margin % | EBIT %

        Definitions (confirmed):
          Total Direct Cost = Resource + Travel + Other Direct
          Corporate Cost    = Indirect Cost
          Gross Margin      = Revenue - (Direct + Indirect)
          Gross Margin %    = Gross Margin / Revenue * 100
          EBIT %            = (Revenue - Gross Margin) / Revenue
                            = Total Cost / Revenue * 100
        """
        rounding = 2
        currency = intent.get('currency', 'usd')
        amt_col = 'amount_inr' if currency == 'inr' else 'amount_usd'

        # ----------------------------------------------------------------
        # Build WHERE clause with values embedded directly — NO psycopg2 %s params.
        #
        # Reason: psycopg2's C-level param scanner throws IndexError on this
        # specific SQL structure (many CASE WHEN blocks + IN lists + %s in WHERE).
        # All filter values here are safe to inline:
        #   - cube_id is a system UUID (not user input)
        #   - year / month are integers
        #   - region_entity is validated against a known enum in the intent builder
        # ----------------------------------------------------------------
        # Escape cube_id just in case (UUIDs only contain hex digits and dashes)
        safe_cube_id = cube_id.replace("'", "''")
        time_parts: List[str] = [f"cube_id = '{safe_cube_id}'"]

        for f in intent.get('filters', []):
            col = f.get('column')
            val = f.get('value')
            if col == 'year':
                time_parts.append(f'year = {int(val)}')
            elif col == 'month':
                if isinstance(val, list):
                    months_str = ', '.join(str(int(m)) for m in val)
                    time_parts.append(f'month IN ({months_str})')
                else:
                    # YTD expansion: "Mar 2025" (month=3) → month IN (1,2,3)
                    max_month = int(val)
                    months_ytd = ', '.join(str(m) for m in range(1, max_month + 1))
                    time_parts.append(f'month IN ({months_ytd})')
            elif col == 'region_entity':
                if isinstance(val, list):
                    escaped = ', '.join(f"'{str(v).replace(chr(39), chr(39)*2)}'" for v in val)
                    time_parts.append(f"region_entity IN ({escaped})")
                else:
                    safe_val = str(val).replace("'", "''")
                    time_parts.append(f"region_entity = '{safe_val}'")

        time_filter = ' AND '.join(time_parts)

        # Revenue exclusions — starts_with avoids any % chars in the SQL body.
        rev_exclusions = (
            " AND COALESCE(TRIM(order_reason), 'x') NOT IN ('YEH','YEI','YEJ','YEK','YN2')"
            " AND NOT starts_with(COALESCE(TRIM(gl_account), 'x'), '139')"
        )

        sql = f"""
            SELECT
                region_entity                                                   AS entity,

                -- Revenue (mUSD / mINR)
                ROUND(SUM(CASE
                    WHEN cost_category = 'Revenue Summary'{rev_exclusions}
                    THEN {amt_col} ELSE 0
                END)::numeric / 1000000.0, {rounding})                         AS revenue,

                -- Resource Cost
                ROUND(SUM(CASE
                    WHEN cost_category = 'Cost Summary'
                     AND cost_category_class = 'Resource Cost'
                    THEN {amt_col} ELSE 0
                END)::numeric / 1000000.0, {rounding})                         AS resource_cost,

                -- Travel Cost
                ROUND(SUM(CASE
                    WHEN cost_category = 'Cost Summary'
                     AND cost_category_class = 'Travel Cost'
                    THEN {amt_col} ELSE 0
                END)::numeric / 1000000.0, {rounding})                         AS travel_cost,

                -- Other Direct Cost
                ROUND(SUM(CASE
                    WHEN cost_category = 'Cost Summary'
                     AND cost_category_class = 'Other Direct Cost'
                    THEN {amt_col} ELSE 0
                END)::numeric / 1000000.0, {rounding})                         AS other_direct_cost,

                -- Total Direct Cost = Resource + Travel + Other Direct
                ROUND(SUM(CASE
                    WHEN cost_category = 'Cost Summary'
                     AND cost_category_class IN ('Resource Cost', 'Travel Cost', 'Other Direct Cost')
                    THEN {amt_col} ELSE 0
                END)::numeric / 1000000.0, {rounding})                         AS total_direct_cost,

                -- Corporate Cost (= Indirect Cost)
                ROUND(SUM(CASE
                    WHEN cost_category = 'Cost Summary'
                     AND cost_category_class = 'Corporate Cost'
                    THEN {amt_col} ELSE 0
                END)::numeric / 1000000.0, {rounding})                         AS corporate_indirect_cost,

                -- Total Cost = Direct + Indirect
                ROUND(SUM(CASE
                    WHEN cost_category = 'Cost Summary'
                    THEN {amt_col} ELSE 0
                END)::numeric / 1000000.0, {rounding})                         AS total_cost,

                -- Gross Margin = Revenue - (Direct + Indirect)
                ROUND((
                    SUM(CASE
                        WHEN cost_category = 'Revenue Summary'{rev_exclusions}
                        THEN {amt_col} ELSE 0
                    END)
                    - SUM(CASE
                        WHEN cost_category = 'Cost Summary'
                        THEN {amt_col} ELSE 0
                      END)
                )::numeric / 1000000.0, {rounding})                            AS gross_margin,

                -- Gross Margin %
                ROUND(
                    100.0 * (
                        SUM(CASE
                            WHEN cost_category = 'Revenue Summary'{rev_exclusions}
                            THEN {amt_col} ELSE 0
                        END)
                        - SUM(CASE
                            WHEN cost_category = 'Cost Summary'
                            THEN {amt_col} ELSE 0
                          END)
                    ) / NULLIF(SUM(CASE
                        WHEN cost_category = 'Revenue Summary'{rev_exclusions}
                        THEN {amt_col} ELSE 0
                    END), 0),
                    {rounding}
                )                                                               AS gross_margin_pct,

                -- EBIT % = Total Cost / Revenue * 100
                ROUND(
                    100.0 * SUM(CASE
                        WHEN cost_category = 'Cost Summary'
                        THEN {amt_col} ELSE 0
                    END)
                    / NULLIF(SUM(CASE
                        WHEN cost_category = 'Revenue Summary'{rev_exclusions}
                        THEN {amt_col} ELSE 0
                    END), 0),
                    {rounding}
                )                                                               AS ebit_pct

            FROM cube_fact_data
            WHERE {time_filter}
              AND cost_category IN ('Revenue Summary', 'Cost Summary')
              AND region_entity IS NOT NULL AND region_entity != ''
            GROUP BY region_entity
            ORDER BY revenue DESC
        """

        logger.info(
            f"GB P&L Summary SQL built: currency={currency}, "
            f"filters={intent.get('filters')}"
        )
        return {
            'success': True,
            'sql': sql,
            'params': [],   # values embedded directly in SQL — no psycopg2 substitution
            'calculation_type': 'gb_pl_summary',
        }

    def _expand_month_range_from_query(self, intent: Dict[str, Any],
                                      query: str) -> Dict[str, Any]:
        """
        Post-process intent to expand month ranges and quarters from query text.
        Overrides whatever the LLM returned for month when the query clearly specifies
        a range ("jan to mar") or quarter ("Q1", "Q2", etc.).

        Priority order:
        1. Quarter detected (Q1/Q2/Q3/Q4) → replace month filter with list
        2. Range detected ("jan to mar") → replace month filter with full list
        3. Multiple individual months mentioned → replace month filter with list
        """
        query_lower = query.lower()

        _month_num_map = {
            'jan': 1, 'january': 1,
            'feb': 2, 'february': 2,
            'mar': 3, 'march': 3,
            'apr': 4, 'april': 4,
            'may': 5,
            'jun': 6, 'june': 6,
            'jul': 7, 'july': 7,
            'aug': 8, 'august': 8,
            'sep': 9, 'september': 9,
            'oct': 10, 'october': 10,
            'nov': 11, 'november': 11,
            'dec': 12, 'december': 12
        }

        new_months = None

        # 1. Quarter detection - collect ALL quarters mentioned (ranges, individual, text-based)
        _quarter_map = {
            'q1': [1, 2, 3], 'q2': [4, 5, 6],
            'q3': [7, 8, 9], 'q4': [10, 11, 12]
        }
        _text_quarter_patterns = [
            (r'\b(?:first|1st)\s+quarter\b', [1, 2, 3]),
            (r'\b(?:second|2nd)\s+quarter\b', [4, 5, 6]),
            (r'\b(?:third|3rd)\s+quarter\b', [7, 8, 9]),
            (r'\b(?:fourth|4th)\s+quarter\b', [10, 11, 12]),
        ]
        _all_quarter_months: List[int] = []
        _qrange = re.search(r'\bq([1-4])\s*(?:to|through|thru|\-)\s*q([1-4])\b', query_lower)
        if _qrange:
            _qs, _qe = int(_qrange.group(1)), int(_qrange.group(2))
            for _qi in range(min(_qs, _qe), max(_qs, _qe) + 1):
                _all_quarter_months.extend(_quarter_map[f'q{_qi}'])
            logger.info(f"_expand_month_range: quarter range Q{_qs}-Q{_qe} → months {_all_quarter_months}")
        else:
            for _qk, _qm in _quarter_map.items():
                if re.search(r'\b' + _qk + r'\b', query_lower):
                    _all_quarter_months.extend(_qm)
                    logger.info(f"_expand_month_range: quarter {_qk.upper()} → months {_qm}")
            if not _all_quarter_months:
                for _tpat, _tqm in _text_quarter_patterns:
                    if re.search(_tpat, query_lower):
                        _all_quarter_months.extend(_tqm)
                        logger.info(f"_expand_month_range: text quarter → months {_tqm}")
        if _all_quarter_months:
            new_months = sorted(set(_all_quarter_months))

        # 2. Range detection: "jan to mar", "jan - mar", "jan through mar"
        if new_months is None:
            _month_abbrevs = '|'.join([
                'jan(?:uary)?', 'feb(?:ruary)?', 'mar(?:ch)?', 'apr(?:il)?',
                'may', 'jun(?:e)?', 'jul(?:y)?', 'aug(?:ust)?',
                'sep(?:tember)?', 'oct(?:ober)?', 'nov(?:ember)?', 'dec(?:ember)?'
            ])
            _range_match = re.search(
                r'\b(' + _month_abbrevs + r')\s+(?:\d{4}\s+)?(?:to|through|thru|-)\s+(' + _month_abbrevs + r')\b',
                query_lower
            )
            if _range_match:
                _sk = _range_match.group(1)[:3]
                _ek = _range_match.group(2)[:3]
                _sn = _month_num_map.get(_sk, 0)
                _en = _month_num_map.get(_ek, 0)
                if _sn and _en and _sn <= _en:
                    new_months = list(range(_sn, _en + 1))
                    logger.info(f"_expand_month_range: range '{_sk}-{_ek}' → months {new_months}")

        # 3. Multiple individual months (e.g. "jan and mar")
        if new_months is None:
            _all_months_found = []
            for _mn, _mv in _month_num_map.items():
                if re.search(r'\b' + _mn + r'\b', query_lower) and _mv not in _all_months_found:
                    _all_months_found.append(_mv)
            _all_months_found.sort()
            if len(_all_months_found) > 1:
                new_months = _all_months_found
                logger.info(f"_expand_month_range: multiple months found → {new_months}")

        if new_months is None:
            return intent

        # Replace existing month filter(s) with the expanded list
        filters = intent.get('filters', [])
        filters = [f for f in filters if (f.get('column') or '').lower() != 'month']
        if len(new_months) == 1:
            filters.append({'column': 'month', 'operator': '=', 'value': new_months[0]})
        else:
            filters.append({'column': 'month', 'operator': 'IN', 'value': new_months})
            # Add month to group_by so results are broken down per month
            group_by = intent.get('group_by', [])
            if 'month' not in group_by:
                intent['group_by'] = ['month'] + group_by

        intent['filters'] = filters
        return intent

    def _fix_employee_level_cost_category(self, intent: Dict[str, Any],
                                          query: str) -> Dict[str, Any]:
        """
        Post-process intent to ensure employee-level queries use detail cost_category.
        
        Summary cost categories (e.g., 'Billing Utilization Summary') don't contain employee data.
        When user asks about specific employees, we must use the detail category instead.
        """
        filters = intent.get('filters', [])
        query_lower = query.lower()

        # Detect if query is employee-specific
        is_employee_query = False
        has_employee_filter = False

        # Check for employee keywords in query
        employee_keywords = [
            'employee', 'emp:', 'emp ', 'person', 'individual', 'staff member'
        ]
        for keyword in employee_keywords:
            if keyword in query_lower:
                is_employee_query = True
                break

        # Check if there's an employee_name or employee_number filter
        for f in filters:
            if f.get('column') in ['employee_name', 'employee_number']:
                has_employee_filter = True
                is_employee_query = True
                break

        # If this is an employee-level query, fix the cost_category
        if is_employee_query:
            # Mapping from summary to detail cost_category
            summary_to_detail = {
                'Billing Utilization Summary': 'Billing Utilization',
                'Revenue Summary': 'Revenue',
            }

            # Find and fix cost_category filter
            for f in filters:
                if f.get('column') == 'cost_category':
                    old_value = f.get('value')
                    if old_value in summary_to_detail:
                        new_value = summary_to_detail[old_value]
                        f['value'] = new_value
                        logger.info(
                            f"Fixed cost_category for employee query: {old_value} → {new_value}"
                        )
                    break

            # Also try to extract employee name from query if no filter exists
            if not has_employee_filter:
                # Try to extract employee name after "emp:" or "employee:"
                import re
                emp_patterns = [
                    r'emp[:\s]+([A-Za-z\s]+?)(?:\s+for|\s+in|\s+from|$)',
                    r'employee[:\s]+([A-Za-z\s]+?)(?:\s+for|\s+in|\s+from|$)',
                    r'for\s+([A-Za-z\s]+?)\s+(?:billing|utilization|hours)',
                    r'employee\s+number[:\s]+(\d+)',
                ]
                for pattern in emp_patterns:
                    match = re.search(pattern, query, re.IGNORECASE)
                    if match:
                        value = match.group(1).strip()
                        if value:
                            # Determine if it's a number or name
                            if value.isdigit():
                                filters.append({
                                    'column': 'employee_number',
                                    'operator': '=',
                                    'value': value
                                })
                            else:
                                filters.append({
                                    'column': 'employee_name',
                                    'operator': 'ILIKE',
                                    'value': f'%{value}%'
                                })
                            logger.info(
                                f"Extracted employee filter from query: {value}"
                            )
                            break

            intent['filters'] = filters

        return intent

    def _fix_cost_category_and_metrics(self, intent: Dict[str, Any],
                                       query: str) -> Dict[str, Any]:
        """
        Post-process intent to:
        1. Convert ILIKE cost_category filters to exact matching for better accuracy
        2. Route Attrition queries to use the 'attrition' column instead of 'headcount'
        3. Distinguish between Revenue (MTD) and Revenue Summary (YTD)
        """
        filters = intent.get('filters', [])
        metrics = intent.get('metrics', [])
        query_lower = query.lower()

        # Track the detected cost category for metric routing
        detected_cost_category = None

        for f in filters:
            col_name = f.get('column', '').lower().replace(' ', '_')
            if col_name == 'cost_category':
                # Get the current value and operator
                value = f.get('value', '')
                operator = f.get('operator', 'ILIKE')

                # Extract the actual category name from ILIKE pattern like '%Revenue%'
                clean_value = value.strip('%') if isinstance(value,
                                                             str) else value

                # CRITICAL: For cost categories, use EXACT matching to prevent overlap
                # Revenue vs Revenue Summary, Billing Utilization vs Billing Utilization Summary
                # FIX: Apply routing logic for BOTH ILIKE and = operators
                # The LLM sometimes sends = operator with wrong category

                # Check if query explicitly mentions "summary" or "ytd"
                wants_summary = 'summary' in query_lower or 'ytd' in query_lower or 'year to date' in query_lower
                wants_monthly = 'mtd' in query_lower or 'monthly' in query_lower or 'month to date' in query_lower

                # Normalize column name to lowercase with underscore
                f['column'] = 'cost_category'

                # Determine exact cost category based on context
                # Always route based on user's MTD/YTD intent, overriding LLM's choice
                if 'revenue' in clean_value.lower():
                    if wants_summary:
                        f['value'] = 'Revenue Summary'
                    elif wants_monthly:
                        # Explicit MTD request -> use Revenue (not Revenue Summary)
                        f['value'] = 'Revenue'
                    elif 'summary' in clean_value.lower():
                        # LLM said summary but user didn't specify MTD/YTD - keep as summary
                        f['value'] = 'Revenue Summary'
                    else:
                        # Default to Revenue (MTD) when no explicit preference
                        f['value'] = 'Revenue'
                    f['operator'] = '='
                    detected_cost_category = f['value']
                    logger.info(
                        f"Fixed cost_category: '{clean_value}' → = '{f['value']}' (wants_monthly={wants_monthly}, wants_summary={wants_summary})"
                    )

                elif 'billing utilization' in clean_value.lower():
                    # CRITICAL: Route based on USER'S query intent, not LLM's suggestion
                    # Default to detailed view (Billing Utilization) unless user explicitly asks for summary
                    if wants_summary:
                        # User explicitly asked for summary/YTD
                        f['value'] = 'Billing Utilization Summary'
                    else:
                        # Default to detailed view for billing utilization queries
                        f['value'] = 'Billing Utilization'
                    f['operator'] = '='
                    detected_cost_category = f['value']
                    logger.info(
                        f"Fixed cost_category: '{clean_value}' → = '{f['value']}' (user wants_summary={wants_summary})"
                    )

                elif 'attrition' in clean_value.lower():
                    # Attrition vs Attrition Pipeline
                    if 'pipeline' in query_lower:
                        f['value'] = 'Attrition Pipeline'
                    else:
                        f['value'] = 'Attrition'
                    f['operator'] = '='
                    detected_cost_category = f['value']
                    logger.info(
                        f"Fixed cost_category: '{clean_value}' → = '{f['value']}'"
                    )

                elif 'capacity' in clean_value.lower(
                ) or 'gb wise' in clean_value.lower():
                    f['value'] = 'GB Wise END Capacity'
                    f['operator'] = '='
                    detected_cost_category = f['value']
                    logger.info(
                        f"Fixed cost_category: '{clean_value}' → = '{f['value']}'"
                    )

                elif 'head count' in clean_value.lower(
                ) or 'headcount' in clean_value.lower():
                    f['value'] = 'Head Count'
                    f['operator'] = '='
                    detected_cost_category = f['value']
                    logger.info(
                        f"Fixed cost_category: '{clean_value}' → = '{f['value']}'"
                    )

                elif 'cost' in clean_value.lower():
                    f['value'] = 'Cost Summary'
                    f['operator'] = '='
                    detected_cost_category = f['value']
                    logger.info(
                        f"Fixed cost_category: '{clean_value}' → = '{f['value']}'"
                    )

                elif 'employee' in clean_value.lower(
                ) or 'ww employee' in clean_value.lower():
                    f['value'] = 'WW Employee'
                    f['operator'] = '='
                    detected_cost_category = f['value']
                    logger.info(
                        f"Fixed cost_category: '{clean_value}' → = '{f['value']}'"
                    )

                else:
                    # Keep the original value but ensure exact matching
                    f['operator'] = '='
                    detected_cost_category = clean_value

        # Also detect queries from the original query text when no cost_category filter exists
        if not detected_cost_category:
            # Check for MTD/YTD keywords for routing
            wants_summary = 'summary' in query_lower or 'ytd' in query_lower or 'year to date' in query_lower
            wants_monthly = 'mtd' in query_lower or 'monthly' in query_lower or 'month to date' in query_lower

            # Revenue queries - MTD uses 'Revenue', YTD uses 'Revenue Summary'
            if 'revenue' in query_lower:
                if wants_summary:
                    category = 'Revenue Summary'
                elif wants_monthly:
                    category = 'Revenue'
                else:
                    # Default: Revenue (MTD) for general revenue queries
                    category = 'Revenue'
                filters.append({
                    'column': 'cost_category',
                    'operator': '=',
                    'value': category
                })
                detected_cost_category = category
                logger.info(
                    f"Added default cost_category = '{category}' for revenue query (mtd={wants_monthly}, ytd={wants_summary})"
                )

            # Billing Utilization queries - detailed vs summary
            elif 'billing utilization' in query_lower or 'billing' in query_lower and 'utilization' in query_lower:
                if wants_summary:
                    category = 'Billing Utilization Summary'
                else:
                    category = 'Billing Utilization'
                filters.append({
                    'column': 'cost_category',
                    'operator': '=',
                    'value': category
                })
                detected_cost_category = category
                logger.info(
                    f"Added default cost_category = '{category}' for billing utilization query"
                )

            # Employee queries
            elif 'employee' in query_lower and ('summary' in query_lower
                                                or 'count' in query_lower
                                                or 'total' in query_lower):
                filters.append({
                    'column': 'cost_category',
                    'operator': '=',
                    'value': 'WW Employee'
                })
                detected_cost_category = 'WW Employee'
                logger.info(
                    f"Added default cost_category = 'WW Employee' for employee query"
                )

            # Attrition queries
            elif 'attrition' in query_lower:
                filters.append({
                    'column': 'cost_category',
                    'operator': '=',
                    'value': 'Attrition'
                })
                detected_cost_category = 'Attrition'
                logger.info(
                    f"Added default cost_category = 'Attrition' for attrition query"
                )

            # Cost queries
            elif 'cost' in query_lower and ('summary' in query_lower
                                            or 'total' in query_lower):
                filters.append({
                    'column': 'cost_category',
                    'operator': '=',
                    'value': 'Cost Summary'
                })
                detected_cost_category = 'Cost Summary'
                logger.info(
                    f"Added default cost_category = 'Cost Summary' for cost query"
                )

            # Capacity queries
            elif 'capacity' in query_lower:
                filters.append({
                    'column': 'cost_category',
                    'operator': '=',
                    'value': 'GB Wise END Capacity'
                })
                detected_cost_category = 'GB Wise END Capacity'
                logger.info(
                    f"Added default cost_category = 'GB Wise END Capacity' for capacity query"
                )

        # AUTO-SELECT CORRECT METRIC COLUMN BASED ON COST CATEGORY
        # Use COST_CATEGORY_METRIC_MAP to route to the right metric column
        if detected_cost_category:
            correct_metric = COST_CATEGORY_METRIC_MAP.get(
                detected_cost_category)

            if correct_metric:
                # Determine the right aggregation for each metric type
                if correct_metric == 'attrition':
                    # Attrition: COUNT the number of attrition records (value=1.0 per person)
                    default_agg = 'COUNT'
                elif correct_metric == 'headcount':
                    # Headcount: SUM the headcount values
                    default_agg = 'SUM'
                else:
                    # Financial metrics: SUM
                    default_agg = 'SUM'

                # Replace ONLY THE FIRST incorrectly routed metric to avoid duplicates
                # This handles cases where LLM chose wrong metric (e.g., amount_usd for Attrition)
                metric_fixed = False
                for m in metrics:
                    old_name = m.get('name')
                    # Only fix if metric is wrong AND we haven't already fixed one
                    if not metric_fixed and old_name != correct_metric and old_name in [
                            'amount_usd', 'headcount', 'attrition', 'capacity'
                    ]:
                        logger.info(
                            f"Routing metric for {detected_cost_category}: {old_name} → {correct_metric} ({default_agg})"
                        )
                        m['name'] = correct_metric
                        m['aggregation'] = default_agg
                        metric_fixed = True

                # If no metrics specified, add the correct default metric
                if not metrics:
                    intent['metrics'] = [{
                        'name': correct_metric,
                        'aggregation': default_agg
                    }]
                    logger.info(
                        f"Added default metric for {detected_cost_category}: {default_agg}({correct_metric})"
                    )

        # REMOVE DUPLICATE cost_category filters - keep only exact match (=)
        # Both LLM and entity detection may add cost_category filters
        cost_cat_filters = [
            f for f in filters
            if f.get('column', '').lower().replace(' ', '_') == 'cost_category'
        ]
        other_filters = [
            f for f in filters
            if f.get('column', '').lower().replace(' ', '_') != 'cost_category'
        ]

        if len(cost_cat_filters) > 1:
            # Keep only the one with exact match (=), prefer that over ILIKE
            exact_match = next(
                (f for f in cost_cat_filters if f.get('operator') == '='),
                None)
            if exact_match:
                logger.info(
                    f"Removing duplicate cost_category filters, keeping: {exact_match}"
                )
                cost_cat_filters = [exact_match]
            else:
                # No exact match, keep the first one
                cost_cat_filters = [cost_cat_filters[0]]

        filters = other_filters + cost_cat_filters

        # FIX include_exclude filter
        # Per spec: include_exclude = 'Include' is ONLY needed for Worldwide (WW) revenue.
        # Individual entity queries (region_entity filter) must NOT have this filter applied.
        # NOTE: new_service_area (view filter like MS/SX) is NOT entity-level — "MS Worldwide"
        # is still a WW query and must get include_exclude='Include'.
        include_exclude_filters = [
            f for f in filters if f.get('column', '').lower().replace(
                ' ', '_') == 'include_exclude'
        ]

        # Detect if this is a WW query:
        # - No region_entity WHERE filter (not a specific-entity query)
        # - No region_entity in group_by (not a "by entity" breakdown query)
        # new_service_area (view scoping) does NOT prevent WW determination.
        _group_by_for_ww = intent.get('group_by', [])
        is_ww_query = (
            not any(f.get('column', '').lower() == 'region_entity' for f in filters)
            and 'region_entity' not in _group_by_for_ww
        )

        if include_exclude_filters:
            if is_ww_query:
                # WW query: fix any existing include_exclude filter value to 'Include'
                for ie_filter in include_exclude_filters:
                    if ie_filter.get('value') != 'Include':
                        logger.info(
                            f"Fixing include_exclude filter: '{ie_filter.get('value')}' → 'Include'"
                        )
                        ie_filter['value'] = 'Include'
                        ie_filter['operator'] = '='
            else:
                # Entity / SX / MS query: remove any include_exclude filter — spec says not needed
                filters = [
                    f for f in filters
                    if f.get('column', '').lower().replace(' ', '_') != 'include_exclude'
                ]
                logger.info(
                    "Removed include_exclude filter: not applicable for entity/SX/MS revenue queries"
                )
        else:
            # No existing include_exclude filter — only add it for WW Revenue queries
            if is_ww_query and detected_cost_category and 'revenue' in detected_cost_category.lower():
                filters.append({
                    'column': 'include_exclude',
                    'operator': '=',
                    'value': 'Include'
                })
                logger.info(
                    "Added include_exclude = 'Include' for WW Revenue query"
                )
            elif not is_ww_query:
                logger.info(
                    "Skipped include_exclude filter: entity/SX/MS revenue query does not need it"
                )

        intent['filters'] = filters
        intent['metrics'] = metrics

        return intent

    def _execute_sql_template(self, sql_template: str, cube_id: str, intent: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a full SQL template defined by an admin in the Intelligence Studio.
        Substitutes placeholders: {cube_id}, {year}, {month}, {group_by}, {extra_filters}.

        {extra_filters} is built from two sources:
          1. intent['filters'] set by the LLM (standard filter parsing)
          2. Matching business terms from cube_business_terms whose aliases appear in the query

        Returns the same structure as compile_calculation_sql so callers handle it uniformly.
        """
        try:
            year = intent.get('year', '')
            month = intent.get('month', '')
            original_query = intent.get('original_query', '').lower()

            # ── Universal year/month fallback from raw query text ─────────────
            # Guarantees ALL template-driven queries get time filtering even when
            # upstream intent extraction missed them.
            import re as _re_time
            _MONTHS = {
                'jan': 1, 'january': 1, 'feb': 2, 'february': 2,
                'mar': 3, 'march': 3, 'apr': 4, 'april': 4,
                'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
                'aug': 8, 'august': 8, 'sep': 9, 'sept': 9, 'september': 9,
                'oct': 10, 'october': 10, 'nov': 11, 'november': 11,
                'dec': 12, 'december': 12,
            }
            if (not month) and original_query:
                # Range first: "jan to mar", "jan-mar", "jan thru mar"
                _rng = _re_time.search(
                    r'\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b'
                    r'\s*(?:to|thru|through|-|–|—)\s*'
                    r'\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b',
                    original_query
                )
                if _rng:
                    a, b = _MONTHS[_rng.group(1)], _MONTHS[_rng.group(2)]
                    if a <= b:
                        month = list(range(a, b + 1))
                        logger.info(f"[DB-TEMPLATE] Fallback month range from query: {month}")
                else:
                    # Quarter: Q1..Q4
                    _q = _re_time.search(r'\bq([1-4])\b', original_query)
                    if _q:
                        qn = int(_q.group(1))
                        month = [(qn - 1) * 3 + 1, (qn - 1) * 3 + 2, qn * 3]
                        logger.info(f"[DB-TEMPLATE] Fallback Q{qn} → months {month}")
                    else:
                        # Single month
                        _m = _re_time.search(
                            r'\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b',
                            original_query
                        )
                        if _m:
                            month = _MONTHS[_m.group(1)]
                            logger.info(f"[DB-TEMPLATE] Fallback single month from query: {month}")
            if (not year) and original_query:
                _y = _re_time.search(r'\b(20\d{2})\b', original_query)
                if _y:
                    year = int(_y.group(1))
                    logger.info(f"[DB-TEMPLATE] Fallback year from query: {year}")
                else:
                    # FY24, FY25, FY 2025
                    _fy = _re_time.search(r'\bfy\s*(\d{2,4})\b', original_query)
                    if _fy:
                        ys = _fy.group(1)
                        year = 2000 + int(ys) if len(ys) == 2 else int(ys)
                        logger.info(f"[DB-TEMPLATE] Fallback FY year from query: {year}")

            # Build group_by clause — exclude period columns
            period_cols = {'year', 'month', 'quarter'}
            raw_group_by = [c for c in intent.get('group_by', []) if c not in period_cols]
            group_by = ', '.join(raw_group_by) if raw_group_by else 'region_entity'

            # ── Source 1: filters already in intent (set by LLM) ──────────────
            standard_cols = {'cube_id', 'year', 'month', 'quarter'}
            extra_filter_parts = []
            for f in intent.get('filters', []):
                col = f.get('column', '')
                val = f.get('value', '')
                op = f.get('operator', '=')
                if not col or col in standard_cols or not val:
                    continue
                if op == '=' or op is None:
                    extra_filter_parts.append(f"AND {col} = '{val}'")
                elif op in ('IN', 'in'):
                    if isinstance(val, list):
                        vals_str = ', '.join(f"'{v}'" for v in val)
                        extra_filter_parts.append(f"AND {col} IN ({vals_str})")
                    else:
                        extra_filter_parts.append(f"AND {col} IN ('{val}')")
                elif op in ('LIKE', 'like'):
                    extra_filter_parts.append(f"AND {col} LIKE '{val}'")
                elif op in ('!=', '<>'):
                    extra_filter_parts.append(f"AND {col} != '{val}'")

            # ── Source 2: business terms matched from original query ──────────
            if original_query:
                try:
                    conn2 = psycopg2.connect(self.db_url)
                    cur2 = conn2.cursor()
                    cur2.execute(
                        """
                        SELECT term_name, term_aliases, sql_filter
                        FROM cube_business_terms
                        WHERE cube_id = %s AND is_active = 1 AND sql_filter IS NOT NULL
                        """, (cube_id,))
                    business_terms = cur2.fetchall()
                    conn2.close()

                    for (term_name, aliases, sql_filter) in business_terms:
                        if not sql_filter:
                            continue
                        candidates = [term_name.lower()] + [a.lower() for a in (aliases or [])]
                        if any(c in original_query for c in candidates):
                            extra_filter_parts.append(f"AND {sql_filter}")
                            logger.info(f"[DB-TEMPLATE] Injected business term filter: {term_name} → {sql_filter}")
                            break  # one business term match per query is sufficient
                except Exception as bt_err:
                    logger.warning(f"[DB-TEMPLATE] Could not load business terms for extra_filters: {bt_err}")

            extra_filters = '\n  '.join(extra_filter_parts)

            # ── Substitute all placeholders ───────────────────────────────────
            # If year/month are missing or empty, strip their entire filter clause
            # (e.g. "AND year = {year}") so we don't produce broken SQL like "AND year =".
            import re as _re
            sql = sql_template

            def _strip_or_replace(sql_in: str, col: str, value) -> str:
                if value in (None, '', [], 'None'):
                    # Remove "AND <col> <op> {col}" or "AND <col> IN ({col})" clauses
                    pattern = _re.compile(
                        r"\s*AND\s+" + _re.escape(col) + r"\s*(=|IN)\s*(\{" + _re.escape(col) + r"\}|\(\s*\{" + _re.escape(col) + r"\}\s*\))",
                        flags=_re.IGNORECASE,
                    )
                    return pattern.sub('', sql_in)
                # Lists → IN clause
                if isinstance(value, list):
                    if len(value) == 1:
                        return sql_in.replace('{' + col + '}', str(value[0]))
                    joined = ', '.join(str(v) for v in value)
                    # If template uses "= {col}", convert to IN (...)
                    sql_in = _re.sub(
                        r"(=\s*)\{" + _re.escape(col) + r"\}",
                        f"IN ({joined})",
                        sql_in,
                    )
                    return sql_in.replace('{' + col + '}', joined)
                return sql_in.replace('{' + col + '}', str(value))

            sql = sql.replace('{cube_id}', str(cube_id))
            sql = _strip_or_replace(sql, 'year', year)
            sql = _strip_or_replace(sql, 'month', month)
            sql = sql.replace('{group_by}', group_by)
            sql = sql.replace('{extra_filters}', extra_filters)

            logger.info(
                f"[DB-TEMPLATE] Substituted template → cube={cube_id}, year={year}, month={month}, "
                f"group_by={group_by}, extra_filters={extra_filters!r}"
            )

            return {
                'success': True,
                'sql': sql,
                'params': [],
                'source': 'db_template'
            }

        except Exception as e:
            logger.error(f"[DB-TEMPLATE] Error building SQL template: {e}")
            return {'success': False, 'error': str(e), 'source': 'db_template'}

    def compile_calculation_sql(self,
                                calculation_name: str,
                                cube_id: str,
                                intent: Dict[str, Any],
                                domain: str = None) -> Dict[str, Any]:
        """
        Compile SQL for KPI calculations (EBIT, Billing Utilization, Price Mix, Attrition %, etc).
        Uses the formula from cube_calculation_rules and adapts it for cube_fact_data.
        Falls back to hardcoded builders if calculation not found in database (not on DB errors).
        
        NOTE: Hardcoded builders are Bosch-specific. For Nemko domain, only database-defined
        calculations are used; if not found, returns an error to trigger RAG fallback.
        """
        # CASE-INSENSITIVE: Normalize calculation_name to lowercase for consistent matching
        calculation_name = calculation_name.lower() if calculation_name else ''

        # Check if this is a Nemko domain - they use different data structures
        is_nemko = is_nemko_domain(domain) if domain else False

        # Normalize underscore format (from LLM metric routing) to space format (used in DB and hardcoded builders)
        # e.g. 'outsourcing_capacity_avg' -> 'outsourcing capacity avg'
        calculation_name = calculation_name.replace('_', ' ')

        try:
            # Get the calculation from the database
            result = None
            db_error = None
            logger.info(f"[DB-LOOKUP] Starting DB lookup for calc='{calculation_name}', cube_id={cube_id}")
            try:
                conn = psycopg2.connect(self.db_url)
                cursor = conn.cursor()

                # Build candidate names: original + progressively stripped suffixes
                # e.g. "total capacity end" → ["total capacity end", "total capacity"]
                # This handles fast-path-generated names like "...End", "...Avg" that
                # may not match seeded calc names exactly.
                _suffix_words = {'end', 'avg', 'average', 'count', 'percentage', '%', 'mix', 'ratio'}
                _name_words = calculation_name.lower().split()
                candidate_names = [calculation_name.lower()]
                _stripped = list(_name_words)
                while len(_stripped) > 1 and _stripped[-1] in _suffix_words:
                    _stripped.pop()
                    candidate_names.append(' '.join(_stripped))
                logger.info(f"[DB-LOOKUP] Candidates to try: {candidate_names}")

                # Try each candidate in order (longest/most-specific first)
                result = None
                for _candidate in candidate_names:
                    cursor.execute(
                        """
                        SELECT calculation_name, formula, result_type, required_columns, default_filters, rounding_precision, sql_template
                        FROM cube_calculation_rules
                        WHERE cube_id = %s AND (
                            calculation_name ILIKE %s 
                            OR %s = ANY(calculation_aliases)
                        )
                        AND is_active = 1
                        ORDER BY sql_template IS NOT NULL DESC,
                                 LENGTH(calculation_name) ASC
                        LIMIT 1
                    """, (cube_id, f"%{_candidate}%", _candidate))
                    result = cursor.fetchone()
                    if result:
                        if _candidate != calculation_name.lower():
                            logger.info(
                                f"[DB-LOOKUP] Matched '{calculation_name}' → seeded calc '{result[0]}' (via stripped candidate '{_candidate}')"
                            )
                        break
                conn.close()
            except Exception as db_err:
                db_error = db_err
                logger.warning(f"DB error fetching calculation: {db_err}")

            # ================================================================
            # DB-FIRST: If the matched calculation has a sql_template, execute
            # it directly — bypasses ALL hardcoded Python builders.
            # Admin defines the full SQL in the Intelligence Studio UI.
            # ================================================================
            logger.info(
                f"[DB-LOOKUP] Result: {result[0] if result else None} | "
                f"has_template={bool(result and result[6])} | db_error={db_error}"
            )
            if result and result[6]:  # result[6] = sql_template
                sql_template = result[6]
                logger.info(
                    f"[DB-TEMPLATE] Found sql_template for '{calculation_name}' → '{result[0]}' — executing directly (bypassing hardcoded builders)"
                )
                return self._execute_sql_template(sql_template, cube_id, intent)

            # Use database result if found
            if result:
                calc_name, formula, result_type, required_columns, default_filters, rounding, _ = result
                calc_name_lower = calc_name.lower(
                ) if calc_name else calculation_name.lower()
                # sql_template is empty — fall back to Python builders below
                if not is_nemko:
                    logger.info(
                        f"[DB-TEMPLATE] calc_rule found for '{calc_name}' but sql_template is empty. "
                        f"Falling back to Python builders."
                    )
                    # Fall through to METRIC_CATALOG / legacy builder routing below
            else:
                # No DB record found — fall back to Python builders for Bosch domain.
                calc_name_lower = calculation_name.lower()
                rounding = 2  # default rounding

                # Nemko domain has its own separate SQL builders (different schema)
                if is_nemko:
                    nemko_result = self._compile_nemko_sql(
                        calculation_name, intent, domain)
                    if nemko_result.get('success'):
                        return nemko_result
                    logger.info(
                        f"Nemko domain - no SQL builder for '{calculation_name}', use RAG instead"
                    )
                    return {
                        'success': False,
                        'error': f"Calculation '{calculation_name}' not available for Nemko domain.",
                        'use_rag': True
                    }

                if db_error:
                    return {'success': False, 'error': f"Database error: {db_error}"}

                # Fall through to Python builder routing below
                logger.info(
                    f"[DB-TEMPLATE] No DB record for '{calculation_name}' — trying Python builders."
                )

            # Extract filters and group_by from intent
            filters = intent.get('filters', [])
            group_by = intent.get('group_by', ['region_entity'])

            # Determine if this calculation needs to skip onsite_offshore filter
            # (calculations that handle onsite_offshore internally)
            offshore_calculations = [
                'offshore capacity avg', 'offshore capacity end',
                'outsourcing capacity avg', 'outsourcing capacity end',
                'budget offshore', 'offshore budget', 'budget outsourcing',
                'outsourcing budget'
            ]
            skip_onsite_offshore = any(kw in calc_name_lower
                                       for kw in offshore_calculations)
            skip_columns = ['onsite_offshore'] if skip_onsite_offshore else []

            # Capacity mix calculations need BOTH Internal AND External resources
            # Skip resource_type filter to avoid filtering out one resource type
            capacity_mix_calculations = [
                'internal capacity mix', 'internal mix',
                'external capacity mix', 'external mix', 'outsourcing mix',
                'total capacity avg', 'total capacity end'
            ]
            if any(kw in calc_name_lower for kw in capacity_mix_calculations):
                skip_columns.append('resource_type')
                logger.info(
                    f"Skipping resource_type filter for capacity mix calculation: {calculation_name}"
                )

            # Build base WHERE clause and params
            where_parts, params = self._build_calculation_where_clause(
                filters, cube_id, skip_columns)

            # Build group by columns
            group_cols = self._build_group_by_columns(group_by)

            # Auto-add month to group_by when multiple months are in the filter
            # (e.g. "jan to feb" → month IN [1,2]) so each month gets its own row.
            _multi_month_f = next(
                (f for f in filters if f.get('column') == 'month'), None)
            if (_multi_month_f
                    and isinstance(_multi_month_f.get('value'), list)
                    and len(_multi_month_f['value']) > 1
                    and 'month' not in group_cols):
                group_cols = ['month'] + group_cols
                logger.info(
                    f"Auto-added month to group_by for multi-month range: "
                    f"months={_multi_month_f['value']}")

            select_cols = ", ".join(group_cols)
            group_by_clause = ", ".join(group_cols)

            # Extract currency preference (INR vs USD, default USD)
            currency = intent.get('currency', 'usd')
            amt_col = get_amount_column(currency)
            currency_label = get_currency_label(currency)
            if currency == 'inr':
                logger.info(f"Using INR currency: column={amt_col}")

            # Route to specific calculation SQL builder
            # FIRST: Check if this is a direct metric_id from METRIC_CATALOG (LLM routing)
            # METRIC_CATALOG uses underscore keys, calc_name_lower uses spaces after normalization
            catalog_key = calc_name_lower.replace(' ', '_')
            if catalog_key in METRIC_CATALOG:
                metric_info = METRIC_CATALOG[catalog_key]
                builder_name = metric_info['builder']
                logger.info(
                    f"Direct METRIC_CATALOG routing: {catalog_key} -> {builder_name}"
                )

                # Route to the appropriate builder based on metric_id
                if catalog_key == 'pyramid_mix':
                    return self._build_pyramid_mix_by_salary_level_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 2)
                elif catalog_key == 'pyramid_mix_individual_levels':
                    return self._build_pyramid_mix_individual_levels_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 2)
                elif catalog_key == 'pyramid_mix_by_salary_level':
                    return self._build_pyramid_mix_by_salary_level_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 2)
                elif catalog_key == 'offshore_capacity_end':
                    return self._build_offshore_capacity_end_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 0, cube_id)
                elif catalog_key == 'offshore_capacity_avg':
                    return self._build_offshore_capacity_avg_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 0, cube_id)
                elif catalog_key == 'outsourcing_capacity_end':
                    return self._build_outsourcing_capacity_end_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 0, cube_id)
                elif catalog_key == 'outsourcing_capacity_avg':
                    return self._build_outsourcing_capacity_avg_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 0, cube_id)
                elif catalog_key == 'total_capacity_end':
                    return self._build_total_capacity_end_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 0, cube_id)
                elif catalog_key == 'total_capacity_avg':
                    return self._build_total_capacity_avg_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 0, cube_id)
                elif catalog_key == 'available_capacity':
                    return self._build_available_capacity_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 2)
                elif catalog_key == 'internal_capacity_mix':
                    return self._build_internal_capacity_mix_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 2)
                elif catalog_key == 'external_capacity_mix':
                    return self._build_external_capacity_mix_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 2)
                elif catalog_key == 'billing_utilization':
                    return self._build_billing_utilization_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 2, 'Billing Utilization')
                elif catalog_key == 'revenue':
                    return self._build_revenue_sql(where_parts, params,
                                                   select_cols,
                                                   group_by_clause, rounding
                                                   or 0, amt_col)
                elif catalog_key == 'gb_pl_revenue':
                    return self._build_gb_pl_revenue_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 2, amt_col)
                elif catalog_key == 'entity_pl_revenue':
                    return self._build_entity_pl_revenue_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 2, amt_col)
                elif catalog_key == 'budget_per_capacity':
                    return self._build_budget_per_capacity_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 0, amt_col)
                elif catalog_key == 'budget_per_avg_capacity_entity':
                    return self._build_budget_per_avg_capacity_entity_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 0, amt_col)
                elif catalog_key == 'budget_per_avg_capacity_ww':
                    # If user asked about a specific entity, use entity version
                    _has_entity_filter = any(
                        f.get('column') == 'region_entity'
                        for f in intent.get('filters', [])
                    )
                    if _has_entity_filter:
                        logger.info(
                            "Budget/Avg Capacity: entity filter detected, routing to Entity version"
                        )
                        return self._build_budget_per_avg_capacity_entity_sql(
                            where_parts, params, select_cols, group_by_clause,
                            rounding or 0, amt_col)
                    return self._build_budget_per_avg_capacity_ww_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 0, cube_id, amt_col)
                elif catalog_key == 'budget_total_ww':
                    return self._build_budget_total_ww_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 2, amt_col, currency_label)
                elif catalog_key == 'budget_offshore':
                    return self._build_budget_offshore_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 2, amt_col, currency_label)
                elif catalog_key == 'budget_outsourcing':
                    return self._build_budget_outsourcing_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 2, amt_col, currency_label)
                elif catalog_key == 'attrition_pct':
                    return self._build_attrition_pct_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 2)
                elif catalog_key == 'ebit':
                    return self._build_ebit_sql(where_parts, params,
                                                select_cols, group_by_clause,
                                                rounding or 2, amt_col)
                elif catalog_key == 'price_mix':
                    return self._build_price_mix_sql(where_parts, params,
                                                     select_cols,
                                                     group_by_clause, rounding
                                                     or 2)
                elif catalog_key == 'travel_cost':
                    return self._build_travel_cost_sql(where_parts, params,
                                                       select_cols,
                                                       group_by_clause,
                                                       rounding or 2, amt_col)
                elif catalog_key == 'direct_cost':
                    return self._build_direct_cost_sql(where_parts, params,
                                                       select_cols,
                                                       group_by_clause,
                                                       rounding or 2, amt_col)
                elif catalog_key == 'indirect_cost':
                    return self._build_indirect_cost_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 2, amt_col)
                elif catalog_key == 'gross_margin':
                    _gm_pl = any(kw in calc_name_lower for kw in [
                        'gb p&l', 'entity p&l', 'gb pl', 'entity pl',
                        'p&l gross', 'pl gross'
                    ])
                    return self._build_gross_margin_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 2, amt_col, apply_pl_exclusions=_gm_pl)
                elif catalog_key == 'resource_cost':
                    return self._build_resource_cost_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 2, amt_col)
                elif catalog_key == 'other_direct_cost':
                    return self._build_other_direct_cost_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 2, amt_col)

            # LEGACY: Keyword-based routing (fallback when LLM not used)
            if 'ebit' in calc_name_lower:
                return self._build_ebit_sql(where_parts, params, select_cols,
                                            group_by_clause, rounding or 2, amt_col)

            elif 'billing utilization' in calc_name_lower or 'utilization' in calc_name_lower:
                billing_cost_cat = 'Billing Utilization Summary'
                for f in filters:
                    if f.get('column',
                             '').lower().replace(' ', '_') == 'cost_category':
                        val = f.get('value', '')
                        if 'billing utilization' in val.lower():
                            billing_cost_cat = val
                            break
                return self._build_billing_utilization_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 2, billing_cost_cat)

            elif 'price mix' in calc_name_lower:
                return self._build_price_mix_sql(where_parts, params,
                                                 select_cols, group_by_clause,
                                                 rounding or 2)

            elif 'attrition' in calc_name_lower:
                return self._build_attrition_pct_sql(where_parts, params,
                                                     select_cols,
                                                     group_by_clause, rounding
                                                     or 2)

            elif 'pyramid' in calc_name_lower and 'salary level' in calc_name_lower:
                return self._build_pyramid_mix_by_salary_level_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 2)

            elif 'pyramid' in calc_name_lower and (
                    'individual' in calc_name_lower or 'breakdown'
                    in calc_name_lower or 'by sl' in calc_name_lower
                    or 'salarylevel' in calc_name_lower):
                return self._build_pyramid_mix_individual_levels_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 2)

            elif 'pyramid' in calc_name_lower:
                return self._build_pyramid_mix_by_salary_level_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 2)

            elif 'internal capacity mix' in calc_name_lower or 'internal mix' in calc_name_lower:
                return self._build_internal_capacity_mix_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 2)

            elif 'external capacity mix' in calc_name_lower or 'external mix' in calc_name_lower or 'outsourcing mix' in calc_name_lower:
                return self._build_external_capacity_mix_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 2)

            elif 'budget per capacity' in calc_name_lower or 'budget per cap' in calc_name_lower:
                return self._build_budget_per_capacity_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 0, amt_col)

            # New WW KPIs - order matters: check specific before general
            elif 'budget offshore' in calc_name_lower or 'offshore budget' in calc_name_lower:
                return self._build_budget_offshore_sql(where_parts, params,
                                                       select_cols,
                                                       group_by_clause,
                                                       rounding or 2, amt_col, currency_label)

            elif 'budget outsourcing' in calc_name_lower or 'outsourcing budget' in calc_name_lower or 'budget external' in calc_name_lower:
                return self._build_budget_outsourcing_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 2, amt_col, currency_label)

            elif ('worldwide budget' in calc_name_lower
                  or 'ww budget' in calc_name_lower
                  or 'global budget' in calc_name_lower
                  or 'budget musd' in calc_name_lower
                  or 'budget_total_ww' in calc_name_lower) and 'per' not in calc_name_lower:
                return self._build_budget_total_ww_sql(where_parts, params,
                                                       select_cols,
                                                       group_by_clause,
                                                       rounding or 2, amt_col, currency_label)

            elif 'total capacity avg' in calc_name_lower or 'average total capacity' in calc_name_lower:
                return self._build_total_capacity_avg_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 0, cube_id)

            elif 'total capacity end' in calc_name_lower or 'end total capacity' in calc_name_lower:
                return self._build_total_capacity_end_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 0, cube_id)

            elif 'offshore capacity avg' in calc_name_lower or 'average offshore capacity' in calc_name_lower or 'offshore avg capacity' in calc_name_lower:
                return self._build_offshore_capacity_avg_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 0, cube_id)

            elif 'offshore capacity end' in calc_name_lower or 'end offshore capacity' in calc_name_lower or 'offshore end capacity' in calc_name_lower:
                return self._build_offshore_capacity_end_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 0, cube_id)

            elif 'outsourcing capacity avg' in calc_name_lower or 'average outsourcing capacity' in calc_name_lower or 'outsourcing avg capacity' in calc_name_lower:
                return self._build_outsourcing_capacity_avg_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 0, cube_id)

            elif 'outsourcing capacity end' in calc_name_lower or 'end outsourcing capacity' in calc_name_lower or 'outsourcing end capacity' in calc_name_lower:
                return self._build_outsourcing_capacity_end_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 0, cube_id)

            # ── BARE-TERM FALLBACKS (no end/avg qualifier) ────────────────────
            # These run only after all specific end/avg checks have already failed to match.
            elif 'outsourcing capacity' in calc_name_lower or 'external capacity' in calc_name_lower:
                # Default: end (point-in-time headcount is the standard report)
                logger.info("Bare 'outsourcing/external capacity' → defaulting to outsourcing_capacity_end")
                return self._build_outsourcing_capacity_end_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 0, cube_id)

            elif 'offshore capacity' in calc_name_lower:
                logger.info("Bare 'offshore capacity' → defaulting to offshore_capacity_end")
                return self._build_offshore_capacity_end_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 0, cube_id)

            elif 'total capacity' in calc_name_lower:
                logger.info("Bare 'total capacity' → defaulting to total_capacity_end")
                return self._build_total_capacity_end_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 0, cube_id)

            elif 'offshore mix' in calc_name_lower:
                logger.info("'offshore mix' → routing to external_capacity_mix")
                return self._build_external_capacity_mix_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 2)

            elif 'capacity mix' in calc_name_lower or (calc_name_lower.strip() == 'mix'):
                logger.info("Bare 'capacity mix' / 'mix' → defaulting to internal_capacity_mix")
                return self._build_internal_capacity_mix_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 2)

            # ── P&L BARE-TERM FALLBACKS ──────────────────────────────────────
            elif 'p&l revenue' in calc_name_lower or 'pl revenue' in calc_name_lower:
                logger.info("Bare 'P&L revenue' → defaulting to GB P&L revenue")
                return self._build_gb_pl_revenue_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 2, amt_col)

            elif 'p&l cost' in calc_name_lower or 'pl cost' in calc_name_lower:
                logger.info("Bare 'P&L cost' → defaulting to direct_cost (GB P&L cost)")
                return self._build_direct_cost_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 2, amt_col)

            # Available Capacity = Allocated + Not Allocated + M/S + VKM - Non Linear
            elif 'available capacity' in calc_name_lower or 'availability capacity' in calc_name_lower:
                return self._build_available_capacity_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 2)

            # Entity version MUST be checked first (before WW version)
            elif 'budget per avg capacity entity' in calc_name_lower or 'entity budget per avg capacity' in calc_name_lower:
                return self._build_budget_per_avg_capacity_entity_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 0, amt_col)

            # Budget per Avg Capacity WW (all variations) - route to entity if specific entity present
            elif any(kw in calc_name_lower for kw in [
                    'budget per avg capacity', 'budget avg capacity',
                    'budget/avg capacity', 'budget/ avg capacity'
            ]):
                _has_entity_filter2 = any(
                    f.get('column') == 'region_entity'
                    for f in intent.get('filters', [])
                )
                if _has_entity_filter2:
                    logger.info(
                        "Budget/Avg Capacity (string path): entity filter detected, routing to Entity version"
                    )
                    return self._build_budget_per_avg_capacity_entity_sql(
                        where_parts, params, select_cols, group_by_clause,
                        rounding or 0, amt_col)
                return self._build_budget_per_avg_capacity_ww_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 0, cube_id, amt_col)

            # GB P&L Revenue (YTD, with order_reason + GL account exclusions)
            # Must be checked BEFORE the generic 'revenue' catch-all below
            elif any(kw in calc_name_lower for kw in [
                    'gb p&l revenue', 'gb pl revenue', 'gb p&l rev',
                    'gb wise p&l revenue', 'gb p and l revenue'
            ]):
                return self._build_gb_pl_revenue_sql(
                    where_parts, params, select_cols, group_by_clause,
                    rounding or 2, amt_col)

            # Entity P&L Revenue (YTD, with order_reason + GL account exclusions)
            # Must be checked BEFORE the generic 'revenue' catch-all below
            elif any(kw in calc_name_lower for kw in [
                    'entity p&l revenue', 'entity pl revenue',
                    'entity p&l rev', 'o&l revenue', 'entity p and l revenue',
                    'entity revenue p&l', 'entity revenue pl'
            ]):
                return self._build_entity_pl_revenue_sql(
                    where_parts, params, select_cols, group_by_clause,
                    rounding or 2, amt_col)

            # Revenue (MTD or Summary) - simple SUM of Revenue Summary by entity
            elif 'revenue' in calc_name_lower:
                return self._build_revenue_sql(where_parts, params,
                                               select_cols, group_by_clause,
                                               rounding or 0, amt_col)

            # Cost breakdown metrics
            elif 'travel cost' in calc_name_lower or 'travel expense' in calc_name_lower:
                return self._build_travel_cost_sql(where_parts, params,
                                                   select_cols,
                                                   group_by_clause, rounding
                                                   or 2, amt_col)

            elif 'direct cost' in calc_name_lower and 'other' not in calc_name_lower and 'indirect' not in calc_name_lower:
                return self._build_direct_cost_sql(where_parts, params,
                                                   select_cols,
                                                   group_by_clause, rounding
                                                   or 2, amt_col)

            elif 'indirect cost' in calc_name_lower or 'corporate cost' in calc_name_lower:
                return self._build_indirect_cost_sql(where_parts, params,
                                                     select_cols,
                                                     group_by_clause, rounding
                                                     or 2, amt_col)

            elif 'gross margin' in calc_name_lower or 'gross profit' in calc_name_lower:
                _gm_pl_legacy = any(kw in calc_name_lower for kw in [
                    'gb p&l', 'entity p&l', 'gb pl', 'entity pl',
                    'p&l gross', 'pl gross'
                ])
                return self._build_gross_margin_sql(where_parts, params,
                                                    select_cols,
                                                    group_by_clause, rounding
                                                    or 2, amt_col,
                                                    apply_pl_exclusions=_gm_pl_legacy)

            elif 'resource cost' in calc_name_lower or 'resource expense' in calc_name_lower:
                return self._build_resource_cost_sql(where_parts, params,
                                                     select_cols,
                                                     group_by_clause, rounding
                                                     or 2, amt_col)

            elif 'other direct cost' in calc_name_lower or 'other direct expense' in calc_name_lower:
                return self._build_other_direct_cost_sql(
                    where_parts, params, select_cols, group_by_clause, rounding
                    or 2, amt_col)

            return {
                'success': False,
                'error': f"Calculation '{calculation_name}' not implemented"
            }

        except Exception as e:
            logger.error(f"Failed to compile calculation SQL: {e}")
            return {'success': False, 'error': str(e)}

    def _extract_ctg_month_clause(self, where_parts: List[str]) -> str:
        """Extract month clause for CTG plan data lookups from where_parts.
        Handles both single-month ('month = X') and multi-month ('month IN (X, Y, Z)') filters.
        Returns an SQL fragment like 'AND p.month = 3' or 'AND p.month IN (1, 2, 3)' or ''.
        """
        for part in where_parts:
            single = re.search(r"\bmonth\s*=\s*(\d+)\b", part, re.IGNORECASE)
            if single:
                return f"AND p.month = {int(single.group(1))}"
            multi = re.search(r"\bmonth\s+IN\s*\(([^)]+)\)", part, re.IGNORECASE)
            if multi:
                raw_vals = [v.strip().strip("'\"") for v in multi.group(1).split(',')]
                ints = [int(v) for v in raw_vals if v.isdigit()]
                if ints:
                    if len(ints) == 1:
                        return f"AND p.month = {ints[0]}"
                    return f"AND p.month IN ({', '.join(str(m) for m in ints)})"
        return ""

    def _build_calculation_where_clause(
            self,
            filters: List[Dict],
            cube_id: str,
            skip_columns: List[str] = None) -> tuple:
        """Build WHERE clause for calculation queries, excluding cost_category.
        
        Args:
            filters: List of filter dictionaries
            cube_id: Cube ID to filter by
            skip_columns: Optional list of column names to skip (e.g., ['onsite_offshore'] for offshore calculations)
        """
        where_parts = ["cube_id = %s"]
        params = [cube_id]
        skip_columns = skip_columns or []

        seen_columns = set()
        for f in filters:
            col = f.get('column', '').lower().replace(' ', '_')
            op = f.get('operator', '=')
            val = f.get('value')

            if col == 'cost_category':
                continue  # Skip - handled per calculation type

            if col in skip_columns:
                continue  # Skip columns that the calculation handles internally

            if col == 'region_entity' and isinstance(val, str):
                val = val.upper()

            if col in seen_columns and col == 'region_entity':
                continue
            seen_columns.add(col)

            if col in [
                    'year', 'month', 'region_entity', 'sector', 'project_gb',
                    'resource_type', 'onsite_offshore', 'service_area',
                    'new_service_area', 'include_exclude'
            ]:
                if op == 'ILIKE':
                    where_parts.append(f"{col} ILIKE %s")
                    params.append(val)
                elif op == 'IN' and isinstance(val, list):
                    placeholders = ', '.join(['%s'] * len(val))
                    where_parts.append(f"{col} IN ({placeholders})")
                    params.extend(val)
                elif op == 'NOT IN' and isinstance(val, list):
                    placeholders = ', '.join(['%s'] * len(val))
                    where_parts.append(
                        f"({col} IS NULL OR {col} NOT IN ({placeholders}))")
                    params.extend(val)
                elif isinstance(val, list):
                    # If value is a list but operator is not IN/NOT IN, use IN
                    placeholders = ', '.join(['%s'] * len(val))
                    where_parts.append(f"{col} IN ({placeholders})")
                    params.extend(val)
                else:
                    where_parts.append(f"{col} = %s")
                    params.append(val)

        return where_parts, params

    def _build_group_by_columns(self, group_by: List[str]) -> List[str]:
        """Build valid group by column list."""
        valid_cols = [
            'region_entity', 'sector', 'year', 'month', 'project_gb',
            'resource_type', 'onsite_offshore', 'service_area'
        ]
        group_cols = []
        for g in group_by:
            db_col = g.lower().replace(' ', '_').replace('/', '_')
            if db_col in valid_cols:
                group_cols.append(db_col)
        return group_cols if group_cols else ['region_entity']

    def _build_ebit_sql(self, where_parts: List[str], params: List,
                        select_cols: str, group_by_clause: str,
                        rounding: int, amt_col: str = 'amount_usd') -> Dict[str, Any]:
        """GB P&L EBIT formula:
          Gross Margin        = Revenue - (Total Direct Cost + Total Indirect Cost)
          Total Direct Cost   = Resource Cost + Travel Cost + Other Direct Cost
          Total Indirect Cost = Corporate Cost
          EBIT                = Gross Margin  (absolute value)
          EBIT%               = Gross Margin / Revenue * 100
        """
        where_clause = " AND ".join(where_parts)
        # NOTE: '139%%' — %% escapes to literal '%' for psycopg2 when params are used
        sql = f"""
            SELECT 
                {select_cols},
                ROUND(SUM(CASE 
                    WHEN cost_category = 'Revenue Summary'
                    AND COALESCE(TRIM(order_reason), 'x') NOT IN ('YEH','YEI','YEJ','YEK','YN2')
                    AND COALESCE(TRIM(gl_account), 'x') NOT LIKE '139%%'
                    THEN {amt_col} ELSE 0 
                END)::numeric, {rounding}) as revenue,
                ROUND(SUM(CASE 
                    WHEN cost_category = 'Cost Summary' 
                    AND cost_category_class IN ('Resource Cost', 'Travel Cost', 'Other Direct Cost')
                    THEN {amt_col} ELSE 0 
                END)::numeric, {rounding}) as total_direct_cost,
                ROUND(SUM(CASE 
                    WHEN cost_category = 'Cost Summary' 
                    AND cost_category_class = 'Corporate Cost'
                    THEN {amt_col} ELSE 0 
                END)::numeric, {rounding}) as total_indirect_cost,
                ROUND((
                    SUM(CASE
                        WHEN cost_category = 'Revenue Summary'
                        AND COALESCE(TRIM(order_reason), 'x') NOT IN ('YEH','YEI','YEJ','YEK','YN2')
                        AND COALESCE(TRIM(gl_account), 'x') NOT LIKE '139%%'
                        THEN {amt_col} ELSE 0
                    END)
                    - SUM(CASE 
                        WHEN cost_category = 'Cost Summary' 
                        AND cost_category_class IN ('Resource Cost', 'Travel Cost', 'Other Direct Cost')
                        THEN {amt_col} ELSE 0 
                      END)
                    - SUM(CASE 
                        WHEN cost_category = 'Cost Summary' 
                        AND cost_category_class = 'Corporate Cost'
                        THEN {amt_col} ELSE 0 
                      END)
                )::numeric, {rounding}) as gross_margin,
                ROUND((
                    SUM(CASE
                        WHEN cost_category = 'Revenue Summary'
                        AND COALESCE(TRIM(order_reason), 'x') NOT IN ('YEH','YEI','YEJ','YEK','YN2')
                        AND COALESCE(TRIM(gl_account), 'x') NOT LIKE '139%%'
                        THEN {amt_col} ELSE 0
                    END)
                    - SUM(CASE 
                        WHEN cost_category = 'Cost Summary' 
                        AND cost_category_class IN ('Resource Cost', 'Travel Cost', 'Other Direct Cost')
                        THEN {amt_col} ELSE 0 
                      END)
                    - SUM(CASE 
                        WHEN cost_category = 'Cost Summary' 
                        AND cost_category_class = 'Corporate Cost'
                        THEN {amt_col} ELSE 0 
                      END)
                )::numeric, {rounding}) as ebit,
                ROUND(
                    100.0 * (
                        SUM(CASE
                            WHEN cost_category = 'Revenue Summary'
                            AND COALESCE(TRIM(order_reason), 'x') NOT IN ('YEH','YEI','YEJ','YEK','YN2')
                            AND COALESCE(TRIM(gl_account), 'x') NOT LIKE '139%%'
                            THEN {amt_col} ELSE 0
                        END)
                        - SUM(CASE 
                            WHEN cost_category = 'Cost Summary' 
                            AND cost_category_class IN ('Resource Cost', 'Travel Cost', 'Other Direct Cost')
                            THEN {amt_col} ELSE 0 
                          END)
                        - SUM(CASE 
                            WHEN cost_category = 'Cost Summary' 
                            AND cost_category_class = 'Corporate Cost'
                            THEN {amt_col} ELSE 0 
                          END)
                    )
                    / NULLIF(SUM(CASE 
                        WHEN cost_category = 'Revenue Summary'
                        AND COALESCE(TRIM(order_reason), 'x') NOT IN ('YEH','YEI','YEJ','YEK','YN2')
                        AND COALESCE(TRIM(gl_account), 'x') NOT LIKE '139%%'
                        THEN {amt_col} ELSE 0 
                    END), 0),
                    {rounding}
                ) as ebit_percentage
            FROM cube_fact_data
            WHERE {where_clause}
              AND cost_category IN ('Revenue Summary', 'Cost Summary')
            GROUP BY {group_by_clause}
            ORDER BY ebit_percentage DESC
        """
        logger.info(
            f"Generated GB P&L EBIT SQL: ebit=gross_margin, ebit%=gross_margin/revenue*100 using {amt_col}"
        )
        return {
            'success': True,
            'sql': sql,
            'params': params,
            'calculation_type': 'ebit'
        }

    def _build_travel_cost_sql(self, where_parts: List[str], params: List,
                               select_cols: str, group_by_clause: str,
                               rounding: int, amt_col: str = 'amount_usd') -> Dict[str, Any]:
        """Travel Cost from CostCategory_Class = 'Travel Cost', grouped by SubCostCategory"""
        where_clause = " AND ".join(where_parts)
        sql = f"""
            SELECT 
                {select_cols},
                sub_cost_category,
                ROUND(SUM({amt_col})::numeric, {rounding}) as travel_cost
            FROM cube_fact_data
            WHERE {where_clause}
              AND cost_category = 'Cost Summary'
              AND cost_category_class = 'Travel Cost'
            GROUP BY {group_by_clause}, sub_cost_category
            ORDER BY travel_cost DESC
        """
        logger.info(
            f"Generated Travel Cost SQL with SubCostCategory breakdown")
        return {
            'success': True,
            'sql': sql,
            'params': params,
            'calculation_type': 'travel_cost'
        }

    def _build_resource_cost_sql(self, where_parts: List[str], params: List,
                                 select_cols: str, group_by_clause: str,
                                 rounding: int, amt_col: str = 'amount_usd') -> Dict[str, Any]:
        """Resource Cost from CostCategory_Class = 'Resource Cost', grouped by SubCostCategory"""
        where_clause = " AND ".join(where_parts)
        sql = f"""
            SELECT 
                {select_cols},
                sub_cost_category,
                ROUND(SUM({amt_col})::numeric, {rounding}) as resource_cost
            FROM cube_fact_data
            WHERE {where_clause}
              AND cost_category = 'Cost Summary'
              AND cost_category_class = 'Resource Cost'
            GROUP BY {group_by_clause}, sub_cost_category
            ORDER BY resource_cost DESC
        """
        logger.info(
            f"Generated Resource Cost SQL with SubCostCategory breakdown")
        return {
            'success': True,
            'sql': sql,
            'params': params,
            'calculation_type': 'resource_cost'
        }

    def _build_other_direct_cost_sql(self, where_parts: List[str],
                                     params: List, select_cols: str,
                                     group_by_clause: str,
                                     rounding: int, amt_col: str = 'amount_usd') -> Dict[str, Any]:
        """Other Direct Cost from CostCategory_Class = 'Other Direct Cost', grouped by SubCostCategory"""
        where_clause = " AND ".join(where_parts)
        sql = f"""
            SELECT 
                {select_cols},
                sub_cost_category,
                ROUND(SUM({amt_col})::numeric, {rounding}) as other_direct_cost
            FROM cube_fact_data
            WHERE {where_clause}
              AND cost_category = 'Cost Summary'
              AND cost_category_class = 'Other Direct Cost'
            GROUP BY {group_by_clause}, sub_cost_category
            ORDER BY other_direct_cost DESC
        """
        logger.info(
            f"Generated Other Direct Cost SQL with SubCostCategory breakdown")
        return {
            'success': True,
            'sql': sql,
            'params': params,
            'calculation_type': 'other_direct_cost'
        }

    def _build_direct_cost_sql(self, where_parts: List[str], params: List,
                               select_cols: str, group_by_clause: str,
                               rounding: int, amt_col: str = 'amount_usd') -> Dict[str, Any]:
        """Total Direct Cost = Resource Cost + Travel Cost + Other Direct Cost, grouped by SubCostCategory"""
        where_clause = " AND ".join(where_parts)
        sql = f"""
            SELECT 
                {select_cols},
                cost_category_class,
                sub_cost_category,
                ROUND(SUM({amt_col})::numeric, {rounding}) as amount
            FROM cube_fact_data
            WHERE {where_clause}
              AND cost_category = 'Cost Summary'
              AND cost_category_class IN ('Resource Cost', 'Travel Cost', 'Other Direct Cost')
            GROUP BY {group_by_clause}, cost_category_class, sub_cost_category
            ORDER BY cost_category_class, amount DESC
        """
        logger.info(
            f"Generated Direct Cost SQL with CostCategory_Class and SubCostCategory breakdown"
        )
        return {
            'success': True,
            'sql': sql,
            'params': params,
            'calculation_type': 'direct_cost'
        }

    def _build_indirect_cost_sql(self, where_parts: List[str], params: List,
                                 select_cols: str, group_by_clause: str,
                                 rounding: int, amt_col: str = 'amount_usd') -> Dict[str, Any]:
        """Indirect Cost = Corporate Cost from CostCategory_Class, grouped by SubCostCategory"""
        where_clause = " AND ".join(where_parts)
        sql = f"""
            SELECT 
                {select_cols},
                sub_cost_category,
                ROUND(SUM({amt_col})::numeric, {rounding}) as indirect_cost
            FROM cube_fact_data
            WHERE {where_clause}
              AND cost_category = 'Cost Summary'
              AND cost_category_class = 'Corporate Cost'
            GROUP BY {group_by_clause}, sub_cost_category
            ORDER BY indirect_cost DESC
        """
        logger.info(
            f"Generated Indirect Cost (Corporate Cost) SQL with SubCostCategory breakdown"
        )
        return {
            'success': True,
            'sql': sql,
            'params': params,
            'calculation_type': 'indirect_cost'
        }

    def _build_gross_margin_sql(self, where_parts: List[str], params: List,
                                select_cols: str, group_by_clause: str,
                                rounding: int, amt_col: str = 'amount_usd',
                                apply_pl_exclusions: bool = False) -> Dict[str, Any]:
        """Gross Margin = Revenue - (Total Direct Cost + Total Indirect Cost)
        Total Direct Cost  = Resource Cost + Travel Cost + Other Direct Cost
        Total Indirect Cost = Corporate Cost

        When apply_pl_exclusions=True (GB/Entity P&L context), revenue excludes:
          - order_reason IN ('YEH','YEI','YEJ','YEK','YN2')
          - gl_account LIKE '139%'
        """
        where_clause = " AND ".join(where_parts)

        # P&L revenue exclusion fragment (only applied in P&L context)
        _pl_rev_exclusions = (
            "\n                      AND order_reason NOT IN ('YEH','YEI','YEJ','YEK','YN2')"
            "\n                      AND NOT starts_with(gl_account, '139')"
        ) if apply_pl_exclusions else ""

        sql = f"""
            SELECT 
                {select_cols},
                ROUND(SUM(CASE 
                    WHEN cost_category = 'Revenue Summary'{_pl_rev_exclusions}
                    THEN {amt_col} ELSE 0 
                END)::numeric, {rounding}) as revenue,
                ROUND(SUM(CASE 
                    WHEN cost_category = 'Cost Summary' 
                    AND cost_category_class IN ('Resource Cost', 'Travel Cost', 'Other Direct Cost')
                    THEN {amt_col} ELSE 0 
                END)::numeric, {rounding}) as total_direct_cost,
                ROUND(SUM(CASE 
                    WHEN cost_category = 'Cost Summary' 
                    AND cost_category_class = 'Corporate Cost'
                    THEN {amt_col} ELSE 0 
                END)::numeric, {rounding}) as total_indirect_cost,
                ROUND((
                    SUM(CASE 
                        WHEN cost_category = 'Cost Summary' 
                        AND cost_category_class IN ('Resource Cost', 'Travel Cost', 'Other Direct Cost')
                        THEN {amt_col} ELSE 0 
                    END) +
                    SUM(CASE 
                        WHEN cost_category = 'Cost Summary' 
                        AND cost_category_class = 'Corporate Cost'
                        THEN {amt_col} ELSE 0 
                    END)
                )::numeric, {rounding}) as total_cost,
                ROUND((
                    SUM(CASE WHEN cost_category = 'Revenue Summary'{_pl_rev_exclusions}
                        THEN {amt_col} ELSE 0 END)
                    - SUM(CASE 
                        WHEN cost_category = 'Cost Summary' 
                        AND cost_category_class IN ('Resource Cost', 'Travel Cost', 'Other Direct Cost')
                        THEN {amt_col} ELSE 0 
                      END)
                    - SUM(CASE 
                        WHEN cost_category = 'Cost Summary' 
                        AND cost_category_class = 'Corporate Cost'
                        THEN {amt_col} ELSE 0 
                      END)
                )::numeric, {rounding}) as gross_margin,
                ROUND(
                    100.0 * (
                        SUM(CASE WHEN cost_category = 'Revenue Summary'{_pl_rev_exclusions}
                            THEN {amt_col} ELSE 0 END)
                        - SUM(CASE 
                            WHEN cost_category = 'Cost Summary' 
                            AND cost_category_class IN ('Resource Cost', 'Travel Cost', 'Other Direct Cost')
                            THEN {amt_col} ELSE 0 
                          END)
                        - SUM(CASE 
                            WHEN cost_category = 'Cost Summary' 
                            AND cost_category_class = 'Corporate Cost'
                            THEN {amt_col} ELSE 0 
                          END)
                    ) / NULLIF(SUM(CASE 
                        WHEN cost_category = 'Revenue Summary'{_pl_rev_exclusions}
                        THEN {amt_col} ELSE 0 
                    END), 0),
                    {rounding}
                ) as gross_margin_pct
            FROM cube_fact_data
            WHERE {where_clause}
              AND cost_category IN ('Revenue Summary', 'Cost Summary')
            GROUP BY {group_by_clause}
            ORDER BY gross_margin DESC
        """
        _excl_label = " [P&L exclusions applied]" if apply_pl_exclusions else ""
        logger.info(
            f"Generated Gross Margin SQL: Revenue - (Direct + Indirect Cost){_excl_label}")
        return {
            'success': True,
            'sql': sql,
            'params': params,
            'calculation_type': 'gross_margin'
        }

    def _build_billing_utilization_sql(
            self,
            where_parts: List[str],
            params: List,
            select_cols: str,
            group_by_clause: str,
            rounding: int,
            cost_category: str = 'Billing Utilization Summary'
    ) -> Dict[str, Any]:
        """Billing Utilization % = Billed Capacity / Available Capacity * 100
        
        Args:
            cost_category: Either 'Billing Utilization' (MTD/detailed) or 'Billing Utilization Summary' (YTD)
        """
        cost_category_clean = cost_category.strip('%').strip()
        where_clause = " AND ".join(where_parts)
        sql = f"""
            SELECT 
                {select_cols},
                ROUND(SUM(billed_capacity)::numeric, {rounding}) as billed_capacity,
                ROUND((SUM(allocated_capacity) + SUM(not_allocated_capacity) + SUM(ms_capacity) + SUM(vkm_capacity) - SUM(non_linear_capacity))::numeric, {rounding}) as available_capacity,
                ROUND(
                    100.0 * SUM(billed_capacity) / NULLIF(
                        SUM(allocated_capacity) + SUM(not_allocated_capacity) + SUM(ms_capacity) + SUM(vkm_capacity) - SUM(non_linear_capacity),
                        0
                    ),
                    {rounding}
                ) as billing_utilization_pct
            FROM cube_fact_data
            WHERE {where_clause}
              AND cost_category = %s
            GROUP BY {group_by_clause}
            ORDER BY billing_utilization_pct DESC
        """
        params.append(cost_category_clean)
        logger.info(
            f"Generated Billing Utilization calculation SQL with cost_category='{cost_category_clean}'"
        )
        return {
            'success': True,
            'sql': sql,
            'params': params,
            'calculation_type': 'billing_utilization'
        }

    def _build_available_capacity_sql(self, where_parts: List[str],
                                      params: List, select_cols: str,
                                      group_by_clause: str,
                                      rounding: int) -> Dict[str, Any]:
        """Available Capacity = Allocated + Not Allocated + M/S + VKM - Non Linear
        
        Per Finance_API_Queries.docx:
        - Uses 'Billing Utilization' for entity-level detail (region_entity grouping)
        - Uses 'Billing Utilization Summary' for sector-level aggregation (sector grouping)
        """
        where_clause = " AND ".join(where_parts)

        group_by_lower = group_by_clause.lower()
        if 'region_entity' in group_by_lower or 'entity' in group_by_lower:
            cost_category = 'Billing Utilization'
        elif 'sector' in group_by_lower:
            cost_category = 'Billing Utilization Summary'
        else:
            cost_category = 'Billing Utilization'

        sql = f"""
            SELECT 
                {select_cols},
                ROUND(SUM(allocated_capacity)::numeric, {rounding}) as allocated_capacity,
                ROUND(SUM(not_allocated_capacity)::numeric, {rounding}) as not_allocated_capacity,
                ROUND(SUM(ms_capacity)::numeric, {rounding}) as ms_capacity,
                ROUND(SUM(vkm_capacity)::numeric, {rounding}) as vkm_capacity,
                ROUND(SUM(non_linear_capacity)::numeric, {rounding}) as non_linear_capacity,
                ROUND((SUM(allocated_capacity) + SUM(not_allocated_capacity) + SUM(ms_capacity) + SUM(vkm_capacity) - SUM(non_linear_capacity))::numeric, {rounding}) as available_capacity
            FROM cube_fact_data
            WHERE {where_clause}
              AND cost_category = %s
            GROUP BY {group_by_clause}
            ORDER BY available_capacity DESC
        """
        params.append(cost_category)
        logger.info(
            f"Generated Available Capacity calculation SQL (using {cost_category})"
        )
        return {
            'success': True,
            'sql': sql,
            'params': params,
            'calculation_type': 'available_capacity'
        }

    def _build_price_mix_sql(self, where_parts: List[str], params: List,
                             select_cols: str, group_by_clause: str,
                             rounding: int) -> Dict[str, Any]:
        """Price Mix Ratio = Premium/Lead Billed Capacity / Total Billed Capacity * 100

        Per Queries_02 spec:
          Differential = SUM(billed_capacity WHERE rate_classification IN ('Premium','Lead')
                             AND vkm_code NOT IN ('0001','0002','0003'))
          Price mix    = SUM(billed_capacity WHERE vkm_code NOT IN ('0001','0002','0003'))
          Ratio %      = Differential / Price_mix * 100
          month filter = month = N  (single month, no YTD expansion)

        No TBP/CTG plan data is used.
        """
        where_clause = " AND ".join(where_parts)

        group_by_sql = f"GROUP BY {group_by_clause}" if group_by_clause else ""
        order_by_sql = "ORDER BY price_mix_ratio_pct DESC" if group_by_clause else ""
        select_prefix = f"{select_cols}," if select_cols else ""

        sql = f"""
            SELECT
                {select_prefix}
                ROUND(
                    SUM(CASE WHEN rate_classification IN ('Lead', 'Premium')
                             THEN billed_capacity ELSE 0 END)::numeric,
                    {rounding}
                ) AS premium_capacity,
                ROUND(SUM(billed_capacity)::numeric, {rounding}) AS total_billed_capacity,
                ROUND(
                    100.0 * SUM(CASE WHEN rate_classification IN ('Lead', 'Premium')
                                     THEN billed_capacity ELSE 0 END)
                    / NULLIF(SUM(billed_capacity), 0),
                    {rounding}
                ) AS price_mix_ratio_pct
            FROM cube_fact_data
            WHERE {where_clause}
              AND cost_category = 'WW Employee Summary'
              AND (vkm_code IS NULL OR vkm_code NOT IN ('0001', '0002', '0003'))
            {group_by_sql}
            {order_by_sql}
        """
        logger.info("Generated Price Mix Ratio SQL (Premium+Lead / Total, no TBP data)")
        return {
            'success': True,
            'sql': sql,
            'params': params,
            'calculation_type': 'price_mix'
        }

    def _build_attrition_pct_sql(self, where_parts: List[str], params: List,
                                 select_cols: str, group_by_clause: str,
                                 rounding: int) -> Dict[str, Any]:
        """Attrition % = (Attrition / Avg Headcount / month) * 12

        Correct formula per KPI spec:
          Attrition    = SUM(attrition)  WHERE cost_category='Attrition'
                         AND resource_type='Internal'
                         AND month = N  (queried month only — NOT cumulative)
          Avg Headcount = SUM(capacity) / N
                         WHERE cost_category='GB Wise END Capacity'
                         AND resource_type='Internal'
                         AND month <= N  (YTD cumulative ÷ month count)
          Attrition %  = (Attrition / Avg_Headcount / N) * 12 * 100
                       = Attrition * 12 * 100 / YTD_Capacity   (N cancels)

        Note: TBP/CTG plan data is NOT used for attrition.

        Filters:
          - Resource Type = 'Internal'
          - Cost Category: 'Attrition' (attrition, month=N only)
                           'GB Wise END Capacity' (capacity, YTD months 1..N)
        """
        # Expand to month IN (1..N) so capacity rows for all YTD months are fetched.
        # Attrition is then restricted inside the CASE WHEN to only month = N.
        ytd_where_parts, ytd_params, max_month = self._expand_month_filter_for_ytd(
            where_parts, params)
        ytd_where_clause = " AND ".join(ytd_where_parts)

        group_by_sql = f"GROUP BY {group_by_clause}" if group_by_clause else ""
        order_by_sql = "ORDER BY attrition_pct DESC" if group_by_clause else ""

        select_prefix = f"{select_cols}," if select_cols else ""

        # Both numerator (attrition) and denominator (capacity) use full YTD months 1..N
        # Attrition % = (YTD_attrition / YTD_capacity) * 12 * 100
        #   = (SUM attrition 1..N) * 12 * 100 / SUM(capacity 1..N)
        # Which is equivalent to: (YTD leavers / YTD avg headcount) * (12/N) * 100
        # Jan matches because N=1 (single month, same result either way).
        # Feb+ requires cumulative attrition so numerator and denominator cover same period.
        sql = f"""
            SELECT
                {select_prefix}
                ROUND(
                    SUM(CASE WHEN cost_category = 'Attrition'
                             THEN COALESCE(attrition::numeric, 0) ELSE 0 END
                    )::numeric,
                    {rounding}
                ) AS ytd_attrition,
                ROUND(
                    (SUM(CASE WHEN cost_category = 'GB Wise END Capacity'
                              THEN capacity ELSE 0 END)
                     / NULLIF(COUNT(DISTINCT CASE WHEN cost_category = 'GB Wise END Capacity'
                                                  THEN month END), 0)
                    )::numeric,
                    {rounding}
                ) AS avg_capacity,
                ROUND(
                    SUM(CASE WHEN cost_category = 'Attrition'
                             THEN COALESCE(attrition::numeric, 0) ELSE 0 END
                    ) * 12.0 * 100.0
                    / NULLIF(
                        SUM(CASE WHEN cost_category = 'GB Wise END Capacity'
                                 THEN capacity ELSE 0 END),
                        0
                    ),
                    {rounding}
                ) AS attrition_pct
            FROM cube_fact_data
            WHERE {ytd_where_clause}
              AND cost_category IN ('Attrition', 'GB Wise END Capacity')
              AND LOWER(TRIM(resource_type)) = 'internal'
            {group_by_sql}
            {order_by_sql}
        """

        logger.info(
            f"Generated Attrition % SQL: YTD attrition (months 1..{max_month}) "
            f"/ YTD capacity (months 1..{max_month}) * 12 — no TBP data"
        )
        return {
            'success': True,
            'sql': sql,
            'params': ytd_params,
            'calculation_type': 'attrition_pct'
        }

    def _build_pyramid_mix_sql(self, where_parts: List[str], params: List,
                               select_cols: str, group_by_clause: str,
                               rounding: int) -> Dict[str, Any]:
        """Pyramid Mix = SL 48-51 Capacity / Overall SL Capacity * 100

        Per Queries_02 spec:
          Level = SUM(capacity WHERE salary_level IN ('48','49','50','51'))
                  month <= N  (YTD cumulative), resource_type='Internal',
                  sector <> 'INTERNAL', onsite_offshore='OFFSHORE'
          Total = SUM(capacity)
                  month <= N  (YTD cumulative), resource_type='Internal',
                  sector <> 'INTERNAL', onsite_offshore='OFFSHORE'
          Mix % = Level / Total * 100

        No TBP/CTG plan data is used.
        """
        # Both Level and Total use YTD cumulative months (month <= N)
        ytd_where_parts, ytd_params, max_month = self._expand_month_filter_for_ytd(
            where_parts, params)
        ytd_where_clause = " AND ".join(ytd_where_parts)

        group_by_sql = f"GROUP BY {group_by_clause}" if group_by_clause else ""
        order_by_sql = "ORDER BY pyramid_mix_pct DESC" if group_by_clause else ""
        select_prefix = f"{select_cols}," if select_cols else ""

        sql = f"""
            SELECT
                {select_prefix}
                ROUND(
                    SUM(CASE WHEN SPLIT_PART(salary_level, '.', 1) IN ('48', '49', '50', '51')
                             THEN capacity ELSE 0 END)::numeric,
                    {rounding}
                ) AS junior_capacity,
                ROUND(SUM(capacity)::numeric, {rounding}) AS total_capacity,
                ROUND(
                    100.0 * SUM(CASE WHEN SPLIT_PART(salary_level, '.', 1) IN ('48', '49', '50', '51')
                                     THEN capacity ELSE 0 END)
                    / NULLIF(SUM(capacity), 0),
                    {rounding}
                ) AS pyramid_mix_pct
            FROM cube_fact_data
            WHERE {ytd_where_clause}
              AND cost_category = 'GB Wise END Capacity'
              AND LOWER(TRIM(resource_type)) = 'internal'
              AND LOWER(TRIM(onsite_offshore)) = 'offshore'
              AND (sector IS NULL OR LOWER(TRIM(sector)) != 'internal')
            {group_by_sql}
            {order_by_sql}
        """
        logger.info(
            f"Generated Pyramid Mix SQL (YTD months 1..{max_month}, "
            f"SL 48-51 / Total, no TBP data)"
        )
        return {
            'success': True,
            'sql': sql,
            'params': ytd_params,
            'calculation_type': 'pyramid_mix'
        }

    def _build_pyramid_mix_individual_levels_sql(
            self, where_parts: List[str], params: List, select_cols: str,
            group_by_clause: str, rounding: int) -> Dict[str, Any]:
        """Pyramid Mix by Individual Salary Level = Show each level (48, 49, 50, 51) separately
        
        Formula per level: (Level Capacity / Total Offshore Capacity) * 100
        Shows breakdown by entity AND individual salary level.
        
        Per user formula:
        - cost_category = 'GB Wise END Capacity'
        - resource_type = 'Internal'
        - sector <> 'INTERNAL'
        - onsite_offshore = 'OFFSHORE'
        """
        where_clause = " AND ".join(where_parts)

        sql = f"""
            WITH level_data AS (
                SELECT 
                    region_entity,
                    SPLIT_PART(salary_level, '.', 1) as salary_level,
                    SUM(capacity) as level_capacity
                FROM cube_fact_data
                WHERE {where_clause}
                  AND cost_category = 'GB Wise END Capacity'
                  AND LOWER(TRIM(resource_type)) = 'internal'
                  AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                  AND (sector IS NULL OR LOWER(TRIM(sector)) != 'internal')
                  AND SPLIT_PART(salary_level, '.', 1) IN ('48', '49', '50', '51')
                GROUP BY region_entity, SPLIT_PART(salary_level, '.', 1)
            ),
            total_data AS (
                SELECT 
                    region_entity,
                    SUM(capacity) as total_capacity
                FROM cube_fact_data
                WHERE {where_clause}
                  AND cost_category = 'GB Wise END Capacity'
                  AND LOWER(TRIM(resource_type)) = 'internal'
                  AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                  AND (sector IS NULL OR LOWER(TRIM(sector)) != 'internal')
                GROUP BY region_entity
            )
            SELECT 
                l.region_entity as entity,
                l.salary_level,
                ROUND(l.level_capacity::numeric, {rounding}) as level_capacity,
                ROUND(t.total_capacity::numeric, {rounding}) as total_capacity,
                ROUND(100.0 * l.level_capacity / NULLIF(t.total_capacity, 0), {rounding}) as percentage
            FROM level_data l
            JOIN total_data t ON l.region_entity = t.region_entity
            ORDER BY l.region_entity, l.salary_level
        """
        logger.info(f"Generated Pyramid Mix by Individual Salary Level SQL")
        return {
            'success': True,
            'sql': sql,
            'params': params,
            'calculation_type': 'pyramid_mix_individual_levels'
        }

    def _build_pyramid_mix_by_salary_level_sql(
            self, where_parts: List[str], params: List, select_cols: str,
            group_by_clause: str, rounding: int) -> Dict[str, Any]:
        """Pyramid Mix by Salary Level Band = Capacity breakdown by salary bands from fact data
        
        Salary bands:
        - 48-51 (Junior)
        - 52-53 (Mid)
        - 54-55 (Senior)
        - 56+ (Leadership)
        
        Formula per band: (Band Capacity / Total Offshore Internal Capacity) * 100
        Uses cube_fact_data with same filters as pyramid_mix.
        """
        where_clause = " AND ".join(where_parts)

        sql = f"""
            WITH band_data AS (
                SELECT 
                    region_entity,
                    CASE 
                        WHEN SPLIT_PART(salary_level, '.', 1) IN ('48', '49', '50', '51') THEN 'SL 48-51'
                        WHEN SPLIT_PART(salary_level, '.', 1) IN ('52', '53') THEN 'SL 52-53'
                        WHEN SPLIT_PART(salary_level, '.', 1) IN ('54', '55') THEN 'SL 54-55'
                        WHEN CAST(SPLIT_PART(salary_level, '.', 1) AS INTEGER) >= 56 THEN 'SL 56-Above'
                        ELSE 'Other'
                    END as salary_band,
                    SUM(capacity) as band_capacity
                FROM cube_fact_data
                WHERE {where_clause}
                  AND cost_category = 'GB Wise END Capacity'
                  AND LOWER(TRIM(resource_type)) = 'internal'
                  AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                  AND (sector IS NULL OR LOWER(TRIM(sector)) != 'internal')
                  AND salary_level IS NOT NULL AND salary_level != ''
                  AND SPLIT_PART(salary_level, '.', 1) ~ '^\d+$'
                GROUP BY region_entity, 
                    CASE 
                        WHEN SPLIT_PART(salary_level, '.', 1) IN ('48', '49', '50', '51') THEN 'SL 48-51'
                        WHEN SPLIT_PART(salary_level, '.', 1) IN ('52', '53') THEN 'SL 52-53'
                        WHEN SPLIT_PART(salary_level, '.', 1) IN ('54', '55') THEN 'SL 54-55'
                        WHEN CAST(SPLIT_PART(salary_level, '.', 1) AS INTEGER) >= 56 THEN 'SL 56-Above'
                        ELSE 'Other'
                    END
            ),
            total_data AS (
                SELECT 
                    region_entity,
                    SUM(capacity) as total_capacity
                FROM cube_fact_data
                WHERE {where_clause}
                  AND cost_category = 'GB Wise END Capacity'
                  AND LOWER(TRIM(resource_type)) = 'internal'
                  AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                  AND (sector IS NULL OR LOWER(TRIM(sector)) != 'internal')
                GROUP BY region_entity
            )
            SELECT 
                b.region_entity,
                b.salary_band,
                ROUND(b.band_capacity::numeric, {rounding}) as band_capacity,
                ROUND(t.total_capacity::numeric, {rounding}) as total_capacity,
                ROUND(100.0 * b.band_capacity / NULLIF(t.total_capacity, 0), {rounding}) as pyramid_mix_pct
            FROM band_data b
            JOIN total_data t ON b.region_entity = t.region_entity
            WHERE b.salary_band != 'Other'
            ORDER BY b.region_entity, 
                CASE b.salary_band 
                    WHEN 'SL 48-51' THEN 1
                    WHEN 'SL 52-53' THEN 2
                    WHEN 'SL 54-55' THEN 3
                    WHEN 'SL 56-Above' THEN 4
                    ELSE 5 
                END
        """
        logger.info(
            f"Generated Pyramid Mix by Salary Level Band from fact data")
        return {
            'success': True,
            'sql': sql,
            'params': list(params) + list(params),
            'calculation_type': 'pyramid_mix_by_salary_level'
        }

    def _build_internal_capacity_mix_sql(self, where_parts: List[str],
                                         params: List, select_cols: str,
                                         group_by_clause: str,
                                         rounding: int) -> Dict[str, Any]:
        """Internal Capacity Mix = Avg Offshore / (Avg Offshore + Avg Outsourcing) * 100
        
        Per Queries_02 spec:
        - Uses AVG (YTD) capacity, not END capacity
        - Offshore = Internal + OFFSHORE + sector <> 'INTERNAL', excluding Corporate service areas
        - Outsourcing = External + OFFSHORE, excluding Corporate service areas
        - Total = Avg Offshore + Avg Outsourcing
        """
        ytd_where_parts, ytd_params, max_month = self._expand_month_filter_for_ytd(
            where_parts, params)

        # Fallback: re-expand ytd_where_parts if _expand_month_filter_for_ytd failed
        ytd_where_parts, ytd_params, max_month = self._apply_ytd_fallback(
            ytd_where_parts, ytd_params, where_parts, params, max_month,
            builder_name='Internal Capacity Mix')

        # Extract sector inline condition BEFORE stripping — applied only to Internal CASE WHEN
        sector_inline = self._extract_sector_inline_condition(ytd_where_parts, ytd_params)
        # Strip sector from outer WHERE — External resources must not be filtered by sector
        ytd_no_sector_parts, ytd_no_sector_params = self._strip_sector_from_where(
            ytd_where_parts, ytd_params)
        ytd_where_clause = " AND ".join(ytd_no_sector_parts)

        sql = f"""
            SELECT 
                {select_cols},
                ROUND(SUM(CASE 
                    WHEN LOWER(TRIM(resource_type)) = 'internal'
                    AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                    AND (sector IS NULL OR LOWER(TRIM(sector)) != 'internal')
                    {sector_inline}
                    AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
                    THEN capacity ELSE 0 
                END)::numeric / NULLIF({max_month}, 0), {rounding}) as offshore_capacity,
                ROUND(SUM(CASE 
                    WHEN LOWER(TRIM(resource_type)) = 'external'
                    AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                    AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
                    AND employee_number IS NOT NULL AND employee_number != '' AND employee_number != '0' AND employee_number != '0.0'
                    THEN capacity ELSE 0 
                END)::numeric / NULLIF({max_month}, 0), {rounding}) as outsourcing_capacity,
                ROUND(
                    100.0 * SUM(CASE 
                        WHEN LOWER(TRIM(resource_type)) = 'internal'
                        AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                        AND (sector IS NULL OR LOWER(TRIM(sector)) != 'internal')
                        {sector_inline}
                        AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
                        THEN capacity ELSE 0 
                    END) 
                    / NULLIF(
                        SUM(CASE 
                            WHEN LOWER(TRIM(resource_type)) = 'internal'
                            AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                            AND (sector IS NULL OR LOWER(TRIM(sector)) != 'internal')
                            {sector_inline}
                            AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
                            THEN capacity ELSE 0 
                        END)
                        + SUM(CASE 
                            WHEN LOWER(TRIM(resource_type)) = 'external'
                            AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                            AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
                            AND employee_number IS NOT NULL AND employee_number != '' AND employee_number != '0' AND employee_number != '0.0'
                            THEN capacity ELSE 0 
                        END),
                        0
                    ),
                    {rounding}
                ) as internal_mix_pct
            FROM cube_fact_data
            WHERE {ytd_where_clause}
              AND cost_category = 'GB Wise END Capacity'
            GROUP BY {group_by_clause}
            ORDER BY internal_mix_pct DESC
        """
        logger.info(
            f"Generated Internal Capacity Mix SQL (sector_inline='{sector_inline}', max_month={max_month})"
        )
        return {
            'success': True,
            'sql': sql,
            'params': ytd_no_sector_params,
            'calculation_type': 'internal_capacity_mix'
        }

    def _build_external_capacity_mix_sql(self, where_parts: List[str],
                                         params: List, select_cols: str,
                                         group_by_clause: str,
                                         rounding: int) -> Dict[str, Any]:
        """External Capacity Mix = Avg Outsourcing / (Avg Offshore + Avg Outsourcing) * 100
        
        Per Queries_02 spec:
        - Uses AVG (YTD) capacity, not END capacity
        - Offshore = Internal + OFFSHORE + sector <> 'INTERNAL', excluding Corporate service areas
        - Outsourcing = External + OFFSHORE, excluding Corporate service areas
        - Total = Avg Offshore + Avg Outsourcing
        """
        ytd_where_parts, ytd_params, max_month = self._expand_month_filter_for_ytd(
            where_parts, params)

        # Fallback: re-expand ytd_where_parts if _expand_month_filter_for_ytd failed
        ytd_where_parts, ytd_params, max_month = self._apply_ytd_fallback(
            ytd_where_parts, ytd_params, where_parts, params, max_month,
            builder_name='External Capacity Mix')

        # Extract sector inline condition BEFORE stripping — applied only to Internal CASE WHEN
        sector_inline = self._extract_sector_inline_condition(ytd_where_parts, ytd_params)
        # Strip sector from outer WHERE — External resources must not be filtered by sector
        ytd_no_sector_parts, ytd_no_sector_params = self._strip_sector_from_where(
            ytd_where_parts, ytd_params)
        ytd_where_clause = " AND ".join(ytd_no_sector_parts)

        sql = f"""
            SELECT 
                {select_cols},
                ROUND(SUM(CASE 
                    WHEN LOWER(TRIM(resource_type)) = 'external'
                    AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                    AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
                    AND employee_number IS NOT NULL AND employee_number != '' AND employee_number != '0' AND employee_number != '0.0'
                    THEN capacity ELSE 0 
                END)::numeric / NULLIF({max_month}, 0), {rounding}) as outsourcing_capacity,
                ROUND(
                    100.0 * SUM(CASE 
                        WHEN LOWER(TRIM(resource_type)) = 'external'
                        AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                        AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
                        AND employee_number IS NOT NULL AND employee_number != '' AND employee_number != '0' AND employee_number != '0.0'
                        THEN capacity ELSE 0 
                    END) 
                    / NULLIF(
                        SUM(CASE 
                            WHEN LOWER(TRIM(resource_type)) = 'internal'
                            AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                            AND (sector IS NULL OR LOWER(TRIM(sector)) != 'internal')
                            {sector_inline}
                            AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
                            THEN capacity ELSE 0 
                        END)
                        + SUM(CASE 
                            WHEN LOWER(TRIM(resource_type)) = 'external'
                            AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                            AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
                            AND employee_number IS NOT NULL AND employee_number != '' AND employee_number != '0' AND employee_number != '0.0'
                            THEN capacity ELSE 0 
                        END),
                        0
                    ),
                    {rounding}
                ) as external_mix_pct
            FROM cube_fact_data
            WHERE {ytd_where_clause}
              AND cost_category = 'GB Wise END Capacity'
            GROUP BY {group_by_clause}
            ORDER BY external_mix_pct DESC
        """
        logger.info(
            f"Generated External Capacity Mix SQL (sector_inline='{sector_inline}', max_month={max_month})"
        )
        return {
            'success': True,
            'sql': sql,
            'params': ytd_no_sector_params,
            'calculation_type': 'external_capacity_mix'
        }

    def _build_budget_per_capacity_sql(self, where_parts: List[str],
                                       params: List, select_cols: str,
                                       group_by_clause: str,
                                       rounding: int, amt_col: str = 'amount_usd') -> Dict[str, Any]:
        """Budget per Avg Capacity = Revenue / (Avg Offshore + Avg Outsourcing) / month
        
        Per Queries_02 spec:
        - Revenue: 'Revenue Summary' is YTD cumulative, so use only max_month value
        - Avg Offshore: Internal + OFFSHORE + sector <> 'INTERNAL', SUM(months 1..N)/N
        - Avg Outsourcing: External + OFFSHORE, SUM(months 1..N)/N
        - Formula: Revenue(month=N) / (Avg Offshore + Avg Outsourcing) / N
        
        Uses two CTEs: one for Revenue at max_month only, one for capacity across all YTD months.
        """
        ytd_where_parts, ytd_params, max_month = self._expand_month_filter_for_ytd(
            where_parts, params)

        # Fallback: re-expand ytd_where_parts if _expand_month_filter_for_ytd failed
        ytd_where_parts, ytd_params, max_month = self._apply_ytd_fallback(
            ytd_where_parts, ytd_params, where_parts, params, max_month,
            builder_name='Budget Per Capacity')

        ytd_where_clause = " AND ".join(ytd_where_parts)

        has_region_entity = 'region_entity' in group_by_clause.lower()

        if has_region_entity:
            original_where_clause = " AND ".join(where_parts)
            # Prefix each group-by column with r. for the final SELECT (avoids r.* + duplicate revenue)
            r_select_cols = ', '.join(f'r.{c.strip()}' for c in select_cols.split(','))
            sql = f"""
                WITH revenue_data AS (
                    SELECT 
                        {select_cols},
                        SUM({amt_col}) as revenue
                    FROM cube_fact_data
                    WHERE {original_where_clause}
                      AND cost_category = 'Revenue Summary'
                      AND (include_exclude = 'Include' OR include_exclude IS NULL)
                    GROUP BY {group_by_clause}
                ),
                capacity_data AS (
                    SELECT 
                        {select_cols},
                        {max_month} as month_count,
                        SUM(CASE 
                            WHEN LOWER(TRIM(resource_type)) = 'internal'
                            AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                            AND (sector IS NULL OR LOWER(TRIM(sector)) != 'internal')
                            AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
                            THEN capacity ELSE 0 
                        END) / NULLIF({max_month}, 0) as avg_offshore_capacity,
                        SUM(CASE 
                            WHEN LOWER(TRIM(resource_type)) = 'external'
                            AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                            AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
                            AND employee_number IS NOT NULL AND employee_number != '' AND employee_number != '0' AND employee_number != '0.0'
                            THEN capacity ELSE 0 
                        END) / NULLIF({max_month}, 0) as avg_outsourcing_capacity
                    FROM cube_fact_data
                    WHERE {ytd_where_clause}
                      AND cost_category = 'GB Wise END Capacity'
                    GROUP BY {group_by_clause}
                )
                SELECT 
                    {r_select_cols},
                    ROUND(r.revenue::numeric, {rounding}) as revenue,
                    ROUND(c.avg_offshore_capacity::numeric, {rounding}) as avg_offshore_capacity,
                    ROUND(c.avg_outsourcing_capacity::numeric, {rounding}) as avg_outsourcing_capacity,
                    ROUND(
                        r.revenue / NULLIF(c.avg_offshore_capacity + c.avg_outsourcing_capacity, 0) / NULLIF(c.month_count, 0),
                        {rounding}
                    ) as budget_per_capacity
                FROM revenue_data r
                LEFT JOIN capacity_data c ON r.region_entity = c.region_entity
                ORDER BY budget_per_capacity DESC
            """
            all_params = list(params) + list(ytd_params)
        else:
            sql = f"""
                SELECT 
                    {select_cols},
                    ROUND(SUM(CASE 
                        WHEN cost_category = 'Revenue Summary' AND (include_exclude = 'Include' OR include_exclude IS NULL)
                          AND month = {max_month}
                        THEN amount_usd ELSE 0 
                    END)::numeric, {rounding}) as revenue,
                    ROUND(SUM(CASE 
                        WHEN cost_category = 'GB Wise END Capacity' 
                        AND LOWER(TRIM(resource_type)) = 'internal'
                        AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                        AND (sector IS NULL OR LOWER(TRIM(sector)) != 'internal')
                        AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
                        THEN capacity ELSE 0 
                    END)::numeric / NULLIF({max_month}, 0), {rounding}) as avg_offshore_capacity,
                    ROUND(SUM(CASE 
                        WHEN cost_category = 'GB Wise END Capacity' 
                        AND LOWER(TRIM(resource_type)) = 'external'
                        AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                        AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
                        AND employee_number IS NOT NULL AND employee_number != '' AND employee_number != '0' AND employee_number != '0.0'
                        THEN capacity ELSE 0 
                    END)::numeric / NULLIF({max_month}, 0), {rounding}) as avg_outsourcing_capacity,
                    ROUND(
                        SUM(CASE 
                            WHEN cost_category = 'Revenue Summary' AND (include_exclude = 'Include' OR include_exclude IS NULL)
                              AND month = {max_month}
                            THEN amount_usd ELSE 0 
                        END)
                        / NULLIF(
                            SUM(CASE 
                                WHEN cost_category = 'GB Wise END Capacity' 
                                AND LOWER(TRIM(resource_type)) = 'internal'
                                AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                                AND (sector IS NULL OR LOWER(TRIM(sector)) != 'internal')
                                AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
                                THEN capacity ELSE 0 
                            END) / NULLIF({max_month}, 0)
                            + SUM(CASE 
                                WHEN cost_category = 'GB Wise END Capacity' 
                                AND LOWER(TRIM(resource_type)) = 'external'
                                AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                                AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
                                AND employee_number IS NOT NULL AND employee_number != '' AND employee_number != '0' AND employee_number != '0.0'
                                THEN capacity ELSE 0 
                            END) / NULLIF({max_month}, 0)
                        , 0) / NULLIF({max_month}, 0),
                        {rounding}
                    ) as budget_per_capacity
                FROM cube_fact_data
                WHERE {ytd_where_clause}
                  AND cost_category IN ('Revenue Summary', 'GB Wise END Capacity')
                GROUP BY {group_by_clause}
                ORDER BY budget_per_capacity DESC
            """
            all_params = list(ytd_params)

        logger.info(
            f"Generated Budget per Avg Capacity SQL (Revenue / (Avg Offshore + Avg Outsourcing) / month, max_month={max_month}, has_entity={has_region_entity})"
        )
        return {
            'success': True,
            'sql': sql,
            'params': all_params,
            'calculation_type': 'budget_per_capacity'
        }

    # ==================== NEW WW KPI BUILDERS ====================

    def _build_budget_total_ww_sql(self, where_parts: List[str], params: List,
                                   select_cols: str, group_by_clause: str,
                                   rounding: int,
                                   amt_col: str = 'amount_usd',
                                   currency_label: str = 'USD') -> Dict[str, Any]:
        """Worldwide Budget (mUSD/mINR) = SUM(Amount) / 1000000
        Filters: Revenue Summary, Include/Exclude=Include, Order reason <> Y36"""
        where_clause = " AND ".join(where_parts)
        col_alias = f'ww_budget_m{currency_label.lower()}'
        select_prefix = f"{select_cols}," if select_cols else ""
        group_by_sql = f"GROUP BY {group_by_clause}" if group_by_clause else ""
        order_by_sql = f"ORDER BY {group_by_clause}" if group_by_clause else ""
        sql = f"""
            SELECT 
                {select_prefix}
                ROUND(SUM({amt_col})::numeric / 1000000, {rounding}) as {col_alias}
            FROM cube_fact_data
            WHERE {where_clause}
              AND cost_category = 'Revenue Summary'
              AND include_exclude = 'Include'
              AND (order_reason IS NULL OR order_reason != 'Y36')
            {group_by_sql}
            {order_by_sql}
        """
        logger.info(f"Generated Worldwide Budget ({currency_label}) calculation SQL")
        return {
            'success': True,
            'sql': sql,
            'params': params,
            'calculation_type': 'budget_total_ww'
        }

    def _build_budget_offshore_sql(self, where_parts: List[str], params: List,
                                   select_cols: str, group_by_clause: str,
                                   rounding: int,
                                   amt_col: str = 'amount_usd',
                                   currency_label: str = 'USD') -> Dict[str, Any]:
        """Worldwide Budget Offshore (mUSD/mINR) = (SUM where Resource Type <> External) - (SUM where Onsite/Offshore <> OFFSHORE)
        This isolates the internal offshore portion of revenue.
        Base filters: Revenue Summary, Include/Exclude=Include, Order reason <> Y36"""
        where_clause = " AND ".join(where_parts)
        col_alias = f'ww_budget_offshore_m{currency_label.lower()}'
        select_prefix = f"{select_cols}," if select_cols else ""
        group_by_sql = f"GROUP BY {group_by_clause}" if group_by_clause else ""
        order_by_sql = f"ORDER BY {group_by_clause}" if group_by_clause else ""
        sql = f"""
            SELECT 
                {select_prefix}
                ROUND(
                    (SUM(CASE WHEN LOWER(TRIM(resource_type)) != 'external' THEN {amt_col} ELSE 0 END) 
                     - SUM(CASE WHEN UPPER(TRIM(onsite_offshore)) != 'OFFSHORE' THEN {amt_col} ELSE 0 END))::numeric / 1000000, {rounding}
                ) as {col_alias}
            FROM cube_fact_data
            WHERE {where_clause}
              AND cost_category = 'Revenue Summary'
              AND include_exclude = 'Include'
              AND (order_reason IS NULL OR order_reason != 'Y36')
            {group_by_sql}
            {order_by_sql}
        """
        logger.info(f"Generated Worldwide Budget Offshore ({currency_label}) calculation SQL")
        return {
            'success': True,
            'sql': sql,
            'params': params,
            'calculation_type': 'budget_offshore'
        }

    def _build_budget_outsourcing_sql(self, where_parts: List[str],
                                      params: List, select_cols: str,
                                      group_by_clause: str,
                                      rounding: int,
                                      amt_col: str = 'amount_usd',
                                      currency_label: str = 'USD') -> Dict[str, Any]:
        """Worldwide Budget Outsourcing (mUSD/mINR) = SUM(Amount) / 1000000 where Resource Type = External
        Base filters: Revenue Summary, Include/Exclude=Include, Order reason <> Y36"""
        where_clause = " AND ".join(where_parts)
        col_alias = f'ww_budget_outsourcing_m{currency_label.lower()}'
        select_prefix = f"{select_cols}," if select_cols else ""
        group_by_sql = f"GROUP BY {group_by_clause}" if group_by_clause else ""
        order_by_sql = f"ORDER BY {group_by_clause}" if group_by_clause else ""
        sql = f"""
            SELECT 
                {select_prefix}
                ROUND(SUM({amt_col})::numeric / 1000000, {rounding}) as {col_alias}
            FROM cube_fact_data
            WHERE {where_clause}
              AND cost_category = 'Revenue Summary'
              AND include_exclude = 'Include'
              AND (order_reason IS NULL OR order_reason != 'Y36')
              AND LOWER(TRIM(resource_type)) = 'external'
            {group_by_sql}
            {order_by_sql}
        """
        logger.info(f"Generated Worldwide Budget Outsourcing ({currency_label}) calculation SQL")
        return {
            'success': True,
            'sql': sql,
            'params': params,
            'calculation_type': 'budget_outsourcing'
        }

    def _build_total_capacity_avg_sql(self,
                                      where_parts: List[str],
                                      params: List,
                                      select_cols: str,
                                      group_by_clause: str,
                                      rounding: int,
                                      cube_id: str = None) -> Dict[str, Any]:
        """Total Average Capacity = (Offshore Capacity + Outsourcing Capacity) / Number of Months + CTG
        
        YTD Average Logic: Sum all months from Jan to requested month, divide by requested month number
        - Feb query: (Jan + Feb) / 2
        - Aug query: (Jan + ... + Aug) / 8
        
        Reference: category_final IN ('Offshore','Onsite') + 'Outsourcing'
        CTG value from MBR file: particulars='Capacity' or 'Total Capacity', sub_category='Average'
        """
        # Expand month filter for YTD: if month=2, change to month IN (1,2)
        ytd_where_parts, ytd_params, max_month = self._expand_month_filter_for_ytd(
            where_parts, params)
        ytd_where_clause = " AND ".join(ytd_where_parts)

        # Safely fetch CTG value from database (parameterized query) with default fallback
        ctg_value = self.get_ctg_value_sync(cube_id, 'Capacity', 'Average',
                                            'World Wide', 0) if cube_id else 0

        # Use max_month as divisor (the filter month number, e.g. 3 for March, 12 for December)
        # This matches the spec formula SUM(capacity)/month and works even when
        # only the current month's row exists (MS/MS-GB cumulative data).
        sql = f"""
            SELECT 
                {select_cols},
                ROUND((SUM(CASE WHEN LOWER(TRIM(resource_type)) = 'internal' AND LOWER(TRIM(onsite_offshore)) IN ('offshore', 'onsite') THEN capacity ELSE 0 END) 
                    / NULLIF({max_month}, 0))::numeric, {rounding}) as offshore_capacity,
                ROUND((SUM(CASE WHEN LOWER(TRIM(resource_type)) = 'external' AND LOWER(TRIM(onsite_offshore)) = 'offshore' THEN capacity ELSE 0 END)
                    / NULLIF({max_month}, 0))::numeric, {rounding}) as outsourcing_capacity,
                ROUND(((SUM(CASE WHEN LOWER(TRIM(resource_type)) = 'internal' AND LOWER(TRIM(onsite_offshore)) IN ('offshore', 'onsite') THEN capacity ELSE 0 END)
                    + SUM(CASE WHEN LOWER(TRIM(resource_type)) = 'external' AND LOWER(TRIM(onsite_offshore)) = 'offshore' THEN capacity ELSE 0 END))
                    / NULLIF({max_month}, 0)
                    + {ctg_value})::numeric, {rounding}) as total_capacity_avg
            FROM cube_fact_data
            WHERE {ytd_where_clause}
              AND cost_category = 'GB Wise END Capacity'
              AND UPPER(TRIM(sector)) != 'INTERNAL'
              AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
            GROUP BY {group_by_clause}
            ORDER BY total_capacity_avg DESC
        """
        logger.info(
            f"Generated Total Capacity Avg SQL (YTD avg / max_month={max_month}) with CTG={ctg_value} from MBR, sector<>'INTERNAL'"
        )
        return {
            'success': True,
            'sql': sql,
            'params': ytd_params,
            'calculation_type': 'total_capacity_avg'
        }

    def _build_total_capacity_end_sql(self,
                                      where_parts: List[str],
                                      params: List,
                                      select_cols: str,
                                      group_by_clause: str,
                                      rounding: int,
                                      cube_id: str = None) -> Dict[str, Any]:
        """Total END Capacity = Offshore End (Internal, Offshore/Onsite) + Outsourcing End (External, Offshore) + CTG
        Reference: category_final IN ('Offshore','Onsite') + 'Outsourcing'
        CTG value from MBR file: particulars='Capacity' or 'Total Capacity', sub_category='End'
        """
        where_clause = " AND ".join(where_parts)
        # Safely fetch CTG value from database (parameterized query) with default fallback
        ctg_value = self.get_ctg_value_sync(cube_id, 'Capacity', 'End',
                                            'World Wide', 0) if cube_id else 0
        sql = f"""
            SELECT 
                {select_cols},
                ROUND(SUM(CASE WHEN LOWER(TRIM(resource_type)) = 'internal' AND LOWER(TRIM(onsite_offshore)) IN ('offshore', 'onsite') THEN capacity ELSE 0 END)::numeric, {rounding}) as offshore_capacity_end,
                ROUND(SUM(CASE WHEN LOWER(TRIM(resource_type)) = 'external' AND LOWER(TRIM(onsite_offshore)) = 'offshore' THEN capacity ELSE 0 END)::numeric, {rounding}) as outsourcing_capacity_end,
                ROUND((
                    SUM(CASE WHEN LOWER(TRIM(resource_type)) = 'internal' AND LOWER(TRIM(onsite_offshore)) IN ('offshore', 'onsite') THEN capacity ELSE 0 END)
                    + SUM(CASE WHEN LOWER(TRIM(resource_type)) = 'external' AND LOWER(TRIM(onsite_offshore)) = 'offshore' THEN capacity ELSE 0 END)
                    + {ctg_value}
                )::numeric, {rounding}) as total_capacity_end
            FROM cube_fact_data
            WHERE {where_clause}
              AND cost_category = 'GB Wise END Capacity'
              AND UPPER(TRIM(sector)) != 'INTERNAL'
              AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
            GROUP BY {group_by_clause}
            ORDER BY total_capacity_end DESC
        """
        logger.info(
            f"Generated Total Capacity End SQL with CTG={ctg_value} from MBR, sector<>'INTERNAL'"
        )
        return {
            'success': True,
            'sql': sql,
            'params': params,
            'calculation_type': 'total_capacity_end'
        }

    def _build_offshore_capacity_avg_sql(
            self,
            where_parts: List[str],
            params: List,
            select_cols: str,
            group_by_clause: str,
            rounding: int,
            cube_id: str = None) -> Dict[str, Any]:
        """Offshore Average Capacity - Internal offshore capacity / Number of Months + CTG from MBR
        
        YTD Average Logic: Sum all months from Jan to requested month, divide by requested month number
        - Feb query: (Jan + Feb) / 2
        - Aug query: (Jan + ... + Aug) / 8
        
        Uses cost_category = 'GB Wise END Capacity'
        """
        # MS/SX view: when new_service_area is in where_parts, capacity data is scoped by
        # new_service_area. The view-injected sector filter (e.g., sector='BBM' for MS,
        # sector IN (...) for SX) may not be populated on capacity rows → strip it so the
        # hardcoded sector != 'INTERNAL' condition handles sector exclusion.
        has_nsa_filter = any('new_service_area' in p.lower() for p in where_parts)
        if has_nsa_filter:
            where_parts, params = self._strip_sector_from_where(where_parts, params)
            logger.info(
                "Offshore Capacity Avg: stripped view-injected sector filter "
                "(new_service_area present — capacity data scoped by new_service_area)"
            )

        # Expand month filter for YTD: if month=2, change to month IN (1,2)
        ytd_where_parts, ytd_params, max_month = self._expand_month_filter_for_ytd(
            where_parts, params)

        # Fallback: if _expand_month_filter_for_ytd failed (max_month=1), extract actual
        # month and re-expand ytd_where_parts to cover month IN (1..N).
        ytd_where_parts, ytd_params, max_month = self._apply_ytd_fallback(
            ytd_where_parts, ytd_params, where_parts, params, max_month,
            builder_name='Offshore Capacity Avg')

        logger.info(
            f"Offshore Capacity Avg: max_month={max_month}, ytd_params={ytd_params}"
        )

        # Embed params into WHERE clause for safe literal SQL (avoids %s count mismatch in CTE reuse)
        ytd_where_clause = self._embed_params_in_where(ytd_where_parts, ytd_params)

        # Safely fetch CTG value from database (parameterized query) with default fallback
        ctg_value = self.get_ctg_value_sync(cube_id, 'Offshore Capacity',
                                            'Average', 'World Wide',
                                            0) if cube_id else 0

        # Divisor = max_month (the filter month number, e.g. 3=March, 12=Dec).
        # Spec formula: SUM(capacity YTD) / month. Avoids avg=end for MS/GB snapshot views.
        sql = f"""
            SELECT 
                {select_cols},
                ROUND((SUM(capacity) / NULLIF({max_month}, 0) + {ctg_value})::numeric, {rounding}) as offshore_capacity_avg
            FROM cube_fact_data
            WHERE {ytd_where_clause}
              AND cost_category = 'GB Wise END Capacity'
              AND LOWER(TRIM(onsite_offshore)) = 'offshore'
              AND LOWER(TRIM(resource_type)) = 'internal'
              AND UPPER(TRIM(sector)) != 'INTERNAL'
              AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
            GROUP BY {group_by_clause}
            ORDER BY offshore_capacity_avg DESC
        """
        logger.info(
            f"Generated Offshore Capacity Avg SQL (YTD avg, max_month={max_month}, CTG={ctg_value}), "
            f"case-insensitive filters: onsite_offshore/resource_type/sector"
        )
        return {
            'success': True,
            'sql': sql,
            'params': [],
            'calculation_type': 'offshore_capacity_avg'
        }

    def _build_offshore_capacity_end_sql(
            self,
            where_parts: List[str],
            params: List,
            select_cols: str,
            group_by_clause: str,
            rounding: int,
            cube_id: str = None) -> Dict[str, Any]:
        """Offshore END Capacity - Internal offshore end capacity excluding Corporate, INTERNAL sector + CTG from MBR"""
        # MS/SX view: strip view-injected sector filter when new_service_area is present
        # (capacity data is scoped by new_service_area; sector != INTERNAL is hardcoded below)
        has_nsa_filter = any('new_service_area' in p.lower() for p in where_parts)
        if has_nsa_filter:
            where_parts, params = self._strip_sector_from_where(where_parts, params)
            logger.info(
                "Offshore Capacity End: stripped view-injected sector filter "
                "(new_service_area present — capacity data scoped by new_service_area)"
            )
        # Embed params into WHERE clause for consistent literal SQL (matches avg builder approach)
        where_clause = self._embed_params_in_where(where_parts, params)
        # Safely fetch CTG value from database (parameterized query) with default fallback
        ctg_value = self.get_ctg_value_sync(cube_id, 'Offshore Capacity',
                                            'End', 'World Wide',
                                            0) if cube_id else 0
        # Case-insensitive filters match data regardless of upload casing
        sql = f"""
            SELECT 
                {select_cols},
                ROUND((SUM(capacity) + {ctg_value})::numeric, {rounding}) as offshore_capacity_end
            FROM cube_fact_data
            WHERE {where_clause}
              AND cost_category = 'GB Wise END Capacity'
              AND LOWER(TRIM(onsite_offshore)) = 'offshore'
              AND LOWER(TRIM(resource_type)) = 'internal'
              AND UPPER(TRIM(sector)) != 'INTERNAL'
              AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
            GROUP BY {group_by_clause}
            ORDER BY offshore_capacity_end DESC
        """
        logger.info(
            f"Generated Offshore Capacity End SQL with CTG={ctg_value} from MBR, "
            f"case-insensitive filters: onsite_offshore/resource_type/sector"
        )
        return {
            'success': True,
            'sql': sql,
            'params': [],
            'calculation_type': 'offshore_capacity_end'
        }

    def _build_outsourcing_capacity_avg_sql(
            self,
            where_parts: List[str],
            params: List,
            select_cols: str,
            group_by_clause: str,
            rounding: int,
            cube_id: str = None) -> Dict[str, Any]:
        """Outsourcing Average Capacity - External resources / Number of Months + CTG from MBR
        
        YTD Average Logic: Sum all months from Jan to requested month, divide by requested month number
        - Feb query: (Jan + Feb) / 2
        - Aug query: (Jan + ... + Aug) / 8
        
        Implementation: Extract max month from params to determine YTD divisor. Query fetches
        all months from 1 to max_month using expanded WHERE clause.
        
        Per KPI_Metrics_Logic document (Entity View):
        - CALCULATE [avg_cap_act_ytd] where KRA[category_final] = "Outsourcing"
        - KRA[Service Area] NOT in {"Corporate","RBEI_CORPORATE","SDS_CORPORATE"}
        - KRA[Employee Number] <> 0 and <> BLANK()
        
        Uses cost_category = 'GB Wise END Capacity'
        Mapping: category_final = "Outsourcing" maps to resource_type = 'External'
        CTG value from MBR file: particulars='Outsourcing Capacity', sub_category='Average'
        """
        # Expand month filter for YTD: if month=2, change to month IN (1,2)
        ytd_where_parts, ytd_params, max_month = self._expand_month_filter_for_ytd(
            where_parts, params)

        # Strip sector filter for External (outsourcing) resources — per spec no sector condition
        ytd_where_parts, ytd_params = self._strip_sector_from_where(
            ytd_where_parts, ytd_params)

        # Fallback: re-expand ytd_where_parts if _expand_month_filter_for_ytd failed
        ytd_where_parts, ytd_params, max_month = self._apply_ytd_fallback(
            ytd_where_parts, ytd_params, where_parts, params, max_month,
            builder_name='Outsourcing Capacity Avg')

        ytd_where_clause = " AND ".join(ytd_where_parts)

        # Safely fetch CTG value from database (parameterized query) with default fallback
        ctg_value = self.get_ctg_value_sync(cube_id, 'Outsourcing Capacity',
                                            'Average', 'World Wide',
                                            0) if cube_id else 0

        # Use max_month as divisor (the filter month number, e.g. 3 for March, 12 for December)
        # Filter: Employee Number <> 0 and <> BLANK per KPI_Metrics_Logic spec
        sql = f"""
            SELECT 
                {select_cols},
                ROUND((SUM(capacity) / NULLIF({max_month}, 0) + {ctg_value})::numeric, {rounding}) as outsourcing_capacity_avg
            FROM cube_fact_data
            WHERE {ytd_where_clause}
              AND cost_category = 'GB Wise END Capacity'
              AND LOWER(TRIM(resource_type)) = 'external'
              AND LOWER(TRIM(onsite_offshore)) = 'offshore'
              AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
              AND employee_number IS NOT NULL AND employee_number != '' AND employee_number != '0' AND employee_number != '0.0'
            GROUP BY {group_by_clause}
            ORDER BY outsourcing_capacity_avg DESC
        """
        logger.info(
            f"Generated Outsourcing Capacity Avg SQL (YTD avg / max_month={max_month}) with CTG={ctg_value} from MBR"
        )
        return {
            'success': True,
            'sql': sql,
            'params': ytd_params,
            'calculation_type': 'outsourcing_capacity_avg'
        }

    def _build_outsourcing_capacity_end_sql(
            self,
            where_parts: List[str],
            params: List,
            select_cols: str,
            group_by_clause: str,
            rounding: int,
            cube_id: str = None) -> Dict[str, Any]:
        """Outsourcing END Capacity - External resources in offshore with GB Wise END Capacity + CTG from MBR
        
        Per KPI_Metrics_Logic document (Entity View):
        - CALCULATE [YTD End cap] where KRA[category_final] = "Outsourcing"
        - KRA[Service Area] NOT in {"Corporate","RBEI_CORPORATE","SDS_CORPORATE"}
        - KRA[Employee Number] <> 0 and <> BLANK()
        
        Per KPI_Metrics_Logic document (World Wide View):
        - Add CTG adjustment from cube_plan_data where plan_type = 'Actual' 
          and particulars = 'Outsourcing Capacity' and sub_category = 'End' and entity = 'Worlwide'
        
        Mapping: category_final = "Outsourcing" maps to resource_type = 'External'
        CTG value from MBR file: particulars='Outsourcing Capacity', sub_category='End'
        """
        where_clause = " AND ".join(where_parts)

        # Build sector-stripped WHERE for outsourcing (External) CTE — per spec no sector condition
        outsourcing_where_parts, outsourcing_params = self._strip_sector_from_where(
            where_parts, params)
        outsourcing_where_clause = " AND ".join(outsourcing_where_parts)

        # Safely fetch CTG value from database (parameterized query) with default fallback
        ctg_value = self.get_ctg_value_sync(cube_id, 'Outsourcing Capacity',
                                            'End', 'World Wide',
                                            0) if cube_id else 0

        if group_by_clause:
            # Two-CTE LEFT JOIN approach: ensures ALL dimension combinations appear in
            # results even when they have 0 outsourcing capacity.
            # all_entities uses full where_clause (with sector) to enumerate correct entities.
            # outsourcing_data uses sector-stripped clause — spec has no sector filter for External.
            # A LEFT JOIN then fills missing rows with 0.
            group_cols = [c.strip() for c in group_by_clause.split(',')]
            ae_select = ', '.join(f'ae.{c}' for c in group_cols)
            join_condition = ' AND '.join(
                f'od.{c} = ae.{c}' for c in group_cols)

            # Null-guard only for region_entity (month/year are never null)
            null_filter = (
                "\n              AND region_entity IS NOT NULL AND region_entity != ''"
                if 'region_entity' in group_by_clause else ''
            )

            # Filter: Employee Number <> 0 and <> BLANK per KPI_Metrics_Logic spec
            sql = f"""
            WITH all_entities AS (
                SELECT DISTINCT {group_by_clause}
                FROM cube_fact_data
                WHERE {where_clause}{null_filter}
            ),
            outsourcing_data AS (
                SELECT
                    {group_by_clause},
                    SUM(capacity) AS raw_capacity
                FROM cube_fact_data
                WHERE {outsourcing_where_clause}
                  AND cost_category = 'GB Wise END Capacity'
                  AND LOWER(TRIM(resource_type)) = 'external'
                  AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                  AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
                  AND employee_number IS NOT NULL AND employee_number != '' AND employee_number != '0' AND employee_number != '0.0'
                GROUP BY {group_by_clause}
            )
            SELECT
                {ae_select},
                ROUND((COALESCE(od.raw_capacity, 0) + {ctg_value})::numeric, {rounding}) AS outsourcing_capacity_end
            FROM all_entities ae
            LEFT JOIN outsourcing_data od ON {join_condition}
            ORDER BY outsourcing_capacity_end DESC
            """
            result_params = list(params) + list(outsourcing_params)
        else:
            # No GROUP BY — world total or single-value query
            # Filter: Employee Number <> 0 and <> BLANK per KPI_Metrics_Logic spec
            sql = f"""
            SELECT
                ROUND((SUM(capacity) + {ctg_value})::numeric, {rounding}) AS outsourcing_capacity_end
            FROM cube_fact_data
            WHERE {outsourcing_where_clause}
              AND cost_category = 'GB Wise END Capacity'
              AND LOWER(TRIM(resource_type)) = 'external'
              AND LOWER(TRIM(onsite_offshore)) = 'offshore'
              AND (service_area IS NULL OR service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE'))
              AND employee_number IS NOT NULL AND employee_number != '' AND employee_number != '0' AND employee_number != '0.0'
            """
            result_params = list(outsourcing_params)

        logger.info(
            f"Generated Outsourcing Capacity End SQL with CTG={ctg_value} from MBR"
        )
        return {
            'success': True,
            'sql': sql,
            'params': result_params,
            'calculation_type': 'outsourcing_capacity_end'
        }

    def _embed_params_in_where(self, where_parts: List[str],
                               params: List) -> str:
        """Embed parameter values into a WHERE clause, replacing %s placeholders with actual values.
        Used for multi-CTE queries where the same WHERE clause is reused multiple times."""
        clause = " AND ".join(where_parts)
        for p in params:
            if '%s' not in clause:
                break
            if isinstance(p, str):
                clause = clause.replace('%s', f"'{p}'", 1)
            else:
                clause = clause.replace('%s', str(p), 1)
        return clause

    def _strip_sector_from_where(self, where_parts: List[str],
                                  params: List) -> tuple:
        """Remove sector condition from where_parts and params.

        Per spec, outsourcing (External resource) CTEs must NOT be filtered by
        sector. Only new_service_area (if present) is kept so the service-area
        scope is still respected.

        Returns (stripped_where_parts, stripped_params).
        """
        stripped_parts = []
        stripped_params = []
        param_idx = 0
        for part in where_parts:
            placeholder_count = part.count('%s')
            if re.match(r'^\s*sector\b', part.strip(), re.IGNORECASE):
                # Skip this condition and consume its params
                param_idx += placeholder_count
                logger.info(
                    f"SX fix: stripped sector condition from outsourcing WHERE: {part.strip()}"
                )
            else:
                stripped_parts.append(part)
                stripped_params.extend(
                    params[param_idx:param_idx + placeholder_count])
                param_idx += placeholder_count
        return stripped_parts, stripped_params

    def _extract_sector_inline_condition(self, where_parts: List[str],
                                         params: List) -> str:
        """Extract any sector condition from where_parts and return it as an
        inline SQL fragment (e.g. "AND sector = 'BBM'" or
        "AND sector IN ('BBE','BBG','BBI','OTHERS')").

        Returns an empty string if no sector condition is present.
        Used by capacity-mix builders to re-attach the sector filter ONLY to
        Internal resource CASE WHEN branches, while keeping External branches
        free of sector conditions (matching outsourcing spec).
        """
        param_idx = 0
        for part in where_parts:
            placeholder_count = part.count('%s')
            if re.match(r'^\s*sector\b', part.strip(), re.IGNORECASE):
                part_params = params[param_idx:param_idx + placeholder_count]
                embedded = self._embed_params_in_where([part], part_params)
                return f"AND {embedded}"
            param_idx += placeholder_count
        return ""

    def _build_mtd_where_from_original(self, where_parts: List[str],
                                       params: List, max_month: int) -> str:
        """Build an MTD WHERE clause from original (non-YTD-expanded) where_parts/params.
        Replaces month placeholder with literal value and correctly maps remaining params."""
        mtd_parts = []
        mtd_params = []
        param_idx = 0
        for part in where_parts:
            num_placeholders = part.count('%s')
            if 'month' in part.lower() and num_placeholders > 0:
                mtd_parts.append(f"month = {max_month}")
                param_idx += num_placeholders
            else:
                mtd_parts.append(part)
                for _ in range(num_placeholders):
                    if param_idx < len(params):
                        mtd_params.append(params[param_idx])
                    param_idx += 1
        return self._embed_params_in_where(mtd_parts, mtd_params)

    def _build_budget_per_avg_capacity_ww_sql(
            self,
            where_parts: List[str],
            params: List,
            select_cols: str,
            group_by_clause: str,
            rounding: int,
            cube_id: str = None,
            amt_col: str = 'amount_usd') -> Dict[str, Any]:
        """Budget per Average Capacity WW = (Revenue_MTD / (Avg Capacity)) / month
        
        CORRECTED Formula per Word document:
        - Revenue = MTD (just that month), NOT YTD
        - Offshore Avg = SUM(Capacity YTD) / month for Internal, OFFSHORE only, Sector <> 'INTERNAL'
        - Outsourcing Avg = SUM(Capacity YTD) / month for External, OFFSHORE only
        - Budget/Avg Cap = (Revenue_MTD / (Offshore_Avg + Outsourcing_Avg + CTG)) / month
        
        Key filters per seed file:
        - OFFSHORE only (not Onsite)
        - Sector <> 'INTERNAL' for Offshore, NO sector filter for Outsourcing
        - Service Area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')
        - Capacity: YTD (Month <= selected month)
        - Revenue: MTD (Month = selected month)
        """
        # Expand month filter for YTD capacity: if month=2, change to month IN (1,2)
        ytd_where_parts, ytd_params, max_month = self._expand_month_filter_for_ytd(
            where_parts, params)

        # FALLBACK: If max_month is still 1, directly extract from where_parts or params
        if max_month == 1:
            # Try to find month in where_parts (literal or placeholder)
            where_str = " ".join(where_parts)
            month_literal_match = re.search(
                r"month\s*=\s*['\"]?(\d{1,2})['\"]?", where_str, re.IGNORECASE)
            if month_literal_match:
                extracted = int(month_literal_match.group(1))
                if 1 <= extracted <= 12:
                    max_month = extracted
                    logger.info(
                        f"FALLBACK WW: Extracted month={max_month} from where_parts literal"
                    )
            elif params:
                # Try to find month in params (usually second param after year)
                for p in params:
                    try:
                        val = int(p)
                        if 1 <= val <= 12:
                            max_month = val
                            logger.info(
                                f"FALLBACK WW: Extracted month={max_month} from params"
                            )
                            break
                    except (ValueError, TypeError):
                        continue

        logger.info(
            f"Budget/Avg Capacity WW: Using max_month={max_month} for division"
        )

        ytd_where_clause = self._embed_params_in_where(ytd_where_parts,
                                                       ytd_params)

        mtd_where_clause = self._build_mtd_where_from_original(
            where_parts, params, max_month)

        # Safely fetch CTG value from database (parameterized query) with default fallback
        ctg_value = self.get_ctg_value_sync(cube_id, 'Capacity', 'Average',
                                            'World Wide', 0) if cube_id else 0

        # For WW queries, we aggregate everything without grouping (single row result)
        # Use CROSS JOIN since there's only one row per CTE
        has_grouping = group_by_clause and group_by_clause.strip(
        ) and group_by_clause.strip() != ''

        if has_grouping:
            # Extract the first grouping column for JOIN
            first_col = group_by_clause.split(',')[0].strip(
            ) if ',' in group_by_clause else group_by_clause.strip()
            join_condition_offshore = f"r.{first_col} = o.{first_col}"
            join_condition_outsourcing = f"r.{first_col} = ou.{first_col}"
            group_by_sql = f"GROUP BY {group_by_clause}"
        else:
            # No grouping - use CROSS JOIN for single-row aggregates
            join_condition_offshore = "1=1"
            join_condition_outsourcing = "1=1"
            group_by_sql = ""

        sql = f"""
            WITH offshore_avg AS (
                SELECT 
                    {select_cols + ',' if select_cols else ''}
                    SUM(capacity) / NULLIF({max_month}, 0) as offshore_avg_cap,
                    {max_month} as month_count
                FROM cube_fact_data
                WHERE {ytd_where_clause}
                  AND cost_category = 'GB Wise END Capacity'
                  AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                  AND LOWER(TRIM(resource_type)) = 'internal'
                  AND UPPER(TRIM(sector)) != 'INTERNAL'
                  AND service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')
                {group_by_sql}
            ),
            outsourcing_avg AS (
                SELECT 
                    {select_cols + ',' if select_cols else ''}
                    SUM(capacity) / NULLIF({max_month}, 0) as outsourcing_avg_cap
                FROM cube_fact_data
                WHERE {ytd_where_clause}
                  AND cost_category = 'GB Wise END Capacity'
                  AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                  AND LOWER(TRIM(resource_type)) = 'external'
                  AND service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')
                  AND employee_number IS NOT NULL AND employee_number != '' AND employee_number != '0' AND employee_number != '0.0'
                {group_by_sql}
            ),
            revenue AS (
                SELECT 
                    {select_cols + ',' if select_cols else ''}
                    SUM({amt_col}) / 1000000.0 as revenue_millions
                FROM cube_fact_data
                WHERE {mtd_where_clause}
                  AND cost_category = 'Revenue Summary'
                  AND include_exclude = 'Include'
                  AND COALESCE(service_area, '') NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')
                {group_by_sql}
            )
            SELECT 
                {', '.join(['r.' + col.strip() for col in select_cols.split(',')]) + ',' if select_cols else ''}
                ROUND(r.revenue_millions::numeric, {rounding}) as budget_millions,
                ROUND((COALESCE(o.offshore_avg_cap, 0) + COALESCE(ou.outsourcing_avg_cap, 0) + {ctg_value})::numeric, {rounding}) as avg_capacity,
                ROUND(
                    ((r.revenue_millions * 1000000.0) / NULLIF(COALESCE(o.offshore_avg_cap, 0) + COALESCE(ou.outsourcing_avg_cap, 0) + {ctg_value}, 0)) / NULLIF(o.month_count, 0),
                    {rounding}
                ) as budget_per_avg_capacity
            FROM revenue r
            LEFT JOIN offshore_avg o ON {join_condition_offshore}
            LEFT JOIN outsourcing_avg ou ON {join_condition_outsourcing}
            ORDER BY budget_per_avg_capacity DESC
        """
        logger.info(
            f"Generated Budget per Avg Capacity WW SQL (Revenue MTD / Avg Cap YTD / {max_month} months) with CTG={ctg_value} from MBR"
        )
        sql = sql.replace('%', '%%')
        return {
            'success': True,
            'sql': sql,
            'params': [],
            'calculation_type': 'budget_per_avg_capacity_ww'
        }

    def _build_budget_per_avg_capacity_entity_sql(
            self, where_parts: List[str], params: List, select_cols: str,
            group_by_clause: str, rounding: int,
            amt_col: str = 'amount_usd') -> Dict[str, Any]:
        """
        Budget per Average Capacity Entity View
        Formula: (Revenue_MTD / (Offshore_Avg_YTD + Outsourcing_Avg_YTD)) / month
        
        Per PowerBI logic:
        - Revenue: MTD (single month), Cost Category = 'Revenue Summary', no Include/Exclude filter for entity
        - Offshore Avg: YTD sum / months, Internal, OFFSHORE, Sector <> INTERNAL, Service Area exclusions
        - Outsourcing Avg: YTD sum / months, External, OFFSHORE, NO sector filter, Service Area exclusions
        - Final: (Revenue / (Offshore Avg + Outsourcing Avg)) / month
        """
        # DEBUG: Log incoming where_parts and params
        logger.info(f"Budget Entity ENTRY - where_parts: {where_parts}")
        logger.info(f"Budget Entity ENTRY - params: {params}")

        # Get YTD where parts for capacity, but keep original for revenue
        ytd_where_parts, ytd_params, max_month = self._expand_month_filter_for_ytd(
            where_parts, params)

        # FALLBACK: If max_month is still 1, directly extract from where_parts or params
        if max_month == 1:
            # Try to find month in where_parts (literal or placeholder)
            where_str = " ".join(where_parts)
            month_literal_match = re.search(
                r"month\s*=\s*['\"]?(\d{1,2})['\"]?", where_str, re.IGNORECASE)
            if month_literal_match:
                extracted = int(month_literal_match.group(1))
                if 1 <= extracted <= 12:
                    max_month = extracted
                    logger.info(
                        f"FALLBACK: Extracted month={max_month} from where_parts literal"
                    )
            elif params:
                # Try to find month in params (usually second param after year)
                for p in params:
                    try:
                        val = int(p)
                        if 1 <= val <= 12:
                            max_month = val
                            logger.info(
                                f"FALLBACK: Extracted month={max_month} from params"
                            )
                            break
                    except (ValueError, TypeError):
                        continue

        logger.info(
            f"Budget/Avg Capacity Entity: Using max_month={max_month} for division"
        )

        ytd_where_clause_with_values = self._embed_params_in_where(
            ytd_where_parts, ytd_params)

        # Strip sector filter for outsourcing_avg CTE — per spec no sector condition for External
        outsourcing_ytd_parts, outsourcing_ytd_params = self._strip_sector_from_where(
            ytd_where_parts, ytd_params)
        outsourcing_ytd_where_clause_with_values = self._embed_params_in_where(
            outsourcing_ytd_parts, outsourcing_ytd_params)

        mtd_where_clause_with_values = self._build_mtd_where_from_original(
            where_parts, params, max_month)

        # Derive the entity join column dynamically from group_by_clause
        # (the first non-time column in the group_by, e.g. 'project_gb' or 'region_entity')
        _time_cols = {'month', 'year'}
        _group_cols = [c.strip() for c in group_by_clause.split(',')]
        entity_col = next(
            (c for c in _group_cols if c not in _time_cols), 'region_entity'
        )
        logger.info(f"Budget Entity: using entity_col={entity_col} for JOIN (group_by={group_by_clause})")

        sql = f"""
            WITH offshore_avg AS (
                -- Avg Offshore = SUM(capacity YTD) / max_month (filter month number)
                -- Fixed: uses literal max_month so MS/GB snapshot views avg correctly
                SELECT 
                    {select_cols},
                    SUM(capacity) / NULLIF({max_month}, 0) as offshore_avg_cap,
                    {max_month} as month_count
                FROM cube_fact_data
                WHERE {ytd_where_clause_with_values}
                  AND cost_category = 'GB Wise END Capacity'
                  AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                  AND LOWER(TRIM(resource_type)) = 'internal'
                  AND UPPER(TRIM(sector)) != 'INTERNAL'
                  AND service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')
                GROUP BY {group_by_clause}
            ),
            outsourcing_avg AS (
                -- Avg Outsourcing = SUM(capacity YTD) / max_month (the filter month number)
                -- No sector filter for External resources per spec
                -- Filter: Employee Number <> 0 and <> BLANK per KPI_Metrics_Logic spec
                SELECT 
                    {select_cols},
                    SUM(capacity) / NULLIF({max_month}, 0) as outsourcing_avg_cap,
                    {max_month} as month_count
                FROM cube_fact_data
                WHERE {outsourcing_ytd_where_clause_with_values}
                  AND cost_category = 'GB Wise END Capacity'
                  AND LOWER(TRIM(onsite_offshore)) = 'offshore'
                  AND LOWER(TRIM(resource_type)) = 'external'
                  AND service_area NOT IN ('Corporate', 'RBEI_CORPORATE', 'SDS_CORPORATE')
                  AND employee_number IS NOT NULL AND employee_number != '' AND employee_number != '0' AND employee_number != '0.0'
                GROUP BY {group_by_clause}
            ),
            revenue AS (
                -- Revenue = SUM(amount_usd MTD single month) / 1,000,000
                SELECT 
                    {select_cols},
                    SUM({amt_col}) / 1000000.0 as revenue_millions
                FROM cube_fact_data
                WHERE {mtd_where_clause_with_values}
                  AND cost_category = 'Revenue Summary'
                GROUP BY {group_by_clause}
            )
            SELECT 
                r.{entity_col},
                ROUND(r.revenue_millions::numeric, {rounding}) as revenue_millions,
                ROUND(COALESCE(o.offshore_avg_cap, 0)::numeric, {rounding}) as avg_offshore_cap,
                ROUND(COALESCE(ou.outsourcing_avg_cap, 0)::numeric, {rounding}) as avg_outsourcing_cap,
                ROUND((COALESCE(o.offshore_avg_cap, 0) + COALESCE(ou.outsourcing_avg_cap, 0))::numeric, {rounding}) as avg_total_capacity,
                COALESCE(o.month_count, 1) as months_used,
                ROUND(
                    ((r.revenue_millions * 1000000.0) / NULLIF(COALESCE(o.offshore_avg_cap, 0) + COALESCE(ou.outsourcing_avg_cap, 0), 0)) / NULLIF(o.month_count, 0),
                    {rounding}
                ) as budget_per_avg_capacity
            FROM revenue r
            LEFT JOIN offshore_avg o ON r.{entity_col} = o.{entity_col}
            LEFT JOIN outsourcing_avg ou ON r.{entity_col} = ou.{entity_col}
            ORDER BY budget_per_avg_capacity DESC
        """
        logger.info(
            f"Generated Budget per Avg Capacity Entity SQL (Revenue MTD / Avg Cap YTD / {max_month} months)"
        )
        sql = sql.replace('%', '%%')
        return {
            'success': True,
            'sql': sql,
            'params': [],
            'calculation_type': 'budget_per_avg_capacity_entity'
        }

    def _build_revenue_sql(self, where_parts: List[str], params: List,
                           select_cols: str, group_by_clause: str,
                           rounding: int,
                           amt_col: str = 'amount_usd') -> Dict[str, Any]:
        """
        Revenue (MTD or Summary) - simple SUM of Revenue Summary by entity
        Formula: SUM(amount_usd or amount_inr) WHERE cost_category = 'Revenue Summary'
        Supports INR via amt_col='amount_inr'.
        """
        where_clause_with_values = self._embed_params_in_where(
            where_parts, params)

        col_alias = 'revenue_inr' if amt_col == 'amount_inr' else 'revenue'
        sql = f"""
            SELECT 
                {select_cols},
                ROUND((SUM({amt_col}) / 1000000.0)::numeric, {rounding}) as {col_alias}
            FROM cube_fact_data
            WHERE {where_clause_with_values}
              AND cost_category = 'Revenue Summary'
            GROUP BY {group_by_clause}
            ORDER BY {col_alias} DESC
        """
        logger.info(f"Generated Revenue SQL (column={amt_col}, alias={col_alias}, divided by 1M)")
        sql = sql.replace('%', '%%')
        return {
            'success': True,
            'sql': sql,
            'params': [],
            'calculation_type': 'revenue'
        }

    # ==================== P&L REVENUE BUILDERS (YTD + exclusions) ====================

    def _build_gb_pl_revenue_sql(self, where_parts: List[str], params: List,
                                  select_cols: str, group_by_clause: str,
                                  rounding: int,
                                  amt_col: str = 'amount_usd') -> Dict[str, Any]:
        """
        GB P&L Revenue — YTD cumulative with order_reason + GL account exclusions.

        Reference formula (MV_GB_INSIGHTS_ALL):
          WHERE cost_category = 'Revenue Summary'
            AND year = N
            AND month <= N_max          -- YTD: all months up to specified month
            AND [region_entity = 'X']  -- only when entity specified (passed via where_parts)
            AND NVL(TRIM(order_reason),'x') NOT IN ('YEH','YEI','YEJ','YEK','YN2')
            AND NVL(TRIM(gl_account),'x') NOT LIKE '139%'

        Returns a single aggregated total — no GROUP BY.
        Entity is always a filter (not a dimension); project_gb is never grouped.
        """
        # Embed all intent filters as literals into the WHERE clause
        raw_where = self._embed_params_in_where(where_parts, params)

        # MTD: keep the specific month asked — do NOT convert to cumulative <= N.
        # Case 1: "month = N"  (normal path — leave as-is, just read the value)
        month_match = re.search(r'\bmonth\s*=\s*(\d{1,2})\b', raw_where,
                                re.IGNORECASE)
        # Case 2: "month IN (N, M, ...)" — multi-month comparison or single value in list.
        # For N > 1 months we keep the IN filter and GROUP BY month (per-month breakdown).
        # For a single value in the list we collapse to = N (backward compat).
        month_in_match = re.search(r'\bmonth\s+IN\s*\(([^)]+)\)', raw_where,
                                   re.IGNORECASE)

        if month_match:
            max_month = int(month_match.group(1))
            is_multi_month_gb = False
        elif month_in_match:
            in_vals = [
                int(x.strip()) for x in month_in_match.group(1).split(',')
                if x.strip().lstrip('-').isdigit()
            ]
            max_month = max(in_vals) if in_vals else None
            is_multi_month_gb = len(in_vals) > 1
            if not is_multi_month_gb and max_month is not None:
                # Single value in IN list — collapse to = N
                raw_where = re.sub(r'\bmonth\s+IN\s*\([^)]+\)',
                                   f'month = {max_month}',
                                   raw_where, flags=re.IGNORECASE)
            # Multi-month: keep month IN (...) — will GROUP BY month below
        else:
            max_month = None
            is_multi_month_gb = False

        col_alias = 'pl_revenue_inr' if amt_col == 'amount_inr' else 'pl_revenue'

        # Month name CASE for human-readable labels in multi-month output
        _mnc = ("CASE month WHEN 1 THEN 'Jan' WHEN 2 THEN 'Feb' WHEN 3 THEN 'Mar'"
                " WHEN 4 THEN 'Apr' WHEN 5 THEN 'May' WHEN 6 THEN 'Jun'"
                " WHEN 7 THEN 'Jul' WHEN 8 THEN 'Aug' WHEN 9 THEN 'Sep'"
                " WHEN 10 THEN 'Oct' WHEN 11 THEN 'Nov' WHEN 12 THEN 'Dec'"
                " ELSE 'Unknown' END")

        # Detect entity pattern: IN (...) for multi-entity, = '...' for single.
        _ent_in_match = re.search(r"region_entity\s+IN\s*\(([^)]+)\)", raw_where, re.IGNORECASE)
        _ent_eq_match = re.search(r"region_entity\s*=\s*'([^']+)'", raw_where, re.IGNORECASE)
        is_multi_entity_gbrev = bool(_ent_in_match)

        # Use per-month breakdown when: (a) multiple months explicitly requested via IN,
        # or (b) caller's group_by_clause contains 'month' (e.g. "which month" queries)
        caller_month_group_gb = 'month' in group_by_clause.lower()
        use_month_breakdown_gb = is_multi_month_gb or (caller_month_group_gb and max_month is None)

        if is_multi_entity_gbrev:
            if use_month_breakdown_gb:
                # Multi-entity + multi-month: one row per (entity, month)
                sql = f"""
                    SELECT
                        region_entity,
                        year, month, {_mnc} AS month_name,
                        ROUND((SUM({amt_col}) / 1000000.0)::numeric, {rounding}) AS {col_alias}
                    FROM cube_fact_data
                    WHERE {raw_where}
                      AND cost_category = 'Revenue Summary'
                      AND COALESCE(TRIM(order_reason), 'x') NOT IN ('YEH','YEI','YEJ','YEK','YN2')
                      AND NOT starts_with(COALESCE(TRIM(gl_account), 'x'), '139')
                    GROUP BY region_entity, year, month
                    ORDER BY year, month, region_entity
                """
            else:
                # Multi-entity, single period aggregate
                sql = f"""
                    SELECT
                        region_entity,
                        ROUND((SUM({amt_col}) / 1000000.0)::numeric, {rounding}) AS {col_alias}
                    FROM cube_fact_data
                    WHERE {raw_where}
                      AND cost_category = 'Revenue Summary'
                      AND COALESCE(TRIM(order_reason), 'x') NOT IN ('YEH','YEI','YEJ','YEK','YN2')
                      AND NOT starts_with(COALESCE(TRIM(gl_account), 'x'), '139')
                    GROUP BY region_entity
                    ORDER BY {col_alias} DESC
                """
        else:
            entity_label = _ent_eq_match.group(1) if _ent_eq_match else 'All Entities'
            if use_month_breakdown_gb:
                # Single entity + multi-month: one row per month
                sql = f"""
                    SELECT
                        '{entity_label}' AS region_entity,
                        year, month, {_mnc} AS month_name,
                        ROUND((SUM({amt_col}) / 1000000.0)::numeric, {rounding}) AS {col_alias}
                    FROM cube_fact_data
                    WHERE {raw_where}
                      AND cost_category = 'Revenue Summary'
                      AND COALESCE(TRIM(order_reason), 'x') NOT IN ('YEH','YEI','YEJ','YEK','YN2')
                      AND NOT starts_with(COALESCE(TRIM(gl_account), 'x'), '139')
                    GROUP BY year, month
                    ORDER BY year, month
                """
            else:
                # Single entity or no entity — scalar aggregate for one period
                sql = f"""
                    SELECT
                        '{entity_label}'                                                    AS region_entity,
                        ROUND((SUM({amt_col}) / 1000000.0)::numeric, {rounding}) AS {col_alias}
                    FROM cube_fact_data
                    WHERE {raw_where}
                      AND cost_category = 'Revenue Summary'
                      AND COALESCE(TRIM(order_reason), 'x') NOT IN ('YEH','YEI','YEJ','YEK','YN2')
                      AND NOT starts_with(COALESCE(TRIM(gl_account), 'x'), '139')
                """
        logger.info(
            f"Generated GB P&L Revenue SQL (MTD month='{max_month}', multi_month={is_multi_month_gb}, "
            f"multi_entity={is_multi_entity_gbrev}, month_breakdown={use_month_breakdown_gb}, "
            f"col={amt_col}, alias={col_alias}, excl order_reason+GL139)"
        )
        return {
            'success': True,
            'sql': sql,
            'params': [],
            'calculation_type': 'gb_pl_revenue'
        }

    def _build_entity_pl_revenue_sql(self, where_parts: List[str], params: List,
                                      select_cols: str, group_by_clause: str,
                                      rounding: int,
                                      amt_col: str = 'amount_usd') -> Dict[str, Any]:
        """
        Entity P&L Revenue — identical formula to GB P&L Revenue.
        YTD cumulative (month <= N), order_reason + GL account exclusions.
        Entity is a filter (passed via where_parts), not a GROUP BY dimension.
        Triggered by 'entity p&l revenue', 'entity pl revenue', 'o&l revenue', etc.
        """
        # Embed all intent filters as literals into the WHERE clause
        raw_where = self._embed_params_in_where(where_parts, params)

        # MTD: keep the specific month asked — do NOT convert to cumulative <= N.
        # Case 1: "month = N"  (normal path — leave as-is, just read the value)
        month_match = re.search(r'\bmonth\s*=\s*(\d{1,2})\b', raw_where,
                                re.IGNORECASE)
        # Case 2: "month IN (N, M, ...)" — multi-month comparison or single value in list.
        # For N > 1 months we keep the IN filter and GROUP BY month (per-month breakdown).
        # For a single value in the list we collapse to = N (backward compat).
        month_in_match = re.search(r'\bmonth\s+IN\s*\(([^)]+)\)', raw_where,
                                   re.IGNORECASE)

        if month_match:
            max_month = int(month_match.group(1))
            is_multi_month_epl = False
        elif month_in_match:
            in_vals = [
                int(x.strip()) for x in month_in_match.group(1).split(',')
                if x.strip().lstrip('-').isdigit()
            ]
            max_month = max(in_vals) if in_vals else None
            is_multi_month_epl = len(in_vals) > 1
            if not is_multi_month_epl and max_month is not None:
                # Single value in IN list — collapse to = N
                raw_where = re.sub(r'\bmonth\s+IN\s*\([^)]+\)',
                                   f'month = {max_month}',
                                   raw_where, flags=re.IGNORECASE)
            # Multi-month: keep month IN (...) — will GROUP BY month below
        else:
            max_month = None
            is_multi_month_epl = False

        col_alias = 'pl_revenue_inr' if amt_col == 'amount_inr' else 'pl_revenue'

        # Month name CASE for human-readable labels in multi-month output
        _mnc = ("CASE month WHEN 1 THEN 'Jan' WHEN 2 THEN 'Feb' WHEN 3 THEN 'Mar'"
                " WHEN 4 THEN 'Apr' WHEN 5 THEN 'May' WHEN 6 THEN 'Jun'"
                " WHEN 7 THEN 'Jul' WHEN 8 THEN 'Aug' WHEN 9 THEN 'Sep'"
                " WHEN 10 THEN 'Oct' WHEN 11 THEN 'Nov' WHEN 12 THEN 'Dec'"
                " ELSE 'Unknown' END")

        # Detect entity pattern: IN (...) for multi-entity, = '...' for single.
        _ent_in_match = re.search(r"region_entity\s+IN\s*\(([^)]+)\)", raw_where, re.IGNORECASE)
        _ent_eq_match = re.search(r"region_entity\s*=\s*'([^']+)'", raw_where, re.IGNORECASE)
        is_multi_entity_eplrev = bool(_ent_in_match)

        # Use per-month breakdown when: (a) multiple months explicitly requested via IN,
        # or (b) caller's group_by_clause contains 'month' (e.g. "which month" queries)
        caller_month_group_epl = 'month' in group_by_clause.lower()
        use_month_breakdown_epl = is_multi_month_epl or (caller_month_group_epl and max_month is None)

        if is_multi_entity_eplrev:
            if use_month_breakdown_epl:
                # Multi-entity + multi-month: one row per (entity, month)
                sql = f"""
                    SELECT
                        region_entity,
                        year, month, {_mnc} AS month_name,
                        ROUND((SUM({amt_col}) / 1000000.0)::numeric, {rounding}) AS {col_alias}
                    FROM cube_fact_data
                    WHERE {raw_where}
                      AND cost_category = 'Revenue Summary'
                      AND COALESCE(TRIM(order_reason), 'x') NOT IN ('YEH','YEI','YEJ','YEK','YN2')
                      AND NOT starts_with(COALESCE(TRIM(gl_account), 'x'), '139')
                    GROUP BY region_entity, year, month
                    ORDER BY year, month, region_entity
                """
            else:
                # Multi-entity, single period aggregate
                sql = f"""
                    SELECT
                        region_entity,
                        ROUND((SUM({amt_col}) / 1000000.0)::numeric, {rounding}) AS {col_alias}
                    FROM cube_fact_data
                    WHERE {raw_where}
                      AND cost_category = 'Revenue Summary'
                      AND COALESCE(TRIM(order_reason), 'x') NOT IN ('YEH','YEI','YEJ','YEK','YN2')
                      AND NOT starts_with(COALESCE(TRIM(gl_account), 'x'), '139')
                    GROUP BY region_entity
                    ORDER BY {col_alias} DESC
                """
        else:
            entity_label = _ent_eq_match.group(1) if _ent_eq_match else 'All Entities'
            if use_month_breakdown_epl:
                # Single entity + multi-month: one row per month
                sql = f"""
                    SELECT
                        '{entity_label}' AS region_entity,
                        year, month, {_mnc} AS month_name,
                        ROUND((SUM({amt_col}) / 1000000.0)::numeric, {rounding}) AS {col_alias}
                    FROM cube_fact_data
                    WHERE {raw_where}
                      AND cost_category = 'Revenue Summary'
                      AND COALESCE(TRIM(order_reason), 'x') NOT IN ('YEH','YEI','YEJ','YEK','YN2')
                      AND NOT starts_with(COALESCE(TRIM(gl_account), 'x'), '139')
                    GROUP BY year, month
                    ORDER BY year, month
                """
            else:
                # Single entity or no entity — scalar aggregate for one period
                sql = f"""
                    SELECT
                        '{entity_label}'                                                    AS region_entity,
                        ROUND((SUM({amt_col}) / 1000000.0)::numeric, {rounding}) AS {col_alias}
                    FROM cube_fact_data
                    WHERE {raw_where}
                      AND cost_category = 'Revenue Summary'
                      AND COALESCE(TRIM(order_reason), 'x') NOT IN ('YEH','YEI','YEJ','YEK','YN2')
                      AND NOT starts_with(COALESCE(TRIM(gl_account), 'x'), '139')
                """
        logger.info(
            f"Generated Entity P&L Revenue SQL (MTD month='{max_month}', multi_month={is_multi_month_epl}, "
            f"multi_entity={is_multi_entity_eplrev}, month_breakdown={use_month_breakdown_epl}, "
            f"col={amt_col}, alias={col_alias}, excl order_reason+GL139)"
        )
        return {
            'success': True,
            'sql': sql,
            'params': [],
            'calculation_type': 'entity_pl_revenue'
        }

    # ==================== END NEW WW KPI BUILDERS ====================

    # ==================== NEMKO P&L SQL BUILDERS ====================

    def _load_nemko_column_config(self, cube_id: str) -> Dict[str, Dict]:
        """
        Load column configuration from database for dynamic SQL generation.
        Returns a dict keyed by column_index for reliable lookup.
        """
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT json_key, display_name, column_type, aliases, column_index
                FROM cube_column_config 
                WHERE cube_id = %s
                ORDER BY column_index
            """, (cube_id, ))
            rows = cursor.fetchall()
            cursor.close()
            conn.close()

            # Index by column_index for reliable lookup
            config = {}
            for row in rows:
                json_key, display_name, column_type, aliases, column_index = row
                config[column_index] = {
                    'json_key': json_key,
                    'display_name': display_name,
                    'column_type': column_type,
                    'aliases': aliases or [],
                    'column_index': column_index
                }
            return config
        except Exception as e:
            logger.error(f"Failed to load column config: {e}")
            # Fallback to index-based config
            return {
                0: {
                    'json_key': 'Values',
                    'display_name': 'Location',
                    'column_type': 'dimension'
                },
                1: {
                    'json_key': 'Unnamed: 1',
                    'display_name': 'Department',
                    'column_type': 'dimension'
                },
                2: {
                    'json_key': 'Unnamed: 2',
                    'display_name': 'Account',
                    'column_type': 'dimension'
                },
                3: {
                    'json_key': 'Unnamed: 3',
                    'display_name': 'Month',
                    'column_type': 'period'
                },
                4: {
                    'json_key': 'Unnamed: 4',
                    'display_name': 'Actual FY24',
                    'column_type': 'metric'
                },
                5: {
                    'json_key': 'Unnamed: 5',
                    'display_name': 'Actual FY25',
                    'column_type': 'metric'
                },
            }

    def _load_nemko_entity_values(self, cube_id: str) -> Dict[str, str]:
        """
        Load known entity values and their aliases from cube_column_values table.
        Falls back to auto-discovery from cube_fact_data if table is empty.
        Returns a dict mapping alias -> actual_value for entity resolution.
        """
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT value_name, value_aliases
                FROM cube_column_values 
                WHERE cube_id = %s AND column_name = 'subsidiary' AND is_active = 1
            """, (cube_id, ))
            rows = cursor.fetchall()
            cursor.close()
            conn.close()

            alias_map = {}
            for value_name, aliases in rows:
                if aliases:
                    for alias in aliases:
                        alias_map[alias.lower()] = value_name

            # If no configured values, use auto-discovery
            if not alias_map:
                logger.info(
                    "No configured entity values, using auto-discovery")
                alias_map = self._auto_discover_entity_values(cube_id)

            return alias_map
        except Exception as e:
            logger.error(f"Failed to load entity values: {e}")
            return {}

    def _get_country_entity_groups(self, cube_id: str) -> Dict[str, List[str]]:
        """
        Group entities by country/region for aggregate queries.
        E.g., "india" -> [all 5 India entities], "taiwan" -> [all Taiwan entities]
        """
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT DISTINCT entity_name FROM dim_entity WHERE cube_id = %s
            """, (cube_id, ))
            rows = cursor.fetchall()
            cursor.close()
            conn.close()

            # Country/region keywords to entity mappings
            country_groups = {}
            country_keywords = [
                'india', 'taiwan', 'china', 'korea', 'japan', 'usa', 'canada',
                'germany', 'norway', 'scandinavia', 'asia', 'europe',
                'americas'
            ]

            for (entity_name, ) in rows:
                entity_lower = entity_name.lower()
                for country in country_keywords:
                    if country in entity_lower:
                        if country not in country_groups:
                            country_groups[country] = []
                        if entity_name not in country_groups[country]:
                            country_groups[country].append(entity_name)

            logger.info(
                f"Country entity groups: {[(k, len(v)) for k, v in country_groups.items()]}"
            )
            return country_groups
        except Exception as e:
            logger.error(f"Country grouping failed: {e}")
            return {}

    def _auto_discover_entity_values(self, cube_id: str) -> Dict[str, str]:
        """
        AUTO-DISCOVERY: Extract unique entity values directly from cube_fact_data.
        Generates aliases automatically from entity names.
        Returns dict mapping alias -> actual_value.
        """
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()

            # Get column config to find the right JSONB key
            col_config = self._load_nemko_column_config(cube_id)
            entity_key = col_config.get(0, {}).get('json_key', 'Values')

            # Extract unique entity values from actual data
            cursor.execute(
                f"""
                SELECT DISTINCT REPLACE(row_data->>'{entity_key}', chr(160), ' ') as entity
                FROM cube_fact_data 
                WHERE cube_id = %s
                AND row_data->>'{entity_key}' IS NOT NULL
                AND row_data->>'{entity_key}' != 'Location'
                AND row_data->>'{entity_key}' != ''
            """, (cube_id, ))
            rows = cursor.fetchall()
            cursor.close()
            conn.close()

            alias_map = {}
            for (entity_value, ) in rows:
                if not entity_value:
                    continue

                # Generate aliases from entity name
                aliases = self._generate_entity_aliases(entity_value)
                for alias in aliases:
                    alias_lower = alias.lower()
                    # Map alias to entity value
                    if alias_lower not in alias_map:
                        alias_map[alias_lower] = entity_value
                    else:
                        # If alias maps to multiple entities, keep as list
                        existing = alias_map[alias_lower]
                        if isinstance(existing, list):
                            if entity_value not in existing:
                                existing.append(entity_value)
                        elif existing != entity_value:
                            alias_map[alias_lower] = [existing, entity_value]

            logger.info(
                f"Auto-discovered {len(rows)} entities with {len(alias_map)} aliases"
            )
            return alias_map
        except Exception as e:
            logger.error(f"Auto-discovery failed: {e}")
            return {}

    def _generate_entity_aliases(self, entity_value: str) -> List[str]:
        """
        Generate aliases from an entity name.
        E.g., "E16 India (Test Lab) Private Limited" -> ["e16", "india", "test lab"]
        """
        import re
        aliases = []

        # Extract E-code (e.g., E16, E10)
        e_code_match = re.match(r'^(E\d{1,2})\s', entity_value)
        if e_code_match:
            aliases.append(e_code_match.group(1).lower())

        # Extract key words (skip common words)
        skip_words = {
            'ltd', 'limited', 'private', 'pvt', 'inc', 'corp', 'branch',
            'group', 'total', 'location', 'elimination'
        }
        words = re.findall(r'\b([a-zA-Z]{3,})\b', entity_value.lower())
        for word in words:
            if word not in skip_words and word not in aliases:
                aliases.append(word)

        # Extract multi-word phrases in parentheses
        paren_match = re.search(r'\(([^)]+)\)', entity_value)
        if paren_match:
            phrase = paren_match.group(1).lower().strip()
            if len(phrase) > 2:
                aliases.append(phrase)

        return aliases

    def _load_nemko_filter_rules(self, cube_id: str) -> List[Dict]:
        """
        Load filter rules from cube_filter_rules table.
        Returns list of filter rule dictionaries with aliases for matching.
        """
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT filter_name, filter_aliases, sql_predicate, target_column, is_default
                FROM cube_filter_rules 
                WHERE cube_id = %s AND is_active = 1
            """, (cube_id, ))
            rows = cursor.fetchall()
            cursor.close()
            conn.close()

            rules = []
            for row in rows:
                filter_name, aliases, sql_predicate, target_column, is_default = row
                rules.append({
                    'filter_name': filter_name,
                    'aliases': [a.lower() for a in (aliases or [])],
                    'sql_predicate': sql_predicate,
                    'target_column': target_column,
                    'is_default': bool(is_default)
                })
            logger.info(f"Loaded {len(rules)} filter rules for cube {cube_id}")
            return rules
        except Exception as e:
            logger.error(f"Failed to load filter rules: {e}")
            return []

    def _match_filter_rules(self, query: str,
                            filter_rules: List[Dict]) -> List[Dict]:
        """
        Match query text against filter rule aliases.
        Returns list of matching filter rules.
        """
        query_lower = query.lower()
        matched = []

        for rule in filter_rules:
            # Check if any alias matches the query
            for alias in rule['aliases']:
                if alias in query_lower:
                    matched.append(rule)
                    break

            # Also check filter_name (e.g., "E10 Asia")
            if rule['filter_name'].lower() in query_lower:
                if rule not in matched:
                    matched.append(rule)

        return matched

    def _parse_nemko_query_intent(
            self,
            query: str,
            entity_alias_map: Dict[str, str] = None) -> Dict[str, Any]:
        """
        Parse natural language query into structured intent.
        Uses data-driven entity matching from cube_column_values.
        Detects: entities, departments, months, years, metrics, comparison types.
        """
        import re
        query_lower = query.lower()
        intent = {
            'entities': [],
            'entity_values': [],  # Resolved entity names for WHERE clause
            'departments': [],
            'months': [],
            'years': [],
            'account_filter': None,
            'wants_breakdown': False,
            'breakdown_by': [],
            'is_comparison': False,
            'compare_years': False,
        }

        # Detect months
        month_map = {
            'jan': 'Jan',
            'january': 'Jan',
            'feb': 'Feb',
            'february': 'Feb',
            'mar': 'Mar',
            'march': 'Mar',
            'apr': 'Apr',
            'april': 'Apr',
            'may': 'May',
            'jun': 'Jun',
            'june': 'Jun',
            'jul': 'Jul',
            'july': 'Jul',
            'aug': 'Aug',
            'august': 'Aug',
            'sep': 'Sep',
            'september': 'Sep',
            'oct': 'Oct',
            'october': 'Oct',
            'nov': 'Nov',
            'november': 'Nov',
            'dec': 'Dec',
            'december': 'Dec'
        }
        for key, val in month_map.items():
            if re.search(r'\b' + key + r'\b', query_lower):
                if val not in intent['months']:
                    intent['months'].append(val)

        # Sort months in calendar order
        month_order = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
            'Oct', 'Nov', 'Dec'
        ]
        intent['months'] = sorted(intent['months'],
                                  key=lambda m: month_order.index(m)
                                  if m in month_order else 99)

        # Detect years
        if '2024' in query_lower or 'fy24' in query_lower:
            intent['years'].append('FY24')
        if '2025' in query_lower or 'fy25' in query_lower:
            intent['years'].append('FY25')
        if not intent['years']:
            intent['years'] = ['FY24']

        # Detect Budget vs Actuals comparison
        if 'budget' in query_lower and 'actual' in query_lower:
            intent['compare_years'] = True
            intent['years'] = ['FY24', 'FY25']
        if 'vs' in query_lower and ('fy24' in query_lower or 'fy25'
                                    in query_lower or '2024' in query_lower
                                    or '2025' in query_lower):
            intent['compare_years'] = True
            intent['years'] = ['FY24', 'FY25']

        # DATA-DRIVEN entity detection using database aliases (supports multi-entity aliases)
        if entity_alias_map:
            for alias, entity_value in entity_alias_map.items():
                if re.search(r'\b' + re.escape(alias) + r'\b', query_lower):
                    # Handle case where alias maps to multiple entities (list)
                    if isinstance(entity_value, list):
                        for ev in entity_value:
                            if ev not in intent['entity_values']:
                                intent['entity_values'].append(ev)
                        intent['entities'].append(alias)
                    elif entity_value not in intent['entity_values']:
                        intent['entity_values'].append(entity_value)
                        intent['entities'].append(alias)

        # Fallback 1: Partial matching on entity VALUE names (e.g., "india" matches "E16 India...")
        if not intent['entity_values'] and entity_alias_map:
            # Get unique entity values - flatten lists
            unique_values = set()
            for val in entity_alias_map.values():
                if isinstance(val, list):
                    unique_values.update(val)
                else:
                    unique_values.add(val)

            query_words = query_lower.split()
            for entity_value in unique_values:
                entity_lower = entity_value.lower()
                for word in query_words:
                    # Skip common words
                    if word in [
                            'what', 'is', 'the', 'for', 'in', 'to', 'a', 'an',
                            'total', 'revenue', 'jan', 'feb', 'mar', 'apr',
                            'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov',
                            'dec', '2024', '2025', 'fy24', 'fy25'
                    ]:
                        continue
                    if len(word) >= 3 and word in entity_lower:
                        if entity_value not in intent['entity_values']:
                            intent['entity_values'].append(entity_value)
                            intent['entities'].append(word)

        # Fallback 2: detect E-codes if no match yet
        if not intent['entity_values']:
            e_code_matches = re.findall(r'\b(e\d{1,2})\b', query_lower)
            for code in e_code_matches:
                if code.upper() not in intent['entities']:
                    intent['entities'].append(code.upper())

        # Detect breakdown requests
        breakdown_keywords = {
            'by subsidiary': 'subsidiary',
            'by entity': 'subsidiary',
            'by location': 'subsidiary',
            'by department': 'department',
            'by dept': 'department',
            'by account': 'account',
            'breakdown': 'all',
            'all depart': 'department',
        }
        for keyword, breakdown_type in breakdown_keywords.items():
            if keyword in query_lower:
                intent['wants_breakdown'] = True
                if breakdown_type not in intent['breakdown_by']:
                    intent['breakdown_by'].append(breakdown_type)

        # Detect account types
        if 'revenue' in query_lower or 'sales' in query_lower:
            intent['account_filter'] = 'Revenue'
        elif 'cost' in query_lower or 'expense' in query_lower:
            intent['account_filter'] = 'Cost'
        elif 'ebit' in query_lower or 'operating' in query_lower:
            intent['account_filter'] = 'Operating'
        elif 'net income' in query_lower or 'net profit' in query_lower:
            intent['account_filter'] = 'Net'

        # Detect comparison type
        if len(intent['months']) > 1 or intent['compare_years']:
            intent['is_comparison'] = True

        return intent

    def _compile_nemko_sql(self,
                           calculation_name: str,
                           intent: Dict[str, Any],
                           domain: str = None) -> Dict[str, Any]:
        """
        Compile SQL for Nemko P&L queries using STAR SCHEMA (Fact/Dimension tables).
        Uses proper joins against dim_entity, dim_department, dim_account, dim_time.
        Supports: single/multi-month, entity filters, breakdowns, budget vs actuals.
        """
        import re

        original_query = intent.get('original_query', calculation_name).lower()
        nemko_pl_cube_id = '663678fc-a902-42d7-8c57-dd40a24e130a'

        # Parse query intent using auto-discovered entity aliases from star schema
        entity_alias_map = self._auto_discover_entity_values(nemko_pl_cube_id)
        query_intent = self._parse_nemko_query_intent(original_query,
                                                      entity_alias_map)

        # PRIORITY 1: Check for country-level queries (e.g., "India" should return ALL India entities)
        country_groups = self._get_country_entity_groups(nemko_pl_cube_id)
        country_keywords = [
            'india', 'taiwan', 'china', 'korea', 'japan', 'usa', 'canada',
            'germany', 'norway', 'scandinavia', 'asia', 'europe', 'americas'
        ]

        country_match_found = False
        for country in country_keywords:
            if re.search(r'\b' + country + r'\b', original_query):
                if country in country_groups and len(
                        country_groups[country]) > 1:
                    # Country name in query AND multiple entities exist - use ALL of them
                    query_intent['entity_values'] = country_groups[country]
                    query_intent['entities'] = [country]
                    country_match_found = True
                    logger.info(
                        f"Country-level query detected: '{country}' -> {len(country_groups[country])} entities"
                    )
                    break

        # PRIORITY 2: If no country match, use GPT-parsed filters as fallback
        if not country_match_found:
            gpt_parsed_filters = intent.get('filters', [])
            for f in gpt_parsed_filters:
                if f.get('column') == 'Location' and f.get('value'):
                    entity_val = f.get('value')
                    if entity_val not in query_intent['entity_values']:
                        query_intent['entity_values'].append(entity_val)
                        logger.info(
                            f"Added entity from GPT filter: {entity_val}")

        # Extract month from GPT filters
        gpt_parsed_filters = intent.get('filters', [])
        for f in gpt_parsed_filters:
            if f.get('column') == 'Fake Months' and f.get('value'):
                month_val = f.get('value')
                if month_val not in query_intent['months']:
                    query_intent['months'].append(month_val)
                    logger.info(f"Added month from GPT filter: {month_val}")

        # Extract fiscal year from GPT metrics (e.g., Actual_FY25 -> FY25)
        gpt_parsed_metrics = intent.get('metrics', [])
        for m in gpt_parsed_metrics:
            metric_name = m.get('name', '')
            if 'FY25' in metric_name:
                if 'FY25' not in query_intent['years']:
                    query_intent['years'] = ['FY25']  # Override default FY24
                    logger.info(f"Set year to FY25 from metric: {metric_name}")
            elif 'FY24' in metric_name:
                if 'FY24' not in query_intent['years']:
                    query_intent['years'] = ['FY24']
                    logger.info(f"Set year to FY24 from metric: {metric_name}")

        logger.info(f"Nemko query intent (star schema): {query_intent}")

        # Build WHERE conditions for star schema joins
        where_conditions = ["f.cube_id = %s"]
        params = [nemko_pl_cube_id]

        # Entity filter - dynamic matching using exact match or ILIKE for partial matches
        entity_filter_applied = False
        if query_intent.get('entity_values'):
            entity_conditions = []
            for entity_value in query_intent['entity_values']:
                entity_conditions.append("e.entity_name = %s")
                params.append(entity_value)
            where_conditions.append(f"({' OR '.join(entity_conditions)})")
            entity_filter_applied = True
            logger.info(
                f"Applied entity filter for: {query_intent['entity_values']}")

        # Department filter - default to TOTAL SERVICES/DEPARTMENTS for aggregated queries
        if entity_filter_applied:
            where_conditions.append(
                "d.department_name = 'TOTAL SERVICES/DEPARTMENTS'")
            logger.info(
                "Applied default department filter: TOTAL SERVICES/DEPARTMENTS"
            )

        # Month filter
        if query_intent['months']:
            if len(query_intent['months']) == 1:
                where_conditions.append("t.period_name = %s")
                params.append(query_intent['months'][0])
            else:
                placeholders = ', '.join(['%s'] * len(query_intent['months']))
                where_conditions.append(f"t.period_name IN ({placeholders})")
                params.extend(query_intent['months'])

        # Account filter - use hierarchy-aware matching
        account_filter = query_intent.get('account_filter')
        if account_filter:
            if account_filter == 'Revenue':
                where_conditions.append("a.account_name = 'Net Revenue'")
            elif account_filter == 'Cost':
                where_conditions.append("a.account_category = 'Cost'")
            elif account_filter == 'Operating':
                where_conditions.append("a.account_name IN ('EBITDA', 'EBIT')")
            elif account_filter == 'Net':
                where_conditions.append("a.account_name = 'Net Income'")

        where_clause = " AND ".join(where_conditions)

        # Build SQL using star schema with proper joins
        if query_intent['compare_years']:
            sql = f"""
                SELECT 
                    e.entity_name as entity,
                    d.department_name as department,
                    a.account_name as account,
                    t.period_name as month,
                    SUM(f.amount_fy24) as fy24_amount,
                    SUM(f.amount_fy25) as fy25_amount,
                    SUM(f.amount_fy25) - SUM(f.amount_fy24) as variance
                FROM fact_financials f
                JOIN dim_entity e ON f.entity_id = e.entity_id
                JOIN dim_department d ON f.department_id = d.department_id
                JOIN dim_account a ON f.account_id = a.account_id
                JOIN dim_time t ON f.time_id = t.time_id
                WHERE {where_clause}
                GROUP BY e.entity_name, d.department_name, a.account_name, t.period_name
                ORDER BY e.entity_name, fy25_amount DESC NULLS LAST
                LIMIT 100
            """
        elif query_intent['wants_breakdown']:
            value_col = "f.amount_fy24" if 'FY24' in query_intent.get(
                'years', ['FY25']) else "f.amount_fy25"
            sql = f"""
                SELECT 
                    e.entity_name as entity,
                    d.department_name as department,
                    a.account_name as account,
                    t.period_name as month,
                    SUM({value_col}) as total_amount
                FROM fact_financials f
                JOIN dim_entity e ON f.entity_id = e.entity_id
                JOIN dim_department d ON f.department_id = d.department_id
                JOIN dim_account a ON f.account_id = a.account_id
                JOIN dim_time t ON f.time_id = t.time_id
                WHERE {where_clause}
                GROUP BY e.entity_name, d.department_name, a.account_name, t.period_name
                ORDER BY total_amount DESC NULLS LAST
                LIMIT 100
            """
        else:
            # Summary query - single aggregated value
            value_col = "f.amount_fy24" if 'FY24' in query_intent.get(
                'years', ['FY25']) else "f.amount_fy25"
            year_label = query_intent['years'][0] if query_intent.get(
                'years') else 'FY25'
            month_label = query_intent['months'][0] if query_intent.get(
                'months') else 'Total'
            entity_list = query_intent.get('entity_values', [])
            entity_label = entity_list[0] if entity_list else 'Nemko Group'
            metric_label = account_filter if account_filter else 'Total'

            sql = f"""
                SELECT 
                    e.entity_name as entity,
                    t.period_name as period,
                    a.account_name as metric,
                    SUM({value_col}) as value,
                    COUNT(*) as record_count
                FROM fact_financials f
                JOIN dim_entity e ON f.entity_id = e.entity_id
                JOIN dim_department d ON f.department_id = d.department_id
                JOIN dim_account a ON f.account_id = a.account_id
                JOIN dim_time t ON f.time_id = t.time_id
                WHERE {where_clause}
                GROUP BY e.entity_name, t.period_name, a.account_name
                ORDER BY e.entity_name, value DESC NULLS LAST
                LIMIT 50
            """

        logger.info(f"Generated STAR SCHEMA SQL with {len(params)} params")
        return {
            'success': True,
            'sql': sql,
            'params': params,
            'calculation_type': 'nemko_star_schema'
        }

    def _compile_nemko_sql_legacy(self,
                                  calculation_name: str,
                                  intent: Dict[str, Any],
                                  domain: str = None) -> Dict[str, Any]:
        """
        LEGACY: Original Nemko SQL builder - kept for reference.
        """
        calc_lower = calculation_name.lower()
        original_query = intent.get('original_query', calculation_name).lower()

        nemko_keywords = [
            'revenue', 'sales', 'turnover', 'gross profit', 'gross margin',
            'operating profit', 'operating income', 'ebit', 'ebitda',
            'net income', 'net profit', 'profit after tax', 'expenses',
            'costs', 'cost of sales', 'p&l', 'profit and loss',
            'income statement', 'total'
        ]

        is_nemko_query = any(kw in calc_lower for kw in nemko_keywords)

        if not is_nemko_query:
            return {
                'success': False,
                'error': 'Not a recognized Nemko P&L query'
            }

        filters = intent.get('filters', [])
        nemko_pl_cube_id = '663678fc-a902-42d7-8c57-dd40a24e130a'
        where_parts = [f"cube_id = '{nemko_pl_cube_id}'"]
        params = []
        entity_filter = None
        month_filter = None
        year_filter = 'FY24'

        for fil in filters:
            col = fil.get('column', '').lower()
            val = str(fil.get('value', ''))

            # Year filter
            if 'year' in col or 'fy' in col:
                if '25' in val:
                    year_filter = 'FY25'
                elif '24' in val:
                    year_filter = 'FY24'

            # Entity/subsidiary filter - look for E-codes or entity names
            if 'entity' in col or 'subsidiary' in col or 'location' in col:
                entity_filter = val

            # Month filter
            if 'month' in col or 'period' in col:
                month_filter = val

        # Also detect entity from calculation name (e.g., "e16 total revenue")
        entity_patterns = [
            'e16', 'e10', 'e27', 'e33', 'e34', 'e48', 'e50', 'e51', 'e21',
            'e18', 'e1 ', 'e0 '
        ]
        for pattern in entity_patterns:
            if pattern in calc_lower:
                entity_filter = pattern.strip().upper()
                break

        # Detect month(s) from ORIGINAL QUERY (not calc_lower which may be "Revenue Summary")
        import re
        month_names = {
            'jan': 'Jan',
            'feb': 'Feb',
            'mar': 'Mar',
            'apr': 'Apr',
            'may': 'May',
            'jun': 'Jun',
            'jul': 'Jul',
            'aug': 'Aug',
            'sep': 'Sep',
            'oct': 'Oct',
            'nov': 'Nov',
            'dec': 'Dec',
            'january': 'Jan',
            'february': 'Feb',
            'march': 'Mar',
            'april': 'Apr',
            'june': 'Jun',
            'july': 'Jul',
            'august': 'Aug',
            'september': 'Sep',
            'october': 'Oct',
            'november': 'Nov',
            'december': 'Dec'
        }

        # Detect ALL months mentioned (for comparison queries like "jan and feb")
        detected_months = []
        for month_key, month_val in month_names.items():
            # Use word boundary to avoid matching "mar" in "departmenrs"
            # Search in original_query, not calc_lower
            if re.search(r'\b' + month_key + r'\b', original_query):
                if month_val not in detected_months:
                    detected_months.append(month_val)

        # Sort months in calendar order
        month_order = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
            'Oct', 'Nov', 'Dec'
        ]
        detected_months = sorted(detected_months,
                                 key=lambda m: month_order.index(m)
                                 if m in month_order else 99)

        # Set month_filter based on detected months
        if len(detected_months) == 1:
            month_filter = detected_months[0]
        elif len(detected_months) > 1:
            month_filter = detected_months  # List for multi-month comparisons

        # Also detect year from original query (2024 -> FY24, 2025 -> FY25)
        if '2024' in original_query or 'fy24' in original_query:
            year_filter = 'FY24'
        elif '2025' in original_query or 'fy25' in original_query:
            year_filter = 'FY25'

        # Ensure month_filter is a list if multiple months detected
        is_multi_month = isinstance(month_filter,
                                    list) and len(month_filter) > 1

        logger.info(
            f"Nemko query filters - entity: {entity_filter}, month: {month_filter}, is_multi_month: {is_multi_month}, year: {year_filter}"
        )

        # Apply entity filter to WHERE clause
        if entity_filter:
            where_parts.append(
                f"row_data->>'Values' ILIKE '%%{entity_filter}%%'")

        # Apply month filter to WHERE clause
        if month_filter:
            if is_multi_month:
                # Multiple months for comparison - use IN clause
                months_str = ", ".join([f"'{m}'" for m in month_filter])
                where_parts.append(
                    f"row_data->>'Unnamed: 3' IN ({months_str})")
            else:
                # Single month - extract from list if needed
                single_month = month_filter[0] if isinstance(
                    month_filter, list) else month_filter
                where_parts.append(
                    f"row_data->>'Unnamed: 3' = '{single_month}'")

        # Map year to JSONB value column key name (without quotes - we add them in SQL)
        value_key = 'Unnamed: 4' if year_filter == 'FY24' else 'Unnamed: 5'

        # Add account filter based on query type
        # NOTE: Use %% to escape % for psycopg2 parameter substitution
        account_filter = None
        if 'revenue' in calc_lower or 'sales' in calc_lower:
            account_filter = "Revenue"
            where_parts.append(
                "(row_data->>'Unnamed: 2' ILIKE '%%Revenue%%' OR row_data->>'Unnamed: 2' ILIKE '%%Sales%%')"
            )
        elif 'cost' in calc_lower or 'expense' in calc_lower:
            account_filter = "Cost"
            where_parts.append(
                "(row_data->>'Unnamed: 2' ILIKE '%%Cost%%' OR row_data->>'Unnamed: 2' ILIKE '%%Expense%%')"
            )
        elif 'ebit' in calc_lower or 'operating' in calc_lower:
            account_filter = "Operating"
            where_parts.append(
                "(row_data->>'Unnamed: 2' ILIKE '%%EBIT%%' OR row_data->>'Unnamed: 2' ILIKE '%%Operating%%')"
            )
        elif 'net income' in calc_lower or 'net profit' in calc_lower:
            account_filter = "Net"
            where_parts.append("row_data->>'Unnamed: 2' ILIKE '%%Net%%'")

        where_clause = " AND ".join(where_parts)

        # Check if user wants a BREAKDOWN (by subsidiary, by department, etc.)
        wants_breakdown = any(kw in original_query for kw in [
            'by subsidiary', 'by department', 'by entity', 'by location',
            'breakdown', 'compare'
        ])

        # Format month label properly for SQL (no Python list representation)
        if is_multi_month:
            month_label = f" for {' vs '.join(month_filter)}"  # e.g., "for Jan vs Feb"
        elif month_filter:
            single_month = month_filter[0] if isinstance(
                month_filter, list) else month_filter
            month_label = f" for {single_month}"
        else:
            month_label = ""

        if wants_breakdown:
            # User wants breakdown by subsidiary/department - include month for comparison
            sql = f"""
                SELECT 
                    row_data->>'Values' as subsidiary,
                    row_data->>'Unnamed: 1' as department,
                    row_data->>'Unnamed: 2' as account,
                    row_data->>'Unnamed: 3' as month,
                    SUM(NULLIF(row_data->>'{value_key}', '')::numeric) as total_amount,
                    COUNT(*) as row_count
                FROM cube_fact_data
                WHERE {where_clause}
                  AND row_data->>'Values' IS NOT NULL
                  AND row_data->>'Values' != 'Location'
                  AND NULLIF(row_data->>'{value_key}', '') IS NOT NULL
                GROUP BY 
                    row_data->>'Values',
                    row_data->>'Unnamed: 1',
                    row_data->>'Unnamed: 2',
                    row_data->>'Unnamed: 3'
                ORDER BY row_data->>'Values', row_data->>'Unnamed: 1', total_amount DESC
                LIMIT 200
            """
        elif entity_filter:
            # Specific entity query - aggregate for that entity
            entity_label = f"{entity_filter} Total"
            sql = f"""
                SELECT 
                    '{entity_label}' as entity,
                    '{year_filter}{month_label}' as fiscal_period,
                    '{account_filter or "All"}' as metric_type,
                    SUM(NULLIF(row_data->>'{value_key}', '')::numeric) as total_amount,
                    COUNT(*) as record_count
                FROM cube_fact_data
                WHERE {where_clause}
                  AND row_data->>'Values' IS NOT NULL
                  AND row_data->>'Values' != 'Location'
                  AND NULLIF(row_data->>'{value_key}', '') IS NOT NULL
            """
        else:
            # General query - return breakdown by location, department, account
            sql = f"""
                SELECT 
                    row_data->>'Values' as location,
                    row_data->>'Unnamed: 1' as department,
                    row_data->>'Unnamed: 2' as account,
                    SUM(NULLIF(row_data->>'{value_key}', '')::numeric) as total_amount,
                    COUNT(*) as row_count
                FROM cube_fact_data
                WHERE {where_clause}
                  AND row_data->>'Values' IS NOT NULL
                  AND row_data->>'Values' != 'Location'
                  AND NULLIF(row_data->>'{value_key}', '') IS NOT NULL
                GROUP BY 
                    row_data->>'Values',
                    row_data->>'Unnamed: 1',
                    row_data->>'Unnamed: 2'
                ORDER BY total_amount DESC
                LIMIT 100
            """

        logger.info(
            f"Generated Nemko JSONB P&L SQL for '{calculation_name}' (year={year_filter})"
        )
        return {
            'success': True,
            'sql': sql,
            'params': params,
            'calculation_type': f'nemko_{calc_lower.replace(" ", "_")}'
        }

    def _compile_nemko_data_sql(self,
                                intent: Dict[str, Any],
                                domain: str = None) -> Dict[str, Any]:
        """
        Compile SQL for Nemko data queries using cube_fact_data table.
        Uses data-driven entity resolution from cube_column_values and index-based column config.
        """
        import re
        original_query = intent.get('original_query', '').lower()
        nemko_pl_cube_id = '663678fc-a902-42d7-8c57-dd40a24e130a'

        # Load column config and entity aliases from database
        col_config = self._load_nemko_column_config(nemko_pl_cube_id)
        entity_alias_map = self._load_nemko_entity_values(nemko_pl_cube_id)

        # Get JSONB keys from config using column index
        subsidiary_key = col_config.get(0, {}).get('json_key', 'Values')
        month_key = col_config.get(3, {}).get('json_key', 'Unnamed: 3')
        account_key = col_config.get(2, {}).get('json_key', 'Unnamed: 2')
        fy24_key = col_config.get(4, {}).get('json_key', 'Unnamed: 4')
        fy25_key = col_config.get(5, {}).get('json_key', 'Unnamed: 5')

        # Parse query intent with data-driven entity matching
        query_intent = self._parse_nemko_query_intent(original_query,
                                                      entity_alias_map)
        logger.info(f"Nemko data query intent: {query_intent}")

        # Build parameterized WHERE clause
        where_parts = ["cube_id = %s"]
        params = [nemko_pl_cube_id]

        # Entity filter - prefer resolved entity_values
        # Use REPLACE to normalize non-breaking spaces (chr(160)) to regular spaces for matching
        entity_list = query_intent.get('entity_values') or query_intent.get(
            'entities', [])
        if entity_list:
            entity_placeholders = []
            for entity in entity_list:
                safe_entity = re.sub(r'[^\w\s()-]', '', str(entity))
                # Normalize non-breaking space (chr(160)) to regular space before ILIKE
                entity_placeholders.append(
                    f"REPLACE(row_data->>'{subsidiary_key}', chr(160), ' ') ILIKE %s"
                )
                params.append(f'%{safe_entity}%')
            if entity_placeholders:
                where_parts.append(f"({' OR '.join(entity_placeholders)})")

        # Month filter from parsed intent
        if query_intent['months']:
            if len(query_intent['months']) == 1:
                where_parts.append(f"row_data->>'{month_key}' = %s")
                params.append(query_intent['months'][0])
            else:
                placeholders = ', '.join(['%s'] * len(query_intent['months']))
                where_parts.append(
                    f"row_data->>'{month_key}' IN ({placeholders})")
                params.extend(query_intent['months'])
        else:
            # Default to 'Total' for yearly aggregates
            where_parts.append(f"row_data->>'{month_key}' = %s")
            params.append('Total')

        # Account filter
        if query_intent['account_filter']:
            acc = query_intent['account_filter']
            if acc == 'Revenue':
                where_parts.append(
                    f"(row_data->>'{account_key}' ILIKE %s OR row_data->>'{account_key}' ILIKE %s)"
                )
                params.extend(['%Revenue%', '%Sales%'])
            elif acc == 'Cost':
                where_parts.append(
                    f"(row_data->>'{account_key}' ILIKE %s OR row_data->>'{account_key}' ILIKE %s)"
                )
                params.extend(['%Cost%', '%Expense%'])

        # Determine value column based on year
        value_key = fy24_key if 'FY24' in query_intent['years'] else fy25_key
        year_label = query_intent['years'][0] if query_intent[
            'years'] else 'FY24'

        # Get department key from config
        department_key = col_config.get(1, {}).get('json_key', 'Unnamed: 1')

        where_clause = " AND ".join(where_parts)

        # Build the SQL query using config-loaded JSONB keys
        sql = f"""
            SELECT 
                row_data->>'{subsidiary_key}' as location,
                row_data->>'{department_key}' as department,
                row_data->>'{account_key}' as account,
                row_data->>'{month_key}' as month,
                SUM(NULLIF(row_data->>'{value_key}', '')::numeric) as total_amount,
                COUNT(*) as row_count
            FROM cube_fact_data
            WHERE {where_clause}
              AND row_data->>'{subsidiary_key}' IS NOT NULL
              AND row_data->>'{subsidiary_key}' != 'Location'
              AND NULLIF(row_data->>'{value_key}', '') IS NOT NULL
            GROUP BY 
                row_data->>'{subsidiary_key}',
                row_data->>'{department_key}',
                row_data->>'{account_key}',
                row_data->>'{month_key}'
            ORDER BY total_amount DESC
            LIMIT 100
        """

        logger.info(
            f"Generated Nemko JSONB data SQL for year={year_label}, months={query_intent['months']}, entities={entity_list}"
        )
        return {
            'success': True,
            'sql': sql,
            'params': params,
            'calculation_type': 'nemko_jsonb_query'
        }

    # ==================== END NEMKO P&L SQL BUILDERS ====================

    def _compile_multi_metric_sql(
        self,
        metric_ids: List[str],
        cube_id: str,
        intent: Dict[str, Any],
        domain: str = None,
    ) -> Dict[str, Any]:
        """
        Run each metric builder independently (with its own intent copy) then
        merge the result rows on shared dimension columns (region_entity, month,
        year, etc.).  If any builder fails, its column is silently omitted so
        the rest of the results still surface.
        """
        import copy, time
        start = time.time()
        all_results: List[Dict[str, Any]] = []
        sql_queries: List[str] = []
        failed: List[str] = []

        _MONTH_STR_TO_INT = {
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
            'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
            'january': 1, 'february': 2, 'march': 3, 'april': 4,
            'june': 6, 'july': 7, 'august': 8, 'september': 9,
            'october': 10, 'november': 11, 'december': 12,
        }

        def _normalize_month(val):
            if isinstance(val, str):
                return _MONTH_STR_TO_INT.get(val.lower().strip(), val)
            return val

        for metric_id in metric_ids:
            metric_intent = copy.deepcopy(intent)
            metric_intent['use_calculation'] = metric_id

            # Normalize month: LLM sometimes returns 'Jan' (string) instead of 1 (int)
            if 'month' in metric_intent:
                metric_intent['month'] = _normalize_month(metric_intent['month'])
            for f in metric_intent.get('filters', []):
                if f.get('column') == 'month':
                    f['value'] = _normalize_month(f.get('value'))

            try:
                compile_result = self.compile_calculation_sql(metric_id, cube_id, metric_intent, domain)
                if not compile_result.get('success'):
                    logger.warning(f"[MULTI-METRIC] compile failed for '{metric_id}': {compile_result.get('error')}")
                    failed.append(metric_id)
                    continue
                sql = compile_result.get('sql') or compile_result.get('sql_query', '')
                params = compile_result.get('params', [])
                if not sql:
                    logger.warning(f"[MULTI-METRIC] No SQL generated for '{metric_id}'")
                    failed.append(metric_id)
                    continue
                exec_result = self.execute_query(sql, params, cube_id, user_id='system', skip_logging=True)
                if exec_result.get('success') and exec_result.get('results') is not None:
                    all_results.append({'metric_id': metric_id, 'rows': exec_result['results']})
                    sql_queries.append(f"-- {metric_id}\n{sql}")
                else:
                    logger.warning(f"[MULTI-METRIC] execute failed for '{metric_id}': {exec_result.get('error')}")
                    failed.append(metric_id)
            except Exception as e:
                logger.warning(f"[MULTI-METRIC] Exception for '{metric_id}': {e}")
                failed.append(metric_id)

        if not all_results:
            return {
                'success': False,
                'error': f"All metric builders failed: {metric_ids}",
                'use_rag': True,
            }

        # ── Merge rows on shared dimension keys ───────────────────────────────
        # Dimension columns are non-numeric keys.  We use the first result's
        # column set to detect them, then join subsequent results on those keys.
        KNOWN_DIMENSION_KEYS = {
            'region_entity', 'month', 'year', 'sector', 'salary_level',
            'project_gb', 'planning_gb', 'resource_type', 'onsite_offshore',
            'new_service_area', 'service_area', 'employee_number', 'employee_name',
        }

        def _dim_keys(rows: List[Dict]) -> List[str]:
            if not rows:
                return []
            return [k for k in rows[0].keys() if k in KNOWN_DIMENSION_KEYS]

        # Build merged dict keyed by frozenset of dim-key values
        merged: Dict[tuple, Dict[str, Any]] = {}

        for entry in all_results:
            rows = entry['rows']
            if not rows:
                continue
            dim_keys = _dim_keys(rows)
            for row in rows:
                key = tuple(row.get(k) for k in dim_keys) if dim_keys else ('__total__',)
                if key not in merged:
                    merged[key] = {k: row[k] for k in dim_keys} if dim_keys else {}
                # Add all non-dimension columns from this row
                for col, val in row.items():
                    if col not in KNOWN_DIMENSION_KEYS:
                        merged[key][col] = val

        merged_rows = list(merged.values())
        all_columns = list(merged_rows[0].keys()) if merged_rows else []

        elapsed_ms = int((time.time() - start) * 1000)
        logger.info(
            f"[MULTI-METRIC] Merged {len(metric_ids)} metrics → {len(merged_rows)} rows "
            f"in {elapsed_ms}ms. Failed: {failed}"
        )

        return {
            'success': True,
            'results': merged_rows,
            'row_count': len(merged_rows),
            'columns': all_columns,
            'sql_query': '\n\n'.join(sql_queries),
            'execution_ms': elapsed_ms,
            'currency': intent.get('currency', 'usd'),
            'calculation_type': 'multi_metric',
        }

    def compile_sql(self,
                    intent: Dict[str, Any],
                    cube_id: str,
                    domain_id: str = None,
                    domain: str = None) -> Dict[str, Any]:
        """
        Compile structured intent into safe, parameterized SQL.
        Uses dynamic column configuration from cube_column_config when available.
        
        Args:
            intent: Structured query intent
            cube_id: Cube ID for filtering
            domain_id: Domain ID (for logging)
            domain: Domain name (e.g., 'in.bosch.com', 'nemko.com') for multi-tenant routing
        """
        try:
            # Check if this is a Nemko domain - route to Nemko-specific tables
            is_nemko = is_nemko_domain(domain) if domain else False
            # CASE-INSENSITIVE: Normalize use_calculation to lowercase for consistent matching
            use_calculation = intent.get('use_calculation', '').lower()

            logger.info(
                f"compile_sql: domain='{domain}', is_nemko={is_nemko}, use_calculation='{use_calculation}'"
            )

            # ----------------------------------------------------------------
            # CURRENCY PROPAGATION: detect INR/USD from original query early
            # so ALL downstream metric builders receive the correct amt_col.
            # This covers EBIT, direct cost, gross margin, budget KPIs, etc.
            # ----------------------------------------------------------------
            if not is_nemko:
                _orig_q = intent.get('original_query', '')
                if _orig_q and 'currency' not in intent:
                    _detected_currency = detect_currency(_orig_q)
                    intent['currency'] = _detected_currency
                    if _detected_currency == 'inr':
                        logger.info(
                            f"Currency propagation: detected INR from query, setting intent['currency']='inr'"
                        )

            if is_nemko:
                # If use_calculation is specified, try _compile_nemko_sql first for P&L calculations
                if use_calculation:
                    nemko_calc_result = self._compile_nemko_sql(
                        use_calculation, intent, domain)
                    if nemko_calc_result.get('success'):
                        return nemko_calc_result

                # For general data queries (no specific calculation), use _compile_nemko_data_sql
                nemko_result = self._compile_nemko_data_sql(intent, domain)
                if nemko_result.get('success'):
                    return nemko_result
                # If Nemko-specific doesn't handle it, fall through to RAG
                logger.info(
                    f"Nemko domain query not handled by SQL builder, will use RAG"
                )

            # ================================================================
            # GB P&L SUMMARY FAST PATH
            # Handles "summarise GB P&L", "GB P&L overview", "GB P&L report", etc.
            # Fires before EBIT so the summary builder wins when both keywords appear.
            # ================================================================
            _calc_type = intent.get('calculation_type', '')
            if _calc_type == 'gb_pl_summary':
                logger.info("compile_sql: GB P&L Summary fast path")
                return self._build_gb_pl_summary_sql(intent, cube_id)

            # ================================================================
            # ENTITY P&L EBIT FAST PATH
            # Handles "ebit by entity p&l" / "ebit% by entity p&l" queries.
            # Must fire BEFORE LLM routing so 'ebit' doesn't get hijacked by
            # the regular Bosch EBIT Percentage builder.
            # ================================================================
            _epl_ebit_type = intent.get('calculation_type', '')
            if _epl_ebit_type in ('entity_pl_ebit', 'entity_pl_ebit_pct'):
                logger.info(
                    f"compile_sql: Entity P&L EBIT fast path, calc_type='{_epl_ebit_type}'"
                )
                return self._build_entity_pl_ebit_sql(intent, cube_id)

            # ================================================================
            # MULTI-METRIC DISPATCH
            # When intent carries multi_metric_calcs (set by intent parser when 2+
            # distinct calculations are detected), run each metric independently
            # via _compile_multi_metric_sql and merge their results.
            # This must fire BEFORE the single-calc use_calculation dispatch.
            # Fallback: detect from original_query in case multi_metric_calcs was
            # dropped during the Node.js intent round-trip.
            # ================================================================
            _multi_calcs = intent.get('multi_metric_calcs', [])
            if not _multi_calcs and not is_nemko:
                _orig_q = intent.get('original_query', '')
                if _orig_q:
                    _all_m = self.get_matching_calculation(
                        _orig_q, {'calculations': []}, return_all=True)
                    _all_names = list(dict.fromkeys(
                        c.get('calculation_name', '')
                        for c in _all_m if c.get('calculation_name')
                    ))
                    if len(_all_names) > 1:
                        logger.info(
                            f"compile_sql: fallback multi-metric detection "
                            f"from original_query → {_all_names}")
                        _multi_calcs = _all_names
            if _multi_calcs and len(_multi_calcs) > 1:
                metric_ids = [c.lower().replace(' ', '_') for c in _multi_calcs]
                logger.info(
                    f"compile_sql: multi_metric_calcs dispatch → {metric_ids}")
                return self._compile_multi_metric_sql(
                    metric_ids, cube_id, intent, domain)

            # ================================================================
            # USE_CALCULATION PRE-SET DISPATCH
            # If a fast-path sub-path already set use_calculation in the intent
            # (e.g. 'gb p&l revenue', 'gb p&l gross margin', 'gb p&l total direct cost',
            # 'gb p&l corporate cost'), dispatch directly to compile_calculation_sql.
            # This MUST fire before the Revenue/LLM fast-paths so that the word
            # 'revenue' in "gb P&L revenue" doesn't hijack to _build_revenue_sql.
            # ================================================================
            _pre_use_calc = intent.get('use_calculation', '')
            if _pre_use_calc:
                logger.info(
                    f"compile_sql: use_calculation='{_pre_use_calc}' pre-set in intent, "
                    f"dispatching directly to compile_calculation_sql (bypassing LLM routing)"
                )
                return self.compile_calculation_sql(
                    _pre_use_calc, cube_id, intent, domain)

            # ================================================================
            # COST CLASS FAST PATH - skip LLM routing if intent has cost_category_class filter
            # This means the query was already handled by _build_cost_class_intent
            # ================================================================
            has_cost_class_filter = any(
                f.get('column') in ('cost_category_class', 'entity_category')
                for f in intent.get('filters', [])) or any(
                    col in ('entity_sub_category', 'entity_category')
                    for col in intent.get('group_by', []))

            # ================================================================
            # LLM-POWERED METRIC ROUTING (New System)
            # Try LLM parsing first for Bosch domain queries
            # Falls back to keyword matching if LLM fails or has low confidence
            # ================================================================
            original_query = intent.get('original_query', '')
            if original_query and not is_nemko and not has_cost_class_filter:
                # ----------------------------------------------------------------
                # REVENUE FAST-PATH: detect "revenue" keyword before LLM routing.
                # Prevents the LLM from confusing plain revenue queries with the
                # budget_total_ww WW KPI metric.
                # Also handles INR vs USD currency selection.
                # ----------------------------------------------------------------
                _q_lower = original_query.lower()
                _is_revenue_query = bool(
                    re.search(r'\brevenue\b', _q_lower)
                ) and not any(kw in _q_lower for kw in [
                    'worldwide budget', 'ww budget', 'global budget',
                    'budget musd worldwide', 'ww budget total'
                ])
                if _is_revenue_query:
                    _currency = detect_currency(original_query)
                    intent['currency'] = _currency
                    # Quarter detection: Q1→month IN(1,2,3), Q2→(4,5,6), etc.
                    _rev_quarter_map = {
                        'q1': [1,2,3], 'q2': [4,5,6],
                        'q3': [7,8,9], 'q4': [10,11,12]
                    }
                    for _q, _qmonths in _rev_quarter_map.items():
                        if _q in _q_lower:
                            if 'filters' not in intent:
                                intent['filters'] = []
                            intent['filters'] = [
                                f for f in intent['filters']
                                if f.get('column') != 'month'
                            ]
                            intent['filters'].append({
                                'column': 'month',
                                'operator': 'IN',
                                'value': _qmonths
                            })
                            if 'group_by' not in intent:
                                intent['group_by'] = []
                            if 'month' not in intent['group_by']:
                                intent['group_by'] = ['month'] + intent['group_by']
                            break
                    logger.info(
                        f"Revenue fast-path: currency={_currency}, bypassing LLM routing"
                    )
                    return self.compile_calculation_sql(
                        'revenue', cube_id, intent, domain)

                # ----------------------------------------------------------------
                # BUDGET FAST-PATH: entity-level "budget musd/inr" queries are
                # the same metric as revenue (amount_usd / Revenue Summary).
                # Prevents LLM from routing "budget musd" to budget_total_ww
                # (which is worldwide-only and returns 0 rows for entity filters).
                # Excludes: worldwide/WW/global budget, vs-actual comparisons,
                # and plan/forecast data queries — those use their own paths.
                # ----------------------------------------------------------------
                _is_budget_query = bool(
                    re.search(r'\bbudget\b', _q_lower)
                ) and not any(kw in _q_lower for kw in [
                    'worldwide budget', 'ww budget', 'global budget',
                    'budget musd worldwide', 'ww budget total',
                    'vs actual', 'actual vs', 'vs plan', 'plan vs',
                    'budget plan', 'budget forecast', 'forecast budget',
                    'budget per avg', 'budget per average', 'budget per cap',
                    'per avg capacity', 'per average capacity', 'budget/avg',
                    'budget / avg', 'budget per head'
                ])
                if _is_budget_query:
                    _currency = detect_currency(original_query)
                    intent['currency'] = _currency
                    # Quarter detection — same as revenue fast-path
                    _bgt_quarter_map = {
                        'q1': [1,2,3], 'q2': [4,5,6],
                        'q3': [7,8,9], 'q4': [10,11,12]
                    }
                    for _q, _qmonths in _bgt_quarter_map.items():
                        if _q in _q_lower:
                            if 'filters' not in intent:
                                intent['filters'] = []
                            intent['filters'] = [
                                f for f in intent['filters']
                                if f.get('column') != 'month'
                            ]
                            intent['filters'].append({
                                'column': 'month',
                                'operator': 'IN',
                                'value': _qmonths
                            })
                            if 'group_by' not in intent:
                                intent['group_by'] = []
                            if 'month' not in intent['group_by']:
                                intent['group_by'] = ['month'] + intent['group_by']
                            break
                    logger.info(
                        f"Budget fast-path: treating as revenue query, currency={_currency}, bypassing LLM routing"
                    )
                    return self.compile_calculation_sql(
                        'revenue', cube_id, intent, domain)

                # ----------------------------------------------------------------
                # COST TYPE FAST-PATH: route well-known cost keywords directly
                # to their hardcoded builders, bypassing the LLM entirely.
                # This prevents misclassification and improves reliability for
                # corporate cost, resource cost, travel cost, etc.
                # ----------------------------------------------------------------
                _cost_keyword_map = [
                    (['corporate cost', 'corporate costs', 'indirect cost', 'indirect expense', 'indirect expenses'], 'indirect cost'),
                    (['resource cost', 'resource costs', 'resource expense', 'resource expenses'], 'resource cost'),
                    (['travel cost', 'travel costs', 'travel expense', 'travel expenses'], 'travel cost'),
                    (['other direct cost', 'other direct costs', 'other direct expense', 'other direct expenses'], 'other direct cost'),
                    (['direct cost', 'direct costs', 'total direct cost', 'total direct costs'], 'direct cost'),
                    (['gross margin', 'gross profit', 'gross_margin'], 'gross margin'),
                    (['ebit', 'earnings before', 'ebit%', 'ebit percentage'], 'ebit'),
                ]
                _matched_cost_metric = None
                for _keywords, _metric in _cost_keyword_map:
                    if any(kw in _q_lower for kw in _keywords):
                        _matched_cost_metric = _metric
                        break
                if _matched_cost_metric:
                    logger.info(
                        f"Cost type fast-path: detected '{_matched_cost_metric}' from query, bypassing LLM routing"
                    )
                    # Strip new_service_area and entity_category filters — they don't belong
                    # in Cost Summary queries and cause false-positive filtering
                    # (e.g. "corporate" in "corporate cost" → new_service_area=CORPORATE).
                    _strip_cols = {'new_service_area', 'new service area', 'entity_category', 'entity category'}
                    if 'filters' in intent:
                        _before = len(intent['filters'])
                        intent['filters'] = [
                            f for f in intent['filters']
                            if f.get('column', '').lower() not in _strip_cols
                        ]
                        if len(intent['filters']) < _before:
                            logger.info(
                                f"Cost type fast-path: stripped {_before - len(intent['filters'])} "
                                f"new_service_area/entity_category filter(s) from cost query"
                            )
                    return self.compile_calculation_sql(
                        _matched_cost_metric, cube_id, intent, domain)

                try:
                    llm_result = parse_query_with_llm(
                        original_query)

                    if llm_result.get('success') and llm_result.get(
                            'confidence', 0) >= 0.7:
                        # Support both "metrics": [...] (new) and "metric": "..." (legacy)
                        metric_ids_llm = llm_result.get('metrics') or []
                        if not metric_ids_llm and llm_result.get('metric'):
                            metric_ids_llm = [llm_result['metric']]
                        metric_ids_llm = [m for m in metric_ids_llm if m]
                        metric_id = metric_ids_llm[0] if metric_ids_llm else None
                        builder_name = llm_result.get('builder')

                        logger.info(
                            f"LLM routing: metrics={metric_ids_llm}, confidence={llm_result.get('confidence')}, builder={builder_name}"
                        )

                        # Update intent with LLM-parsed values
                        if llm_result.get('year'):
                            intent['year'] = llm_result['year']
                        if llm_result.get('month') is not None:
                            _llm_month = llm_result['month']
                            # Preserve existing multi-month IN filter — don't let LLM single-month
                            # result override an already-expanded month list from the orchestrator
                            _existing_month_f = [
                                f for f in intent.get('filters', [])
                                if (f.get('column') or '').lower() == 'month'
                            ]
                            _already_multi = (
                                _existing_month_f
                                and _existing_month_f[0].get('operator') == 'IN'
                                and isinstance(_existing_month_f[0].get('value'), list)
                                and len(_existing_month_f[0].get('value', [])) > 1
                            )
                            if _already_multi:
                                logger.info(
                                    f"Preserving existing multi-month IN filter over LLM single-month result (month={_llm_month})"
                                )
                            else:
                                intent['month'] = _llm_month
                                # Also push into filters array (the WHERE clause uses filters)
                                if 'filters' not in intent:
                                    intent['filters'] = []
                                intent['filters'] = [
                                    f for f in intent['filters']
                                    if (f.get('column') or '').lower() != 'month'
                                ]
                                if isinstance(_llm_month, list) and len(_llm_month) > 1:
                                    intent['filters'].append({
                                        'column': 'month', 'operator': 'IN', 'value': _llm_month
                                    })
                                    grp = intent.get('group_by', [])
                                    if 'month' not in grp:
                                        intent['group_by'] = ['month'] + grp
                                elif isinstance(_llm_month, list) and len(_llm_month) == 1:
                                    intent['filters'].append({
                                        'column': 'month', 'operator': '=', 'value': _llm_month[0]
                                    })
                                elif isinstance(_llm_month, int):
                                    intent['filters'].append({
                                        'column': 'month', 'operator': '=', 'value': _llm_month
                                    })
                        # Always re-run month range expansion to catch "jan to mar" patterns
                        intent = self._expand_month_range_from_query(intent, original_query)
                        _has_multi_month = any(
                            f.get('column', '').lower() == 'month' and f.get('operator') == 'IN'
                            for f in intent.get('filters', [])
                        )
                        if llm_result.get('group_by'):
                            intent['group_by'] = llm_result['group_by']
                        # Re-add 'month' to group_by if multi-month was detected
                        if _has_multi_month and 'month' not in intent.get('group_by', []):
                            intent['group_by'] = ['month'] + intent.get('group_by', ['region_entity'])
                        if llm_result.get('filters'):
                            if 'filters' not in intent:
                                intent['filters'] = []
                            existing_cols = {
                                f.get('column')
                                for f in intent['filters']
                            }
                            for col, val in llm_result['filters'].items():
                                if col == 'region_entity' and isinstance(
                                        val, str):
                                    val = val.upper()
                                if col not in existing_cols:
                                    intent['filters'].append({
                                        'column': col,
                                        'value': val
                                    })

                        # Set primary use_calculation from first metric (backward compat)
                        intent['use_calculation'] = metric_id
                        use_calculation = metric_id

                        # ── Multi-metric: run each builder then merge ──────────
                        if len(metric_ids_llm) > 1:
                            logger.info(
                                f"[MULTI-METRIC] Detected {len(metric_ids_llm)} metrics: {metric_ids_llm}"
                            )
                            return self._compile_multi_metric_sql(
                                metric_ids_llm, cube_id, intent, domain)

                        # Single metric: existing path unchanged
                        return self.compile_calculation_sql(
                            metric_id, cube_id, intent, domain)
                    else:
                        logger.info(
                            f"LLM parsing: low confidence or failed, falling back to keyword matching. Result: {llm_result}"
                        )
                except Exception as llm_error:
                    logger.warning(
                        f"LLM parsing error, falling back to keyword matching: {llm_error}"
                    )

            # ================================================================
            # LEGACY KEYWORD MATCHING (Fallback)
            # Used when LLM is unavailable or has low confidence
            # ================================================================
            if use_calculation:
                calc_lower = use_calculation.lower()
                # List of all supported KPI calculation keywords
                # For Bosch, these trigger hardcoded SQL builders
                # For Nemko, these first check DB for custom rules, then fall back to RAG
                kpi_keywords = [
                    'ebit',
                    'billing utilization',
                    'utilization',
                    'price mix',
                    'attrition',
                    'pyramid',
                    'internal capacity mix',
                    'internal mix',
                    'external capacity mix',
                    'external mix',
                    'outsourcing mix',
                    'budget per capacity',
                    'capacity mix',
                    # New WW KPIs
                    'budget offshore',
                    'offshore budget',
                    'budget outsourcing',
                    'outsourcing budget',
                    'total capacity avg',
                    'total capacity end',
                    'total capacity',       # bare → defaults to end
                    'offshore capacity avg',
                    'offshore capacity end',
                    'offshore capacity',    # bare → defaults to end
                    'outsourcing capacity avg',
                    'outsourcing capacity end',
                    'outsourcing capacity', # bare → defaults to end
                    'offshore mix',         # → external capacity mix
                    'p&l revenue',          # bare → defaults to GB P&L revenue
                    'p&l cost',             # bare → defaults to GB P&L cost
                    # Alternate word orders for capacity KPIs (database uses 'X End Capacity' format)
                    'offshore end capacity',
                    'outsourcing end capacity',
                    'total end capacity',
                    'offshore avg capacity',
                    'outsourcing avg capacity',
                    'total avg capacity',
                    'budget per avg capacity',
                    'budget per avg capacity entity',
                    'budget avg capacity',
                    'budget/avg capacity',
                    'budget/ avg capacity',
                    # Available Capacity - uses correct formula with M/S, VKM, Non-Linear
                    'available capacity',
                    'availability capacity',
                    'available cap',
                    # Revenue KPIs
                    'revenue',
                    'revenue in millions',
                    'revenue mtd',
                    'revenue summary',
                    # Cost breakdown metrics
                    'travel cost',
                    'direct cost',
                    'indirect cost',
                    'corporate cost',
                    'gross margin',
                    'gross profit',
                    'resource cost',
                    'other direct cost'
                ]

                # Route to calculation SQL builder - it handles domain-awareness internally
                # For Nemko: checks DB first, falls back to RAG if no rule found
                # For Bosch: uses hardcoded builders
                if any(kw in calc_lower for kw in kpi_keywords):
                    return self.compile_calculation_sql(
                        use_calculation, cube_id, intent, domain)

            # Get dynamic column lists from schema config
            metric_columns = []
            dimension_columns = []
            column_mappings = {}
            using_dynamic_config = False

            if SCHEMA_CONTEXT_AVAILABLE:
                try:
                    # Get dynamic metrics from schema config (these ARE the DB column names now)
                    dynamic_metrics = schema_context_builder.get_metric_columns(
                        cube_id)
                    if dynamic_metrics:
                        metric_columns = [
                            m['original_name'] for m in dynamic_metrics
                        ]
                        logger.info(
                            f"Using {len(metric_columns)} dynamic metric columns from schema config"
                        )
                        using_dynamic_config = True

                    # Get dynamic dimensions from schema config
                    dynamic_dimensions = schema_context_builder.get_dimension_columns(
                        cube_id)
                    if dynamic_dimensions:
                        dimension_columns = [
                            d['original_name'] for d in dynamic_dimensions
                        ]
                        logger.info(
                            f"Using {len(dimension_columns)} dynamic dimension columns from schema config"
                        )
                        using_dynamic_config = True

                    # Get alias mappings (display_name/aliases -> original_name which IS the DB column)
                    column_mappings = schema_context_builder.get_column_mappings(
                        cube_id)

                except Exception as e:
                    logger.warning(
                        f"Could not load dynamic columns, using defaults: {e}")

            # Fallback to hardcoded if no dynamic config
            if not using_dynamic_config:
                metric_columns = METRIC_COLUMNS
                dimension_columns = DIMENSION_COLUMNS
                # Build column_mappings from COLUMN_MAPPING for fallback
                for excel_name, db_name in COLUMN_MAPPING.items():
                    column_mappings[excel_name.lower()] = db_name
                    column_mappings[db_name.lower()] = db_name

            # Start building query
            select_parts = []
            params = [cube_id]

            # Handle metrics with aggregations
            for metric in intent.get('metrics', []):
                col = metric.get('name', '')
                agg = metric.get('aggregation', 'SUM').upper()

                # Resolve alias/display name to actual DB column name
                db_col = column_mappings.get(col.lower())
                if not db_col:
                    # Try as-is (might already be a db column name)
                    db_col = col if col in metric_columns else None

                if not db_col:
                    return {
                        'success': False,
                        'error': f"Invalid metric: {col}"
                    }

                # Validate column name against dynamic list
                if db_col not in metric_columns:
                    return {
                        'success': False,
                        'error': f"Invalid metric: {col}"
                    }

                if agg not in ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX']:
                    return {
                        'success': False,
                        'error': f"Invalid aggregation: {agg}"
                    }

                select_parts.append(
                    f"{agg}({db_col}) as {db_col}_{agg.lower()}")

            # Handle group by columns
            group_by = intent.get('group_by', [])
            resolved_group_by = []

            # Extract cost_category from filters for column fallback logic
            detected_cost_category = None
            for filter_item in intent.get('filters', []):
                if filter_item.get('column', '').lower() == 'cost_category':
                    val = filter_item.get('value', '')
                    # Extract category name from pattern like '%GB Wise END Capacity%'
                    detected_cost_category = val.strip('%') if isinstance(
                        val, str) else val
                    break

            for col in group_by:
                # Resolve alias/display name to actual DB column name
                db_col = column_mappings.get(col.lower())
                if not db_col:
                    db_col = col if col in dimension_columns else None

                if db_col and db_col in dimension_columns:
                    # Apply column fallback if the column is not available for the cost category
                    if detected_cost_category:
                        db_col = get_column_for_cost_category(
                            db_col, detected_cost_category)

                    select_parts.insert(0, db_col)
                    resolved_group_by.append(db_col)

            # Build SELECT clause
            if not select_parts:
                select_parts = ['COUNT(*) as row_count']

            sql = f"SELECT {', '.join(select_parts)} FROM cube_fact_data WHERE cube_id = %s"

            # Handle filters with alias resolution
            for filter_item in intent.get('filters', []):
                col = filter_item.get('column', '')
                op = filter_item.get('operator', '=')
                val = filter_item.get('value')

                # Resolve alias/display name to actual DB column name
                db_col = column_mappings.get(col.lower())
                if not db_col:
                    # Try as-is if it's a valid column
                    db_col = col if (col in dimension_columns
                                     or col in metric_columns) else None

                if not db_col:
                    continue  # Skip invalid columns in filters

                # Validate operator - include ILIKE for fuzzy text matching and NOT IN
                if op not in [
                        '=', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN',
                        'LIKE', 'ILIKE'
                ]:
                    op = '='

                # entity_category has trailing spaces in some DB rows (e.g. 'Revenue Software ')
                # Always use TRIM() on the column side so the filter matches cleanly.
                _sql_col = f"TRIM({db_col})" if db_col == 'entity_category' else db_col

                if op == 'IN' and isinstance(val, list):
                    placeholders = ', '.join(['%s'] * len(val))
                    sql += f" AND {_sql_col} IN ({placeholders})"
                    clean_vals = [v.strip() if isinstance(v, str) else v for v in val] if db_col == 'entity_category' else val
                    params.extend(clean_vals)
                elif op == 'NOT IN' and isinstance(val, list):
                    placeholders = ', '.join(['%s'] * len(val))
                    sql += f" AND ({_sql_col} IS NULL OR {_sql_col} NOT IN ({placeholders}))"
                    clean_vals = [v.strip() if isinstance(v, str) else v for v in val] if db_col == 'entity_category' else val
                    params.extend(clean_vals)
                elif op in ['LIKE', 'ILIKE']:
                    # For text pattern matching, ensure value has wildcards
                    pattern_val = val if '%' in str(val) else f"%{val}%"
                    sql += f" AND {_sql_col} {op} %s"
                    params.append(pattern_val)
                elif isinstance(val, list):
                    # If value is a list but operator is not IN/NOT IN, use IN
                    placeholders = ', '.join(['%s'] * len(val))
                    sql += f" AND {_sql_col} IN ({placeholders})"
                    clean_vals = [v.strip() if isinstance(v, str) else v for v in val] if db_col == 'entity_category' else val
                    params.extend(clean_vals)
                else:
                    clean_val = val.strip() if (db_col == 'entity_category' and isinstance(val, str)) else val
                    sql += f" AND {_sql_col} {op} %s"
                    params.append(clean_val)

            # Add GROUP BY using resolved columns
            if resolved_group_by:
                sql += f" GROUP BY {', '.join(resolved_group_by)}"

            # Build a set of metric columns used in this query for ORDER BY alias resolution
            metrics_in_select = {}
            for metric in intent.get('metrics', []):
                col_name = metric.get('name', '')
                agg = metric.get('aggregation', 'SUM').upper()
                # Map to the alias we created in the SELECT clause
                alias = f"{col_name}_{agg.lower()}"
                metrics_in_select[col_name.lower()] = alias

            # Add ORDER BY with alias resolution
            order_by = intent.get('order_by')
            if order_by:
                col = order_by.get('column', '')
                direction = order_by.get('direction', 'DESC').upper()

                # Resolve alias/display name to actual DB column name (case-insensitive)
                db_col = column_mappings.get(col.lower())
                if not db_col:
                    db_col = get_column_mapping(col)
                if not db_col:
                    db_col = col

                # Check if this is a metric column - if so, use the aggregated alias
                if db_col.lower() in metrics_in_select:
                    order_col = metrics_in_select[db_col.lower()]
                elif db_col in resolved_group_by:
                    # Dimension column in GROUP BY - use directly
                    order_col = db_col
                elif '_sum' in db_col or '_avg' in db_col or '_count' in db_col:
                    # Already an alias
                    order_col = db_col
                else:
                    # Default to first GROUP BY column if available, otherwise skip
                    order_col = resolved_group_by[
                        0] if resolved_group_by else None

                if order_col:
                    if direction not in ['ASC', 'DESC']:
                        direction = 'DESC'
                    sql += f" ORDER BY {order_col} {direction}"

            # Add LIMIT
            limit = min(intent.get('limit', 100), 1000)  # Cap at 1000
            sql += f" LIMIT {limit}"

            return {'success': True, 'sql': sql, 'params': params}

        except Exception as e:
            logger.error(f"SQL compilation failed: {e}")
            return {'success': False, 'error': str(e)}

    def validate_cube_exists(self, cube_id: str) -> bool:
        """Check if a cube_id exists in the cubes table"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM cubes WHERE id = %s", (cube_id, ))
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            return result is not None
        except Exception as e:
            logger.error(f"Error checking cube existence: {e}")
            return False

    def execute_query(self,
                      sql: str,
                      params: List,
                      cube_id: str,
                      user_id: str,
                      skip_logging: bool = False) -> Dict[str, Any]:
        """
        Execute compiled SQL and return results
        """
        start_time = datetime.now()

        try:
            conn = self.get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            # If params is empty the SQL has all values embedded inline —
            # call execute without a second arg so psycopg2 doesn't scan for %s.
            if params:
                cursor.execute(sql, params)
            else:
                cursor.execute(sql)
            rows = cursor.fetchall()

            execution_ms = int(
                (datetime.now() - start_time).total_seconds() * 1000)

            # Store query job for audit (skip if cube doesn't exist or skip_logging is True)
            if not skip_logging:
                try:
                    cursor.execute(
                        """
                        INSERT INTO cube_query_jobs 
                        (cube_id, user_id, query_text, generated_sql, status, result_count, execution_ms, completed_at)
                        VALUES (%s, %s, %s, %s, 'completed', %s, %s, NOW())
                    """, (cube_id, user_id, sql, sql, len(rows), execution_ms))
                    conn.commit()
                except Exception as job_error:
                    logger.warning(f"Could not log query job: {job_error}")
                    conn.rollback()
            cursor.close()
            conn.close()

            # Convert to serializable format
            results = [dict(row) for row in rows]

            return {
                'success': True,
                'results': results,
                'row_count': len(results),
                'execution_ms': execution_ms
            }

        except Exception as e:
            import traceback
            logger.error(f"Query execution failed: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {'success': False, 'error': str(e)}

    def format_results(self,
                       results: List[Dict],
                       query_type: str = 'aggregation') -> Dict[str, Any]:
        """
        Format results into table, chart, and narrative formats
        Anti-hallucination: Detect and handle null/empty results properly
        """
        if not results:
            return {
                'table': [],
                'chart': None,
                'narrative': "No data found for the given query."
            }

        # ANTI-HALLUCINATION: Check if all values in the result are None/null
        # This happens when aggregate queries return rows with NULL values (no matching data)
        def is_all_nulls(row: Dict) -> bool:
            """Check if all numeric/aggregate values in a row are null"""
            for key, value in row.items():
                # Skip dimension columns (usually strings like region_entity)
                if isinstance(value, str) and value:
                    return False
                # Check if numeric values are non-null
                if value is not None and value != '':
                    if isinstance(value, (int, float)):
                        return False
                    # Try to parse string numbers
                    try:
                        float(str(value))
                        return False
                    except (ValueError, TypeError):
                        pass
            return True

        # If single row with all nulls, treat as no data
        if len(results) == 1 and is_all_nulls(results[0]):
            return {
                'table': [],
                'chart':
                None,
                'narrative':
                "No data found for the given query. The requested time period or filters may not have any matching records in the database."
            }

        # Filter out rows where all values are null
        filtered_results = [row for row in results if not is_all_nulls(row)]
        if not filtered_results:
            return {
                'table': [],
                'chart':
                None,
                'narrative':
                "No data found for the given query. The requested filters may not have any matching records in the database."
            }

        results = filtered_results

        # Table format
        table = results

        # Chart format (if applicable)
        chart = None
        if len(results) > 1 and len(results) <= 20:
            # Determine chart type based on data structure
            columns = list(results[0].keys())
            numeric_cols = [
                c for c in columns if isinstance(results[0].get(c), (
                    int, float)) and results[0].get(c) is not None
            ]
            string_cols = [c for c in columns if c not in numeric_cols]

            if string_cols and numeric_cols:
                chart = {
                    'type':
                    'bar',
                    'labels':
                    [str(row.get(string_cols[0], '')) for row in results],
                    'datasets': [
                        {
                            'label':
                            col,
                            'data':
                            [float(row.get(col, 0) or 0) for row in results]
                        } for col in numeric_cols[:3]  # Limit to 3 metrics
                    ]
                }

        # Generate narrative
        narrative = self._generate_narrative(results, query_type)

        return {'table': table, 'chart': chart, 'narrative': narrative}

    def _generate_narrative(self, results: List[Dict], query_type: str) -> str:
        """Generate a natural language summary of the results"""
        if not results:
            return "No data found."

        if len(results) == 1:
            row = results[0]
            parts = []
            for key, value in row.items():
                if value is not None:
                    if isinstance(value, float):
                        parts.append(
                            f"{key.replace('_', ' ').title()}: {value:,.2f}")
                    else:
                        parts.append(
                            f"{key.replace('_', ' ').title()}: {value}")
            return "Result: " + ", ".join(parts)

        # Multi-row summary
        return f"Found {len(results)} records matching your query."

    # ==================== PLAN DATA QUERY NAVIGATION ====================

    def detect_plan_data_query(self, query: str) -> Dict[str, Any]:
        """
        Detect if query is for plan data (cube_plan_data) based on keywords.
        Returns plan context including plan_type filters if detected.
        
        Plan data keywords:
        - Plan types: TBP, CF02, CF05, CF09, CF11, YTD Forecast, Budget Forecast
        - Comparison: vs actual, actual vs, plan vs, forecast vs
        - Plan metrics: budget, forecast, plan, target
        """
        query_lower = query.lower()

        # Detect year from query FIRST (needed for dynamic plan_type mapping)
        detected_year = None
        import re
        year_match = re.search(r'\b(20\d{2})\b', query)
        if year_match:
            detected_year = int(year_match.group(1))

        # Plan type base keywords (year will be appended dynamically)
        plan_type_base_keywords = {
            'tbp': 'TBP',
            'target business plan': 'TBP',
            'cf02': 'CF02',
            'cf05': 'CF05',
            'cf09': 'CF09',
            'cf11': 'CF11',
        }

        # Year-independent plan types
        year_independent_types = {
            'ytd forecast': 'YTD Forecast',
            'ytd forcast': 'YTD Forecast',
            'year to date forecast': 'YTD Forecast',
        }

        # Detect plan type from query (dynamically build with detected year)
        detected_plan_types = []
        detected_plan_type_base = None

        for keyword, base_type in plan_type_base_keywords.items():
            if keyword in query_lower:
                detected_plan_type_base = base_type
                if detected_year:
                    detected_plan_types.append(f"{base_type} {detected_year}")
                else:
                    # No year specified - will filter by base type pattern later
                    detected_plan_types.append(base_type)
                break

        # Check year-independent types
        for keyword, plan_type in year_independent_types.items():
            if keyword in query_lower:
                detected_plan_types.append(plan_type)
                break

        # Check for generic plan/forecast/budget keywords
        plan_keywords = [
            'budget forecast', 'budget plan', 'forecast budget', 'plan data',
            'planning data', 'forecast data', 'budget target', 'target budget',
            'vs actual', 'actual vs', 'vs plan', 'plan vs',
            'compared to actual', 'comparison with actual', 'forecast vs',
            'vs forecast'
        ]

        is_plan_query = len(detected_plan_types) > 0

        # If no specific plan type but has plan keywords, default to checking
        if not is_plan_query:
            for keyword in plan_keywords:
                if keyword in query_lower:
                    is_plan_query = True
                    break

        # Check for particulars (metrics in plan data)
        plan_particulars = [
            'offshore capacity', 'outsourcing capacity', 'onsite capacity',
            'pyramid mix', 'budget musd', 'budget (musd)',
            'internal utilization', 'outsourcing utilization',
            'price mix ratio', 'attrition', 'budget/avg capacity'
        ]

        detected_particulars = []
        for particular in plan_particulars:
            if particular in query_lower:
                detected_particulars.append(particular)

        # Check for view/page references
        page_keywords = {
            'entity view': 'Entity',
            'entity': 'Entity',
            'ms view': 'MS  View',
            'sx view': 'SX  View',
            'world wide': 'World Wide',
            'worldwide': 'World Wide',
            'ww view': 'World Wide',
            'ms gb': 'MS GB',
            'ne-mm': 'NE-MM'
        }

        detected_page = None
        for keyword, page in page_keywords.items():
            if keyword in query_lower:
                detected_page = page
                break

        # Check for comparison queries (actual vs plan)
        is_comparison = False
        comparison_actual = False
        if 'vs actual' in query_lower or 'actual vs' in query_lower or 'compared to actual' in query_lower:
            is_comparison = True
            comparison_actual = True

        # detected_year is already set at the top of the function

        # Detect month from query
        detected_month = None
        month_names = {
            'jan': 1,
            'feb': 2,
            'mar': 3,
            'apr': 4,
            'may': 5,
            'jun': 6,
            'jul': 7,
            'aug': 8,
            'sep': 9,
            'oct': 10,
            'nov': 11,
            'dec': 12
        }
        for name, num in month_names.items():
            if name in query_lower:
                detected_month = num
                break

        return {
            'is_plan_query': is_plan_query,
            'plan_types': detected_plan_types,
            'particulars': detected_particulars,
            'page': detected_page,
            'is_comparison': is_comparison,
            'include_actual': comparison_actual,
            'year': detected_year,
            'month': detected_month
        }

    def compile_plan_sql(self, query: str, cube_id: str,
                         plan_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compile SQL for cube_plan_data queries.
        Completely separate from cube_fact_data logic.
        
        cube_plan_data columns:
        - plan_type: Actual, TBP 2024, TBP 2025, CF02 2024, etc.
        - particulars: metric name (Offshore Capacity, Budget, etc.)
        - sub_category: sub-category (Average, End, salary bands, etc.)
        - entity: BGSW, BGSV, NE-MX, Worlwide
        - gb: project/GB code
        - page: view/page (Entity, MS View, SX View, World Wide, etc.)
        - year, month: time dimensions
        - cost_value: numeric value
        - value_percent: percentage value
        """
        try:
            params = [cube_id]
            where_parts = ["cube_id = %s"]

            # Add plan_type filter
            plan_types = plan_context.get('plan_types', [])
            if plan_context.get('include_actual'):
                plan_types = list(set(plan_types + ['Actual']))

            if plan_types:
                placeholders = ', '.join(['%s'] * len(plan_types))
                where_parts.append(f"plan_type IN ({placeholders})")
                params.extend(plan_types)

            # Add year filter
            if plan_context.get('year'):
                where_parts.append("year = %s")
                params.append(plan_context['year'])

            # Add month filter
            if plan_context.get('month'):
                where_parts.append("month = %s")
                params.append(plan_context['month'])

            # Add page filter
            if plan_context.get('page'):
                where_parts.append("page ILIKE %s")
                params.append(f"%{plan_context['page']}%")

            # Add particulars filter (detected from metadata registry)
            if plan_context.get('particulars'):
                where_parts.append("particulars ILIKE %s")
                params.append(f"%{plan_context['particulars']}%")

            # Add sub_category filter
            if plan_context.get('sub_category'):
                where_parts.append("sub_category ILIKE %s")
                params.append(f"%{plan_context['sub_category']}%")

            # Add entity filter - only if detected from plan_context or query keywords
            # Skip duplicate detection by checking if entity already added
            entity_added = False
            if plan_context.get('entity'):
                where_parts.append("entity ILIKE %s")
                params.append(f"%{plan_context['entity']}%")
                entity_added = True

            # Detect entity from query only if not already added from plan_context
            if not entity_added:
                query_lower = query.lower()
                entity_keywords = {
                    # Entity codes
                    'bgsw/ne-mx':  'BGSW/NE-MX',
                    'bgsw/ebs-pl': 'BGSW/EBS-PL',
                    'bgsw':        'BGSW',
                    'bgsv':        'BGSV',
                    'bgsj':        'BGSJ',
                    'bgsg':        'BGSG',
                    'ne-mx':       'BGSW/NE-MX',
                    'ebs-pl':      'BGSW/EBS-PL',
                    # Country name aliases
                    'india':       'BGSW',
                    'vietnam':     'BGSV',
                    'japan':       'BGSJ',
                    'germany':     'BGSG',
                    'mexico':      'BGSW/NE-MX',
                    'ebs':         'BGSW/EBS-PL',
                    'poland':      'BGSW/EBS-PL',
                    # World Wide
                    'worldwide':   'Worlwide',
                    'world wide':  'Worlwide',
                }
                # Match longest keyword first to avoid partial overlaps
                for keyword, entity in sorted(entity_keywords.items(), key=lambda x: len(x[0]), reverse=True):
                    if keyword in query_lower:
                        where_parts.append("entity ILIKE %s")
                        params.append(f"%{entity}%")
                        break

            where_clause = " AND ".join(where_parts)

            # Build SELECT with grouping
            if plan_context.get('is_comparison'):
                # Comparison query: pivot Actual vs specific Plan type
                # Get the non-Actual plan type for specific filtering
                non_actual_types = [pt for pt in plan_types if pt != 'Actual']
                if non_actual_types:
                    # Use the first specific plan type for comparison
                    comparison_plan_type = non_actual_types[0]
                    # If plan type is a base (e.g., "TBP" without year), use LIKE pattern
                    if ' ' not in comparison_plan_type:
                        plan_type_condition = f"plan_type LIKE '{comparison_plan_type}%'"
                    else:
                        plan_type_condition = f"plan_type = '{comparison_plan_type}'"
                else:
                    # Default to any non-Actual plan type
                    plan_type_condition = "plan_type != 'Actual'"

                sql = f"""
                    SELECT 
                        entity,
                        particulars,
                        sub_category,
                        year,
                        month,
                        MAX(CASE WHEN plan_type = 'Actual' THEN cost_value END) as actual_value,
                        MAX(CASE WHEN plan_type = 'Actual' THEN value_percent END) as actual_percent,
                        MAX(CASE WHEN {plan_type_condition} THEN plan_type END) as plan_type,
                        MAX(CASE WHEN {plan_type_condition} THEN cost_value END) as plan_value,
                        MAX(CASE WHEN {plan_type_condition} THEN value_percent END) as plan_percent
                    FROM cube_plan_data
                    WHERE {where_clause}
                    GROUP BY entity, particulars, sub_category, year, month
                    ORDER BY entity, particulars, year, month
                """
            else:
                # Standard query
                sql = f"""
                    SELECT 
                        plan_type,
                        entity,
                        particulars,
                        sub_category,
                        year,
                        month,
                        cost_value,
                        value_percent,
                        page
                    FROM cube_plan_data
                    WHERE {where_clause}
                    ORDER BY plan_type, entity, particulars, year, month
                """

            logger.info(f"Generated Plan Data SQL: {sql[:200]}...")
            logger.info(f"Plan Data params: {params}")

            return {
                'success': True,
                'sql': sql,
                'params': params,
                'data_source': 'cube_plan_data',
                'plan_context': plan_context
            }

        except Exception as e:
            logger.error(f"Plan SQL compilation failed: {e}")
            return {'success': False, 'error': str(e)}

    def execute_plan_query(self, query: str, cube_id: str) -> Dict[str, Any]:
        """
        Execute a query against cube_plan_data.
        This is the main entry point for plan data queries.
        Uses the new detect_plan_type() with metadata registry for normalization.
        """
        try:
            # Detect if this is a plan data query using new metadata-driven detection
            plan_context = self.detect_plan_type(query)

            # Map new detection format to old format expected by compile_plan_sql
            plan_context['is_plan_query'] = plan_context.get(
                'is_plan_query', False)
            # Key field: 'plan_types' (list) is expected by compile_plan_sql
            plan_context['plan_types'] = [
                plan_context.get('plan_type')
            ] if plan_context.get('plan_type') else []
            plan_context['page'] = plan_context.get('page')
            plan_context['entity'] = plan_context.get('entity')
            plan_context['particulars'] = plan_context.get('particulars')
            plan_context['sub_category'] = plan_context.get('sub_category')
            plan_context['year'] = plan_context.get('year')
            plan_context['month'] = plan_context.get('month')

            if not plan_context['is_plan_query']:
                return {
                    'success': False,
                    'error': 'Query does not appear to be for plan data',
                    'is_plan_query': False
                }

            # Compile plan SQL
            sql_result = self.compile_plan_sql(query, cube_id, plan_context)

            if not sql_result['success']:
                return sql_result

            # Execute query
            conn = self.get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            try:
                cursor.execute(sql_result['sql'], tuple(sql_result['params']))
                results = [dict(row) for row in cursor.fetchall()]

                return {
                    'success': True,
                    'results': results,
                    'row_count': len(results),
                    'data_source': 'cube_plan_data',
                    'plan_context': plan_context,
                    'sql': sql_result['sql']
                }
            finally:
                cursor.close()
                conn.close()

        except Exception as e:
            logger.error(f"Plan query execution failed: {e}")
            return {'success': False, 'error': str(e)}

    # ==================== END PLAN DATA QUERY NAVIGATION ====================


# Singleton instance
semantic_sql_service = SemanticSQLService()
