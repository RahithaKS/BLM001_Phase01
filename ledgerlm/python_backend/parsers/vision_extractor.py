#!/usr/bin/env python3
"""
GPT-4 Vision-based KPI Dashboard Extractor for LedgerLM

Uses OpenAI's GPT-4 Vision API to accurately extract metrics from 
complex visual PDF layouts where text-based extraction fails.

Handles:
- Left/Right column metric cards
- Multiple value columns (CF02.2024, CF Plan, YTD Forecast, YTD Actual)
- Monthly trend data
- Entity and view type identification
"""

import os
import base64
import json
import logging
from typing import List, Dict, Any, Optional
from pdf2image import convert_from_path
from io import BytesIO

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vision-extractor")

# Static page-to-entity mapping for Bosch KPI PDFs
# This ensures correct country assignment regardless of GPT-4 Vision interpretation
BOSCH_KPI_PAGE_MAPPING = {
    1: {"view_type": "Entity View", "entity": "Global"},
    2: {"view_type": "Entity View", "entity": "India"},
    3: {"view_type": "Entity View", "entity": "Vietnam"},
    4: {"view_type": "Entity View", "entity": "Mexico"},
    5: {"view_type": "MS View", "entity": "Global"},
    6: {"view_type": "MS View", "entity": "India"},
    7: {"view_type": "MS View", "entity": "Vietnam"},
    8: {"view_type": "MS View", "entity": "Mexico"},
    9: {"view_type": "MS GB View", "entity": "VM"},
    10: {"view_type": "MS GB View", "entity": "PS"},
    11: {"view_type": "MS GB View", "entity": "XC excl CV"},
    12: {"view_type": "SX View", "entity": "Global"},
    13: {"view_type": "SX View", "entity": "India"},
    14: {"view_type": "SX View", "entity": "Vietnam"},
    15: {"view_type": "SX View", "entity": "Mexico"},
    16: {"view_type": "NE-MM View", "entity": "NE-MM"},
    17: {"view_type": "Pyramid Salary", "entity": "India"},
}

def apply_static_page_mapping(page_data: Dict[str, Any], page_num: int) -> Dict[str, Any]:
    """
    Override GPT-4 Vision's entity/view_type with static page mapping.
    This fixes Vietnam/Mexico data swap issues caused by Vision misreading flags.
    """
    if page_num in BOSCH_KPI_PAGE_MAPPING:
        static_mapping = BOSCH_KPI_PAGE_MAPPING[page_num]
        
        # Ensure page_metadata exists
        if "page_metadata" not in page_data:
            page_data["page_metadata"] = {}
        
        # Get what Vision detected for logging
        vision_entity = page_data["page_metadata"].get("entity", "Unknown")
        vision_view = page_data["page_metadata"].get("view_type", "Unknown")
        
        # Override with static mapping
        page_data["page_metadata"]["entity"] = static_mapping["entity"]
        page_data["page_metadata"]["view_type"] = static_mapping["view_type"]
        
        # Log if there was a mismatch
        if vision_entity != static_mapping["entity"]:
            logger.warning(f"Page {page_num}: Corrected entity from '{vision_entity}' to '{static_mapping['entity']}'")
        
        logger.info(f"Page {page_num}: Applied static mapping -> {static_mapping['entity']} / {static_mapping['view_type']}")
    
    return page_data

# Import OpenAI - handle both sync and async clients
try:
    import requests
# Vision handled via fallback or custom endpoint if available
    OPENAI_AVAILABLE = True
except ImportError:
    OpenAI = None  # type: ignore
    OPENAI_AVAILABLE = False
    logger.warning("OpenAI package not available")


