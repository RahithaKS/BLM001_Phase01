#!/usr/bin/env python3
"""
KPI Dashboard PDF Extractor for LedgerLM
Handles complex KPI metrics PDFs with structured dashboard layouts.

Designed for PDFs like KPI_Metrics_jun-24.pdf with:
- Left/Right column layouts with metric cards
- Monthly trend data
- Multiple views per page (Entity View, MS View, etc.)
- Structured metrics: CF02.2024, CF Plan, YTD Forecast, YTD Actual
"""

import os
import re
import logging
from typing import List, Dict, Any, Optional, Tuple
import pdfplumber
from collections import defaultdict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("kpi-dashboard-extractor")

# Known reversed text patterns found in Bosch KPI dashboard PDFs
# Format: reversed_text -> correct_text
REVERSED_TEXT_MAPPINGS = {
    # Common metric labels (character-reversed)
    "tegduB": "Budget",
    "yticapaC": "Capacity",
    "gnicruostuO": "Outsourcing",
    "erohsffO": "Offshore",
    "noitirttA": "Attrition",
    "noitazilitU": "Utilization",
    "lanretnI": "Internal",
    "lanretxE": "External",
    "dimaryP": "Pyramid",
    "xiM": "Mix",
    "ecirP": "Price",
    "oitaR": "Ratio",
    "egarevA": "Average",
    "dnE": "End",
    "gvA": "Avg",
    # Units
    "DSUm": "mUSD",
    "DSU": "USD",
    # Time-related
    "dnerT": "Trend",
    "ylhtnoM": "Monthly",
    # Common patterns with parentheses
    ")DSUm(": "(mUSD)",
    ")DSU(": "(USD)",
    ")%(": "(%)",
}

def fix_reversed_text(text: str) -> str:
    """
    Detect and fix reversed text patterns commonly found in visual PDFs.
    OCR sometimes extracts text character-by-character in reverse order
    from chart graphics and dashboard elements.
    """
    if not text:
        return text
    
    fixed_text = text
    
    # Apply known reversed pattern fixes (case-insensitive)
    for reversed_pattern, correct_text in REVERSED_TEXT_MAPPINGS.items():
        # Use regex for case-insensitive replacement
        fixed_text = re.sub(re.escape(reversed_pattern), correct_text, fixed_text, flags=re.IGNORECASE)
    
    # Also try to detect and fix other potential reversed words
    # Pattern: sequence of lowercase letters that when reversed forms a known word
    known_words = {
        "budget", "capacity", "outsourcing", "offshore", "attrition",
        "utilization", "internal", "external", "pyramid", "mix", "price",
        "ratio", "average", "trend", "monthly", "forecast", "actual",
        "global", "india", "vietnam", "mexico", "entity", "view"
    }
    
    # Find potential reversed words (sequences of 4+ lowercase letters)
    potential_reversed = re.findall(r'\b([a-z]{4,})\b', fixed_text, re.IGNORECASE)
    for word in potential_reversed:
        reversed_word = word[::-1].lower()
        if reversed_word in known_words and word.lower() not in known_words:
            # This word is reversed - fix it
            if word[0].isupper():
                replacement = reversed_word.capitalize()
            else:
                replacement = reversed_word
            fixed_text = re.sub(r'\b' + re.escape(word) + r'\b', replacement, fixed_text)
    
    return fixed_text

# Known KPI metrics patterns for dashboard recognition
KPI_METRIC_PATTERNS = [
    r"Budget\s*\(mUSD\)",
    r"Budget.*Capacity.*\(USD\)",
    r"Price\s*Mix\s*Ratio",
    r"Attrition",
    r"Internal\s*Utilization\s*\(%\)",
    r"Offshore\s*Capacity",
    r"Outsourcing\s*Capacity", 
    r"Capacity\s*Mix\s*\(%\)",
    r"Pyramid\s*Mix",
    r"Outsourcing\s*Utilization\s*\(%\)",
]

