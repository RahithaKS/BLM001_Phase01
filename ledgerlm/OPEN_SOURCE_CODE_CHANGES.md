# Code Changes for Open-Source AI Integration

## Overview

These are the code changes needed to make LedgerLM work with your local Ollama models.
**DO NOT apply these changes in Replit** - apply them only in your production environment.

---

## FILE 1: python_backend/services/ollama_client.py (NEW FILE)

Create this new file to handle communication with Ollama:

```python
"""
Ollama Client for Local AI Models
Replaces OpenAI API calls with local Ollama server
"""

import os
import requests
import logging
import base64
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class OllamaClient:
    """Client for interacting with local Ollama server"""
    
    def __init__(self):
        self.base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
        self.chat_model = os.environ.get("LOCAL_CHAT_MODEL", "qwen2.5:7b")
        self.embedding_model = os.environ.get("LOCAL_EMBEDDING_MODEL", "nomic-embed-text")
        self.vision_model = os.environ.get("LOCAL_VISION_MODEL", "llava:13b")
        self.timeout = int(os.environ.get("OLLAMA_TIMEOUT", "600"))
        
        logger.info(f"Ollama client initialized: {self.base_url}")
        logger.info(f"Chat model: {self.chat_model}")
        logger.info(f"Embedding model: {self.embedding_model}")
        logger.info(f"Vision model: {self.vision_model}")
    
    def is_available(self) -> bool:
        """Check if Ollama server is reachable"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except Exception as e:
            logger.warning(f"Ollama not available: {e}")
            return False
    
    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for a list of texts
        Replaces: OpenAI text-embedding-3-small
        """
        embeddings = []
        
        for text in texts:
            try:
                response = requests.post(
                    f"{self.base_url}/api/embeddings",
                    json={
                        "model": self.embedding_model,
                        "prompt": text
                    },
                    timeout=self.timeout
                )
                response.raise_for_status()
                data = response.json()
                embeddings.append(data["embedding"])
            except Exception as e:
                logger.error(f"Embedding error: {e}")
                # Return zero vector on error
                embeddings.append([0.0] * 768)
        
        return embeddings
    
    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        """
        Generate chat completion
        Replaces: OpenAI GPT-4
        """
        try:
            # Convert messages to Ollama format
            prompt = self._format_messages(messages)
            
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.chat_model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens
                    }
                },
                timeout=self.timeout
            )
            response.raise_for_status()
            data = response.json()
            return data.get("response", "")
        
        except Exception as e:
            logger.error(f"Chat completion error: {e}")
            raise
    
    def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 4096
    ):
        """
        Generate streaming chat completion
        Yields chunks of text as they are generated
        """
        try:
            prompt = self._format_messages(messages)
            
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.chat_model,
                    "prompt": prompt,
                    "stream": True,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens
                    }
                },
                stream=True,
                timeout=self.timeout
            )
            response.raise_for_status()
            
            for line in response.iter_lines():
                if line:
                    import json
                    data = json.loads(line)
                    if "response" in data:
                        yield data["response"]
        
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            raise
    
    def vision_completion(
        self,
        image_base64: str,
        prompt: str,
        temperature: float = 0.0,
        max_tokens: int = 4096
    ) -> str:
        """
        Extract data from an image using vision model
        Replaces: OpenAI GPT-4 Vision
        """
        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.vision_model,
                    "prompt": prompt,
                    "images": [image_base64],
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens
                    }
                },
                timeout=self.timeout
            )
            response.raise_for_status()
            data = response.json()
            return data.get("response", "")
        
        except Exception as e:
            logger.error(f"Vision completion error: {e}")
            raise
    
    def _format_messages(self, messages: List[Dict[str, str]]) -> str:
        """Convert OpenAI-style messages to a single prompt"""
        formatted = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            
            if role == "system":
                formatted.append(f"System: {content}")
            elif role == "user":
                formatted.append(f"User: {content}")
            elif role == "assistant":
                formatted.append(f"Assistant: {content}")
        
        formatted.append("Assistant:")
        return "\n\n".join(formatted)


# Singleton instance
_ollama_client = None

def get_ollama_client() -> OllamaClient:
    """Get or create Ollama client singleton"""
    global _ollama_client
    if _ollama_client is None:
        _ollama_client = OllamaClient()
    return _ollama_client


def is_local_ai_enabled() -> bool:
    """Check if local AI is enabled and available"""
    use_local = os.environ.get("USE_LOCAL_AI", "false").lower() == "true"
    if not use_local:
        return False
    
    client = get_ollama_client()
    return client.is_available()
```

---

## FILE 2: Update python_backend/services/vector_store.py

Replace the OpenAI embeddings with Ollama:

```python
# At the top of the file, add:
from services.ollama_client import get_ollama_client, is_local_ai_enabled

# Replace the _get_openai_client function with:

def _get_embedding_function():
    """Get embedding function - uses local Ollama if available, otherwise OpenAI"""
    
    if is_local_ai_enabled():
        logger.info("Using local Ollama for embeddings")
        ollama = get_ollama_client()
        
        def get_embeddings_local(texts):
            return ollama.get_embeddings(texts)
        
        return get_embeddings_local
    else:
        logger.info("Using OpenAI for embeddings")
        client = _get_openai_client()
        
        def get_embeddings_openai(texts):
            embeddings = []
            for text in texts:
                response = client.embeddings.create(
                    model=EMBED_MODEL,
                    input=text
                )
                embeddings.append(response.data[0].embedding)
            return embeddings
        
        return get_embeddings_openai

# Then update the get_embeddings function to use this:

_embedding_function = None

def get_embeddings(texts: list) -> list:
    """Get embeddings for a list of texts"""
    global _embedding_function
    
    if _embedding_function is None:
        _embedding_function = _get_embedding_function()
    
    return _embedding_function(texts)
```

---

## FILE 3: Update python_backend/parsers/vision_extractor.py

Replace GPT-4 Vision with Ollama vision:

```python
# At the top, add:
from services.ollama_client import get_ollama_client, is_local_ai_enabled

# Replace get_openai_client function:

def get_vision_client():
    """Get vision client - uses local Ollama if available, otherwise OpenAI"""
    
    if is_local_ai_enabled():
        logger.info("Using local Ollama for vision extraction")
        return get_ollama_client()
    else:
        logger.info("Using OpenAI for vision extraction")
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            return None
        return OpenAI(api_key=api_key, timeout=600, max_retries=3)


# Replace extract_page_with_vision function:

def extract_page_with_vision(image, page_num: int, client: Any) -> Dict[str, Any]:
    """
    Extract metrics from a single page image using vision model.
    Works with both OpenAI and local Ollama.
    """
    logger.info(f"Extracting page {page_num} with vision model")
    
    content: Optional[str] = None
    try:
        # Convert image to base64
        base64_image = image_to_base64(image)
        
        # Check if using local Ollama or OpenAI
        if is_local_ai_enabled() and hasattr(client, 'vision_completion'):
            # Use Ollama
            content = client.vision_completion(
                image_base64=base64_image,
                prompt=KPI_EXTRACTION_PROMPT,
                temperature=0,
                max_tokens=4096
            )
        else:
            # Use OpenAI
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": KPI_EXTRACTION_PROMPT},
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
                temperature=0
            )
            content = response.choices[0].message.content
        
        if content is None:
            raise ValueError("Empty response from vision model")
        
        # Extract JSON from response
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        
        result = json.loads(content.strip())
        result["page_number"] = page_num
        result["extraction_method"] = "local_vision" if is_local_ai_enabled() else "gpt4_vision"
        
        logger.info(f"Page {page_num}: Extracted {len(result.get('metrics', []))} metrics")
        return result
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON for page {page_num}: {e}")
        return {
            "page_number": page_num,
            "extraction_method": "vision",
            "error": f"JSON parse error: {str(e)}",
            "metrics": []
        }
    except Exception as e:
        logger.error(f"Vision extraction failed for page {page_num}: {e}")
        return {
            "page_number": page_num,
            "extraction_method": "vision",
            "error": str(e),
            "metrics": []
        }
```

---

## FILE 4: Environment Variables (.env on GPU Server)

Add these to your `.env` file:

```bash
# ================================
# Local AI Configuration
# ================================
USE_LOCAL_AI=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_TIMEOUT=600

# Model names (must match what you downloaded)
LOCAL_EMBEDDING_MODEL=nomic-embed-text
LOCAL_CHAT_MODEL=qwen2.5:7b
LOCAL_VISION_MODEL=llava:13b

# ================================
# Fallback to OpenAI (optional)
# ================================
# If local AI fails, fall back to OpenAI
OPENAI_API_KEY=sk-your-key-here
```

---

## FILE 5: Environment Variables (.env on Bosch VM)

If LedgerLM runs on Bosch VM but AI models on GPU server:

```bash
# ================================
# Remote AI Configuration
# ================================
USE_LOCAL_AI=true
OLLAMA_BASE_URL=http://GPU_SERVER_IP:11434
OLLAMA_TIMEOUT=600

LOCAL_EMBEDDING_MODEL=nomic-embed-text
LOCAL_CHAT_MODEL=qwen2.5:7b
LOCAL_VISION_MODEL=llava:13b
```

Replace `GPU_SERVER_IP` with the actual IP of your RTX 5000 server.

---

## TESTING CHECKLIST

After applying these changes, test each function:

### 1. Test Embeddings
```bash
curl -X POST http://localhost:8000/api/test/embeddings \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world"}'
```

### 2. Test Vision Extraction
Upload a test KPI PDF and check logs for "Using local Ollama for vision extraction"

### 3. Test Chat
Send a chat message and verify response comes from local model

---

## ROLLBACK PLAN

If local AI doesn't work well, you can instantly switch back to OpenAI:

```bash
# In .env, change:
USE_LOCAL_AI=false

# Then restart:
docker-compose restart app
```

---

## EMBEDDING DIMENSION NOTE

**Important:** nomic-embed-text produces 768-dimensional vectors, while OpenAI text-embedding-3-small produces 1536-dimensional vectors.

If you switch from OpenAI to local embeddings, you need to:
1. Re-generate all embeddings in your database
2. Or create a new vector column with 768 dimensions

SQL to add new column:
```sql
ALTER TABLE enterprise_chunks ADD COLUMN embedding_local vector(768);
```

---

**Document Version:** 1.0
**Apply these changes only in production, not in Replit**
