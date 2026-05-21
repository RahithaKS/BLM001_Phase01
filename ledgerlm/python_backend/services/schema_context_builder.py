"""
Schema Context Builder Service

Generates LLM context from stored column configurations and hierarchy definitions.
Used by:
1. Semantic SQL service - to generate accurate SQL from natural language
2. RAG engine - to provide domain-specific context for document analysis
"""

import logging
from typing import Dict, List, Any, Optional
from database import get_db_connection

logger = logging.getLogger(__name__)


class SchemaContextBuilder:
    """Builds LLM-ready context from domain schema configurations."""
    
    @staticmethod
    def get_column_config(cube_id: str) -> List[Dict[str, Any]]:
        """Fetch all column configurations for a cube."""
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT column_index, original_name, display_name, column_type,
                               data_type, description, aliases, aggregation_rule,
                               use_for_sql, use_for_rag
                        FROM cube_column_config
                        WHERE cube_id = %s
                        ORDER BY column_index
                    """, (cube_id,))
                    
                    columns = []
                    for row in cur.fetchall():
                        columns.append({
                            "column_index": row[0],
                            "original_name": row[1],
                            "display_name": row[2],
                            "column_type": row[3],
                            "data_type": row[4],
                            "description": row[5],
                            "aliases": row[6] or [],
                            "aggregation_rule": row[7],
                            "use_for_sql": row[8],
                            "use_for_rag": row[9]
                        })
                    return columns
        except Exception as e:
            logger.error(f"Error fetching column config: {e}")
            return []
    
    @staticmethod
    def get_hierarchy_config(domain_id: str) -> List[Dict[str, Any]]:
        """Fetch all hierarchy configurations for a domain."""
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT id, hierarchy_name, description, levels, column_mappings
                        FROM domain_hierarchy_config
                        WHERE domain_id = %s
                    """, (domain_id,))
                    
                    hierarchies = []
                    for row in cur.fetchall():
                        hierarchies.append({
                            "id": row[0],
                            "hierarchy_name": row[1],
                            "description": row[2],
                            "levels": row[3] or [],
                            "column_mappings": row[4] or {}
                        })
                    return hierarchies
        except Exception as e:
            logger.error(f"Error fetching hierarchy config: {e}")
            return []
    
    @staticmethod
    def build_sql_context(cube_id: str, domain_id: Optional[str] = None) -> str:
        """
        Build LLM context for SQL generation.
        
        Returns a formatted string that describes:
        - Available dimensions and their meanings
        - Available metrics and their aggregation rules
        - Period columns and their format
        - Organizational hierarchies
        """
        columns = SchemaContextBuilder.get_column_config(cube_id)
        
        if not columns:
            return "No column configuration available. Use default column names."
        
        # Group columns by type
        dimensions = [c for c in columns if c["column_type"] == "dimension" and c["use_for_sql"]]
        metrics = [c for c in columns if c["column_type"] == "metric" and c["use_for_sql"]]
        periods = [c for c in columns if c["column_type"] == "period" and c["use_for_sql"]]
        hierarchies = [c for c in columns if c["column_type"] == "hierarchy" and c["use_for_sql"]]
        
        context_parts = ["## Data Schema Context\n"]
        
        # Dimensions
        if dimensions:
            context_parts.append("### Dimensions (for filtering and grouping):")
            for dim in dimensions:
                desc = f"  - `{dim['original_name']}`"
                if dim['display_name'] != dim['original_name']:
                    desc += f" (a.k.a. {dim['display_name']})"
                if dim['description']:
                    desc += f": {dim['description']}"
                if dim['aliases']:
                    desc += f" [aliases: {', '.join(dim['aliases'])}]"
                context_parts.append(desc)
        
        # Metrics
        if metrics:
            context_parts.append("\n### Metrics (numeric values for aggregation):")
            for metric in metrics:
                desc = f"  - `{metric['original_name']}`"
                if metric['display_name'] != metric['original_name']:
                    desc += f" (a.k.a. {metric['display_name']})"
                if metric['aggregation_rule']:
                    desc += f" [default aggregation: {metric['aggregation_rule']}]"
                if metric['description']:
                    desc += f": {metric['description']}"
                if metric['aliases']:
                    desc += f" [aliases: {', '.join(metric['aliases'])}]"
                context_parts.append(desc)
        
        # Periods
        if periods:
            context_parts.append("\n### Time/Period Columns:")
            for period in periods:
                desc = f"  - `{period['original_name']}`"
                if period['data_type']:
                    desc += f" ({period['data_type']})"
                if period['description']:
                    desc += f": {period['description']}"
                context_parts.append(desc)
        
        # Hierarchies
        if domain_id:
            hierarchy_config = SchemaContextBuilder.get_hierarchy_config(domain_id)
            if hierarchy_config:
                context_parts.append("\n### Organizational Hierarchies:")
                for h in hierarchy_config:
                    desc = f"  - **{h['hierarchy_name']}**"
                    if h['description']:
                        desc += f": {h['description']}"
                    desc += f"\n    Levels: {' → '.join(h['levels'])}"
                    context_parts.append(desc)
        
        # Column aliases summary for NLP matching
        alias_map = {}
        for col in columns:
            if col['aliases'] and col['use_for_sql']:
                for alias in col['aliases']:
                    alias_map[alias.lower()] = col['original_name']
        
        if alias_map:
            context_parts.append("\n### Column Alias Mappings:")
            context_parts.append("When users say these terms, map to these columns:")
            for alias, col_name in alias_map.items():
                context_parts.append(f"  - \"{alias}\" → `{col_name}`")
        
        # Column relationships
        relationships_context = SchemaContextBuilder._build_column_relationships_context(cube_id)
        if relationships_context:
            context_parts.append(relationships_context)
        
        return "\n".join(context_parts)
    
    @staticmethod
    def _build_column_relationships_context(cube_id: str) -> str:
        """Fetch column relationships and format as LLM context."""
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT from_column, to_column, relationship_type, role, metric_name, description
                        FROM cube_column_relationships
                        WHERE cube_id = %s AND is_active = 1
                        ORDER BY metric_name, role
                    """, (cube_id,))
                    rows = cur.fetchall()
            
            if not rows:
                return ""
            
            lines = ["\n### Column Relationships (for computing derived metrics):"]
            for row in rows:
                from_col, to_col, rel_type, role, metric_name, description = row
                if role and metric_name:
                    lines.append(f"  - `{from_col}` is the {role} of **{metric_name}** ({rel_type}): {description}")
                elif metric_name:
                    lines.append(f"  - `{from_col}` relates to `{to_col}` for **{metric_name}** ({rel_type}): {description}")
                else:
                    lines.append(f"  - `{from_col}` → `{to_col}` ({rel_type}): {description}")
            
            return "\n".join(lines)
        except Exception as e:
            logger.warning(f"Could not load column relationships for cube {cube_id}: {e}")
            return ""
    
    @staticmethod
    def build_rag_context(cube_id: str, domain_id: Optional[str] = None) -> str:
        """
        Build LLM context for RAG document analysis.
        
        Returns a formatted string that helps the AI understand:
        - What each column represents in business terms
        - How to interpret values
        - Domain-specific terminology
        """
        columns = SchemaContextBuilder.get_column_config(cube_id)
        
        if not columns:
            return ""
        
        # Only include columns marked for RAG
        rag_columns = [c for c in columns if c["use_for_rag"]]
        
        if not rag_columns:
            return ""
        
        context_parts = ["## Domain Data Dictionary\n"]
        context_parts.append("This document uses the following data terminology:\n")
        
        for col in rag_columns:
            if col['description']:
                context_parts.append(f"- **{col['display_name']}** ({col['original_name']}): {col['description']}")
            elif col['display_name'] != col['original_name']:
                context_parts.append(f"- **{col['display_name']}** ({col['original_name']})")
        
        # Add hierarchy context
        if domain_id:
            hierarchy_config = SchemaContextBuilder.get_hierarchy_config(domain_id)
            if hierarchy_config:
                context_parts.append("\n### Organizational Structure:")
                for h in hierarchy_config:
                    if h['description']:
                        context_parts.append(f"- **{h['hierarchy_name']}**: {h['description']}")
                    else:
                        context_parts.append(f"- **{h['hierarchy_name']}**: {' → '.join(h['levels'])}")
        
        return "\n".join(context_parts)
    
    @staticmethod
    def get_column_mappings(cube_id: str) -> Dict[str, str]:
        """
        Get a mapping of aliases/display names to original column names.
        Used for intent parsing to map user terms to actual column names.
        """
        columns = SchemaContextBuilder.get_column_config(cube_id)
        
        mappings = {}
        for col in columns:
            if not col['use_for_sql']:
                continue
                
            # Map original name to itself
            mappings[col['original_name'].lower()] = col['original_name']
            
            # Map display name
            if col['display_name']:
                mappings[col['display_name'].lower()] = col['original_name']
            
            # Map all aliases
            for alias in (col['aliases'] or []):
                mappings[alias.lower()] = col['original_name']
        
        return mappings
    
    @staticmethod
    def get_metric_columns(cube_id: str) -> List[Dict[str, Any]]:
        """Get only metric columns for aggregation operations."""
        columns = SchemaContextBuilder.get_column_config(cube_id)
        return [c for c in columns if c['column_type'] == 'metric' and c['use_for_sql']]
    
    @staticmethod
    def get_dimension_columns(cube_id: str) -> List[Dict[str, Any]]:
        """Get only dimension columns for filtering/grouping."""
        columns = SchemaContextBuilder.get_column_config(cube_id)
        return [c for c in columns if c['column_type'] == 'dimension' and c['use_for_sql']]
    
    @staticmethod  
    def get_period_columns(cube_id: str) -> List[Dict[str, Any]]:
        """Get only period/time columns."""
        columns = SchemaContextBuilder.get_column_config(cube_id)
        return [c for c in columns if c['column_type'] == 'period' and c['use_for_sql']]
    
    # ===================================
    # BUSINESS LOGIC METHODS
    # ===================================
    
    @staticmethod
    def get_business_terms(cube_id: str) -> List[Dict[str, Any]]:
        """Fetch business terminology definitions for a cube."""
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT id, term_name, term_aliases, definition, sql_filter, 
                               required_columns, category, priority
                        FROM cube_business_terms
                        WHERE cube_id = %s AND is_active = 1
                        ORDER BY priority DESC, term_name
                    """, (cube_id,))
                    
                    terms = []
                    for row in cur.fetchall():
                        terms.append({
                            "id": row[0],
                            "term_name": row[1],
                            "term_aliases": row[2] or [],
                            "definition": row[3],
                            "sql_filter": row[4],
                            "required_columns": row[5] or [],
                            "category": row[6],
                            "priority": row[7]
                        })
                    return terms
        except Exception as e:
            logger.error(f"Error fetching business terms: {e}")
            return []
    
    @staticmethod
    def get_calculation_rules(cube_id: str) -> List[Dict[str, Any]]:
        """Fetch calculation rules (formulas) for a cube."""
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT id, calculation_name, calculation_aliases, description, formula,
                               formula_type, result_type, required_columns, default_filters, rounding_precision
                        FROM cube_calculation_rules
                        WHERE cube_id = %s AND is_active = 1
                        ORDER BY calculation_name
                    """, (cube_id,))
                    
                    rules = []
                    for row in cur.fetchall():
                        rules.append({
                            "id": row[0],
                            "calculation_name": row[1],
                            "calculation_aliases": row[2] or [],
                            "description": row[3],
                            "formula": row[4],
                            "formula_type": row[5],
                            "result_type": row[6],
                            "required_columns": row[7] or [],
                            "default_filters": row[8],
                            "rounding_precision": row[9]
                        })
                    return rules
        except Exception as e:
            logger.error(f"Error fetching calculation rules: {e}")
            return []
    
    @staticmethod
    def get_filter_rules(cube_id: str) -> List[Dict[str, Any]]:
        """Fetch filter rules (semantic labels to SQL predicates) for a cube."""
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT id, filter_name, filter_aliases, description, sql_predicate,
                               target_column, is_default
                        FROM cube_filter_rules
                        WHERE cube_id = %s AND is_active = 1
                        ORDER BY filter_name
                    """, (cube_id,))
                    
                    filters = []
                    for row in cur.fetchall():
                        filters.append({
                            "id": row[0],
                            "filter_name": row[1],
                            "filter_aliases": row[2] or [],
                            "description": row[3],
                            "sql_predicate": row[4],
                            "target_column": row[5],
                            "is_default": row[6] == 1
                        })
                    return filters
        except Exception as e:
            logger.error(f"Error fetching filter rules: {e}")
            return []
    
    @staticmethod
    def get_query_patterns(cube_id: str) -> List[Dict[str, Any]]:
        """Fetch reusable SQL query patterns for a cube."""
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT id, pattern_name, pattern_description, trigger_phrases, sql_template,
                               template_variables, example_question, example_sql, category
                        FROM cube_query_patterns
                        WHERE cube_id = %s AND is_active = 1
                        ORDER BY pattern_name
                    """, (cube_id,))
                    
                    patterns = []
                    for row in cur.fetchall():
                        patterns.append({
                            "id": row[0],
                            "pattern_name": row[1],
                            "pattern_description": row[2],
                            "trigger_phrases": row[3] or [],
                            "sql_template": row[4],
                            "template_variables": row[5] or {},
                            "example_question": row[6],
                            "example_sql": row[7],
                            "category": row[8]
                        })
                    return patterns
        except Exception as e:
            logger.error(f"Error fetching query patterns: {e}")
            return []
    
    @staticmethod
    def get_column_values(cube_id: str) -> List[Dict[str, Any]]:
        """Fetch column value explanations for a cube."""
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT id, column_name, value_name, value_description, value_aliases,
                               usage_context, related_values
                        FROM cube_column_values
                        WHERE cube_id = %s AND is_active = 1
                        ORDER BY column_name, value_name
                    """, (cube_id,))
                    
                    values = []
                    for row in cur.fetchall():
                        values.append({
                            "id": row[0],
                            "column_name": row[1],
                            "value_name": row[2],
                            "value_description": row[3],
                            "value_aliases": row[4] or [],
                            "usage_context": row[5],
                            "related_values": row[6] or []
                        })
                    return values
        except Exception as e:
            logger.error(f"Error fetching column values: {e}")
            return []
    
    @staticmethod
    def get_all_business_logic(cube_id: str) -> Dict[str, Any]:
        """Fetch all business logic for a cube in one call."""
        return {
            "terms": SchemaContextBuilder.get_business_terms(cube_id),
            "calculations": SchemaContextBuilder.get_calculation_rules(cube_id),
            "filters": SchemaContextBuilder.get_filter_rules(cube_id),
            "patterns": SchemaContextBuilder.get_query_patterns(cube_id),
            "column_values": SchemaContextBuilder.get_column_values(cube_id)
        }
    
    @staticmethod
    def build_business_logic_context(cube_id: str) -> str:
        """
        Build LLM context from business logic definitions.
        
        Returns a formatted string that helps the AI understand:
        - Business terminology and their SQL filters
        - Calculation formulas for derived metrics
        - Filter rules for common data views
        - Query patterns for complex queries
        - Column value meanings
        """
        logic = SchemaContextBuilder.get_all_business_logic(cube_id)
        
        context_parts = ["## Business Logic Context\n"]
        
        # Business Terms
        if logic["terms"]:
            context_parts.append("\n### Business Terminology:")
            context_parts.append("When user asks about these concepts, apply the corresponding SQL filters:\n")
            for term in logic["terms"]:
                term_aliases = term.get('term_aliases') or []
                aliases = f" (also: {', '.join(term_aliases)})" if term_aliases else ""
                term_name = term.get('term_name') or 'Unknown Term'
                definition = term.get('definition') or ''
                context_parts.append(f"- **{term_name}**{aliases}: {definition}")
                sql_filter = term.get('sql_filter')
                if sql_filter:
                    context_parts.append(f"  → SQL Filter: `{sql_filter}`")
        
        # Calculation Rules
        if logic["calculations"]:
            context_parts.append("\n### Calculation Formulas:")
            context_parts.append("For these derived metrics, use these SQL expressions:\n")
            for calc in logic["calculations"]:
                calc_aliases = calc.get('calculation_aliases') or []
                aliases = f" (also: {', '.join(calc_aliases)})" if calc_aliases else ""
                calc_name = calc.get('calculation_name') or 'Unknown Calculation'
                description = calc.get('description') or ''
                formula = calc.get('formula') or ''
                context_parts.append(f"- **{calc_name}**{aliases}: {description}")
                context_parts.append(f"  → Formula: `{formula}`")
                default_filters = calc.get('default_filters')
                if default_filters:
                    context_parts.append(f"  → Default Filter: `{default_filters}`")
        
        # Filter Rules
        if logic["filters"]:
            context_parts.append("\n### Named Filters:")
            context_parts.append("When user mentions these views/scopes, apply these SQL predicates:\n")
            for f in logic["filters"]:
                filter_aliases = f.get('filter_aliases') or []
                aliases = f" (also: {', '.join(filter_aliases)})" if filter_aliases else ""
                filter_name = f.get('filter_name') or 'Unknown Filter'
                description = f.get('description') or ''
                sql_predicate = f.get('sql_predicate') or ''
                context_parts.append(f"- **{filter_name}**{aliases}: {description}")
                context_parts.append(f"  → SQL: `{sql_predicate}`")
        
        # Query Patterns - OPTIMIZED: Only include names and triggers to reduce token count
        # Full SQL examples are too large and exceed token limits
        if logic["patterns"]:
            context_parts.append("\n### Available Query Patterns:")
            context_parts.append("These patterns are available for complex queries:\n")
            # Limit to top 15 patterns to reduce context size
            for p in logic["patterns"][:15]:
                trigger_phrases = p.get('trigger_phrases') or []
                triggers = f" [{', '.join(trigger_phrases[:2])}]" if trigger_phrases else ""
                pattern_name = p.get('pattern_name') or 'Unknown Pattern'
                context_parts.append(f"- {pattern_name}{triggers}")
        
        # Column Values
        if logic["column_values"]:
            context_parts.append("\n### Column Value Meanings:")
            # Group by column
            by_column = {}
            for cv in logic["column_values"]:
                col = cv.get('column_name') or 'Unknown Column'
                if col not in by_column:
                    by_column[col] = []
                by_column[col].append(cv)
            
            for col, values in by_column.items():
                context_parts.append(f"\n**{col}** column values:")
                for cv in values:
                    value_aliases = cv.get('value_aliases') or []
                    aliases = f" (also: {', '.join(value_aliases)})" if value_aliases else ""
                    value_name = cv.get('value_name') or 'Unknown'
                    value_desc = cv.get('value_description') or ''
                    context_parts.append(f"  - `{value_name}`{aliases}: {value_desc}")
                    usage_context = cv.get('usage_context')
                    if usage_context:
                        context_parts.append(f"    → Use when: {usage_context}")
        
        if len(context_parts) == 1:
            return ""  # No business logic defined
        
        return "\n".join(context_parts)
    
    @staticmethod
    def match_business_term(cube_id: str, query_text: str) -> Optional[Dict[str, Any]]:
        """
        Find a matching business term for the given query text.
        Returns the highest priority matching term.
        """
        terms = SchemaContextBuilder.get_business_terms(cube_id)
        if not query_text:
            return None
        query_lower = query_text.lower()
        
        matched_terms = []
        for term in terms:
            # Check if term name matches
            term_name = term.get('term_name') or ''
            if term_name and term_name.lower() in query_lower:
                matched_terms.append(term)
                continue
            
            # Check aliases (guard against None)
            aliases = term.get('term_aliases') or []
            for alias in aliases:
                if alias and alias.lower() in query_lower:
                    matched_terms.append(term)
                    break
        
        # Return highest priority match
        if matched_terms:
            matched_terms.sort(key=lambda x: x.get('priority', 0) or 0, reverse=True)
            return matched_terms[0]
        
        return None
    
    @staticmethod
    def match_filter_rules(cube_id: str, query_text: str) -> List[Dict[str, Any]]:
        """
        Find all matching filter rules for the given query text.
        """
        filters = SchemaContextBuilder.get_filter_rules(cube_id)
        if not query_text:
            return []
        query_lower = query_text.lower()
        
        matched_filters = []
        for f in filters:
            # Check if filter name matches
            filter_name = f.get('filter_name') or ''
            if filter_name and filter_name.lower() in query_lower:
                matched_filters.append(f)
                continue
            
            # Check aliases (guard against None)
            aliases = f.get('filter_aliases') or []
            for alias in aliases:
                if alias and alias.lower() in query_lower:
                    matched_filters.append(f)
                    break
        
        return matched_filters
    
    @staticmethod
    def match_calculation(cube_id: str, query_text: str) -> Optional[Dict[str, Any]]:
        """
        Find a matching calculation rule for the given query text.
        """
        calculations = SchemaContextBuilder.get_calculation_rules(cube_id)
        if not query_text:
            return None
        query_lower = query_text.lower()
        
        for calc in calculations:
            # Check if calculation name matches
            calc_name = calc.get('calculation_name') or ''
            if calc_name and calc_name.lower() in query_lower:
                return calc
            
            # Check aliases (guard against None)
            aliases = calc.get('calculation_aliases') or []
            for alias in aliases:
                if alias and alias.lower() in query_lower:
                    return calc
        
        return None


# Singleton instance
schema_context_builder = SchemaContextBuilder()
