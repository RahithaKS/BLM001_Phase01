"""
Database utilities bridge module
Re-exports database functions from python_backend for use in attached_assets modules
"""
import sys
import os

# Add python_backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'python_backend'))

# Import and re-export all needed functions
from database import (
    store_document_chunks,
    store_vector_embeddings,
    search_similar_chunks,
    is_database_available
)

__all__ = [
    'store_document_chunks',
    'store_vector_embeddings',
    'search_similar_chunks',
    'is_database_available'
]