# Value column patterns
VALUE_PATTERNS = [
    r"CF\s*02\.2024",
    r"CF\s*Plan",
    r"YTD\s*\d+\.\d+\s*Forecast",
    r"YTD\s*\d+\.\d+\s*Actual",
]

# Month patterns for trend data
MONTH_PATTERNS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# Static page-to-entity mapping for Bosch KPI PDFs
# This ensures correct country assignment regardless of OCR/extraction quality
BOSCH_KPI_PAGE_MAPPING = {
    1: {"view_type": "entity_view", "entity": "Global"},
    2: {"view_type": "entity_view", "entity": "India"},
    3: {"view_type": "entity_view", "entity": "Vietnam"},
    4: {"view_type": "entity_view", "entity": "Mexico"},
    5: {"view_type": "ms_view", "entity": "Global"},
    6: {"view_type": "ms_view", "entity": "India"},
    7: {"view_type": "ms_view", "entity": "Vietnam"},
    8: {"view_type": "ms_view", "entity": "Mexico"},
    9: {"view_type": "ms_gb_view", "entity": "VM"},
    10: {"view_type": "ms_gb_view", "entity": "PS"},
    11: {"view_type": "ms_gb_view", "entity": "XC excl CV"},
    12: {"view_type": "sx_view", "entity": "Global"},
    13: {"view_type": "sx_view", "entity": "India"},
    14: {"view_type": "sx_view", "entity": "Vietnam"},
    15: {"view_type": "sx_view", "entity": "Mexico"},
    16: {"view_type": "ne_mm_view", "entity": "NE-MM"},
    17: {"view_type": "pyramid_salary", "entity": "India"},
}


def is_kpi_dashboard_pdf(pdf_path: str) -> bool:
    """
    Detect if a PDF is a KPI dashboard format based on content patterns.
    Returns True if the PDF matches KPI dashboard characteristics.
    Uses OCR fallback for image-based PDFs.
    """
    try:
        import pytesseract
        from pdf2image import convert_from_path
        
        with pdfplumber.open(pdf_path) as pdf:
            if len(pdf.pages) == 0:
                return False
            
            first_page = pdf.pages[0]
            text = first_page.extract_text() or ""
            
            # If text extraction failed (image-based PDF), try OCR on first page
            if len(text.strip()) < 100:
                logger.info("Text extraction sparse, attempting OCR for KPI detection")
                try:
                    images = convert_from_path(pdf_path, dpi=150, first_page=1, last_page=1)
                    if images:
                        text = pytesseract.image_to_string(images[0])
                        images[0].close()
                except Exception as ocr_error:
                    logger.warning(f"OCR fallback failed: {ocr_error}")
            
            # Also check filename for KPI patterns
            filename = os.path.basename(pdf_path).upper()
            filename_indicators = [
                "KPI" in filename,
                "METRICS" in filename,
                "DASHBOARD" in filename,
            ]
            
            text_indicators = [
                "Business Metrics" in text,
                "KPI" in text.upper(),
                "YTD" in text,
                "Forecast" in text,
                "Actual" in text,
                "CF02" in text or "CF 02" in text,
                any(re.search(pattern, text, re.IGNORECASE) for pattern in KPI_METRIC_PATTERNS[:5]),
            ]
            
            # Accept if 3+ text indicators OR filename match + 2 text indicators
            return sum(text_indicators) >= 3 or (any(filename_indicators) and sum(text_indicators) >= 2)
            
    except Exception as e:
        logger.warning(f"Could not detect KPI dashboard format: {e}")
        return False