# Structured prompt for KPI dashboard extraction
KPI_EXTRACTION_PROMPT = """Analyze this KPI dashboard page and extract ALL metrics with their values.

The page has LEFT and RIGHT columns, each containing metric cards.

For EACH metric card, extract:
1. metric_name: The name of the metric (e.g., "Budget (mUSD)", "Offshore Capacity", "Attrition", etc.)
2. position: "left" or "right" column
3. cf02_2024: The CF02.2024 value (null if N/A or --)
4. cf_plan: The CF Plan value (null if N/A or --)  
5. ytd_forecast: The YTD Forecast value (null if N/A or --)
6. ytd_actual: The YTD Actual value (this is usually the main/highlighted value)
7. monthly_trend: Object with month abbreviations as keys (e.g., {"Apr": 523, "May": 540, "Jun": 523})

Also extract page-level metadata:
- entity: The country/region (e.g., "Global", "India", "Vietnam", "Mexico")
- view_type: The view type (e.g., "Entity View", "MS View", "SX View")
- year: The year shown (e.g., "2024")
- month: The month shown (e.g., "Jun")

IMPORTANT RULES:
1. Read values EXACTLY as shown - do not confuse metrics
2. "Offshore Capacity" and "Outsourcing Capacity" are DIFFERENT metrics
3. Average and End values should be captured separately if shown
4. Percentages should be stored as numbers (e.g., 11.0 for 11.0%)
5. Large numbers may have commas (e.g., 32,455 = 32455)
6. Return null for missing or "--" values

Return ONLY valid JSON in this exact format:
{
  "page_metadata": {
    "entity": "string",
    "view_type": "string", 
    "year": "string",
    "month": "string"
  },
  "metrics": [
    {
      "metric_name": "string",
      "position": "left|right",
      "cf02_2024": number|null,
      "cf_plan": number|null,
      "ytd_forecast": number|null,
      "ytd_actual": number|null,
      "ytd_actual_avg": number|null,
      "ytd_actual_end": number|null,
      "monthly_trend": {"Apr": number, "May": number, "Jun": number}
    }
  ]
}"""


def get_openai_client() -> Optional[Any]:
    """OpenAI Vision disabled in favor of self-hosted LLM fallback."""
    return None


def image_to_base64(image) -> str:
    """Convert PIL Image to base64 string."""
    buffered = BytesIO()
    image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")


def extract_page_with_vision(image, page_num: int, client: Any) -> Dict[str, Any]:
    """
    Extract metrics from a single page image using GPT-4 Vision.
    
    Args:
        image: PIL Image of the page
        page_num: Page number (1-indexed)
        client: OpenAI client
        
    Returns:
        Dictionary with extracted metrics and metadata
    """
    logger.info(f"Extracting page {page_num} with GPT-4 Vision")
    
    content: Optional[str] = None
    try:
        # Convert image to base64
        base64_image = image_to_base64(image)
        
        # Call GPT-4 Vision API
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": KPI_EXTRACTION_PROMPT
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{base64_image}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ],
            max_tokens=4096,
            temperature=0  # Deterministic output for accuracy
        )
        
        # Parse response
        content = response.choices[0].message.content
        
        if content is None:
            raise ValueError("Empty response from GPT-4 Vision")
        
        # Extract JSON from response (handle markdown code blocks)
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        
        result = json.loads(content.strip())
        result["page_number"] = page_num
        result["extraction_method"] = "gpt4_vision"
        
        logger.info(f"Page {page_num}: Extracted {len(result.get('metrics', []))} metrics")
        return result
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response for page {page_num}: {e}")
        logger.error(f"Raw response: {content[:500] if content else 'N/A'}")
        return {
            "page_number": page_num,
            "extraction_method": "gpt4_vision",
            "error": f"JSON parse error: {str(e)}",
            "metrics": []
        }
    except Exception as e:
        logger.error(f"Vision extraction failed for page {page_num}: {e}")
        return {
            "page_number": page_num,
            "extraction_method": "gpt4_vision",
            "error": str(e),
            "metrics": []
        }


