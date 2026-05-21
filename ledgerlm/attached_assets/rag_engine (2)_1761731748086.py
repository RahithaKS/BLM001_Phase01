import os
import json
import re
import html
from openai import OpenAI
import logging
from vector_store import search_vector_store, search_across_documents
import requests
from urllib.parse import quote

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize OpenAI client
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

# the newest OpenAI model is "gpt-4o" which was released May 13, 2024.
# do not change this unless explicitly requested by the user
CHAT_MODEL = "gpt-4o"


def calculate_cagr(start_value, end_value, num_years):
    """
    Calculate Compound Annual Growth Rate (CAGR)
    
    Parameters:
    - start_value: Initial value
    - end_value: Final value
    - num_years: Number of years between start and end values
    
    Returns:
    - CAGR as a percentage
    """
    if start_value <= 0 or num_years <= 0:
        return 0

    cagr = (pow(end_value / start_value, 1 / num_years) - 1) * 100
    return round(cagr, 2)


def detect_data_preference(query):
    """
    Intelligently detect whether user wants consolidated or standalone data based on query
    """
    query_lower = query.lower()
    
    # Consolidated data indicators
    consolidated_keywords = [
        "consolidated", "group", "total", "overall", "combined", "including subsidiaries",
        "entire company", "all operations", "comprehensive", "subsidiaries included"
    ]
    
    # Standalone data indicators  
    standalone_keywords = [
        "standalone", "parent company", "parent only", "excluding subsidiaries", 
        "core business", "main company", "primary operations", "without subsidiaries"
    ]
    
    # Check for explicit preferences
    for keyword in consolidated_keywords:
        if keyword in query_lower:
            return "consolidated"
            
    for keyword in standalone_keywords:
        if keyword in query_lower:
            return "standalone"
    
    # Default to consolidated for comprehensive analysis
    return "consolidated"

def should_search_web(query, answer_text="", pdf_confidence=1.0):
    """
    Determine if Google API web search should be triggered based on query content and PDF results
    """
    query_lower = query.lower()
    
    # Always search queries - these require current/live information
    always_search_queries = [
        "current", "latest", "recent", "today", "now", "this year", "2024", "2025",
        "website", "url", "phone", "email", "address", "contact", "headquarters",
        "stock price", "market cap", "share price", "trading", "ticker",
        "news", "announcement", "press release", "earnings", "financial results"
    ]
    
    # Check if query contains always-search terms
    if any(term in query_lower for term in always_search_queries):
        logger.info(f"Google API web search triggered by always-search term in query: {query}")
        return True
    
    # Check PDF result quality
    if not answer_text or answer_text.strip() == "":
        logger.info("Google API web search triggered: No PDF results found")
        return True
    
    if pdf_confidence < 0.3:
        logger.info(f"Google API web search triggered: Low PDF confidence ({pdf_confidence})")
        return True
    
    if len(answer_text.strip()) < 50:
        logger.info("Google API web search triggered: Very short PDF answer")
        return True
    
    return False


def perform_web_search(query, num_results=3):
    """
    Perform Google Custom Search API search
    """
    try:
        google_api_key = os.environ.get("GOOGLE_API_KEY")
        google_cse_id = os.environ.get("GOOGLE_CSE_ID")
        
        if not google_api_key or not google_cse_id:
            logger.warning("Google API credentials not found - web search disabled")
            return []
        
        url = "https://www.googleapis.com/customsearch/v1"
        params = {
            'key': google_api_key,
            'cx': google_cse_id,
            'q': query,
            'num': num_results
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        results = []
        
        for item in data.get('items', []):
            results.append({
                'title': item.get('title', ''),
                'link': item.get('link', ''),
                'snippet': item.get('snippet', ''),
                'content': item.get('snippet', '')  # Use snippet as content
            })
        
        logger.info(f"Google API web search returned {len(results)} results")
        return results
        
    except Exception as e:
        logger.error(f"Google API web search failed: {str(e)}")
        return []


def synthesize_web_and_document_results(query, document_answer, web_results):
    """
    Synthesize document analysis with web search results using comprehensive prompt from attached system
    """
    try:
        web_content = "\n".join([f"Source: {result['title']}\nContent: {result['content']}" 
                                for result in web_results[:3]])
        
        # Enhanced web search synthesis prompt from the attached comprehensive system
        synthesis_prompt = f"""Based on the document analysis: "{document_answer}"
        And these web search results:
        {web_content}
        
        Please provide a comprehensive, synthesized answer to the original question: "{query}"
        
        Instructions:
        - Combine information from both the document and web sources
        - Provide a complete, detailed answer
        - Clearly indicate when information comes from web sources vs documents
        - Give the most current and accurate information available
        - Format the response professionally with clear sections if needed
        - Include a Financial Analysis Reasoning section for financial queries
        """
        
        response = client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[{
                "role": "system", 
                "content": "You are LedgerLM, an expert financial analysis assistant that synthesizes document analysis with current web information to provide comprehensive institutional-grade analysis."
            }, {
                "role": "user",
                "content": synthesis_prompt
            }],
            temperature=0.2,
            max_tokens=2000
        )
        
        if response and hasattr(response, 'choices') and len(response.choices) > 0:
            enhanced_answer = response.choices[0].message.content
            return f"🔍 **Enhanced with web search ({len(web_results)} results)**\n\n{enhanced_answer}"
        
        return document_answer
        
    except Exception as e:
        logger.error(f"Web synthesis failed: {str(e)}")
        return document_answer


def format_financial_tables(text):
    """Format financial tables for better display"""

    try:
        # Look for table-like structures in the text
        lines = text.split('\n')
        formatted_lines = []
        i = 0

        while i < len(lines):
            line = lines[i]

            # Check if this line looks like a table header or data row
            if re.search(
                    r'(?:Supporting Data Table|Metric|Year|Value|NOK|USD|EUR|Calculation)',
                    line, re.IGNORECASE):
                # Check if the next few lines contain table data
                table_lines = [line]
                j = i + 1

                # Collect consecutive table-like lines
                while j < len(
                        lines
                ) and j < i + 15:  # Limit to prevent over-processing
                    next_line = lines[j].strip()
                    if not next_line:
                        break

                    # Check if line contains financial data patterns
                    if (re.search(
                            r'[\d,]+\.?\d*\s*(?:NOK|USD|EUR|%)', next_line
                    ) or re.search(r'\d{4}.*[\d,]+', next_line) or re.search(
                            r'(?:Total|EBIT|Interest|Debt|Equity|Assets|Ratio)',
                            next_line, re.IGNORECASE)):
                        table_lines.append(next_line)
                        j += 1
                    else:
                        break

                # If we found table data, format it properly
                if len(table_lines) > 1:
                    formatted_table = format_table_structure(table_lines)
                    formatted_lines.extend(formatted_table)
                    # Skip the processed lines
                    i = j
                else:
                    formatted_lines.append(line)
                    i += 1
            else:
                formatted_lines.append(line)
                i += 1

        return '\n'.join(formatted_lines)

    except Exception as e:
        logger.error(f"Error formatting financial tables: {e}")
        return text


def format_table_structure(table_lines):
    """Format a list of table lines into a properly structured table"""
    try:
        # Create properly aligned text table
        formatted = []

        # Process header if present
        if table_lines and re.search(
                r'(?:Supporting Data Table|Metric|Year|Value|Calculation)',
                table_lines[0], re.IGNORECASE):
            header = table_lines[0]
            if "Supporting Data Table" in header:
                formatted.append("**Supporting Data Table:**")
                formatted.append("")
            else:
                formatted.append(f"**{header}**")
                formatted.append("")
            table_lines = table_lines[1:]

        # Process data rows
        for line in table_lines:
            if line.strip():
                # Split line into columns and format
                parts = re.split(r'\s{2,}|\t', line.strip())
                if len(parts) >= 2:
                    formatted_row = format_table_row_text(parts)
                    formatted.append(formatted_row)
                else:
                    formatted.append(line)

        return formatted

    except Exception as e:
        logger.error(f"Error formatting table structure: {e}")
        return table_lines


def format_table_row_text(parts):
    """Format individual table row with proper text alignment"""
    try:
        # Ensure we have at least 4 columns for consistency
        while len(parts) < 4:
            parts.append("")

        # Clean and format each part
        cleaned_parts = []
        for part in parts[:4]:  # Limit to 4 columns
            cleaned_part = part.strip()
            # Format numbers with proper spacing
            if re.search(r'[\d,]+\.?\d*', cleaned_part):
                cleaned_part = re.sub(r'(\d)([A-Za-z])', r'\1 \2',
                                      cleaned_part)
            cleaned_parts.append(cleaned_part)

        return "| " + " | ".join(cleaned_parts) + " |"

    except Exception as e:
        logger.error(f"Error formatting table row: {e}")
        return "| " + " | ".join(parts[:4]) + " |"