def extract_page_metadata(page, page_num: int, use_static_mapping: bool = True) -> Dict[str, Any]:
    """
    Extract metadata from a page including view type, date context, etc.
    Uses static page mapping for Bosch KPI PDFs to ensure correct entity assignment.
    Never cascades entity from adjacent pages to prevent Vietnam/Mexico confusion.
    """
    text = page.extract_text() or ""
    # Apply reversed text fix
    text = fix_reversed_text(text)
    
    metadata = {
        "page_number": page_num,
        "view_type": None,
        "year": None,
        "month": None,
        "entity": None,
    }
    
    # First, try to use static page mapping for reliable entity assignment
    if use_static_mapping and page_num in BOSCH_KPI_PAGE_MAPPING:
        static_data = BOSCH_KPI_PAGE_MAPPING[page_num]
        metadata["view_type"] = static_data["view_type"]
        metadata["entity"] = static_data["entity"]
        logger.info(f"Page {page_num}: Using static mapping - {static_data['view_type']} / {static_data['entity']}")
    else:
        # Fallback to regex extraction (but never cascade to adjacent pages)
        view_patterns = [
            (r"(\w+)'?\d*-?\s*Entity\s*View", "entity_view"),
            (r"(\w+)'?\d*-?\s*MS\s*View", "ms_view"),
            (r"(\w+)'?\d*-?\s*MS\s*GB\s*View", "ms_gb_view"),
            (r"(\w+)'?\d*-?\s*SX\s*View", "sx_view"),
            (r"(\w+)'?\d*-?\s*Region\s*View", "region_view"),
            (r"NE-MM\s*View", "ne_mm_view"),
            (r"Pyramid\s*wise\s*salary", "pyramid_salary"),
        ]
        
        for pattern, view_type in view_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                metadata["view_type"] = view_type
                # Only extract entity if we captured a group
                if match.lastindex and match.lastindex >= 1:
                    entity = match.group(1).strip()
                    # Validate entity is a known country/region
                    valid_entities = ["Global", "India", "Vietnam", "Mexico", "VM", "PS", "XC"]
                    if any(ve.lower() in entity.lower() for ve in valid_entities):
                        metadata["entity"] = entity
                break
    
    # Extract year and month from text
    year_match = re.search(r"Year\s*[\n\r]*\s*(\d{4})", text)
    if year_match:
        metadata["year"] = year_match.group(1)
    
    month_match = re.search(r"Month\s*[\n\r]*\s*(\w{3})", text)
    if month_match:
        metadata["month"] = month_match.group(1)
    
    return metadata


def extract_metric_cards(page, page_num: int) -> List[Dict[str, Any]]:
    """
    Extract metric cards from a page using layout-aware parsing.
    Returns structured metric data for each card detected.
    """
    metrics = []
    
    try:
        page_width = page.width
        mid_point = page_width / 2
        
        tables = page.extract_tables() or []
        text = page.extract_text() or ""
        # Apply reversed text fix
        text = fix_reversed_text(text)
        
        words = page.extract_words() or []
        
        left_column_words = [w for w in words if float(w.get('x0', 0)) < mid_point]
        right_column_words = [w for w in words if float(w.get('x0', 0)) >= mid_point]
        
        left_text = ' '.join([w.get('text', '') for w in sorted(left_column_words, key=lambda w: (w.get('top', 0), w.get('x0', 0)))])
        right_text = ' '.join([w.get('text', '') for w in sorted(right_column_words, key=lambda w: (w.get('top', 0), w.get('x0', 0)))])
        # Apply reversed text fix to both columns
        left_text = fix_reversed_text(left_text)
        right_text = fix_reversed_text(right_text)
        
        left_metrics = _parse_metrics_from_text(left_text, "left", page_num)
        right_metrics = _parse_metrics_from_text(right_text, "right", page_num)
        
        metrics.extend(left_metrics)
        metrics.extend(right_metrics)
        
        if tables:
            for table_idx, table in enumerate(tables):
                table_metrics = _parse_metrics_from_table(table, page_num, table_idx)
                for tm in table_metrics:
                    if not any(m.get('metric_name') == tm.get('metric_name') for m in metrics):
                        metrics.append(tm)
        
    except Exception as e:
        logger.error(f"Error extracting metric cards from page {page_num}: {e}")
    
    return metrics


