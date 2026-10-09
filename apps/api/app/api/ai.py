
import json
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import RoleChecker
from app.db.models import (
    User,
    UserRole,
    KnowledgeDocument,
    KnowledgeChunk,
)
from app.db.session import get_db
from app.services.ai_providers import get_llm_provider
from app.services.knowledge_rag import (
    ingest_document,
    retrieve_relevant_chunks,
)

router = APIRouter()


# ---------------------------------------------------------
# FOOD LISTING PARSER
# ---------------------------------------------------------

class ParseRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10000)


class ParseResponse(BaseModel):
    name: str
    quantity: float
    unit: str
    is_veg: bool
    is_leftover: bool
    prep_time: str
    expiry_time: str


@router.post("/parse-listing", response_model=ParseResponse)
async def parse_food_listing(
    request: ParseRequest,
    llm=Depends(get_llm_provider),
):
    """
    Extract structured food details from unstructured text.
    Reject consumer-exposed plate leftovers.
    """
    prompt = (
        "You are an AI food safety parser. Extract food details "
        "from the text below.\n"
        f"Text: {request.text!r}\n"
        "Return ONLY a JSON object with these keys: name, quantity, "
        "unit, is_veg, is_leftover, prep_time, expiry_time."
    )

    raw_response = await llm.generate_response(prompt)

    try:
        data = json.loads(raw_response)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="AI parser produced invalid JSON output.",
        )

    try:
        validated = ParseResponse(**data)
    except (ValidationError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="AI output did not match the required food schema.",
        )

    if validated.is_leftover:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Safety Reject: This listing contains consumer-exposed plate leftovers.",
        )

    return validated


# ---------------------------------------------------------
# RAG KNOWLEDGE QUERY
# ---------------------------------------------------------

class RagRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    jurisdiction: str = Field(
        default="ANDHRA_PRADESH",
        min_length=2,
        max_length=100,
    )


@router.post("/knowledge-query")
async def query_knowledge_rag(
    request: RagRequest,
    db: AsyncSession = Depends(get_db),
    llm=Depends(get_llm_provider),
):
    """
    Retrieve stored knowledge and answer with source citations.
    Abstain when sufficient supporting evidence is unavailable.
    """
    chunks = await retrieve_relevant_chunks(
        db,
        request.question,
        limit=2,
    )

    if (
        not chunks
        or all(chunk.get("score", 0) < 0.1 for chunk in chunks)
    ):
        return {
            "answer": (
                "I could not find sufficient authoritative information "
                "to answer this question."
            ),
            "citations": [],
            "status": "ABSTAIN",
        }

    context_str = "\n\n".join(
        [
            (
                f"Source [{index + 1}]: "
                f"{item['chunk'].content}"
            )
            for index, item in enumerate(chunks)
        ]
    )

    prompt = (
        f"You are a food safety information assistant for "
        f"{request.jurisdiction}, India.\n"
        "Answer using only the supplied source context. "
        "Do not invent regulations, requirements, or citations. "
        "If the context does not support an answer, say so.\n\n"
        f"Source context:\n{context_str}\n\n"
        f"Question: {request.question}\n"
        "Answer:"
    )

    answer = await llm.generate_response(prompt)

    citations = [
        {
            "document": item["document"].title,
            "source_url": item["document"].source_url,
            "section": (
                f"Chunk {item['chunk'].chunk_index + 1}"
            ),
            "jurisdiction": item["document"].jurisdiction,
        }
        for item in chunks
    ]

    return {
        "answer": answer,
        "citations": citations,
        "status": "ANSWERED",
    }


# ---------------------------------------------------------
# ADMIN-ONLY KNOWLEDGE INGESTION
# ---------------------------------------------------------

class KnowledgeIngestRequest(BaseModel):
    title: str = Field(min_length=3, max_length=250)
    content: str = Field(min_length=20, max_length=500000)
    source_url: str = Field(min_length=8, max_length=2000)
    jurisdiction: str = Field(
        default="ANDHRA_PRADESH",
        min_length=2,
        max_length=100,
    )
    language: str = Field(default="en", min_length=2, max_length=20)


@router.post(
    "/knowledge-ingest",
    status_code=status.HTTP_201_CREATED,
)
async def ingest_knowledge(
    request: KnowledgeIngestRequest,
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN])
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Store a knowledge document and create its searchable chunks.
    Accessible only to authenticated administrators.
    """
    title = request.title.strip()
    content = request.content.strip()
    source_url = request.source_url.strip()

    if not title or not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Title and content cannot be blank.",
        )

    parsed_url = urlparse(source_url)

    if (
        parsed_url.scheme not in ("http", "https")
        or not parsed_url.netloc
        or parsed_url.username
        or parsed_url.password
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide a valid HTTP or HTTPS source URL.",
        )

    # Avoid ingesting the same URL more than once.
    existing_result = await db.execute(
        select(KnowledgeDocument).where(
            KnowledgeDocument.source_url == source_url
        )
    )
    existing_document = existing_result.scalars().first()

    if existing_document:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A document with this source URL already exists.",
        )

    try:
        document = await ingest_document(
            db=db,
            title=title,
            content=content,
            source_url=source_url,
            jurisdiction=request.jurisdiction.strip(),
            language=request.language.strip(),
        )

        chunk_result = await db.execute(
            select(func.count())
            .select_from(KnowledgeChunk)
            .where(
                KnowledgeChunk.document_id == document.id
            )
        )
        chunks_created = chunk_result.scalar_one()

    except HTTPException:
        raise
    except Exception:
        # Log the full exception server-side in your application
        # before using this endpoint in production.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Knowledge ingestion failed.",
        )

    return {
        "message": "Knowledge document ingested successfully.",
        "document_id": document.id,
        "title": document.title,
        "source_url": document.source_url,
        "jurisdiction": document.jurisdiction,
        "chunks_created": chunks_created,
        "created_by": current_user.id,
    }