def calculate_growth_rates(years, values):
    """
    Calculate year-over-year growth rates and CAGR for a time series
    
    Parameters:
    - years: List of years (strings)
    - values: List of corresponding values
    
    Returns:
    - Dictionary with growth rates and CAGR
    """
    if len(years) < 2 or len(values) < 2:
        return None

    # Convert years to integers for calculation
    years_int = [int(y) for y in years]

    # Calculate year-over-year growth rates
    growth_rates = []
    for i in range(1, len(values)):
        if values[i - 1] == 0:
            growth_rates.append(0)
        else:
            growth_rate = ((values[i] - values[i - 1]) / values[i - 1]) * 100
            growth_rates.append(round(growth_rate, 2))

    # Calculate CAGR between first and last values
    total_years = years_int[-1] - years_int[0]
    if total_years > 0:
        cagr = calculate_cagr(values[0], values[-1], total_years)
    else:
        cagr = 0

    return {
        'growth_rates': growth_rates,
        'growth_rate_years': years[1:],
        'cagr': cagr,
        'cagr_period': f"{years[0]}-{years[-1]}"
    }


def forecast_future_values(historical_data, forecast_years):
    """
    Forecast future values using CAGR from historical data
    
    Parameters:
    - historical_data: Dictionary with years as keys and values as values
    - forecast_years: List of years to forecast
    
    Returns:
    - Dictionary with forecasted values
    """
    if not historical_data or len(historical_data) < 2:
        return {}

    years = sorted(historical_data.keys())
    values = [historical_data[year] for year in years]

    # Calculate CAGR from historical data
    start_value = values[0]
    end_value = values[-1]
    num_years = int(years[-1]) - int(years[0])

    if start_value <= 0 or num_years <= 0:
        return {}

    cagr = calculate_cagr(start_value, end_value, num_years)
    growth_rate = cagr / 100  # Convert percentage to decimal

    # Forecast future values
    forecasted = {}
    last_year = int(years[-1])
    last_value = end_value

    for target_year in forecast_years:
        year_diff = int(target_year) - last_year
        if year_diff > 0:
            forecasted_value = last_value * ((1 + growth_rate)**year_diff)
            forecasted[target_year] = round(forecasted_value, 2)

    return forecasted


def format_structured_data_as_tables(context_chunks):
    """
    Enhanced format structured data from Excel/Anaplan files with dynamic time-series analysis
    
    Parameters:
    - context_chunks: List of chunks that may contain structured data
    
    Returns:
    - Dictionary with formatted tables and comprehensive financial analysis insights
    """
    try:
        # Import the time-series analyzer (lazy import to avoid circular dependencies)
        try:
            from time_series_analyzer import analyze_financial_time_series
            has_time_series_analyzer = True
        except ImportError as e:
            logger.warning(f"Time-series analyzer not available: {e}. Using basic analysis.")
            has_time_series_analyzer = False
        
        formatted_tables = []
        table_summaries = []
        financial_insights = []
        total_rows_processed = 0
        time_series_results = {}
        
        for chunk in context_chunks:
            chunk_text = chunk.get("text", "") if isinstance(chunk, dict) else str(chunk)
            
            # Look for table-like data patterns (structured Excel data)
            if "Sheet:" in chunk_text and "|" in chunk_text:
                # Extract sheet name
                sheet_match = re.search(r"Sheet:\s*([^\n]+)", chunk_text)
                sheet_name = sheet_match.group(1).strip() if sheet_match else "Unknown Sheet"
                
                # Parse table data into DataFrame for comprehensive analysis
                table_data = _parse_table_to_dataframe(chunk_text)
                
                if table_data is not None and not table_data.empty:
                    # Apply time-series analysis if available
                    if has_time_series_analyzer:
                        try:
                            ts_analysis = analyze_financial_time_series(
                                table_data,
                                metadata={'sheet_name': sheet_name, 'source': 'excel_chunk'}
                            )
                            time_series_results[sheet_name] = ts_analysis
                        except Exception as e:
                            logger.warning(f"Time-series analysis failed for {sheet_name}: {e}")
                            ts_analysis = None
                    else:
                        ts_analysis = None
                    
                    # Create enhanced markdown table with time-series insights
                    markdown_table = _create_enhanced_table_markdown(
                        sheet_name, table_data, ts_analysis
                    )
                    
                    formatted_tables.append(markdown_table)
                    total_rows_processed += len(table_data)
                    
                    # Create intelligent summary with time-series context
                    summary = _create_intelligent_summary(sheet_name, table_data, ts_analysis)
                    table_summaries.append(summary)
                    
                    # Store comprehensive insights
                    insights = _extract_comprehensive_insights(sheet_name, table_data, ts_analysis)
                    financial_insights.append(insights)
        
        # Generate overall analysis summary
        overall_summary = _generate_overall_analysis_summary(time_series_results)
        
        return {
            'formatted_tables': formatted_tables,  # Enhanced Markdown tables
            'table_summaries': table_summaries,
            'financial_insights': financial_insights,
            'time_series_analysis': time_series_results,
            'overall_summary': overall_summary,
            'total_tables': len(formatted_tables),
            'total_rows': total_rows_processed,
            'has_structured_data': len(formatted_tables) > 0,
            'has_time_series_data': len(time_series_results) > 0
        }
        
    except Exception as e:
        logger.error(f"Error formatting structured data: {e}")
        return {
            'formatted_tables': [],
            'table_summaries': [],
            'financial_insights': [],
            'time_series_analysis': {},
            'overall_summary': {},
            'total_tables': 0,
            'total_rows': 0,
            'has_structured_data': False,
            'has_time_series_data': False
        }


def _parse_table_to_dataframe(chunk_text):
    """Parse table text into a pandas DataFrame"""
    try:
        import pandas as pd
        
        lines = chunk_text.split('\n')
        table_lines = []
        in_table = False
        
        for line in lines:
            if '|' in line and len(line.strip()) > 0:
                table_lines.append(line.strip())
                in_table = True
            elif in_table and line.strip() == "":
                break
        
        if len(table_lines) > 1:
            # Parse header
            header_row = table_lines[0]
            headers = [h.strip() for h in header_row.split('|') if h.strip()]
            
            # Parse data rows
            data_rows = []
            for row_line in table_lines[1:]:
                if '|' in row_line:
                    row_data = [d.strip() for d in row_line.split('|') if d.strip()]
                    if len(row_data) >= len(headers):
                        data_rows.append(row_data[:len(headers)])  # Ensure consistent column count
            
            if data_rows:
                df = pd.DataFrame(data_rows, columns=headers)
                
                # Clean and convert numeric columns
                for col in df.columns:
                    # Try to convert to numeric if possible
                    df[col] = df[col].astype(str).str.replace(',', '').str.replace('$', '').str.replace('%', '')
                    df[col] = df[col].str.replace('(', '-').str.replace(')', '').str.strip()
                    
                    # Convert to numeric where possible
                    try:
                        df[col] = pd.to_numeric(df[col], errors='ignore')
                    except:
                        pass
                
                return df
        
        return None
        
    except Exception as e:
        logger.error(f"Error parsing table to DataFrame: {e}")
        return None


def _create_enhanced_table_markdown(sheet_name, table_data, ts_analysis):
    """Create enhanced markdown table with time-series insights"""
    try:
        # Start with basic table
        markdown = f"\n\n### 📊 **{sheet_name}**\n\n"
        
        # Display table (limit to first 15 rows)
        display_df = table_data.head(15)
        markdown += display_df.to_markdown(index=False) + "\n"
        
        if len(table_data) > 15:
            markdown += f"\n*Showing first 15 of {len(table_data)} total rows*\n\n"
        
        # Add time-series analysis insights if available
        if ts_analysis and 'financial_metrics' in ts_analysis:
            metrics = ts_analysis['financial_metrics']
            
            markdown += "**🔍 Advanced Financial Analysis:**\n\n"
            
            # Key insights
            if metrics.get('key_insights'):
                markdown += "**Key Insights:**\n"
                for insight in metrics['key_insights'][:5]:  # Top 5 insights
                    markdown += f"- {insight}\n"
                markdown += "\n"
            
            # Growth rates
            if metrics.get('growth_rates'):
                markdown += "**Growth Analysis:**\n"
                for metric, growth_data in list(metrics['growth_rates'].items())[:3]:  # Top 3 metrics
                    if growth_data.get('cagr'):
                        markdown += f"- **{metric}**: CAGR {growth_data['cagr']}%"
                        if growth_data.get('average_growth'):
                            markdown += f", Avg Growth: {growth_data['average_growth']}%"
                        markdown += "\n"
                markdown += "\n"
            
            # Variance analysis
            if metrics.get('variance_analysis'):
                markdown += "**Variance Analysis:**\n"
                for metric, variance_data in list(metrics['variance_analysis'].items())[:3]:
                    if variance_data.get('vs_budget'):
                        var_info = variance_data['vs_budget']
                        markdown += f"- **{metric}** vs Budget: {var_info['percentage_variance']:+.1f}% ({var_info['performance']})\n"
                    elif variance_data.get('vs_forecast'):
                        var_info = variance_data['vs_forecast']
                        markdown += f"- **{metric}** vs Forecast: {var_info['percentage_variance']:+.1f}% ({var_info['performance']})\n"
                markdown += "\n"
            
            # Data quality and structure info
            if ts_analysis.get('summary'):
                summary = ts_analysis['summary']
                markdown += f"**Data Quality Score:** {summary.get('data_quality_score', 0):.1%}\n"
                markdown += f"**Analysis Date:** {summary.get('analysis_date', 'N/A')}\n\n"
        
        else:
            # Fallback to basic analysis
            markdown += _create_basic_analysis_markdown(table_data)
        
        return markdown
        
    except Exception as e:
        logger.error(f"Error creating enhanced table markdown: {e}")
        return f"\n\n### 📊 **{sheet_name}**\n\n*Error creating enhanced analysis*\n\n"