def _parse_metrics_from_text(text: str, column: str, page_num: int) -> List[Dict[str, Any]]:
    """
    Parse structured metrics from text content.
    Scopes value extraction to metric-specific text segments.
    """
    metrics = []
    
    metric_names = [
        ("Budget (mUSD)", r"Budget\s*\(?mUSD\)?"),
        ("Budget/Avg Capacity (USD)", r"Budget.*Avg.*Capacity.*\(?USD\)?"),
        ("Price Mix Ratio", r"Price\s*Mix\s*Ratio"),
        ("Attrition", r"Attrition"),
        ("Internal Utilization (%)", r"Internal\s*Utilization\s*\(?%?\)?"),
        ("Offshore Capacity", r"Offshore\s*Capacity"),
        ("Outsourcing Capacity", r"Outsourcing\s*Capacity"),
        ("Capacity Mix (%)", r"Capacity\s*Mix\s*\(?%?\)?"),
        ("Pyramid Mix", r"Pyramid\s*Mix"),
        ("Outsourcing Utilization (%)", r"Outsourcing\s*Utilization\s*\(?%?\)?"),
    ]
    
    for idx, (metric_name, pattern) in enumerate(metric_names):
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            # Find the text segment for this metric (until next metric or end)
            start_pos = match.start()
            end_pos = len(text)
            
            # Find where next metric starts
            for next_name, next_pattern in metric_names[idx+1:]:
                next_match = re.search(next_pattern, text[start_pos+10:], re.IGNORECASE)
                if next_match:
                    end_pos = min(end_pos, start_pos + 10 + next_match.start())
                    break
            
            # Also limit to ~500 chars after metric name for safety
            end_pos = min(end_pos, start_pos + 500)
            
            metric_text = text[start_pos:end_pos]
            
            metric_data = {
                "metric_name": metric_name,
                "column_position": column,
                "page_number": page_num,
                "values": {},
                "trend_data": {},
            }
            
            # Extract values from scoped metric text
            values = _extract_metric_values_scoped(metric_text)
            metric_data["values"] = values
            
            trend = _extract_trend_data_scoped(metric_text)
            metric_data["trend_data"] = trend
            
            metrics.append(metric_data)
    
    return metrics


def _extract_metric_values_scoped(metric_text: str) -> Dict[str, Any]:
    """
    Extract CF02.2024, CF Plan, YTD Forecast, YTD Actual values from scoped metric text.
    """
    values = {
        "cf02_2024": None,
        "cf_plan": None,
        "ytd_forecast": None,
        "ytd_actual": None,
    }
    
    number_pattern = r"[\d,]+\.?\d*%?"
    
    # Look for value patterns in the metric-scoped text
    cf02_match = re.search(r"CF\s*02\.?2024\s*[:\s]*(" + number_pattern + r"|--)", metric_text, re.IGNORECASE)
    if cf02_match:
        val = cf02_match.group(1)
        values["cf02_2024"] = None if val == "--" else _parse_number(val)
    
    cf_plan_match = re.search(r"CF\s*Plan\s*%?\s*[:\s]*(" + number_pattern + r"|--)", metric_text, re.IGNORECASE)
    if cf_plan_match:
        val = cf_plan_match.group(1)
        values["cf_plan"] = None if val == "--" else _parse_number(val)
    
    ytd_forecast_match = re.search(r"YTD\s*[\d.]+\s*Forecast\s*[:\s]*(" + number_pattern + r"|--)", metric_text, re.IGNORECASE)
    if ytd_forecast_match:
        val = ytd_forecast_match.group(1)
        values["ytd_forecast"] = None if val == "--" else _parse_number(val)
    
    ytd_actual_match = re.search(r"YTD\s*[\d.]+\s*Actual\s*[:\s]*(" + number_pattern + r"|--)", metric_text, re.IGNORECASE)
    if ytd_actual_match:
        val = ytd_actual_match.group(1)
        values["ytd_actual"] = None if val == "--" else _parse_number(val)
    
    # Fallback: if no labeled values found, try to extract prominent numbers
    if all(v is None for v in values.values()):
        numbers = re.findall(r"\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\b", metric_text)
        if numbers:
            try:
                values["ytd_actual"] = _parse_number(numbers[0])
            except:
                pass
    
    return values


