"""
Schema Configuration API Routes

Provides endpoints for:
1. Analyzing Excel columns and detecting types
2. Saving/retrieving column configurations
3. Detecting schema changes between uploads
4. Managing domain hierarchies
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import os
import sys
import hashlib
import json
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))
from database import get_db_connection
import psycopg2
from psycopg2.extras import RealDictCursor

router = APIRouter()
logger = logging.getLogger(__name__)

# ============================================================================
# Pydantic Models
# ============================================================================

class ColumnInfo(BaseModel):
    column_index: int
    original_name: str
    display_name: Optional[str] = None
    column_type: str = 'dimension'  # dimension, metric, period, hierarchy, ignore
    data_type: str = 'text'  # text, number, date, currency, boolean
    description: Optional[str] = None
    aliases: Optional[List[str]] = None
    aggregation_rule: str = 'sum'
    hierarchy_ref: Optional[str] = None
    use_for_sql: bool = True
    use_for_rag: bool = True
    sample_values: Optional[List[str]] = None

class SaveColumnConfigRequest(BaseModel):
    cube_id: str
    columns: List[ColumnInfo]

class HierarchyConfig(BaseModel):
    hierarchy_name: str
    description: Optional[str] = None
    levels: List[str]
    column_mappings: Optional[Dict[str, str]] = None

class SaveHierarchyRequest(BaseModel):
    domain_id: str
    hierarchies: List[HierarchyConfig]

# ============================================================================
# Helper Functions
# ============================================================================

def detect_column_type(column_name: str, sample_values: List[Any]) -> Dict[str, str]:
    """
    Auto-detect column type and data type based on column name and sample values.
    """
    column_lower = column_name.lower().strip()
    
    # Period indicators (months, years, fiscal periods)
    period_patterns = [
        'jan', 'feb', 'mar', 'apr', 'may', 'jun', 
        'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
        'q1', 'q2', 'q3', 'q4', 'fy', 'year', 'month',
        '-25', '-24', '-23', '-26', '2024', '2025', '2026'
    ]
    
    # Metric indicators (financial amounts, counts)
    metric_patterns = [
        'amount', 'capacity', 'hours', 'count', 'total',
        'sum', 'usd', 'inr', 'eur', 'cost', 'revenue',
        'budget', 'actual', 'variance', 'payable', 'billable',
        'headcount', 'fte', 'rate', 'price', 'value'
    ]
    
    # Dimension indicators
    dimension_patterns = [
        'entity', 'region', 'country', 'department', 'project',
        'sector', 'type', 'category', 'name', 'code', 'id',
        'classification', 'status', 'level', 'group', 'area'
    ]
    
    # Ignore patterns (PII, internal IDs)
    ignore_patterns = [
        'employee number', 'employee name', 'emp_id', 'ssn',
        'password', 'token', 'secret'
    ]
    
    # Check for ignore patterns first
    for pattern in ignore_patterns:
        if pattern in column_lower:
            return {'column_type': 'ignore', 'data_type': 'text'}
    
    # Check for period patterns
    for pattern in period_patterns:
        if pattern in column_lower:
            return {'column_type': 'period', 'data_type': 'text'}
    
    # Check for metric patterns
    for pattern in metric_patterns:
        if pattern in column_lower:
            return {'column_type': 'metric', 'data_type': 'number'}
    
    # Check sample values to determine data type
    numeric_count = 0
    for val in sample_values:
        if val is not None:
            try:
                float(val)
                numeric_count += 1
            except (ValueError, TypeError):
                pass
    
    # If most values are numeric, it's likely a metric
    if len(sample_values) > 0 and numeric_count / len(sample_values) > 0.7:
        return {'column_type': 'metric', 'data_type': 'number'}
    
    # Default to dimension with text type
    return {'column_type': 'dimension', 'data_type': 'text'}


def compute_schema_hash(column_names: List[str]) -> str:
    """Compute a hash of column names for change detection."""
    sorted_names = sorted(column_names)
    return hashlib.md5('|'.join(sorted_names).encode()).hexdigest()


# ============================================================================
# API Endpoints
# ============================================================================

@router.get("/health")
async def health_check():
    """Health check for schema config routes"""
    return {"status": "healthy", "service": "schema_config"}


@router.post("/analyze-columns")
async def analyze_columns(
    file: UploadFile = File(...),
    cube_id: str = Form(...)
):
    """
    Analyze an Excel file and return column information with auto-detected types.
    This does NOT save anything - it just analyzes and returns suggestions.
    """
    try:
        import pandas as pd
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            # Read Excel file (just first 100 rows for analysis)
            df = pd.read_excel(tmp_path, nrows=100)
            
            columns = []
            for idx, col_name in enumerate(df.columns):
                # Get sample values (non-null, unique)
                sample_vals = df[col_name].dropna().head(10).unique().tolist()
                sample_strings = [str(v)[:50] for v in sample_vals]  # Truncate long values
                
                # Auto-detect type
                detected = detect_column_type(col_name, sample_vals)
                
                columns.append({
                    'column_index': idx,
                    'original_name': str(col_name),
                    'display_name': str(col_name),  # Default to original
                    'column_type': detected['column_type'],
                    'data_type': detected['data_type'],
                    'description': None,
                    'aliases': [],
                    'aggregation_rule': 'sum' if detected['column_type'] == 'metric' else None,
                    'use_for_sql': detected['column_type'] != 'ignore',
                    'use_for_rag': detected['column_type'] != 'ignore',
                    'sample_values': sample_strings
                })
            
            # Compute schema hash for change detection
            column_names = [str(c) for c in df.columns]
            schema_hash = compute_schema_hash(column_names)
            
            return {
                'success': True,
                'cube_id': cube_id,
                'total_columns': len(columns),
                'schema_hash': schema_hash,
                'column_names': column_names,
                'columns': columns
            }
            
        finally:
            # Clean up temp file
            os.unlink(tmp_path)
            
    except Exception as e:
        logger.error(f"Error analyzing columns: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-hierarchy")
async def analyze_hierarchy(
    file: UploadFile = File(...),
    domain_id: str = Form(...)
):
    """
    Analyze an Excel file and detect potential hierarchy structures.
    Looks for columns that could represent organizational hierarchies
    (e.g., Region -> Country -> Entity).
    """
    try:
        import pandas as pd
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            file_ext = os.path.splitext(file.filename or '')[1].lower()
            if file_ext == '.csv':
                df = pd.read_csv(tmp_path, nrows=500)
            elif file_ext in ['.xlsx', '.xls']:
                df = pd.read_excel(tmp_path, nrows=500)
            else:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Unsupported file format: {file_ext}. Please upload .xlsx, .xls, or .csv files."
                )
            
            hierarchy_patterns = [
                'level', 'parent', 'child', 'region', 'country', 'entity',
                'department', 'division', 'org', 'manager', 'hierarchy',
                'sector', 'area', 'zone', 'branch', 'group', 'unit',
                'company', 'business', 'segment', 'practice', 'team',
                'section', 'projtop', 'projbu', 'projsection', 'projdept', 'projgroup',
                'projectgb', 'planninggb', 'service'
            ]
            
            detected_hierarchies = []
            hierarchy_columns = []
            
            for col in df.columns:
                col_lower = str(col).lower()
                for pattern in hierarchy_patterns:
                    if pattern in col_lower:
                        unique_values = df[col].dropna().unique().tolist()[:20]
                        hierarchy_columns.append({
                            'column_name': str(col),
                            'pattern_matched': pattern,
                            'unique_count': df[col].nunique(),
                            'sample_values': [str(v)[:50] for v in unique_values]
                        })
                        break
            
            if len(hierarchy_columns) >= 2:
                sorted_cols = sorted(hierarchy_columns, key=lambda x: x['unique_count'])
                
                detected_hierarchies.append({
                    'hierarchy_name': 'Organization Structure',
                    'description': 'Auto-detected from Excel columns',
                    'levels': [c['column_name'] for c in sorted_cols],
                    'column_mappings': {c['column_name']: c['column_name'] for c in sorted_cols},
                    'confidence': 'medium',
                    'detected_columns': sorted_cols
                })
            
            region_geo_cols = [c for c in hierarchy_columns 
                             if any(p in c['column_name'].lower() 
                                   for p in ['region', 'country', 'zone', 'area'])]
            if len(region_geo_cols) >= 2:
                sorted_geo = sorted(region_geo_cols, key=lambda x: x['unique_count'])
                detected_hierarchies.append({
                    'hierarchy_name': 'Geography',
                    'description': 'Geographic hierarchy from Excel',
                    'levels': [c['column_name'] for c in sorted_geo],
                    'column_mappings': {c['column_name']: c['column_name'] for c in sorted_geo},
                    'confidence': 'high',
                    'detected_columns': sorted_geo
                })
            
            bu_cols = [c for c in hierarchy_columns 
                      if any(p in c['column_name'].lower() 
                            for p in ['projtop', 'projbu', 'projsection', 'projdept', 'projgroup'])]
            if len(bu_cols) >= 2:
                sorted_bu = sorted(bu_cols, key=lambda x: x['unique_count'])
                detected_hierarchies.append({
                    'hierarchy_name': 'Business Unit Hierarchy',
                    'description': 'Project/BU hierarchy from Excel (ProjTop → ProjBU → Section → Dept → Group)',
                    'levels': [c['column_name'] for c in sorted_bu],
                    'column_mappings': {c['column_name']: c['column_name'] for c in sorted_bu},
                    'confidence': 'high',
                    'detected_columns': sorted_bu
                })
            
            return {
                'success': True,
                'domain_id': domain_id,
                'total_columns': len(df.columns),
                'hierarchy_candidates': hierarchy_columns,
                'detected_hierarchies': detected_hierarchies,
                'all_columns': [str(c) for c in df.columns]
            }
            
        finally:
            os.unlink(tmp_path)
            
    except Exception as e:
        logger.error(f"Error analyzing hierarchy: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/column-config")
async def save_column_config(request: SaveColumnConfigRequest):
    """
    Save column configuration for a cube.
    This replaces any existing configuration for the cube.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Verify cube exists
        cur.execute("SELECT id FROM cubes WHERE id = %s", (request.cube_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail=f"Cube not found: {request.cube_id}")
        
        # Delete existing config for this cube
        cur.execute("DELETE FROM cube_column_config WHERE cube_id = %s", (request.cube_id,))
        
        # Insert new config
        for col in request.columns:
            cur.execute("""
                INSERT INTO cube_column_config (
                    cube_id, column_index, original_name, display_name,
                    column_type, data_type, description, aliases,
                    aggregation_rule, hierarchy_ref, use_for_sql, use_for_rag,
                    sample_values, is_nullable
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1
                )
            """, (
                request.cube_id,
                col.column_index,
                col.original_name,
                col.display_name or col.original_name,
                col.column_type,
                col.data_type,
                col.description,
                col.aliases or [],
                col.aggregation_rule,
                col.hierarchy_ref,
                1 if col.use_for_sql else 0,
                1 if col.use_for_rag else 0,
                col.sample_values or []
            ))
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"Saved {len(request.columns)} column configs for cube {request.cube_id}")
        
        return {
            'success': True,
            'cube_id': request.cube_id,
            'columns_saved': len(request.columns)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving column config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/column-config/{cube_id}")
async def get_column_config(cube_id: str):
    """
    Get the column configuration for a cube.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT * FROM cube_column_config 
            WHERE cube_id = %s 
            ORDER BY column_index
        """, (cube_id,))
        
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        columns = []
        for row in rows:
            columns.append({
                'id': row['id'],
                'column_index': row['column_index'],
                'original_name': row['original_name'],
                'display_name': row['display_name'],
                'column_type': row['column_type'],
                'data_type': row['data_type'],
                'description': row['description'],
                'aliases': row['aliases'] or [],
                'aggregation_rule': row['aggregation_rule'],
                'hierarchy_ref': row['hierarchy_ref'],
                'use_for_sql': bool(row['use_for_sql']),
                'use_for_rag': bool(row['use_for_rag']),
                'sample_values': row['sample_values'] or []
            })
        
        return {
            'success': True,
            'cube_id': cube_id,
            'columns': columns,
            'total_columns': len(columns)
        }
        
    except Exception as e:
        logger.error(f"Error getting column config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync-columns-from-data/{cube_id}")