def _create_basic_analysis_markdown(table_data):
    """Create basic analysis when time-series analysis is not available"""
    try:
        markdown = "**📈 Basic Financial Analysis:**\n\n"
        
        numeric_cols = table_data.select_dtypes(include=['number']).columns
        
        for col in numeric_cols[:5]:  # Limit to first 5 numeric columns
            if table_data[col].notna().any():
                total = table_data[col].sum()
                avg = table_data[col].mean()
                markdown += f"- **{col}**: Total: {total:,.0f}, Average: {avg:,.0f}\n"
        
        return markdown + "\n"
        
    except Exception as e:
        logger.error(f"Error creating basic analysis: {e}")
        return "**Analysis Error**\n\n"


def _create_intelligent_summary(sheet_name, table_data, ts_analysis):
    """Create intelligent summary with time-series context"""
    try:
        # Base summary
        summary = f"**{sheet_name}**: {len(table_data)} rows, {len(table_data.columns)} columns"
        
        # Add time-series context if available
        if ts_analysis:
            normalization = ts_analysis.get('data_normalization', {})
            fiscal_info = ts_analysis.get('fiscal_calendar', {})
            
            # Add detected scenarios
            scenarios = normalization.get('scenarios', [])
            if scenarios:
                scenario_text = ', '.join(scenarios[:3])  # First 3 scenarios
                summary += f" | Scenarios: {scenario_text}"
            
            # Add fiscal calendar info
            if fiscal_info.get('type') != 'calendar_year':
                summary += f" | Fiscal: {fiscal_info['type']}"
            
            # Add data quality
            quality_score = ts_analysis.get('summary', {}).get('data_quality_score', 0)
            summary += f" | Quality: {quality_score:.1%}"
        
        else:
            # Add basic column analysis
            numeric_cols = len(table_data.select_dtypes(include=['number']).columns)
            if numeric_cols > 0:
                summary += f" | {numeric_cols} numeric columns"
        
        return summary
        
    except Exception as e:
        logger.error(f"Error creating intelligent summary: {e}")
        return f"**{sheet_name}**: Analysis error"


def _extract_comprehensive_insights(sheet_name, table_data, ts_analysis):
    """Extract comprehensive insights for storage"""
    try:
        insights = {
            'sheet_name': sheet_name,
            'row_count': len(table_data),
            'column_count': len(table_data.columns),
            'numeric_columns': len(table_data.select_dtypes(include=['number']).columns),
            'analysis_type': 'basic'
        }
        
        if ts_analysis:
            insights.update({
                'analysis_type': 'time_series',
                'fiscal_calendar': ts_analysis.get('fiscal_calendar', {}),
                'data_quality_score': ts_analysis.get('summary', {}).get('data_quality_score', 0),
                'detected_scenarios': ts_analysis.get('data_normalization', {}).get('scenarios', []),
                'detected_metrics': ts_analysis.get('data_normalization', {}).get('metrics', []),
                'key_insights': ts_analysis.get('financial_metrics', {}).get('key_insights', [])
            })
        
        return insights
        
    except Exception as e:
        logger.error(f"Error extracting comprehensive insights: {e}")
        return {'sheet_name': sheet_name, 'error': str(e)}


def _generate_overall_analysis_summary(time_series_results):
    """Generate overall analysis summary across all sheets"""
    try:
        if not time_series_results:
            return {}
        
        summary = {
            'total_sheets_analyzed': len(time_series_results),
            'avg_data_quality': 0.0,
            'common_scenarios': set(),
            'common_metrics': set(),
            'fiscal_calendar_types': set(),
            'overall_insights': []
        }
        
        quality_scores = []
        all_insights = []
        
        for sheet_name, analysis in time_series_results.items():
            # Collect data quality scores
            quality = analysis.get('summary', {}).get('data_quality_score', 0)
            if quality > 0:
                quality_scores.append(quality)
            
            # Collect scenarios and metrics
            normalization = analysis.get('data_normalization', {})
            summary['common_scenarios'].update(normalization.get('scenarios', []))
            summary['common_metrics'].update(normalization.get('metrics', []))
            
            # Collect fiscal calendar types
            fiscal_type = analysis.get('fiscal_calendar', {}).get('type', 'calendar_year')
            summary['fiscal_calendar_types'].add(fiscal_type)
            
            # Collect insights
            sheet_insights = analysis.get('financial_metrics', {}).get('key_insights', [])
            all_insights.extend(sheet_insights)
        
        # Calculate averages and summaries
        if quality_scores:
            summary['avg_data_quality'] = sum(quality_scores) / len(quality_scores)
        
        # Convert sets to lists and limit
        summary['common_scenarios'] = list(summary['common_scenarios'])[:10]
        summary['common_metrics'] = list(summary['common_metrics'])[:10]
        summary['fiscal_calendar_types'] = list(summary['fiscal_calendar_types'])
        summary['overall_insights'] = all_insights[:15]  # Top 15 insights
        
        return summary
        
    except Exception as e:
        logger.error(f"Error generating overall analysis summary: {e}")
        return {'error': str(e)}

def extract_financial_data(text):
    """
    Extract structured financial data from text for visualization.
    
    Parameters:
    - text: Text containing financial information
    
    Returns:
    - Dictionary with extracted financial data, or None if no financial data found
    """
    import re

    # Basic patterns to identify
    patterns = {
        'yearly_values': r'(\d{4})[\s\:]+[\$\€\£]?([\d,\.]+)',
        'percentage_values': r'(\w+(?:\s+\w+)*)[\s\:]+(\d+(?:\.\d+)?)%',
        'currency_values': r'(\w+(?:\s+\w+)*)[\s\:]+[\$\€\£]([\d,\.]+)',
        'comparison_years': r'(\d{4})(?:\s*vs\.?\s*|\s*compared to\s*)(\d{4})'
    }

    # Check for yearly financial data (time series)
    year_matches = re.findall(patterns['yearly_values'], text, re.IGNORECASE)
    if len(year_matches) >= 2:
        years = []
        values = []

        # Extract years and values
        for year, value_str in year_matches:
            try:
                value = float(value_str.replace(',', ''))
                years.append(year)
                values.append(value)
            except ValueError:
                continue

        # Sort by year
        if len(years) >= 2:
            # Sort years and values together
            sorted_data = sorted(zip(years, values), key=lambda x: x[0])
            years = [x[0] for x in sorted_data]
            values = [x[1] for x in sorted_data]

            is_revenue = 'revenue' in text.lower()

            # Calculate growth rates and CAGR if this is revenue data
            growth_analysis = None
            if is_revenue:
                growth_analysis = calculate_growth_rates(years, values)

            result = {
                'type':
                'timeSeries',
                'title':
                'Financial Metrics by Year',
                'labels':
                years,
                'values':
                values,
                'is_currency':
                '$' in text or 'revenue' in text.lower()
                or 'profit' in text.lower() or 'income' in text.lower()
            }

            # Add growth rate and CAGR data if available
            if growth_analysis:
                result['growth_analysis'] = growth_analysis

            return result

    # Check for percentage-based data
    pct_matches = re.findall(patterns['percentage_values'], text,
                             re.IGNORECASE)
    if len(pct_matches) >= 2:
        categories = []
        percentages = []

        for category, percentage_str in pct_matches:
            try:
                percentage = float(percentage_str)
                categories.append(category.strip())
                percentages.append(percentage)
            except ValueError:
                continue

        if len(categories) >= 2:
            return {
                'type': 'distribution',
                'title': 'Percentage Distribution',
                'labels': categories,
                'values': percentages,
                'is_currency': False
            }

    # Check for currency-based data (e.g., balance sheet components)
    currency_matches = re.findall(patterns['currency_values'], text,
                                  re.IGNORECASE)
    if len(currency_matches) >= 2:
        categories = []
        values = []

        for category, value_str in currency_matches:
            try:
                value = float(value_str.replace(',', ''))
                categories.append(category.strip())
                values.append(value)
            except ValueError:
                continue

        if len(categories) >= 2:
            return {
                'type': 'categories',
                'title': 'Financial Breakdown',
                'labels': categories,
                'values': values,
                'is_currency': True
            }

    return None