def _extract_trend_data_scoped(metric_text: str) -> Dict[str, Any]:
    """
    Extract monthly trend data from scoped metric text.
    """
    trend = {}
    
    month_value_pattern = r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*[:\s]*(\d[\d,]*\.?\d*)"
    
    matches = re.findall(month_value_pattern, metric_text, re.IGNORECASE)
    for month, value in matches:
        trend[month.capitalize()] = _parse_number(value)
    
    return trend


def _extract_metric_values(text: str, metric_pattern: str) -> Dict[str, Any]:
    """
    Extract CF02.2024, CF Plan, YTD Forecast, YTD Actual values for a metric.
    """
    values = {
        "cf02_2024": None,
        "cf_plan": None,
        "ytd_forecast": None,
        "ytd_actual": None,
    }
    
    number_pattern = r"[\d,]+\.?\d*%?"
    
    cf02_match = re.search(r"CF\s*02\.2024\s*[:\s]*(" + number_pattern + r"|--)", text, re.IGNORECASE)
    if cf02_match:
        val = cf02_match.group(1)
        values["cf02_2024"] = None if val == "--" else _parse_number(val)
    
    cf_plan_match = re.search(r"CF\s*Plan\s*%?\s*[:\s]*(" + number_pattern + r"|--)", text, re.IGNORECASE)
    if cf_plan_match:
        val = cf_plan_match.group(1)
        values["cf_plan"] = None if val == "--" else _parse_number(val)
    
    ytd_forecast_match = re.search(r"YTD\s*\d+\.\d+\s*Forecast\s*[:\s]*(" + number_pattern + r"|--)", text, re.IGNORECASE)
    if ytd_forecast_match:
        val = ytd_forecast_match.group(1)
        values["ytd_forecast"] = None if val == "--" else _parse_number(val)
    
    ytd_actual_match = re.search(r"YTD\s*\d+\.\d+\s*Actual\s*[:\s]*(" + number_pattern + r"|--)", text, re.IGNORECASE)
    if ytd_actual_match:
        val = ytd_actual_match.group(1)
        values["ytd_actual"] = None if val == "--" else _parse_number(val)
    
    return values


def _extract_trend_data(text: str, metric_pattern: str) -> Dict[str, Any]:
    """
    Extract monthly trend data (Apr, May, Jun, etc.)
    """
    trend = {}
    
    month_value_pattern = r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*[:\s]*(\d[\d,]*\.?\d*)"
    
    matches = re.findall(month_value_pattern, text, re.IGNORECASE)
    for month, value in matches:
        trend[month.capitalize()] = _parse_number(value)
    
    return trend


def _parse_number(value_str: str) -> Optional[float]:
    """
    Parse a number string into a float, handling commas and percentages.
    """
    if not value_str or value_str == "--":
        return None
    
    try:
        cleaned = value_str.replace(",", "").replace("%", "").strip()
        return float(cleaned)
    except ValueError:
        return None


def _parse_metrics_from_table(table: List[List], page_num: int, table_idx: int) -> List[Dict[str, Any]]:
    """
    Parse metrics from a detected table structure.
    """
    metrics = []
    
    if not table or len(table) < 2:
        return metrics
    
    try:
        header_row = table[0] if table else []
        
        for row_idx, row in enumerate(table[1:], start=1):
            if not row or len(row) < 2:
                continue
            
            first_cell = str(row[0]).strip() if row[0] else ""
            # Apply reversed text fix
            first_cell = fix_reversed_text(first_cell)
            
            if any(keyword in first_cell.lower() for keyword in ["budget", "capacity", "attrition", "utilization", "mix"]):
                metric_data = {
                    "metric_name": first_cell,
                    "column_position": "table",
                    "page_number": page_num,
                    "table_index": table_idx,
                    "values": {},
                    "raw_row": row,
                }
                
                for col_idx, cell in enumerate(row[1:], start=1):
                    cell_val = str(cell).strip() if cell else ""
                    if col_idx < len(header_row):
                        header = str(header_row[col_idx]).strip() if header_row[col_idx] else f"col_{col_idx}"
                        metric_data["values"][header] = _parse_number(cell_val)
                
                metrics.append(metric_data)
                
    except Exception as e:
        logger.warning(f"Error parsing table on page {page_num}: {e}")
    
    return metrics