def extract_kpi_dashboard_with_vision(pdf_path: str) -> Dict[str, Any]:
    """
    Extract KPI dashboard data from PDF using GPT-4 Vision.
    
    Args:
        pdf_path: Path to the PDF file
        
    Returns:
        Dictionary with all extracted data
    """
    logger.info(f"Starting Vision extraction for: {pdf_path}")
    
    result = {
        "document_type": "kpi_dashboard",
        "file_path": pdf_path,
        "file_name": os.path.basename(pdf_path),
        "extraction_method": "gpt4_vision",
        "total_pages": 0,
        "pages": [],
        "all_metrics": [],
        "extraction_quality": {
            "pages_processed": 0,
            "metrics_extracted": 0,
            "errors": []
        }
    }
    
    # Get OpenAI client
    client = get_openai_client()
    if not client:
        result["extraction_quality"]["errors"].append("OpenAI client not available")
        return result
    
    try:
        # Get total page count first (without loading images)
        import PyPDF2
        with open(pdf_path, 'rb') as f:
            pdf_reader = PyPDF2.PdfReader(f)
            total_pages = len(pdf_reader.pages)
        
        result["total_pages"] = total_pages
        logger.info(f"PDF has {total_pages} pages, processing one at a time")
        
        # Process ONE PAGE AT A TIME to prevent memory exhaustion
        for page_num in range(1, total_pages + 1):
            logger.info(f"Processing page {page_num}/{total_pages}")
            
            try:
                # Convert only THIS page to image
                images = convert_from_path(
                    pdf_path, 
                    dpi=150,
                    first_page=page_num,
                    last_page=page_num
                )
                
                if not images:
                    logger.warning(f"No image generated for page {page_num}")
                    continue
                
                image = images[0]
                page_data = extract_page_with_vision(image, page_num, client)
                
                # CRITICAL: Apply static page mapping to fix Vietnam/Mexico swap
                # GPT-4 Vision sometimes misreads flags, causing entity confusion
                page_data = apply_static_page_mapping(page_data, page_num)
                
                result["pages"].append(page_data)
                
                # Aggregate metrics with corrected entity/view_type
                if page_data.get("metrics"):
                    for metric in page_data["metrics"]:
                        metric["page_number"] = page_num
                        if page_data.get("page_metadata"):
                            metric["entity"] = page_data["page_metadata"].get("entity")
                            metric["view_type"] = page_data["page_metadata"].get("view_type")
                        result["all_metrics"].append(metric)
                        result["extraction_quality"]["metrics_extracted"] += 1
                
                if page_data.get("error"):
                    result["extraction_quality"]["errors"].append(
                        f"Page {page_num}: {page_data['error']}"
                    )
                else:
                    result["extraction_quality"]["pages_processed"] += 1
                
                # Close image to free memory
                image.close()
                del images
                
            except Exception as page_error:
                logger.error(f"Failed to process page {page_num}: {page_error}")
                result["extraction_quality"]["errors"].append(f"Page {page_num}: {str(page_error)}")
        
    except Exception as e:
        logger.error(f"Vision extraction failed: {e}")
        result["extraction_quality"]["errors"].append(str(e))
    
    logger.info(f"Vision extraction complete: {result['extraction_quality']['metrics_extracted']} metrics from {result['extraction_quality']['pages_processed']} pages")
    
    return result