def classify_query_type(query):
    """
    Classify the query to determine response strategy for calculations
    
    Returns:
    - Dict with query classification and response strategy  
    """
    query_lower = query.lower().strip()

    # Strong decision blocks for different query types
    classification = {
        'type': 'general',
        'show_calculations': False,
        'show_formula': False,
        'calculation_detail_level': 'none'
    }

    # 1. FORMULA REQUEST DETECTION
    formula_keywords = [
        'formula', 'how to calculate', 'how is calculated',
        'calculation method', 'how do you calculate'
    ]
    if any(keyword in query_lower for keyword in formula_keywords):
        classification.update({
            'type': 'formula_request',
            'show_formula': True,
            'show_calculations': False,
            'calculation_detail_level': 'formula_only'
        })
        return classification

    # 2. CALCULATION VERIFICATION/EXPLANATION
    calc_verification_keywords = [
        'how did you calculate', 'show calculation', 'calculation steps',
        'how was calculated', 'calculation breakdown'
    ]
    if any(keyword in query_lower for keyword in calc_verification_keywords):
        classification.update({
            'type': 'calculation_verification',
            'show_calculations': True,
            'show_formula': True,
            'calculation_detail_level': 'full_breakdown'
        })
        return classification

    # 3. SPECIFIC RATIO/METRIC QUESTIONS - Show calculation work
    ratio_keywords = [
        'ratio', 'margin', 'percentage', 'growth rate', 'cagr', 'return on',
        'current ratio', 'debt ratio', 'profit margin'
    ]
    if any(keyword in query_lower for keyword in ratio_keywords):
        classification.update({
            'type': 'financial_metric',
            'show_calculations': True,
            'calculation_detail_level': 'show_work'
        })
        return classification

    # 4. COMPARISON QUERIES - Show comparative calculations
    comparison_keywords = [
        'compare', 'versus', 'vs', 'difference between', 'better than',
        'higher than', 'lower than'
    ]
    if any(keyword in query_lower for keyword in comparison_keywords):
        classification.update({
            'type': 'comparison',
            'show_calculations': True,
            'calculation_detail_level': 'comparative'
        })
        return classification

    return classification