def extract_kpi_dashboard(pdf_path: str) -> Dict[str, Any]:
    """
    Main extraction function for KPI dashboard PDFs.
    Returns structured data with page-wise metrics and metadata.
    Uses OCR fallback when text extraction is sparse.
    """
    # Lazy import OCR dependencies with fallback
    try:
        import pytesseract
        from pdf2image import convert_from_path
        ocr_available = True
    except ImportError as e:
        logger.warning(f"OCR dependencies not available, will use text extraction only: {e}")
        ocr_available = False
        pytesseract = None
        convert_from_path = None
    
    result = {
        "document_type": "kpi_dashboard",
        "file_path": pdf_path,
        "file_name": os.path.basename(pdf_path),
        "total_pages": 0,
        "pages": [],
        "all_metrics": [],
        "extraction_quality": {
            "pages_processed": 0,
            "metrics_extracted": 0,
            "ocr_pages": 0,
            "warnings": [],
        }
    }
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            result["total_pages"] = len(pdf.pages)
            
            for page_num, page in enumerate(pdf.pages, start=1):
                logger.info(f"Processing KPI dashboard page {page_num}/{len(pdf.pages)}")
                
                # Extract text using pdfplumber first
                raw_text = page.extract_text() or ""
                
                # If text extraction is sparse, use OCR if available
                if len(raw_text.strip()) < 200 and ocr_available:
                    logger.info(f"Page {page_num}: Sparse text ({len(raw_text)} chars), using OCR")
                    try:
                        images = convert_from_path(pdf_path, dpi=200, first_page=page_num, last_page=page_num)
                        if images:
                            ocr_text = pytesseract.image_to_string(images[0])
                            if len(ocr_text.strip()) > len(raw_text.strip()):
                                raw_text = ocr_text
                                result["extraction_quality"]["ocr_pages"] += 1
                            images[0].close()
                    except Exception as ocr_error:
                        logger.warning(f"OCR failed for page {page_num}: {ocr_error}")
                
                # Fix reversed text patterns from OCR/visual extraction
                raw_text = fix_reversed_text(raw_text)
                logger.info(f"Page {page_num}: Applied reversed text correction")
                
                page_data = {
                    "page_number": page_num,
                    "metadata": extract_page_metadata(page, page_num),
                    "metrics": [],
                    "raw_text": raw_text,
                }
                
                # Update metadata with OCR text if needed
                if page_data["metadata"].get("view_type") is None and raw_text:
                    # Try to extract view type from OCR text
                    view_patterns = [
                        (r"(\w+)'?\d*-?\s*Entity\s*View", "entity_view"),
                        (r"(\w+)'?\d*-?\s*MS\s*View", "ms_view"),
                    ]
                    for pattern, view_type in view_patterns:
                        match = re.search(pattern, raw_text, re.IGNORECASE)
                        if match:
                            page_data["metadata"]["view_type"] = view_type
                            page_data["metadata"]["entity"] = match.group(1).strip()
                            break
                
                metrics = extract_metric_cards(page, page_num)
                
                # If no metrics found via layout, try parsing from raw OCR text
                if not metrics and raw_text:
                    metrics = _parse_metrics_from_text(raw_text, "ocr", page_num)
                
                page_data["metrics"] = metrics
                
                result["pages"].append(page_data)
                result["all_metrics"].extend(metrics)
                result["extraction_quality"]["pages_processed"] += 1
                result["extraction_quality"]["metrics_extracted"] += len(metrics)
                
            if result["extraction_quality"]["metrics_extracted"] == 0:
                result["extraction_quality"]["warnings"].append(
                    "No structured metrics detected - PDF may not be a KPI dashboard format"
                )
                
    except Exception as e:
        logger.error(f"Error extracting KPI dashboard: {e}")
        result["extraction_quality"]["warnings"].append(f"Extraction error: {str(e)}")
    
    logger.info(f"KPI Dashboard extraction complete: {result['extraction_quality']['metrics_extracted']} metrics from {result['extraction_quality']['pages_processed']} pages ({result['extraction_quality']['ocr_pages']} OCR)")
    
    return result


