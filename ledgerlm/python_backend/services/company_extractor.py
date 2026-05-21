#!/usr/bin/env python3
"""
Company Name Extraction Module for LedgerLM
Automatically identifies company names from uploaded documents
"""

import re
import logging
from typing import Dict, List, Optional, Tuple, Any
import requests
from config import settings

def get_ai_completion(prompt: str):
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
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# OpenAI client disabled
client = None

class CompanyExtractor:
    """Extract and identify company names from document content"""
    
    def __init__(self):
        # Common business entity suffixes
        self.business_suffixes = [
            'Inc', 'Inc.', 'Corp', 'Corp.', 'Corporation', 'Company', 'Co', 'Co.',
            'Ltd', 'Ltd.', 'Limited', 'LLC', 'LLP', 'LP', 'PLC', 'plc',
            'AS', 'A/S', 'AB', 'SA', 'S.A.', 'SAS', 'SARL', 'GmbH', 'AG',
            'Oy', 'Oyj', 'BV', 'NV', 'SpA', 'S.p.A.', 'Srl', 'S.r.l.',
            'Pty', 'Pty.', 'Group', 'Holdings', 'Enterprises', 'Industries',
            'Technologies', 'Systems', 'Solutions', 'Services', 'International',
            'Global', 'Worldwide', 'Partners', 'Associates', 'Software'
        ]
        
        # Keywords that often appear near company names
        self.company_indicators = [
            'company', 'corporation', 'group', 'holdings', 'enterprises',
            'industries', 'solutions', 'technologies', 'systems', 'services',
            'international', 'global', 'worldwide', 'partners', 'associates'
        ]
        
        # Financial statement headers that contain company names
        self.financial_headers = [
            'consolidated statement', 'balance sheet', 'income statement',
            'profit and loss', 'cash flow statement', 'annual report',
            'quarterly report', 'financial statements', 'audited financials'
        ]

    def extract_company_name(self, text: str, filename: str = "") -> Dict[str, Any]:
        """
        Extract company name from document text using multiple strategies
        
        Args:
            text: Document text content
            filename: Original filename for additional context
            
        Returns:
            Dictionary with company information
        """
        try:
            # Strategy 1: Look for company name in filename
            filename_company = self._extract_from_filename(filename)
            
            # Strategy 2: Look for company name in document headers/titles
            header_company = self._extract_from_headers(text)
            
            # Strategy 3: Look for company names with business suffixes
            suffix_companies = self._extract_with_suffixes(text)
            
            # Strategy 4: Look for repeated capitalized phrases (likely company names)
            repeated_companies = self._extract_repeated_names(text)
            
            # Strategy 5: Use AI to identify the main company
            ai_company = self._extract_with_ai(text[:3000])  # First 3000 chars for speed
            
            # Combine and rank results
            candidates = self._rank_candidates([
                filename_company,
                header_company,
                *suffix_companies,
                *repeated_companies,
                ai_company
            ], text)
            
            # Extract additional context
            context = self._extract_context(text, candidates[0] if candidates else None)
            
            result = {
                "primary_company": candidates[0] if candidates else None,
                "alternative_names": candidates[1:5] if len(candidates) > 1 else [],
                "context": context,
                "extraction_methods": {
                    "filename": filename_company,
                    "headers": header_company,
                    "business_suffixes": suffix_companies[:3],
                    "repeated_names": repeated_companies[:3],
                    "ai_extraction": ai_company
                }
            }
            
            logger.info(f"Company extraction completed. Primary: {result['primary_company']}")
            return result
            
        except Exception as e:
            logger.error(f"Company extraction failed: {e}")
            return {
                "primary_company": None,
                "alternative_names": [],
                "context": {},
                "error": str(e)
            }

    def _extract_from_filename(self, filename: str) -> Optional[str]:
        """Extract company name from filename"""
        if not filename:
            return None
            
        # Remove extension and common prefixes
        name = filename.split('.')[0]
        name = re.sub(r'^(report|statement|financial|annual|quarterly|q[1-4]|fy|yr)[\s_-]?', '', name, flags=re.IGNORECASE)
        name = re.sub(r'[\s_-]?(report|statement|financial|annual|quarterly|q[1-4]|fy|yr)$', '', name, flags=re.IGNORECASE)
        
        # Clean up separators
        name = re.sub(r'[_-]', ' ', name)
        name = ' '.join(word.capitalize() for word in name.split())
        
        return name if len(name) > 2 else None

    def _extract_from_headers(self, text: str) -> Optional[str]:
        """Extract company name from document headers and titles"""
        lines = text.split('\n')[:20]  # Check first 20 lines
        
        for line in lines:
            line = line.strip()
            if len(line) < 5 or len(line) > 100:
                continue
                
            # Look for lines that might be company names (all caps, title case)
            if line.isupper() and len(line.split()) <= 6:
                # Skip if it looks like a section header
                if not any(word.lower() in ['statement', 'report', 'balance', 'income', 'cash'] for word in line.split()):
                    return line.title()
            
            # Look for "Company Name Corp" patterns
            for suffix in self.business_suffixes:
                pattern = rf'^(.+?)\s+{re.escape(suffix)}\b'
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    company_name = match.group(1).strip()
                    if len(company_name) > 2:
                        return f"{company_name} {suffix}"
        
        return None

    def _extract_with_suffixes(self, text: str) -> List[str]:
        """Extract company names by looking for business suffixes"""
        companies = []
        
        for suffix in self.business_suffixes:
            # Pattern to find "Word Word Word Inc." style names - more flexible matching
            pattern = rf'\b([A-Z][a-zA-Z\s&-]+?)\s+{re.escape(suffix)}\b'
            matches = re.findall(pattern, text, re.IGNORECASE)
            
            for match in matches:
                company_name = f"{match.strip()} {suffix}"
                if len(company_name) > 5 and company_name not in companies:
                    companies.append(company_name)
        
        return companies[:10]  # Return top 10

    def _extract_repeated_names(self, text: str) -> List[str]:
        """Find capitalized phrases that appear multiple times (likely company names)"""
        # Find all capitalized phrases (2-6 words, allowing more flexibility)
        pattern = r'\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,5})\b'
        matches = re.findall(pattern, text)
        
        # Count frequency
        name_counts = {}
        for match in matches:
            if len(match) > 5:  # Minimum length
                # Skip common non-company phrases
                if not any(skip_word in match.lower() for skip_word in ['summary', 'analysis', 'report', 'statement', 'data', 'view', 'trend', 'entity']):
                    name_counts[match] = name_counts.get(match, 0) + 1
        
        # Return names that appear at least 2 times (lowered threshold), sorted by frequency
        repeated = [name for name, count in name_counts.items() if count >= 2]
        repeated.sort(key=lambda x: name_counts[x], reverse=True)
        
        return repeated[:10]

    def _extract_with_ai(self, text: str) -> Optional[str]:
        """Use AI to identify the main company name"""
        try:
            prompt = f"""
            Analyze this document excerpt and identify the main company name. Look for:
            1. The company that this financial document/report is about
            2. Company names with business suffixes (Inc, Corp, Ltd, etc.)
            3. The most frequently mentioned company name
            
            Document excerpt:
            {text}
            
            Respond with ONLY the company name, or "NONE" if no clear company can be identified.
            """
            
            company_name = get_ai_completion(prompt)
            return company_name if company_name and company_name != "NONE" else None
            
        except Exception as e:
            logger.error(f"AI company extraction failed: {e}")
            return None

    def _rank_candidates(self, candidates: List[Optional[str]], text: str) -> List[str]:
        """Rank company name candidates by relevance and frequency"""
        if not candidates:
            return []
        
        # Filter out None values and duplicates
        unique_candidates = []
        seen = set()
        
        for candidate in candidates:
            if candidate and candidate not in seen:
                unique_candidates.append(candidate)
                seen.add(candidate)
        
        if not unique_candidates:
            return []
        
        # Score candidates based on frequency in text and other factors
        scored_candidates = []
        text_lower = text.lower()
        
        # Find AI extraction result (it's the last in the candidates list)
        ai_candidate = None
        if len(candidates) > 4:  # filename, headers, suffixes, repeated, ai
            ai_candidate = candidates[-1]  # AI extraction is last
        
        for candidate in unique_candidates:
            score = 0
            candidate_lower = candidate.lower()
            
            # Clean candidate for better matching
            clean_candidate = re.sub(r'\n', ' ', candidate)
            clean_candidate = re.sub(r'\s+', ' ', clean_candidate.strip())
            
            # Skip obviously wrong candidates
            if any(skip in clean_candidate.lower() for skip in ['summary', 'analysis', 'view', 'data', 'similarly available']):
                score -= 1000  # Heavy penalty
                
            # Frequency in text
            score += text_lower.count(candidate_lower) * 10
            
            # Strong boost for AI extraction
            if ai_candidate and clean_candidate == ai_candidate:
                score += 1000
            
            # Bonus for business suffixes and company indicators
            if any(suffix.lower() in candidate_lower for suffix in self.business_suffixes):
                score += 50
            
            # Boost candidates with company indicators
            if any(indicator.lower() in candidate_lower for indicator in ['technologies', 'global', 'software', 'corporation', 'company', 'group']):
                score += 100
            
            # Bonus for appearing in first 500 characters
            if candidate_lower in text_lower[:500]:
                score += 30
            
            # Penalty for very short or generic words
            if len(clean_candidate) < 10 or clean_candidate.lower() in ['services', 'units', 'mobility']:
                score -= 50
            
            scored_candidates.append((clean_candidate, score))
        
        # Sort by score and return names only
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        return [candidate for candidate, score in scored_candidates]

    def _extract_context(self, text: str, company_name: Optional[str]) -> Dict[str, Any]:
        """Extract additional context about the company"""
        context = {}
        
        if not company_name:
            return context
        
        # Look for industry/sector information
        industry_patterns = [
            r'industry[:\s]+([^\n\r\.]+)',
            r'sector[:\s]+([^\n\r\.]+)',
            r'business[:\s]+([^\n\r\.]+)',
            r'operates in[:\s]+([^\n\r\.]+)'
        ]
        
        for pattern in industry_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                context['industry'] = match.group(1).strip()
                break
        
        # Look for geographic information
        countries = ['Norway', 'USA', 'United States', 'UK', 'Germany', 'France', 'Sweden', 'Denmark']
        currencies = ['NOK', 'USD', 'EUR', 'GBP', 'SEK', 'DKK']
        
        for country in countries:
            if country.lower() in text.lower():
                context['country'] = country
                break
        
        for currency in currencies:
            if currency in text:
                context['currency'] = currency
                break
        
        # Detect document type
        if any(term in text.lower() for term in ['annual report', 'quarterly report']):
            context['document_type'] = 'financial_report'
        elif any(term in text.lower() for term in ['balance sheet', 'income statement']):
            context['document_type'] = 'financial_statement'
        
        return context

def extract_company_info(text: str, filename: str = "") -> Dict[str, Any]:
    """
    Convenience function to extract company information from document
    
    Args:
        text: Document text content
        filename: Original filename
        
    Returns:
        Dictionary with company information
    """
    extractor = CompanyExtractor()
    return extractor.extract_company_name(text, filename)

if __name__ == "__main__":
    # Test the extractor
    sample_text = """
    NEMKO AS
    CONSOLIDATED STATEMENT OF PROFIT AND LOSS
    For the year ended 31 December 2023
    
    Revenue: NOK 1,234,567
    Operating expenses: NOK 987,654
    Net profit: NOK 246,913
    
    Nemko is a leading testing, inspection and certification company.
    """
    
    result = extract_company_info(sample_text, "nemko_annual_report_2023.pdf")
    print("Company extraction result:")
    print(f"Primary company: {result['primary_company']}")
    print(f"Context: {result['context']}")