def get_answer(query,
               vector_store,
               top_k=5,
               document_id=None,
               is_comparison=False,
               document_results=None,
               session_company_info=None):
    """
    Get an answer to a query using RAG (Retrieval Augmented Generation).
    First retrieves relevant chunks from the vector store, then uses OpenAI to generate an answer.
    
    Parameters:
    - query: User's question
    - vector_store: Vector store with document embeddings
    - top_k: Number of relevant chunks to retrieve
    - document_id: Optional document ID to limit search to a specific document
    - is_comparison: Whether this is a multi-document comparison query
    - document_results: Pre-retrieved results organized by document ID for comparison
    - session_company_info: Company information extracted from documents in this session
    
    Returns:
    - Dictionary with the answer and information about source chunks used,
      plus any extracted financial data for visualization
    """
    try:
        # Classify the query to determine response strategy
        query_classification = classify_query_type(query)
        logger.info(
            f"Query classified as: {query_classification['type']} with calculation detail level: {query_classification['calculation_detail_level']}"
        )

        # For tracking which document chunks were used
        source_chunks = []
        
        # Extract company context from session information
        company_context = ""
        data_preference = None
        
        if session_company_info:
            primary_company = session_company_info.get('primary_company')
            context_info = session_company_info.get('context', {})
            
            # Detect user's data preference for Indian companies with dual data
            data_preference = detect_data_preference(query)
            logger.info(f"Detected data preference: {data_preference} based on query: {query}")
            
            if primary_company:
                company_context = f"Company: {primary_company}"
                if context_info.get('industry'):
                    company_context += f" (Industry: {context_info['industry']})"
                if context_info.get('country'):
                    company_context += f" (Location: {context_info['country']})"
                company_context += "\n\n"
                
                logger.info(f"Using company context: {primary_company}")

        # Context building based on query type
        if is_comparison and document_results:
            # For multi-document comparison, format context with document identifiers
            context_parts = []

            # Add a section for each document
            for doc_id, chunks in document_results.items():
                doc_text = "\n".join([c["text"] for c in chunks])
                context_parts.append(f"DOCUMENT {doc_id}:\n{doc_text}\n")

                # Add to source chunks for visualization
                for chunk in chunks:
                    source_chunks.append({
                        "text":
                        chunk["text"],
                        "similarity":
                        chunk.get("similarity", 1.0),
                        "doc_id":
                        doc_id,
                        "chunk_num":
                        chunk.get("chunk_num", 0)
                    })

            context = "\n\n" + "\n\n".join(context_parts)

        elif document_id:
            # When querying a specific document
            chunks_with_metadata = search_vector_store(
                query,
                vector_store,
                top_k=top_k,
                filter_doc_id=document_id,
                include_metadata=True)

            # Extract just the text for the context
            context_chunks = [chunk["text"] for chunk in chunks_with_metadata]
            context = "\n\n".join(context_chunks)

            # Save source chunks for visualization
            source_chunks = chunks_with_metadata

        else:
            # Standard query across all documents
            chunks_with_metadata = search_vector_store(query,
                                                       vector_store,
                                                       top_k=top_k,
                                                       include_metadata=True)

            # Smart filtering for Indian screener data based on preference
            if data_preference and chunks_with_metadata:
                filtered_chunks = []
                preferred_chunks = []
                other_chunks = []
                
                for chunk in chunks_with_metadata:
                    chunk_text = chunk.get("text", "").lower()
                    
                    # Check if this is screener data and classify by type
                    if "screener.in" in chunk_text or "data types found" in chunk_text:
                        if data_preference == "consolidated":
                            # Prioritize consolidated data sections
                            if any(term in chunk_text for term in ["consolidated", "group", "### consolidated"]):
                                preferred_chunks.append(chunk)
                                logger.info(f"Prioritizing consolidated data chunk for query: {query}")
                            elif any(term in chunk_text for term in ["standalone", "### standalone"]):
                                other_chunks.append(chunk)
                            else:
                                filtered_chunks.append(chunk)
                        else:  # standalone preference
                            if any(term in chunk_text for term in ["standalone", "### standalone"]):
                                preferred_chunks.append(chunk)
                                logger.info(f"Prioritizing standalone data chunk for query: {query}")
                            elif any(term in chunk_text for term in ["consolidated", "group", "### consolidated"]):
                                other_chunks.append(chunk)
                            else:
                                filtered_chunks.append(chunk)
                    else:
                        # Non-screener data, include as normal
                        filtered_chunks.append(chunk)
                
                # Reorganize chunks: preferred first, then general, then other type as fallback
                chunks_with_metadata = preferred_chunks + filtered_chunks + other_chunks[:2]  # Limit fallback
                logger.info(f"Reorganized {len(preferred_chunks)} preferred, {len(filtered_chunks)} general, {len(other_chunks)} fallback chunks")

            # Extract just the text for the context
            context_chunks = [chunk["text"] for chunk in chunks_with_metadata]
            context = "\n\n".join(context_chunks)

            # Save source chunks for visualization
            source_chunks = chunks_with_metadata

        # Determine query type for specialized prompting
        query_lower = query.lower()

        # Check if user explicitly wants calculation steps shown
        show_calculations = any(term in query_lower for term in [
            "calculate", "computation", "step by step", "show steps",
            "show calculation", "show working", "show formula", "show me how"
        ])

        # For financial calculations, add additional context when needed
        financial_terms = [
            # Ratio types and financial metrics
            "ratio",
            "margin",
            "turnover",
            "return",
            "ebitda",
            "ebit",
            "eps",
            "roe",
            "roa",
            "roce",
            "dividend",
            "payout",
            "yield",
            "coverage",
            "leverage",
            "debt",
            "equity",
            "liquidity",
            "solvency",
            "profitability",
            "efficiency",
            "working capital",
            "interest",
            "cash flow",
            "fcf",
            "pe ratio",
            "pb ratio",
            "ps ratio",

            # Actions and analysis terms
            "calculation",
            "calculate",
            "compute",
            "analysis",
            "analyze",
            "evaluate",
            "assess",
            "estimate",
            "compare",
            "trend",
            "growth",
            "forecast",
            "financial",
            "performance",
            "position",
            "valuation",

            # Balance sheet items
            "asset",
            "liability",
            "equity",
            "revenue",
            "income",
            "expense",
            "profit",
            "loss",
            "cash",
            "inventory",
            "receivable",
            "payable",
            "capital",
            "tax",
            "depreciation",
            "amortization",

            # Industry-specific
            "gearing",
            "current ratio",
            "quick ratio",
            "acid test",
            "debt-to-equity",
            "gross margin",
            "operating margin",
            "net margin",
            "capex",
            "opex",
            "book value"
        ]

        is_financial_calc = any(term in query_lower
                                for term in financial_terms)

        if is_financial_calc and not is_comparison:
            # Multiple RAG approaches for comprehensive financial analysis
            logger.info(
                "Financial calculation detected - applying multiple RAG approaches for robust calculation"
            )

            # Primary RAG approach - specific targeted queries
            primary_financial_queries = [
                "balance sheet financial statements assets liabilities",
                "revenue total revenue income statement",
                "profit net income operating profit EBIT",
                "equity shareholders equity total equity",
                "interest expense finance costs", "debt loans borrowings",
                "financial ratios"
            ]

            # Alternative RAG approach - broader context queries for cross-verification
            alternative_financial_queries = [
                "annual report financial highlights summary",
                "key financial figures performance metrics",
                "cash flow statement operating activities",
                "income statement comprehensive income",
                "notes to financial statements disclosures"
            ]

            # Enhanced data mining for missing calculation components
            calculation_component_queries = [
                "current assets current liabilities working capital",
                "total assets total equity debt financing",
                "operating income operating expenses EBITDA",
                "net sales revenue cost of goods sold gross profit",
                "share capital retained earnings shareholders equity",
                "interest expense financial costs borrowing costs",
                "depreciation amortization non-cash expenses"
            ]

            # Process primary financial queries first
            for finance_query in primary_financial_queries:
                additional_chunks = search_vector_store(
                    finance_query,
                    vector_store,
                    top_k=2,
                    filter_doc_id=document_id,
                    include_metadata=True)

                # Add these chunks to our context if they're not already included
                for chunk in additional_chunks:
                    chunk_already_included = False
                    for existing_chunk in source_chunks:
                        if existing_chunk.get('text') == chunk.get('text'):
                            chunk_already_included = True
                            break

                    if not chunk_already_included:
                        source_chunks.append(chunk)
                        context += "\n\n" + chunk["text"]

            # Process alternative queries for cross-verification (limit to avoid over-context)
            alternative_context = ""
            for alt_query in alternative_financial_queries[:
                                                           3]:  # Limit to 3 for efficiency
                alt_chunks = search_vector_store(alt_query,
                                                 vector_store,
                                                 top_k=1,
                                                 filter_doc_id=document_id,
                                                 include_metadata=True)

                for chunk in alt_chunks:
                    chunk_already_included = False
                    for existing_chunk in source_chunks:
                        if existing_chunk.get('text') == chunk.get('text'):
                            chunk_already_included = True
                            break

                    if not chunk_already_included:
                        source_chunks.append(chunk)
                        alternative_context += "\n\n" + chunk["text"]

            # Add alternative context for cross-verification
            if alternative_context:
                context += "\n\n--- Alternative Data Sources for Cross-Verification ---" + alternative_context

            # Search for specific calculation components if needed
            component_context = ""
            for component_query in calculation_component_queries[:
                                                                 4]:  # Limit to avoid over-context
                comp_chunks = search_vector_store(component_query,
                                                  vector_store,
                                                  top_k=1,
                                                  filter_doc_id=document_id,
                                                  include_metadata=True)

                for chunk in comp_chunks:
                    chunk_already_included = False
                    for existing_chunk in source_chunks:
                        if existing_chunk.get('text') == chunk.get('text'):
                            chunk_already_included = True
                            break

                    if not chunk_already_included:
                        source_chunks.append(chunk)
                        component_context += "\n\n" + chunk["text"]

            # Add component context for calculation data mining
            if component_context:
                context += "\n\n--- Additional Calculation Components ---" + component_context

        # Enhanced financial calculation prompt with comprehensive methodology
        data_selection_guidance = ""
        if data_preference:
            data_selection_guidance = f"""
        
        DATA SELECTION GUIDANCE:
        - User preference detected: {data_preference.upper()} data
        - CRITICAL: When both standalone and consolidated data are available, ONLY use {data_preference} data for analysis
        - If the context contains both types, IGNORE the non-preferred data type completely
        - For consolidated queries: Focus EXCLUSIVELY on group-wide performance including subsidiaries - DO NOT use standalone figures
        - For standalone queries: Focus EXCLUSIVELY on parent company performance excluding subsidiaries - DO NOT use consolidated figures
        - ALWAYS label your data correctly: Use "Consolidated Figures" for consolidated data and "Standalone Figures" for standalone data
        - When extracting financial data from Screener.in context, look for sections marked with "### Consolidated" or "### Standalone" and use ONLY the preferred type
        """
        
        financial_calculation_prompt = f"""You are LedgerLM, an expert financial analysis assistant that specializes in analyzing financial metrics from documents and web sources.
        
        IMPORTANT: When analyzing multiple documents, always identify which document each piece of information comes from.
        Format your responses to clearly distinguish between different documents.
        {data_selection_guidance}
        
        WEB SEARCH INTEGRATION: If web search context is provided in the query, use it to enhance your analysis:
        - Synthesize information from both documents and web sources into one comprehensive answer
        - Combine document data with current web information seamlessly
        - When information comes from web sources, mention "according to recent web sources" or similar
        - Use web search to fill gaps in document information or provide current/updated data
        - Create one unified, comprehensive response that addresses the original question fully
        - Do not simply append web results - integrate them naturally into your analysis
        
        Answer Guidelines for Financial Analysis:
        1. For ALL financial calculations (metrics, ratios, margins, etc.):
           - FIRST, carefully scan ALL context provided and identify ALL financial numbers in the context
           - ALWAYS perform your own calculations from raw numbers to ensure accuracy and consistency
           - Never use pre-calculated percentages or ratios from the document directly
           - Be precise with decimal places (use 2 decimal places for percentages)
           - ONLY mention calculation methods if EXPLICITLY asked to show calculations
           - Focus on the final values and insights rather than explaining the calculation process
        2. Keep your answers extremely concise and focused on the final values and their interpretation
        3. When web search context is available, provide comprehensive answers that synthesize all available information
        4. Only if there is absolutely no way to provide an estimate or value, then explain what data is missing
        
        STANDARD FINANCIAL CALCULATIONS:
        1. Gross Profit Margin = (Gross Profit / Revenue) * 100
        2. Operating Profit Margin = (Operating Profit / Revenue) * 100
        3. Net Profit Margin = (Net Profit / Revenue) * 100
        4. EBITDA = Operating Profit + Depreciation + Amortization
        5. EBITDA Margin = (EBITDA / Revenue) * 100
        6. Return on Equity (ROE) = (Net Profit / Shareholders' Equity) * 100
        7. Return on Assets (ROA) = (Net Profit / Total Assets) * 100
        8. Current Ratio = Current Assets / Current Liabilities
        9. Debt-to-Equity Ratio = Total Debt / Total Equity
        """

        financial_comparison_prompt = """You are LedgerLM, an expert financial analysis assistant that specializes in comparing financial data across time periods.
        
        Answer Guidelines for Financial Comparisons:
        1. When comparing financial periods:
           - Clearly identify the values for each period being compared
           - Calculate absolute changes and percentage changes between periods
           - Highlight significant trends or unusual patterns
           - Consider seasonal factors or industry cycles if relevant
        2. If comparing against benchmarks:
           - Explain what the benchmark represents and why it's relevant
           - Provide context about industry standards when possible
        3. Show your calculations for any derived metrics
        4. Identify possible business reasons for significant changes
        
        Important Formatting Requirements:
        1. Present comparisons in a structured, easy-to-read format
        2. Never use LaTeX formatting - use plain text formatting only
        3. Format numbers consistently with appropriate currency symbols and decimal places
        4. Use year-over-year (YoY) or period-over-period (PoP) terminology consistently
        5. For important metrics, include both absolute and percentage changes
        """

        # Add ratio analysis prompt from the attached comprehensive system
        ratio_analysis_prompt = """You are LedgerLM, an expert financial analysis assistant that specializes in calculating and interpreting financial ratios.
        
        Answer Guidelines for Financial Ratio Analysis:
        1. For ratio calculations:
           - FIRST, explicitly identify the exact values from the document that you'll use in the calculation
           - Format these as "Component: Value" on separate lines
           - If showing steps, clearly format the formula with division indicated by / (not ÷)
           - Always show the final calculated value with appropriate formatting
           - Format ratios to 2 decimal places or as percentages as appropriate
        2. For all financial ratios:
           - Provide a 1-2 sentence interpretation of what the ratio means for the company
           - Compare to industry standards or previous periods when that data is available
           - Use consistent terminology in your explanations
        
        Common Financial Ratios and Their Notation:
        - Liquidity: Current Ratio, Quick Ratio, Cash Ratio (format to 2 decimal places, no units)
        - Profitability: Gross Margin, Operating Margin, Net Margin, ROA, ROE (format as percentages)
        - Efficiency: Asset Turnover, Inventory Turnover (format to 2 decimal places, add "x" for turns)
        - Solvency: Debt-to-Equity, Interest Coverage (format to 2 decimal places, no units)
        """

        # Default general prompt for non-financial queries
        general_prompt = """You are LedgerLM, an expert financial analysis assistant.
        
        Answer Guidelines:
        1. Provide concise, accurate information based on the document
        2. Use bullet points for clarity when appropriate
        3. Format numbers consistently with appropriate units
        4. State when information is not available in the document
        5. Focus on facts directly from the text rather than speculation
        
        When multiple documents are presented:
        1. Identify which document contains relevant information
        2. Note any differences or discrepancies between documents
        3. Synthesize information across documents when appropriate
        """

        # Forecasting enhancement for future year projections
        def add_forecasting_enhancement(prompt, query, context):
            """Add forecasting capabilities when future years are requested"""
            import re
            current_year = 2025
            future_years = re.findall(r'\b(20(?:2[5-9]|[3-9][0-9]))\b', query)
            
            if future_years:
                # Extract available years from context
                available_years = re.findall(r'\b(20(?:1[5-9]|2[0-4]))\b', context)
                available_years = sorted(list(set(available_years)))
                requested_years = sorted(list(set(future_years)))
                missing_years = [year for year in requested_years if year not in available_years]
                
                if missing_years:
                    forecasting_instructions = f"""
                    
                    FORECASTING INSTRUCTIONS:
                    You are being asked about years {requested_years}.
                    Available data years in documents: {available_years}
                    Missing years requiring projection: {missing_years}
                    
                    For any requested year NOT in the available data years list above:
                    1. State "Data for [year] is not available in the documents"
                    2. Calculate CAGR projection using ALL available historical data
                    3. Use formula: CAGR = (Ending Value / Beginning Value)^(1/years) - 1
                    4. Apply projection: Future Value = Latest Value × (1 + CAGR)^years_forward
                    5. Show actual calculated projection values
                    6. Format as: "[Year]: [Value] (Projected using CAGR of X.X%)"
                    """
                    return prompt + forecasting_instructions
            
            return prompt

        general_financial_prompt = """You are LedgerLM, a helpful financial analysis assistant that answers questions about documents in a clear, conversational way.
        
        Answer Guidelines:
        1. Answer the user's question directly and naturally
        2. Extract specific information from the document context
        3. Use simple, clear language without overly technical formatting
        4. Provide relevant numbers, dates, and details as needed
        5. Only show calculation steps if the user specifically asks for them
        
        Response Style:
        - Write in a conversational, helpful tone
        - Answer the exact question asked
        - Provide context when helpful
        - Use simple paragraph formatting
        - Include specific numbers and data from the document
        
        Always give the most direct and useful answer possible based on the document content.
        """

        # Create adaptive system prompt based on query classification
        base_prompt = "You are LedgerLM, an expert financial analyst providing institutional-grade analysis for finance professionals."

        # Enhanced Document Response Framework with Professional Structure
        simple_document_framework = """
        
        RESPONSE STRUCTURE:
        Use clear, professional formatting with proper structure:
        
        ## [Main Topic/Answer Header]
        
        ### Key Financial Metrics
        • **Metric 1:** [Value] - [Brief explanation]
        • **Metric 2:** [Value] - [Brief explanation]
        • **Metric 3:** [Value] - [Brief explanation]
        
        ### Performance Analysis
        • [Key insight 1 with specific numbers]
        • [Key insight 2 with specific numbers]
        • [Key insight 3 with specific numbers]
        
        ### Financial Analysis Reasoning
        **Strategic Implications:** [Professional analysis for financial analysts]
        
        **Business Context:** [Strategic context of the findings and key takeaways]
        
        **Industry Perspective:** [Industry context and performance evaluation]
        
        FORMATTING GUIDELINES:
        - Use ## for main headers and ### for subheadings
        - Use bullet points (•) for key metrics and insights
        - Bold important financial terms and values with **text**
        - Include specific numbers and dates
        - Structure information clearly with logical sections
        - Always include Financial Analysis Reasoning section for finance queries
        
        Present information in a clear, structured format that highlights key findings.
        """

        # Apply forecasting enhancement if needed
        enhanced_calc_prompt = add_forecasting_enhancement(financial_calculation_prompt, query, context)
        
        # Select appropriate comprehensive prompt based on query type
        if any(keyword in query.lower() for keyword in ['ratio', 'current ratio', 'debt-to-equity', 'roe', 'roa', 'quick ratio']):
            selected_prompt = ratio_analysis_prompt
        elif any(keyword in query.lower() for keyword in ['compare', 'comparison', 'vs', 'versus', 'year-over-year', 'yoy']):
            selected_prompt = financial_comparison_prompt
        elif any(keyword in query.lower() for keyword in ['calculate', 'computation', 'margin', 'profit', 'ebitda', 'revenue', 'formula']):
            selected_prompt = enhanced_calc_prompt
        else:
            selected_prompt = general_prompt
        
        # Use the comprehensive enhanced prompt system
        system_prompt = f"""{selected_prompt}
        
{simple_document_framework}
        """

        # Enhanced user prompt with company context
        enhanced_user_prompt = f"""
        {company_context}Question: {query}
        
        Document Context:
        {context}
        
        Please answer the question directly based on the information in the document. Use a natural, conversational tone and provide the specific information requested.
        {f'Focus your analysis specifically on {session_company_info.get("primary_company")} and provide company-specific insights.' if session_company_info and session_company_info.get('primary_company') else ''}
        """

        # Use the enhanced prompt with company context for natural, conversational responses
        user_prompt = enhanced_user_prompt

        # Check if we have structured data to format as tables
        table_formatting = format_structured_data_as_tables(context_chunks)
        
        # Enhance the user prompt with financial analysis context if available
        if table_formatting['has_structured_data']:
            # Build intelligent financial context
            financial_context = f"""

COMPANY FINANCIAL DATA ANALYSIS:
This company's data contains {table_formatting['total_tables']} financial datasets with {table_formatting['total_rows']} total data points.

Financial Analysis Dimensions:
{chr(10).join(table_formatting['table_summaries'])}

Key Financial Insights:"""

            # Add specific financial insights
            for insight in table_formatting.get('financial_insights', []):
                financial_context += f"""
- **{insight['sheet_name']}** ({insight['analysis_type']}): Contains {insight['row_count']} entries
  * Data includes: {', '.join(insight['financial_data'].keys()) if insight['financial_data'] else 'numeric financial metrics'}
  * Analysis Type: {insight['analysis_type']}"""

            financial_context += f"""

FINANCIAL ANALYST INSTRUCTIONS:
1. Analyze this company's specific financial dimensions (Budget vs Actual vs Forecast)
2. Identify trends, variances, and key performance indicators
3. Provide insights on financial performance based on their actual data
4. Calculate relevant financial ratios and growth rates where applicable
5. Present findings in well-formatted tables with clear financial metrics
6. Highlight any significant deviations or patterns in the data"""
            
            user_prompt += financial_context

        # Generate the answer
        logger.info(f"Sending query to OpenAI: {query}")
        try:
            response = client.chat.completions.create(
                model=CHAT_MODEL,
                messages=[{
                    "role": "system",
                    "content": system_prompt
                }, {
                    "role": "user",
                    "content": user_prompt
                }],
                temperature=0.2,  # Lower temperature for more factual responses
                max_tokens=4000)

            if response and hasattr(response, 'choices') and len(
                    response.choices) > 0:
                answer = response.choices[0].message.content
                
                # Enhance answer with formatted tables if we have structured data
                if table_formatting['has_structured_data']:
                    table_section = "\n\n## 📊 **Company Financial Data Analysis**\n\n"
                    table_section += "Below are the detailed financial tables from your company's Anaplan/Excel data with analytical insights:\n\n"
                    
                    for table_markdown in table_formatting['formatted_tables']:
                        table_section += table_markdown
                    
                    # Add financial summary based on insights
                    if table_formatting.get('financial_insights'):
                        table_section += "\n### 💼 **Financial Analysis Summary**\n\n"
                        for insight in table_formatting['financial_insights']:
                            table_section += f"**{insight['sheet_name']}** - {insight['analysis_type']}: "
                            table_section += f"{insight['row_count']} data entries with "
                            if insight['financial_data']:
                                table_section += f"{len(insight['financial_data'])} financial dimensions\n"
                            else:
                                table_section += f"{insight['numeric_columns']} numeric columns\n"
                    
                    # Insert the table section strategically in the answer
                    if "## " in answer:
                        # Insert before the last section for better flow
                        parts = answer.rsplit("## ", 1)
                        if len(parts) == 2:
                            answer = parts[0] + table_section + "\n## " + parts[1]
                        else:
                            answer += table_section
                    else:
                        answer += table_section
            else:
                logger.warning("Received empty response from OpenAI")
                answer = "I apologize, but I couldn't generate an answer at this time. Please try your question again."

        except Exception as e:
            logger.error(f"Error in OpenAI call: {str(e)}")
            answer = f"Error generating response: {str(e)}"

        # Enhanced post-processing for improved formatting and structure
        if answer and query_lower:
            # Remove LaTeX formatting
            answer = answer.replace("\\[", "")
            answer = answer.replace("\\]", "")
            answer = answer.replace("\\text{", "")
            answer = answer.replace("\\(", "")
            answer = answer.replace("\\)", "")
            answer = answer.replace("$$", "")
            answer = answer.replace("$", "")

            # Fix common formatting issues
            answer = answer.replace("**Answer:**",
                                    "## Financial Analysis Results")

            # Improve table formatting for financial data
            answer = format_financial_tables(answer)

            # Fix common formatting issues with mathematical expressions
            # Handle fraction notation properly
            import re
            # Replace \frac{numerator}{denominator} with (numerator / denominator)
            answer = re.sub(r'\\frac\{([^}]+)\}\{([^}]+)\}', r'(\1 / \2)', answer)
            
            # Replace specific LaTeX symbols
            answer = answer.replace("\\div", " ÷ ")  # Replace \div with ÷
            answer = answer.replace("\\times", " × ")  # Replace \times with ×
            answer = answer.replace("\\cdot", " · ")  # Replace \cdot with ·
            
            # Clean up remaining isolated braces (but preserve meaningful content)
            # Only remove braces that appear to be LaTeX remnants
            answer = re.sub(r'(?<=\s)\{(?=\s)|(?<=^)\{(?=\s)|(?<=\s)\}(?=\s)|(?<=\s)\}(?=$)', '', answer)

            import re

            # Check if calculation steps should be shown
            if not show_calculations and is_financial_calc:
                # First pass - capture final results for all financial metrics
                financial_metrics = {}

                # Extract values for common financial metrics: metrics with percent signs
                percent_metrics = re.finditer(
                    r'((?:Gross|Net|Operating)?\s*(?:Profit|EBIT(?:DA)?|Margin|ROE|ROA|Return|Ratio|Turnover)[^:=]*)[:\s]*=?\s*([\d\.]+%)',
                    answer, re.IGNORECASE)
                for match in percent_metrics:
                    metric = match.group(1).strip()
                    value = match.group(2).strip()
                    financial_metrics[metric] = value

                # Extract values for ratio calculations (e.g., Cash Ratio = 0.62)
                ratio_values = re.finditer(
                    r'([A-Za-z0-9\s]+Ratio)[^:=]*[:\s]*=?\s*([\d\.]+)(?!\s*%)',
                    answer, re.IGNORECASE)
                for match in ratio_values:
                    metric = match.group(1).strip()
                    value = match.group(2).strip()
                    financial_metrics[metric] = value

                # Extract values for currency amounts (e.g., Revenue: NOK 1,207,501,000)
                currency_metrics = re.finditer(
                    r'(Revenue|Sales|Income|EBIT(?:DA)?|Profit|Asset(?:s)?|Liability|Expense)(?:[^:=]*)[:\s]*=?\s*(?:NOK|USD|EUR)\s*([\d,\.]+)',
                    answer, re.IGNORECASE)
                for match in currency_metrics:
                    metric = match.group(1).strip()
                    value = "NOK " + match.group(2).strip()
                    financial_metrics[metric] = value

                # Now remove calculation blocks
                # 1. Remove lines with specific division operations
                calculation_lines = re.finditer(
                    r'^.*=\s*(?:[^=]*[\/÷]|\([^)]*[\/÷]).*$', answer,
                    re.MULTILINE)
                for match in calculation_lines:
                    line = match.group(0)
                    # Don't remove lines with final results
                    if not re.search(r'=\s*[\d\.]+%?$', line):
                        answer = answer.replace(line, '')

                # 2. Remove explicit calculation steps
                calculation_blocks = re.finditer(
                    r'(?:Step-by-Step|steps:|Calculation:|calculated as:|We calculate this as:|Formula:|is calculated as follows:).*?(?=\n\n|\n[A-Z]|\Z)',
                    answer, re.DOTALL | re.IGNORECASE)
                for match in calculation_blocks:
                    block = match.group(0)
                    answer = answer.replace(block, '')

                # 3. Remove explanations of calculations
                for metric_name in financial_metrics:
                    # Find explanations of how to calculate this metric
                    explanation_pattern = rf'(?:To calculate|Computing|Calculating) (?:the )?\s*{re.escape(metric_name)}.*?(?=\n\n|\n[A-Z]|\Z)'
                    explanation_blocks = re.finditer(explanation_pattern,
                                                     answer,
                                                     re.DOTALL | re.IGNORECASE)
                    for match in explanation_blocks:
                        block = match.group(0)
                        answer = answer.replace(block, '')

                # 4. Remove formula definitions but keep the metric name
                formula_patterns = re.finditer(
                    r'((?:Gross|Net|Operating)?\s*(?:Profit|EBIT(?:DA)?|Margin|ROE|ROA|Return|Ratio|Turnover)[^:=]*)[:\s]*=\s*(?:[^=\n]*)(?!\s*[\d\.]+%?$)',
                    answer, re.IGNORECASE)
                for match in formula_patterns:
                    full_match = match.group(0)
                    metric_name = match.group(1).strip()
                    if metric_name in financial_metrics:
                        answer = answer.replace(
                            full_match,
                            f"{metric_name} = {financial_metrics[metric_name]}"
                        )

                # 5. Clean up remaining calculation fragments
                answer = re.sub(r'- Formula:.*?\n', '', answer)
                answer = re.sub(r'- Calculation:.*?\n', '', answer)
                answer = re.sub(r'- Computed as:.*?\n', '', answer)

                # 6. Fix any division expressions without final results
                ratio_patterns = re.finditer(
                    r'(\d{4}\s+\w+\s+Ratio:[\s\n]+|\w+\s+Ratio\s*=\s*|\w+\s+Margin\s*=\s*)\(?([\d,]+)[}/](\d+,?[\d,]*)\)?(?!\s*=)',
                    answer)
                for match in ratio_patterns:
                    full_match = match.group(0)
                    prefix = match.group(1)
                    numerator_str = match.group(2).replace(',', '')
                    denominator_str = match.group(3).replace(',', '')

                    try:
                        numerator = float(numerator_str)
                        denominator = float(denominator_str)
                        if denominator != 0:
                            result = numerator / denominator
                            # Format appropriately - with 2 decimal places
                            result_str = f"{result:.2f}"
                            replacement = f"{prefix}{numerator_str:,}/{denominator_str:,} = {result_str}"
                            answer = answer.replace(full_match, replacement)
                    except (ValueError, ZeroDivisionError):
                        # Skip if we can't parse the numbers
                        pass

            logger.info(f"Generated answer: {answer[:100]}...")
        else:
            logger.warning("Generated empty answer")
            answer = "I apologize, but I couldn't generate an answer. Please try a different question."

        # Extract financial data for visualization
        financial_data = extract_financial_data(answer)

        # Check if Google API web search should be triggered
        web_search_used = False
        search_results = []
        
        # Only trigger web search for specific Google API use cases
        should_use_web_search = should_search_web(query, answer, 1.0 if answer and len(answer.strip()) > 100 else 0.3)
        
        if should_use_web_search:
            try:
                logger.info("Google API web search triggered for query enhancement")
                web_results = perform_web_search(query, num_results=3)
                if web_results:
                    web_search_used = True
                    search_results = web_results
                    # Enhanced answer with web results
                    enhanced_answer = synthesize_web_and_document_results(query, answer, web_results)
                    if enhanced_answer and enhanced_answer != answer:
                        answer = enhanced_answer
                        logger.info("Successfully enhanced answer with Google web search results")
            except Exception as e:
                logger.error(f"Google API web search failed: {str(e)}")

        # Return the answer, source chunks, financial data, and controlled web results
        return {
            "answer": answer,
            "sources": source_chunks,
            "financial_data": financial_data,
            "web_search_used": web_search_used,
            "search_results": search_results if web_search_used else []
        }

    except Exception as e:
        logger.error(f"Error in RAG process: {str(e)}")
        return {
            "answer": f"Error processing your question: {str(e)}",
            "sources": []
        }