def convert_to_chunks(extraction_result: Dict[str, Any], doc_id: str) -> List[Dict[str, Any]]:
    """
    Convert extracted KPI dashboard data into chunks for embedding.
    Each page becomes a chunk with structured metadata.
    Ensures all text is properly stringified for embedding API.
    """
    chunks = []
    
    for page_data in extraction_result.get("pages", []):
        page_num = page_data.get("page_number", 0)
        metadata = page_data.get("metadata", {})
        metrics = page_data.get("metrics", [])
        raw_text = str(page_data.get("raw_text", "") or "")
        # Apply reversed text fix again to ensure all text is corrected
        raw_text = fix_reversed_text(raw_text)
        
        structured_text_parts = []
        
        if metadata.get("view_type"):
            structured_text_parts.append(f"View: {metadata['view_type']}")
        if metadata.get("entity"):
            structured_text_parts.append(f"Entity: {metadata['entity']}")
        if metadata.get("year") and metadata.get("month"):
            structured_text_parts.append(f"Period: {metadata['month']} {metadata['year']}")
        
        structured_text_parts.append("\n--- METRICS ---\n")
        
        metrics_found = False
        for metric in metrics:
            metric_name = str(metric.get("metric_name", "Unknown") or "Unknown")
            values = metric.get("values", {}) or {}
            trend = metric.get("trend_data", {}) or {}
            
            metric_line = f"\n{metric_name}:"
            has_values = False
            
            if values.get("ytd_actual") is not None:
                try:
                    metric_line += f" YTD Actual = {float(values['ytd_actual']):,.2f}"
                    has_values = True
                except (ValueError, TypeError):
                    pass
            if values.get("ytd_forecast") is not None:
                try:
                    metric_line += f", YTD Forecast = {float(values['ytd_forecast']):,.2f}"
                    has_values = True
                except (ValueError, TypeError):
                    pass
            if values.get("cf_plan") is not None:
                try:
                    metric_line += f", CF Plan = {float(values['cf_plan']):,.2f}"
                    has_values = True
                except (ValueError, TypeError):
                    pass
            if values.get("cf02_2024") is not None:
                try:
                    metric_line += f", CF02.2024 = {float(values['cf02_2024']):,.2f}"
                    has_values = True
                except (ValueError, TypeError):
                    pass
            
            if trend:
                try:
                    trend_parts = []
                    for m, v in trend.items():
                        if v is not None:
                            trend_parts.append(f"{m}={float(v):,.0f}")
                    if trend_parts:
                        metric_line += f" | Trend: {', '.join(trend_parts)}"
                        has_values = True
                except (ValueError, TypeError):
                    pass
            
            if has_values:
                structured_text_parts.append(metric_line)
                metrics_found = True
            elif metric_name and metric_name != "Unknown":
                structured_text_parts.append(f"\n{metric_name}: (no values extracted)")
                metrics_found = True
        
        if not metrics_found:
            structured_text_parts.append("\n(No structured metrics extracted from this page)")
        
        structured_text_parts.append("\n\n--- RAW CONTENT ---\n")
        structured_text_parts.append(raw_text[:3000])
        
        chunk_text = "\n".join(structured_text_parts)
        
        # Ensure chunk text is valid non-empty string
        if not chunk_text.strip():
            chunk_text = f"Page {page_num} - Content extraction incomplete"
        
        chunk = {
            "text": chunk_text,
            "doc_id": doc_id,
            "chunk_num": page_num,
            "metadata": {
                "page_number": page_num,
                "view_type": str(metadata.get("view_type") or ""),
                "entity": str(metadata.get("entity") or ""),
                "period": f"{metadata.get('month', '')} {metadata.get('year', '')}".strip(),
                "metrics_count": len(metrics),
                "metric_names": [str(m.get("metric_name", "")) for m in metrics if m.get("metric_name")],
                "extraction_type": "kpi_dashboard",
            }
        }
        
        chunks.append(chunk)
    
    logger.info(f"Created {len(chunks)} chunks from KPI dashboard extraction")
    return chunks