def convert_vision_to_chunks(extraction_result: Dict[str, Any], doc_id: str) -> List[Dict[str, Any]]:
    """
    Convert Vision-extracted KPI data into chunks for embedding.
    Creates highly structured chunks optimized for RAG retrieval.
    
    Args:
        extraction_result: Result from extract_kpi_dashboard_with_vision
        doc_id: Document ID for chunk association
        
    Returns:
        List of chunk dictionaries
    """
    chunks = []
    
    for page_data in extraction_result.get("pages", []):
        page_num = page_data.get("page_number", 0)
        metadata = page_data.get("page_metadata", {})
        metrics = page_data.get("metrics", [])
        
        # Skip pages with errors
        if page_data.get("error") and not metrics:
            continue
        
        # CRITICAL: Apply static page mapping to ensure correct entity assignment
        # This is a safety net in case extraction didn't apply the mapping
        if page_num in BOSCH_KPI_PAGE_MAPPING:
            static_mapping = BOSCH_KPI_PAGE_MAPPING[page_num]
            entity = static_mapping["entity"]
            view_type = static_mapping["view_type"]
            logger.debug(f"Chunk generation: Page {page_num} -> {entity} / {view_type}")
        else:
            entity = metadata.get("entity", "Unknown")
            view_type = metadata.get("view_type", "Unknown View")
        
        # Build structured text for this page
        text_parts = []
        year = metadata.get("year", "")
        month = metadata.get("month", "")
        
        text_parts.append(f"=== {entity} - {view_type} ===")
        if year and month:
            text_parts.append(f"Period: {month} {year}")
        text_parts.append("")
        
        # Group metrics by position
        left_metrics = [m for m in metrics if m.get("position") == "left"]
        right_metrics = [m for m in metrics if m.get("position") == "right"]
        
        # Format metrics
        for metric in metrics:
            metric_name = metric.get("metric_name", "Unknown Metric")
            text_parts.append(f"\n{metric_name}:")
            
            # Add all available values
            value_parts = []
            
            if metric.get("ytd_actual") is not None:
                value_parts.append(f"YTD Actual = {metric['ytd_actual']:,.2f}" if isinstance(metric['ytd_actual'], (int, float)) else f"YTD Actual = {metric['ytd_actual']}")
            
            if metric.get("ytd_actual_avg") is not None:
                value_parts.append(f"YTD Actual (Avg) = {metric['ytd_actual_avg']:,.2f}" if isinstance(metric['ytd_actual_avg'], (int, float)) else f"YTD Actual (Avg) = {metric['ytd_actual_avg']}")
            
            if metric.get("ytd_actual_end") is not None:
                value_parts.append(f"YTD Actual (End) = {metric['ytd_actual_end']:,.2f}" if isinstance(metric['ytd_actual_end'], (int, float)) else f"YTD Actual (End) = {metric['ytd_actual_end']}")
            
            if metric.get("ytd_forecast") is not None:
                value_parts.append(f"YTD Forecast = {metric['ytd_forecast']:,.2f}" if isinstance(metric['ytd_forecast'], (int, float)) else f"YTD Forecast = {metric['ytd_forecast']}")
            
            if metric.get("cf_plan") is not None:
                value_parts.append(f"CF Plan = {metric['cf_plan']:,.2f}" if isinstance(metric['cf_plan'], (int, float)) else f"CF Plan = {metric['cf_plan']}")
            
            if metric.get("cf02_2024") is not None:
                value_parts.append(f"CF02.2024 = {metric['cf02_2024']:,.2f}" if isinstance(metric['cf02_2024'], (int, float)) else f"CF02.2024 = {metric['cf02_2024']}")
            
            if value_parts:
                text_parts.append("  " + ", ".join(value_parts))
            
            # Add trend data
            trend = metric.get("monthly_trend", {})
            if trend:
                trend_str = ", ".join([f"{m}={v}" for m, v in trend.items() if v is not None])
                if trend_str:
                    text_parts.append(f"  Monthly Trend: {trend_str}")
        
        chunk_text = "\n".join(text_parts)
        
        # Create chunk with rich metadata
        chunk = {
            "text": chunk_text,
            "doc_id": doc_id,
            "chunk_num": page_num,
            "metadata": {
                "page_number": page_num,
                "entity": entity,
                "view_type": view_type,
                "period": f"{month} {year}".strip(),
                "metrics_count": len(metrics),
                "metric_names": [m.get("metric_name", "") for m in metrics],
                "extraction_type": "kpi_dashboard_vision",
            }
        }
        
        chunks.append(chunk)
    
    logger.info(f"Created {len(chunks)} chunks from Vision extraction")
    return chunks


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
        
        print(f"Extracting KPI dashboard with Vision: {pdf_path}")
        result = extract_kpi_dashboard_with_vision(pdf_path)
        
        print(f"\nExtraction Summary:")
        print(f"  Total Pages: {result['total_pages']}")
        print(f"  Pages Processed: {result['extraction_quality']['pages_processed']}")
        print(f"  Metrics Extracted: {result['extraction_quality']['metrics_extracted']}")
        
        if result['extraction_quality']['errors']:
            print(f"  Errors: {result['extraction_quality']['errors']}")
        
        print("\n--- Extracted Metrics ---")
        for page in result["pages"]:
            page_num = page.get("page_number", 0)
            meta = page.get("page_metadata", {})
            print(f"\nPage {page_num}: {meta.get('entity', 'Unknown')} - {meta.get('view_type', 'Unknown')}")
            
            for metric in page.get("metrics", []):
                name = metric.get("metric_name", "Unknown")
                actual = metric.get("ytd_actual")
                print(f"  - {name}: YTD Actual = {actual}")
    else:
        print("Usage: python vision_extractor.py <pdf_path>")