async def sync_columns_from_data(cube_id: str):
    """
    Auto-populate cube_column_config by introspecting actual cube_fact_data columns.
    This is called when opening config dialog for a cube with no saved config.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if cube exists in cubes table
        cur.execute("SELECT id, name FROM cubes WHERE id = %s", (cube_id,))
        cube = cur.fetchone()
        if not cube:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail=f"Cube not found: {cube_id}")
        
        # Check if config already exists
        cur.execute("SELECT COUNT(*) as count FROM cube_column_config WHERE cube_id = %s", (cube_id,))
        existing_count = cur.fetchone()['count']
        if existing_count > 0:
            # Already has config, just return it
            cur.execute("SELECT * FROM cube_column_config WHERE cube_id = %s ORDER BY column_index", (cube_id,))
            rows = cur.fetchall()
            cur.close()
            conn.close()
            columns = [{
                'column_index': row['column_index'],
                'original_name': row['original_name'],
                'display_name': row['display_name'],
                'column_type': row['column_type'],
                'data_type': row['data_type'],
                'description': row['description'],
                'aliases': row['aliases'] or [],
                'aggregation_rule': row['aggregation_rule'],
                'use_for_sql': bool(row['use_for_sql']),
                'use_for_rag': bool(row['use_for_rag']),
                'sample_values': row['sample_values'] or []
            } for row in rows]
            return {
                'success': True,
                'cube_id': cube_id,
                'columns': columns,
                'total_columns': len(columns),
                'synced': False,
                'message': 'Config already exists'
            }
        
        # Get column names from information_schema (excluding system columns)
        system_columns = {'id', 'cube_id', 'ingested_at', 'source_row_number', 'row_data'}
        cur.execute("""
            SELECT column_name, data_type, ordinal_position
            FROM information_schema.columns 
            WHERE table_name = 'cube_fact_data'
            AND column_name NOT IN %s
            ORDER BY ordinal_position
        """, (tuple(system_columns),))
        db_columns = cur.fetchall()
        
        # Get sample values for each column from actual data
        cur.execute("SELECT COUNT(*) as cnt FROM cube_fact_data WHERE cube_id = %s", (cube_id,))
        row_count = cur.fetchone()['cnt']
        
        columns = []
        for idx, col_info in enumerate(db_columns):
            col_name = col_info['column_name']
            pg_type = col_info['data_type']
            
            # Get sample values
            sample_values = []
            if row_count > 0:
                cur.execute(f"""
                    SELECT DISTINCT {col_name}::text as val 
                    FROM cube_fact_data 
                    WHERE cube_id = %s AND {col_name} IS NOT NULL
                    LIMIT 5
                """, (cube_id,))
                sample_values = [row['val'] for row in cur.fetchall() if row['val']]
            
            # Detect column type
            detected = detect_column_type(col_name, sample_values)
            
            # Map PostgreSQL types to our data types
            data_type = 'text'
            if pg_type in ('numeric', 'double precision', 'real', 'integer', 'bigint'):
                data_type = 'number'
            elif pg_type in ('date', 'timestamp', 'timestamp with time zone'):
                data_type = 'date'
            
            columns.append({
                'column_index': idx,
                'original_name': col_name,
                'display_name': col_name.replace('_', ' ').title(),
                'column_type': detected['column_type'],
                'data_type': data_type,
                'description': None,
                'aliases': [],
                'aggregation_rule': 'sum' if detected['column_type'] == 'metric' else 'none',
                'use_for_sql': True,
                'use_for_rag': True,
                'sample_values': sample_values[:5]
            })
        
        # Insert into database
        for col in columns:
            cur.execute("""
                INSERT INTO cube_column_config 
                (cube_id, column_index, original_name, display_name, column_type, 
                 data_type, description, aliases, aggregation_rule, use_for_sql, 
                 use_for_rag, sample_values)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                cube_id,
                col['column_index'],
                col['original_name'],
                col['display_name'],
                col['column_type'],
                col['data_type'],
                col['description'],
                col['aliases'],
                col['aggregation_rule'],
                1 if col['use_for_sql'] else 0,
                1 if col['use_for_rag'] else 0,
                col['sample_values']
            ))
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"Synced {len(columns)} columns from cube_fact_data for cube {cube_id}")
        
        return {
            'success': True,
            'cube_id': cube_id,
            'columns': columns,
            'total_columns': len(columns),
            'synced': True,
            'message': f'Synced {len(columns)} columns from data'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing columns: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detect-schema-changes")
async def detect_schema_changes(
    file: UploadFile = File(...),
    cube_id: str = Form(...)
):
    """
    Compare uploaded Excel schema against stored configuration.
    Returns list of new, removed, and unchanged columns.
    """
    try:
        import pandas as pd
        
        # Get existing config
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT original_name FROM cube_column_config 
            WHERE cube_id = %s 
            ORDER BY column_index
        """, (cube_id,))
        
        existing_columns = set(row['original_name'] for row in cur.fetchall())
        cur.close()
        conn.close()
        
        # Read new file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            df = pd.read_excel(tmp_path, nrows=0)
            new_columns = set(str(c) for c in df.columns)
            
            added = new_columns - existing_columns
            removed = existing_columns - new_columns
            unchanged = existing_columns & new_columns
            
            return {
                'success': True,
                'cube_id': cube_id,
                'has_changes': len(added) > 0 or len(removed) > 0,
                'added_columns': list(added),
                'removed_columns': list(removed),
                'unchanged_columns': list(unchanged),
                'total_new': len(new_columns),
                'total_existing': len(existing_columns)
            }
            
        finally:
            os.unlink(tmp_path)
            
    except Exception as e:
        logger.error(f"Error detecting schema changes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/hierarchy-config")
async def save_hierarchy_config(request: SaveHierarchyRequest):
    """
    Save hierarchy configurations for a domain.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Verify domain exists
        cur.execute("SELECT id FROM domains WHERE id = %s", (request.domain_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail=f"Domain not found: {request.domain_id}")
        
        saved_count = 0
        for hierarchy in request.hierarchies:
            # Check if hierarchy exists
            cur.execute("""
                SELECT id FROM domain_hierarchy_config 
                WHERE domain_id = %s AND hierarchy_name = %s
            """, (request.domain_id, hierarchy.hierarchy_name))
            
            existing = cur.fetchone()
            
            if existing:
                # Update existing
                cur.execute("""
                    UPDATE domain_hierarchy_config 
                    SET description = %s, levels = %s, column_mappings = %s, updated_at = NOW()
                    WHERE id = %s
                """, (
                    hierarchy.description,
                    hierarchy.levels,
                    json.dumps(hierarchy.column_mappings) if hierarchy.column_mappings else None,
                    existing['id']
                ))
            else:
                # Insert new
                cur.execute("""
                    INSERT INTO domain_hierarchy_config 
                    (domain_id, hierarchy_name, description, levels, column_mappings)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    request.domain_id,
                    hierarchy.hierarchy_name,
                    hierarchy.description,
                    hierarchy.levels,
                    json.dumps(hierarchy.column_mappings) if hierarchy.column_mappings else None
                ))
            
            saved_count += 1
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            'success': True,
            'domain_id': request.domain_id,
            'hierarchies_saved': saved_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving hierarchy config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/hierarchy-config/{domain_id}")
async def get_hierarchy_config(domain_id: str):
    """
    Get all hierarchy configurations for a domain.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT * FROM domain_hierarchy_config 
            WHERE domain_id = %s 
            ORDER BY hierarchy_name
        """, (domain_id,))
        
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        hierarchies = []
        for row in rows:
            hierarchies.append({
                'id': row['id'],
                'hierarchy_name': row['hierarchy_name'],
                'description': row['description'],
                'levels': row['levels'] or [],
                'column_mappings': row['column_mappings'] or {}
            })
        
        return {
            'success': True,
            'domain_id': domain_id,
            'hierarchies': hierarchies,
            'total': len(hierarchies)
        }
        
    except Exception as e:
        logger.error(f"Error getting hierarchy config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/hierarchy-config/{hierarchy_id}")
async def delete_hierarchy(hierarchy_id: str):
    """
    Delete a specific hierarchy configuration.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("DELETE FROM domain_hierarchy_config WHERE id = %s", (hierarchy_id,))
        deleted = cur.rowcount
        
        conn.commit()
        cur.close()
        conn.close()
        
        if deleted == 0:
            raise HTTPException(status_code=404, detail="Hierarchy not found")
        
        return {'success': True, 'deleted': hierarchy_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting hierarchy: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/schema-version")
async def save_schema_version(cube_id: str, column_names: List[str]):
    """
    Save a new schema version for change tracking.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get next version number
        cur.execute("""
            SELECT COALESCE(MAX(version), 0) + 1 as next_version 
            FROM cube_schema_versions WHERE cube_id = %s
        """, (cube_id,))
        
        row = cur.fetchone()
        next_version = row['next_version'] if row else 1
        schema_hash = compute_schema_hash(column_names)
        
        cur.execute("""
            INSERT INTO cube_schema_versions (cube_id, version, column_names, column_hash)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (cube_id, next_version, column_names, schema_hash))
        
        result = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            'success': True,
            'version_id': result['id'] if result else None,
            'version': next_version,
            'schema_hash': schema_hash
        }
        
    except Exception as e:
        logger.error(f"Error saving schema version: {e}")
        raise HTTPException(status_code=500, detail=str(e))