def extract_kpi_dashboard_smart(pdf_path: str, use_vision: bool = True) -> Dict[str, Any]:
    """
    Smart extraction for KPI dashboard PDFs.
    Uses GPT-4 Vision for accurate extraction with fallback to text-based extraction.
    
    Args:
        pdf_path: Path to the PDF file
        use_vision: Whether to try Vision extraction first (default: True)
        
    Returns:
        Dictionary with extracted data
    """
    if use_vision:
        try:
            from .vision_extractor import extract_kpi_dashboard_with_vision
            
            logger.info("Attempting Vision-based extraction for KPI dashboard")
            result = extract_kpi_dashboard_with_vision(pdf_path)
            
            # Check if Vision extraction was successful
            if result.get("extraction_quality", {}).get("metrics_extracted", 0) > 0:
                logger.info(f"Vision extraction successful: {result['extraction_quality']['metrics_extracted']} metrics")
                return result
            else:
                logger.warning("Vision extraction returned no metrics, falling back to text extraction")
        except ImportError as e:
            logger.warning(f"Vision extractor not available: {e}")
        except Exception as e:
            logger.error(f"Vision extraction failed: {e}, falling back to text extraction")
    
    # Fallback to text-based extraction
    logger.info("Using text-based extraction for KPI dashboard")
    return extract_kpi_dashboard(pdf_path)


def convert_to_chunks_smart(extraction_result: Dict[str, Any], doc_id: str) -> List[Dict[str, Any]]:
    """
    Smart chunk conversion that handles both Vision and text-based extraction results.
    
    Args:
        extraction_result: Result from either extraction method
        doc_id: Document ID
        
    Returns:
        List of chunks
    """
    extraction_method = extraction_result.get("extraction_method", "text")
    
    if extraction_method == "gpt4_vision":
        try:
            from .vision_extractor import convert_vision_to_chunks
            return convert_vision_to_chunks(extraction_result, doc_id)
        except ImportError:
            logger.warning("Vision extractor not available, using text-based chunking")
    
    return convert_to_chunks(extraction_result, doc_id)


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
        use_vision = "--vision" in sys.argv or "-v" in sys.argv
        
        if is_kpi_dashboard_pdf(pdf_path):
            print(f"Detected as KPI Dashboard PDF")
            
            if use_vision:
                print("Using Vision-based extraction...")
                result = extract_kpi_dashboard_smart(pdf_path, use_vision=True)
            else:
                print("Using text-based extraction...")
                result = extract_kpi_dashboard(pdf_path)
            
            print(f"Extracted {result['extraction_quality']['metrics_extracted']} metrics from {result['extraction_quality']['pages_processed']} pages")
            
            for page in result["pages"]:
                if result.get("extraction_method") == "gpt4_vision":
                    meta = page.get("page_metadata", {})
                    print(f"\nPage {page['page_number']}: {meta.get('entity', 'Unknown')} - {meta.get('view_type', 'Unknown')}")
                    for metric in page.get("metrics", []):
                        print(f"  - {metric.get('metric_name', 'Unknown')}: YTD Actual = {metric.get('ytd_actual')}")
                else:
                    print(f"\nPage {page['page_number']}: {page['metadata']}")
                    for metric in page["metrics"]:
                        print(f"  - {metric['metric_name']}: {metric['values']}")
        else:
            print(f"Not a KPI Dashboard PDF format")
    else:
        print("Usage: python kpi_dashboard_extractor.py <pdf_path> [--vision|-v]")
