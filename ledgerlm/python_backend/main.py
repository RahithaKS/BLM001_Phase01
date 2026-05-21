"""
LedgerLM Python Backend - FastAPI Application
Handles document processing, embeddings, and RAG queries
"""
# CRITICAL: Set PIL image limit FIRST before any other imports
# This prevents DecompressionBombWarning for large scanned PDFs
from PIL import Image
Image.MAX_IMAGE_PIXELS = 300000000  # 300 million pixels (default is ~89 million)

import os
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import settings
from api.routes import documents, embeddings, rag, enterprise, semantic_sql, schema_config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="LedgerLM Python Backend",
    description="Document processing, embeddings, and RAG for financial analysis",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(documents.router, prefix="/api/v2/documents", tags=["documents"])
app.include_router(embeddings.router, prefix="/api/v2/embeddings", tags=["embeddings"])
app.include_router(rag.router, prefix="/api/v2/rag", tags=["rag"])
app.include_router(enterprise.router, prefix="/api/v2/enterprise", tags=["enterprise"])
app.include_router(semantic_sql.router, prefix="/api/v2", tags=["semantic-sql"])
app.include_router(schema_config.router, prefix="/api/v2/schema-config", tags=["schema-config"])

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "LedgerLM Python Backend",
        "status": "running",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    try:
        from database import is_database_available
        db_status = "connected" if is_database_available() else "disconnected"
    except Exception as e:
        logger.warning(f"Database check failed: {e}")
        db_status = "error"
    
    return {
        "status": "healthy",
        "database": db_status,
        "openai": "configured" if settings.OPENAI_API_KEY else "not configured"
    }


@app.get("/health/calculations")
async def validate_calculations():
    """
    Validate that all core KPI calculations are working correctly.
    This can be used for monitoring and manual verification.
    Returns status without blocking - always returns a response.
    """
    try:
        from services.semantic_sql_service import SemanticSQLService
        service = SemanticSQLService()
    except Exception as e:
        return {
            "status": "error",
            "message": f"Could not initialize service: {type(e).__name__}",
            "calculations": []
        }
    
    validation_results = []
    
    # Get first cube with data for testing
    try:
        conn = service.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT cube_id FROM cube_fact_data LIMIT 1
        """)
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not row:
            return {
                "status": "skipped",
                "message": "No cube data available for validation - upload files first",
                "calculations": []
            }
        
        test_cube_id = row[0]
    except Exception as e:
        return {
            "status": "skipped",
            "message": f"Database not ready: {type(e).__name__}",
            "calculations": []
        }
    
    # Core calculations to validate
    core_calculations = [
        "Budget Per Avg Capacity Entity",
        "Billing Utilization",
        "Revenue Summary",
        "CTG Adjustment",
    ]
    
    for calc_name in core_calculations:
        try:
            # Test that calculation SQL generation works
            result = service.execute_semantic_query(
                test_cube_id,
                {
                    "use_calculation": calc_name,
                    "group_by": ["region_entity"],
                    "filters": [
                        {"column": "year", "operator": "=", "value": 2025},
                        {"column": "month", "operator": "=", "value": 8}
                    ],
                    "limit": 1
                }
            )
            
            if result.get('success'):
                validation_results.append({
                    "calculation": calc_name,
                    "status": "ok",
                    "row_count": len(result.get('results', []))
                })
            else:
                validation_results.append({
                    "calculation": calc_name,
                    "status": "error",
                    "error": result.get('error', 'Unknown error')
                })
        except Exception as e:
            validation_results.append({
                "calculation": calc_name,
                "status": "error",
                "error": str(e)
            })
    
    # Validate NL intent parsing for key phrases
    nl_tests = [
        ("budget avg capacity by entity", "Budget Per Avg Capacity Entity"),
        ("billing utilization", "Billing Utilization"),
        ("ctg adjustment", "CTG Adjustment"),
    ]
    
    for query, expected_calc in nl_tests:
        try:
            business_logic = service.load_business_logic_context(test_cube_id)
            matched = service.get_matching_calculation(query, business_logic)
            
            if matched and matched.get('calculation_name') == expected_calc:
                validation_results.append({
                    "nl_query": query,
                    "status": "ok",
                    "matched_calculation": expected_calc
                })
            else:
                validation_results.append({
                    "nl_query": query,
                    "status": "warning",
                    "expected": expected_calc,
                    "matched": matched.get('calculation_name') if matched else None
                })
        except Exception as e:
            validation_results.append({
                "nl_query": query,
                "status": "error",
                "error": str(e)
            })
    
    # Determine overall status
    errors = [r for r in validation_results if r.get('status') == 'error']
    warnings = [r for r in validation_results if r.get('status') == 'warning']
    
    if errors:
        overall_status = "unhealthy"
    elif warnings:
        overall_status = "degraded"
    else:
        overall_status = "healthy"
    
    return {
        "status": overall_status,
        "message": f"{len(validation_results) - len(errors) - len(warnings)}/{len(validation_results)} checks passed",
        "calculations": validation_results
    }


@app.on_event("startup")
async def startup_validation():
    """
    Run automatic validation on startup to ensure all core calculations work.
    NEVER blocks startup - all errors are logged but tolerated.
    System will start even if database is empty or unavailable.
    """
    try:
        logger.info("🔧 Running startup calculation validation...")
        
        from services.semantic_sql_service import SemanticSQLService
        service = SemanticSQLService()
        
        # Check if any cube data exists - with robust error handling
        try:
            conn = service.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM cube_fact_data")
            count = cursor.fetchone()[0]
            cursor.close()
            conn.close()
        except Exception as db_err:
            logger.info(f"📊 Database not ready yet - skipping validation ({type(db_err).__name__})")
            logger.info("   System starting without validation - /health/calculations available later")
            return
        
        if count == 0:
            logger.info("📊 No cube data found - skipping calculation validation")
            logger.info("   Upload Excel files to enable automatic KPI calculations")
            return
        
        logger.info(f"📊 Found {count:,} rows of fact data")
        
        # Validate core KPI triggers are registered
        try:
            business_logic = service.load_business_logic_context(None)
            calc_count = len(business_logic.get('calculations', []))
            logger.info(f"✅ {calc_count} calculation rules registered")
            
            # Test key NL triggers
            test_queries = [
                "budget avg capacity by entity",
                "billing utilization by entity",
                "ctg adjustment"
            ]
            
            for query in test_queries:
                try:
                    matched = service.get_matching_calculation(query, business_logic)
                    if matched:
                        logger.info(f"   ✓ '{query}' → {matched.get('calculation_name')}")
                    else:
                        logger.warning(f"   ✗ '{query}' did not match any calculation")
                except Exception:
                    logger.warning(f"   ✗ '{query}' - validation error")
            
            logger.info("✨ Startup validation complete - system ready for automatic queries")
        except Exception as logic_err:
            logger.warning(f"⚠️ Business logic validation skipped: {type(logic_err).__name__}")
        
    except Exception as e:
        # NEVER block startup - just log and continue
        logger.warning(f"⚠️ Startup validation skipped: {type(e).__name__}")
        logger.info("   System starting - validation can be run via /health/calculations")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True
    )
