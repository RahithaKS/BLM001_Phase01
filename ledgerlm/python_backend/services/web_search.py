#!/usr/bin/env python3
"""
Enhanced Web Search Module for LedgerLM
Provides Google Custom Search integration with advanced caching and error handling
Based on MCP server architecture but optimized for direct integration
"""

import json
import logging
import os
import time
import socket
from typing import Any, Dict, List, Optional
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Configure logging
logger = logging.getLogger(__name__)

class EnhancedWebSearchManager:
    """Enhanced web search manager with caching and professional error handling"""
    
    def __init__(self):
        self.api_key = os.getenv('GOOGLE_API_KEY')
        self.cse_id = os.getenv('GOOGLE_CSE_ID')
        self.service = None
        self.search_cache = {}  # Simple cache for repeated searches
        self.cache_timeout = 3600  # 1 hour cache timeout
        self._initialized = False
        
    def initialize(self):
        """Initialize Google Custom Search service with comprehensive error handling"""
        # Refresh credentials from environment in case they changed
        self.api_key = os.getenv('GOOGLE_API_KEY')
        self.cse_id = os.getenv('GOOGLE_CSE_ID')
        
        logger.info(f"Initializing enhanced web search with API key present: {bool(self.api_key)}")
        logger.info(f"CSE ID present: {bool(self.cse_id)}")
        
        if not self.api_key or not self.cse_id:
            logger.warning("Google API credentials not found. Web search will be disabled.")
            logger.warning(f"API key: {'present' if self.api_key else 'missing'}")
            logger.warning(f"CSE ID: {'present' if self.cse_id else 'missing'}")
            self._initialized = False
            return False
            
        try:
            self.service = build("customsearch", "v1", developerKey=self.api_key)
            self._initialized = True
            logger.info("Google Custom Search service initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Google Custom Search: {e}")
            self._initialized = False
            return False
    
    def _is_cache_valid(self, cache_entry: Dict[str, Any]) -> bool:
        """Check if cache entry is still valid"""
        if not cache_entry or 'timestamp' not in cache_entry:
            return False
        return time.time() - cache_entry['timestamp'] < self.cache_timeout
    
    def search_web(self, query: str, num_results: int = 5) -> Dict[str, Any]:
        """
        Perform web search using Google Custom Search API with caching and timeout handling
        
        Args:
            query: Search query
            num_results: Number of results to return (max 10)
            
        Returns:
            Dictionary with search results and metadata
        """
        logger.info(f"Enhanced web search requested for: {query}")
        logger.info(f"Service initialized: {self._initialized}")
        logger.info(f"Service object: {self.service is not None}")
        
        if not self.service:
            logger.error("Web search service not initialized - attempting re-initialization")
            self.initialize()
            if not self.service:
                return {
                    "success": False,
                    "error": "Web search service not initialized. Please check GOOGLE_API_KEY and GOOGLE_CSE_ID environment variables.",
                    "results": [],
                    "cached": False
                }
        
        # Check cache first
        cache_key = f"{query}_{num_results}"
        if cache_key in self.search_cache:
            cache_entry = self.search_cache[cache_key]
            if self._is_cache_valid(cache_entry):
                logger.info(f"Returning cached results for: {query}")
                cache_entry['cached'] = True
                return cache_entry
            else:
                # Remove expired cache entry
                del self.search_cache[cache_key]
        
        try:
            # Perform search with timeout protection
            original_timeout = socket.getdefaulttimeout()
            socket.setdefaulttimeout(15)  # 15 second timeout for API calls
            
            search_result = self.service.cse().list(
                q=query,
                cx=self.cse_id,
                num=min(num_results, 10)  # API limit is 10
            ).execute()
            
            socket.setdefaulttimeout(original_timeout)
            
            # Process results with enhanced metadata
            items = search_result.get('items', [])
            processed_results = []
            
            for item in items:
                processed_results.append({
                    'title': item.get('title', ''),
                    'link': item.get('link', ''),
                    'snippet': item.get('snippet', ''),
                    'displayLink': item.get('displayLink', ''),
                    'formattedUrl': item.get('formattedUrl', ''),
                    'pagemap': item.get('pagemap', {}),  # Additional metadata
                    'fileFormat': item.get('fileFormat', 'text/html')
                })
            
            search_info = search_result.get('searchInformation', {})
            result = {
                "success": True,
                "query": query,
                "total_results": search_info.get('totalResults', '0'),
                "search_time": search_info.get('searchTime', '0'),
                "results": processed_results,
                "cached": False,
                "timestamp": time.time(),
                "api_quota_used": 1  # Track quota usage
            }
            
            # Cache the result
            self.search_cache[cache_key] = result
            
            logger.info(f"Enhanced web search completed for: {query} - {len(processed_results)} results")
            return result
            
        except HttpError as e:
            error_details = json.loads(e.content.decode()) if e.content else {}
            error_message = error_details.get('error', {}).get('message', str(e))
            
            # Handle specific API errors
            if 'quota' in error_message.lower():
                error_message = "Google API quota exceeded. Please check your API usage limits."
            elif 'invalid' in error_message.lower():
                error_message = "Invalid Google API credentials. Please verify GOOGLE_API_KEY and GOOGLE_CSE_ID."
            
            logger.error(f"Google API error: {error_details}")
            return {
                "success": False,
                "error": f"Google API error: {error_message}",
                "results": [],
                "cached": False,
                "error_code": e.resp.status if hasattr(e, 'resp') else None
            }
        except Exception as e:
            logger.error(f"Enhanced web search error: {e}")
            return {
                "success": False,
                "error": f"Search error: {str(e)}",
                "results": [],
                "cached": False
            }
        finally:
            # Always restore original timeout
            try:
                if 'original_timeout' in locals():
                    socket.setdefaulttimeout(original_timeout)
            except:
                pass
    
    def format_search_results(self, search_results: Dict[str, Any], max_snippets: int = 5) -> str:
        """
        Format search results for AI consumption with comprehensive context
        
        Args:
            search_results: Results from search_web()
            max_snippets: Maximum number of result snippets to include
            
        Returns:
            Formatted string with comprehensive search results
        """
        if not search_results.get("success") or not search_results.get("results"):
            error_msg = search_results.get("error", "No web search results found.")
            return f"**Web Search Status:** {error_msg}"
        
        results = search_results["results"][:max_snippets]
        cache_status = " (cached)" if search_results.get("cached") else ""
        
        formatted = f"**Comprehensive Web Search Results{cache_status}** for '{search_results['query']}':\n\n"
        formatted += f"*Found {search_results.get('total_results', 'unknown')} total results in {search_results.get('search_time', 'unknown')} seconds*\n\n"
        
        for i, result in enumerate(results, 1):
            formatted += f"**{i}. {result['title']}**\n"
            formatted += f"   📍 Source: {result['displayLink']}\n"
            formatted += f"   📄 Content: {result['snippet']}\n"
            formatted += f"   🔗 Reference: {result['link']}\n\n"
        
        return formatted
    
    def should_search_web(self, pdf_confidence: float, pdf_results: List[str], query: str = "") -> Dict[str, Any]:
        """
        Enhanced decision logic for determining if web search should be triggered
        
        Args:
            pdf_confidence: Confidence score from PDF search (0-1)
            pdf_results: List of relevant chunks from PDF search
            query: Original user query for context
            
        Returns:
            Dictionary with decision and reasoning
        """
        reasons = []
        should_search = False
        
        # Check for empty or insufficient PDF results
        if not pdf_results:
            should_search = True
            reasons.append("No PDF results found")
        elif len(pdf_results) == 0:
            should_search = True
            reasons.append("Empty PDF results list")
        
        # Check PDF confidence threshold
        if pdf_confidence < 0.3:
            should_search = True
            reasons.append(f"Low PDF confidence score ({pdf_confidence:.2f})")
        
        # Check total content length
        total_text = " ".join(pdf_results) if pdf_results else ""
        if len(total_text.strip()) < 50:
            should_search = True
            reasons.append("Very short PDF results (< 50 characters)")
        
        # Query-specific triggers
        query_lower = query.lower() if query else ""
        current_info_terms = [
            'current', 'recent', 'latest', 'today', 'now', 'present', 'updated',
            '2024', '2025', 'this year', 'recent news', 'latest news'
        ]
        
        if any(term in query_lower for term in current_info_terms):
            should_search = True
            reasons.append("Query requires current/recent information")
        
        market_terms = [
            'stock market', 'market cap', 'share price', 'trading', 'listed',
            'ticker', 'nasdaq', 'nyse', 'stock exchange'
        ]
        
        if any(term in query_lower for term in market_terms):
            should_search = True
            reasons.append("Query requires current market information")
        
        contact_terms = [
            'website', 'contact', 'phone', 'email', 'address', 'headquarters',
            'url', 'official site'
        ]
        
        if any(term in query_lower for term in contact_terms):
            should_search = True
            reasons.append("Query requires contact/website information")
        
        return {
            "should_search_web": should_search,
            "confidence_score": pdf_confidence,
            "pdf_results_count": len(pdf_results) if pdf_results else 0,
            "pdf_text_length": len(total_text),
            "reasons": reasons,
            "recommendation": "Enhanced web search" if should_search else "PDF results sufficient"
        }
    
    def format_combined_results(self, pdf_results: str, web_results: Dict[str, Any], query: str) -> str:
        """
        Format and combine PDF results with web search results for comprehensive answer
        
        Args:
            pdf_results: Results from PDF document search
            web_results: Results from web search  
            query: Original user query
            
        Returns:
            Formatted combined response
        """
        formatted_response = ""
        
        # Add PDF results if available
        if pdf_results and pdf_results.strip():
            formatted_response += "## 📄 **Document Analysis**\n"
            formatted_response += pdf_results + "\n\n"
        
        # Add web results if available
        if web_results.get("success") and web_results.get("results"):
            web_indicator = "🔍 **Enhanced with Web Search**" if formatted_response else "🌐 **Web Search Results**"
            cache_note = " (cached)" if web_results.get("cached") else ""
            formatted_response += f"{web_indicator}{cache_note}\n\n"
            formatted_response += self.format_search_results(web_results)
        elif web_results.get("error"):
            formatted_response += f"\n\n⚠️ **Web Search Status:** {web_results['error']}\n"
        
        if not formatted_response:
            formatted_response = "❌ **No Information Found**\n\nNo relevant information found in uploaded documents or web search results."
        
        return formatted_response
    
    def get_search_capabilities(self) -> Dict[str, Any]:
        """Get current search capabilities and status"""
        return {
            "service_initialized": self._initialized,
            "api_key_present": bool(self.api_key),
            "cse_id_present": bool(self.cse_id),
            "cache_size": len(self.search_cache),
            "cache_timeout": self.cache_timeout,
            "max_results_per_search": 10,
            "confidence_threshold": 0.3,
            "features": [
                "Google Custom Search API integration",
                "Intelligent caching system",
                "Confidence-based triggering",
                "Professional result formatting",
                "Comprehensive error handling",
                "Timeout protection"
            ]
        }

# Global enhanced web search manager
enhanced_web_search = EnhancedWebSearchManager()

# Direct access functions for integration
def search_web_enhanced(query: str, num_results: int = 5) -> Dict[str, Any]:
    """Direct access to enhanced web search functionality"""
    if not enhanced_web_search._initialized:
        enhanced_web_search.initialize()
    return enhanced_web_search.search_web(query, num_results)

def should_use_web_search_enhanced(pdf_confidence: float, pdf_results: List[str], query: str = "") -> Dict[str, Any]:
    """Direct access to enhanced web search decision logic"""
    return enhanced_web_search.should_search_web(pdf_confidence, pdf_results, query)

def format_combined_results_enhanced(pdf_results: str, web_results: Dict[str, Any], query: str) -> str:
    """Direct access to enhanced result formatting"""
    return enhanced_web_search.format_combined_results(pdf_results, web_results, query)

def get_web_search_status() -> Dict[str, Any]:
    """Get comprehensive web search status and capabilities"""
    return enhanced_web_search.get_search_capabilities()