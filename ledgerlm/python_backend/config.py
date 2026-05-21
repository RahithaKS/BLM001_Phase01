"""Configuration settings for LedgerLM Python Backend"""
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Server
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    
    # Database
    DATABASE_URL: str = os.environ.get("NEON_DATABASE_URL", os.environ.get("DATABASE_URL", ""))
    
    # Ollama (OpenAI Compatible)
    OLLAMA_BASE_URL: str = os.environ.get("OLLAMA_BASE_URL", "https://ollama.ledgerlm.ai").replace("/v1", "").rstrip("/")
    OLLAMA_API_KEY: str = os.environ.get("OLLAMA_API_KEY", "ledgerlm-secret-key")
    OLLAMA_CHAT_MODEL: str = os.environ.get("OLLAMA_CHAT_MODEL", "qwen2.5:32b")
    OLLAMA_EMBEDDING_MODEL: str = os.environ.get("OLLAMA_EMBEDDING_MODEL", "mxbai-embed-large")
    
    # Legacy OpenAI placeholders (to avoid breaking imports)
    OPENAI_API_KEY: str = OLLAMA_API_KEY
    OPENAI_CHAT_MODEL: str = OLLAMA_CHAT_MODEL
    OPENAI_EMBEDDING_MODEL: str = OLLAMA_EMBEDDING_MODEL
    
    # Google Search
    GOOGLE_API_KEY: str = os.environ.get("GOOGLE_API_KEY", "")
    GOOGLE_CSE_ID: str = os.environ.get("GOOGLE_CSE_ID", "")
    
    # Document Processing
    MAX_FILE_SIZE: int = 2000 * 1024 * 1024  # 2GB for very large financial files
    CHUNK_SIZE: int = 8000
    CHUNK_OVERLAP: int = 1000
    
    # Timeouts for large file processing
    UPLOAD_TIMEOUT: int = 1800  # 30 minutes for large uploads
    PROCESSING_TIMEOUT: int = 3600  # 60 minutes for processing
    
    # Storage
    UPLOAD_DIR: str = "./uploads"
    
    class Config:
        env_file = ".env"
        extra = "ignore"  # Ignore extra environment variables

settings = Settings()