async def analyze_financial_query(query: str, company_name: str, financial_data: dict) -> dict:
    """
    Analyze financial query using OpenAI with structured financial data from Indian Stock Market API
    """
    try:
        logger.info(f"Analyzing financial query for {company_name}: {query}")
        
        # Create comprehensive financial context focusing on Indian fundamental data
        financial_context = []
        
        # Prioritize Indian fundamental data for analysis with enhanced year context
        if financial_data.get('indian_fundamental_data'):
            indian_data = financial_data['indian_fundamental_data']
            financial_context.append("=== INDIAN STOCK MARKET API - FUNDAMENTAL DATA ===")
            financial_context.append(f"Total Financial Periods: {indian_data.get('periods_available', 0)}")
            
            # Year Range Context
            if indian_data.get('year_range'):
                year_range = indian_data['year_range']
                if year_range.get('years_covered'):
                    financial_context.append(f"Year Coverage: {year_range['earliest']}-{year_range['latest']} ({year_range['total_years']} years)")
                    financial_context.append(f"Specific Years Available: {year_range['years_covered']}")
            
            # Revenue Analysis with Fiscal Year Format
            if indian_data.get('revenue_data'):
                financial_context.append("\n--- REVENUE ANALYSIS BY FISCAL YEAR ---")
                for revenue_entry in indian_data['revenue_data']:
                    fy_format = revenue_entry.get('fiscal_year', f"FY {revenue_entry.get('year', 'Unknown')}")
                    financial_context.append(f"{fy_format}: Revenue ₹{revenue_entry.get('revenue')} | Period: {revenue_entry.get('period')}")
            
            # Profit Analysis with Fiscal Year Format
            if indian_data.get('profit_data'):
                financial_context.append("\n--- PROFIT ANALYSIS BY FISCAL YEAR ---")
                for profit_entry in indian_data['profit_data']:
                    fy_format = profit_entry.get('fiscal_year', f"FY {profit_entry.get('year', 'Unknown')}")
                    financial_context.append(f"{fy_format}: Profit ₹{profit_entry.get('profit')} | Period: {profit_entry.get('period')}")
        
        # Comprehensive Financial Statements
        if financial_data.get('comprehensive_statements'):
            statements = financial_data['comprehensive_statements']
            financial_context.append(f"\n=== COMPREHENSIVE FINANCIAL STATEMENTS ===")
            financial_context.append(f"Total Statements Available: {statements.get('statements_available', 0)}")
            
            # Income Statements
            if statements.get('income_statements'):
                financial_context.append("\n--- INCOME STATEMENTS ---")
                for i, stmt in enumerate(statements['income_statements'][:3]):
                    financial_context.append(f"Income Statement {i+1}: {json.dumps(stmt, indent=2)}")
            
            # Balance Sheets
            if statements.get('balance_sheets'):
                financial_context.append("\n--- BALANCE SHEETS ---")
                for i, stmt in enumerate(statements['balance_sheets'][:3]):
                    financial_context.append(f"Balance Sheet {i+1}: {json.dumps(stmt, indent=2)}")
            
            # Cash Flow Statements
            if statements.get('cash_flows'):
                financial_context.append("\n--- CASH FLOW STATEMENTS ---")
                for i, stmt in enumerate(statements['cash_flows'][:3]):
                    financial_context.append(f"Cash Flow {i+1}: {json.dumps(stmt, indent=2)}")
        
        # Key Financial Ratios
        if financial_data.get('key_ratios'):
            financial_context.append("\n=== KEY FINANCIAL RATIOS & METRICS ===")
            financial_context.append(json.dumps(financial_data['key_ratios'], indent=2))
        
        # Market Data (Yahoo Finance)
        if financial_data.get('market_data'):
            market_data = financial_data['market_data']
            financial_context.append("\n=== MARKET DATA (YAHOO FINANCE) ===")
            if market_data.get('current_price'):
                financial_context.append(f"Current Price: ${market_data['current_price']}")
            if market_data.get('market_cap'):
                financial_context.append(f"Market Cap: ${market_data['market_cap']}")
            if market_data.get('pe_ratio'):
                financial_context.append(f"P/E Ratio: {market_data['pe_ratio']}")
        
        # Combine all context
        context_text = "\n".join(financial_context)
        
        # Enhanced financial analysis prompt with multi-source data integration
        system_prompt = f"""You are LedgerLM, an expert financial analysis assistant providing institutional-grade financial insights with comprehensive fundamental analysis. You analyze companies using multiple premium data sources including Indian Stock Market API, Yahoo Finance, Financial Modeling Prep, Alpha Vantage, and Google Search.

Core Capabilities:
- Multi-Market Financial Analysis (Global Markets, Indian BSE/NSE, US Markets)
- Comprehensive Financial Statement Analysis (Income Statement, Balance Sheet, Cash Flow)
- Multi-period Financial Trend Analysis with Specific Year References
- Advanced Financial Ratio Calculation and Interpretation
- Revenue Growth and Profitability Analysis
- Risk Assessment and Investment Recommendations
- Industry Benchmarking and Comparative Analysis

CRITICAL RESPONSE REQUIREMENTS:
1. ALWAYS identify the specific company name when providing financial data
2. ALWAYS mention the exact financial year or period for each figure
3. Use the ACTUAL FINANCIAL DATA provided from the multiple data sources
4. Provide specific numbers, ratios, and calculations based on the real data
5. When data is available, provide comprehensive analysis regardless of the company's exchange

Analysis Framework:
1. Extract and analyze ALL available financial metrics from ALL provided data sources
2. Calculate key financial ratios (P/E, ROE, ROA, Debt-to-Equity, Current Ratio, etc.)
3. Identify multi-year trends in revenue, profit, and growth patterns
4. Assess financial health using balance sheet strength indicators
5. Evaluate cash flow patterns and liquidity positions
6. Provide specific numerical insights with percentage changes
7. Highlight growth rates, margins, and efficiency metrics
8. Offer actionable investment insights with risk considerations

CRITICAL REQUIREMENT - USE REAL DATA:
- ALWAYS use the actual financial data provided in the context
- Extract and reference specific numbers, dates, and metrics from the data sources
- Calculate real growth rates, ratios, and trends from the provided data
- Reference specific years/periods from the actual data (e.g., "2023", "Q4 2023", "FY 2023")
- Never refuse to analyze a company if financial data is provided
- Use whatever financial data is available from any of the integrated APIs

Important: Always use ACTUAL NUMBERS from the provided financial data sources. Provide real analysis based on the available data regardless of which market the company is listed on."""

        user_prompt = f"""Provide a comprehensive financial analysis for {company_name} addressing this query: "{query}"

COMPREHENSIVE FINANCIAL DATA:
{context_text}

CRITICAL ANALYSIS REQUIREMENTS:
1. Use specific financial numbers and metrics from ALL available data sources provided above
2. Calculate actual growth rates, ratios, and trends from the multi-period data
3. Analyze revenue patterns, profitability trends, and financial health indicators
4. Provide quantitative insights with specific percentages and amounts
5. Address the specific query while leveraging all available fundamental data
6. Include professional investment perspective with risk assessment

YEAR SPECIFICATION REQUIREMENTS:
- ALWAYS mention specific years/periods from the actual data provided
- Extract and specify the exact year/period from the financial data sources
- When comparing periods, clearly state both years being compared
- Reference multiple years from the available data to show trends
- Use whatever date format is present in the provided data

Focus on delivering substantial analysis with real calculations based on the actual financial data provided. Use the specific numbers, ratios, and metrics from the data sources to provide actionable investment insights."""

        # Call OpenAI API for analysis
        response = client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=2500,
            temperature=0.7
        )
        
        analysis = response.choices[0].message.content
        
        logger.info(f"Comprehensive financial analysis completed for {company_name}")
        
        return {
            'success': True,
            'answer': analysis,
            'company': company_name,
            'query': query,
            'data_sources_used': list(financial_data.keys()),
            'analysis_type': 'comprehensive_fundamental_analysis'
        }
        
    except Exception as e:
        logger.error(f"Error in financial analysis for {company_name}: {e}")
        return {
            'success': False,
            'error': str(e),
            'company': company_name,
            'query': query
        }
