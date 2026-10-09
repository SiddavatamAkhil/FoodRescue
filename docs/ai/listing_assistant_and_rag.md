# AI Listing Assistant & RAG Knowledge Engine

To ensure safety and reliability, AI capabilities are confined to the edges and never control critical transaction states.

## AI Listing Assistant
- Unstructured food business input is parsed via LLM.
- Output JSON is parsed against a strict Pydantic model (`ParseResponse`).
- **Safety Gate:** If `is_leftover` evaluates to `True`, the listing is immediately flagged and rejected to comply with FSSAI regulations.

## RAG Knowledge Engine
- Authored with official, verified Indian food safety rules (FSSAI).
- Uses vector embeddings to match queries.
- **Abstention Policy:** If matching confidence is below threshold, or no clear authoritative documentation is present, the AI explicitly abstains: *"I could not find sufficient authoritative information to answer this question."*
