import os
import json
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from openai import AsyncOpenAI

class BaseLLMProvider(ABC):
    @abstractmethod
    async def generate_response(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        pass

class BaseEmbeddingProvider(ABC):
    @abstractmethod
    async def get_embedding(self, text: str) -> List[float]:
        pass

# --- Mock Implementation for Testing/Local Dev ---
class MockLLMProvider(BaseLLMProvider):
    async def generate_response(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        # Check if we are testing the AI Parser
        p_lower = prompt.lower()
        if "biryani" in p_lower or "listing" in p_lower or "extract" in p_lower:
            # Check if testing plate leftovers safety gate
            if "plates" in p_lower or "leftovers" in p_lower or "private party" in p_lower:
                return json.dumps({
                    "name": "Veg Biryani Plate Leftovers",
                    "quantity": 10.0,
                    "unit": "meals",
                    "is_veg": True,
                    "is_leftover": True, # Triggers safety reject
                    "prep_time": "2026-10-07T13:00:00",
                    "expiry_time": "2026-10-07T17:00:00"
                })
            else:
                return json.dumps({
                    "name": "Fresh Veg Biryani Boxes",
                    "quantity": 45.0,
                    "unit": "meals",
                    "is_veg": True,
                    "is_leftover": False,
                    "prep_time": "2026-10-07T13:00:00",
                    "expiry_time": "2026-10-07T19:00:00"
                })
                
        # Check if RAG test for abstention
        if "abstain" in p_lower or "unknown regulatory standard" in p_lower:
            return "I could not find sufficient authoritative information to answer this question."

        return "Mocked AI response with high citation credibility."

class MockEmbeddingProvider(BaseEmbeddingProvider):
    async def get_embedding(self, text: str) -> List[float]:
        # Return a simple mock vector of dimension 128
        return [0.1] * 128


# --- OpenAI Implementation (Used in Production) ---
class OpenAILLMProvider(BaseLLMProvider):
    def __init__(self, api_key: str):
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")

    async def generate_response(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.0
        )
        return response.choices[0].message.content

class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    def __init__(self, api_key: str):
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")

    async def get_embedding(self, text: str) -> List[float]:
        response = await self.client.embeddings.create(
            model=self.model,
            input=text
        )
        return response.data[0].embedding


# Factory getters
def get_llm_provider() -> BaseLLMProvider:
    key = os.getenv("OPENAI_API_KEY")
    if key and not key.startswith("mock"):
        return OpenAILLMProvider(key)
    return MockLLMProvider()

def get_embedding_provider() -> BaseEmbeddingProvider:
    key = os.getenv("OPENAI_API_KEY")
    if key and not key.startswith("mock"):
        return OpenAIEmbeddingProvider(key)
    return MockEmbeddingProvider()
