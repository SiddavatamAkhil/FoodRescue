
import uuid
import math
from typing import List, Dict, Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.models import KnowledgeDocument, KnowledgeChunk
from app.services.ai_providers import get_embedding_provider


async def ingest_document(
    db: AsyncSession,
    title: str,
    content: str,
    source_url: Optional[str] = None,
    jurisdiction: str = "ANDHRA_PRADESH",
    language: str = "en",
) -> KnowledgeDocument:
    """
    Ingest a document, split it into chunks, generate embeddings,
    and store the document and chunks in the database.
    """
    doc_id = str(uuid.uuid4())

    doc = KnowledgeDocument(
        id=doc_id,
        title=title,
        content=content,
        source_url=source_url,
        jurisdiction=jurisdiction,
        language=language,
    )
    db.add(doc)

    # Split content into chunks of approximately 500 characters.
    paragraphs = [
        paragraph.strip()
        for paragraph in content.split("\n\n")
        if paragraph.strip()
    ]

    chunks = []
    current_chunk = ""

    for paragraph in paragraphs:
        if not current_chunk:
            current_chunk = paragraph
        elif len(current_chunk) + len(paragraph) + 2 <= 500:
            current_chunk += "\n\n" + paragraph
        else:
            chunks.append(current_chunk.strip())
            current_chunk = paragraph

    if current_chunk:
        chunks.append(current_chunk.strip())

    embedding_provider = get_embedding_provider()

    try:
        for index, chunk_text in enumerate(chunks):
            vector = await embedding_provider.get_embedding(chunk_text)

            chunk_model = KnowledgeChunk(
                id=str(uuid.uuid4()),
                document_id=doc_id,
                chunk_index=index,
                content=chunk_text,
                embedding=vector,
            )
            db.add(chunk_model)

        await db.commit()
        await db.refresh(doc)
        return doc

    except Exception:
        await db.rollback()
        raise


async def retrieve_relevant_chunks(
    db: AsyncSession,
    query: str,
    limit: int = 3,
) -> List[Dict[str, Any]]:
    """
    Retrieve relevant document chunks using keyword matching and
    cosine similarity. Compatible with JSON embeddings in PostgreSQL
    and SQLite; does not require the pgvector <=> operator.
    """
    if limit <= 0:
        return []

    embedding_provider = get_embedding_provider()
    query_vector = await embedding_provider.get_embedding(query)

    result = await db.execute(
        select(KnowledgeChunk, KnowledgeDocument)
        .join(
            KnowledgeDocument,
            KnowledgeChunk.document_id == KnowledgeDocument.id,
        )
    )

    rows = result.all()
    scored_chunks = []

    import re
    STOP_WORDS = {
        "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "of", "for", "with", "about",
        "against", "between", "into", "through", "during", "before", "after",
        "above", "below", "to", "from", "up", "down", "in", "out", "on", "off",
        "over", "under", "again", "further", "then", "once", "here", "there",
        "when", "where", "why", "how", "all", "any", "both", "each", "few", "more",
        "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same",
        "so", "than", "too", "very", "s", "t", "can", "will", "just", "don",
        "should", "now", "what", "which", "who", "whom", "this", "that", "these", "those"
    }
    
    query_tokens = [w for w in re.findall(r"\w+", query.lower()) if w not in STOP_WORDS]

    for chunk, doc in rows:
        content_lower = (chunk.content or "").lower()
        chunk_tokens = set(re.findall(r"\w+", content_lower))

        # Count significant query terms found in the chunk.
        keyword_score = sum(
            1.0
            for token in query_tokens
            if token in chunk_tokens
        )

        # Calculate cosine similarity between stored and query vectors.
        vector_score = 0.0
        stored_vector = chunk.embedding

        if stored_vector and query_vector:
            try:
                stored_values = [float(value) for value in stored_vector]
                query_values = [float(value) for value in query_vector]

                # Cosine similarity requires vectors of equal length.
                # Do not treat placeholder or identical mock vectors as meaningful semantic similarity.
                is_stored_uniform = len(stored_values) == 0 or len(set(stored_values)) <= 1
                is_query_uniform = len(query_values) == 0 or len(set(query_values)) <= 1

                if len(stored_values) == len(query_values) and not is_stored_uniform and not is_query_uniform:
                    dot_product = sum(
                        a * b
                        for a, b in zip(stored_values, query_values)
                    )

                    magnitude_stored = math.sqrt(
                        sum(value * value for value in stored_values)
                    )
                    magnitude_query = math.sqrt(
                        sum(value * value for value in query_values)
                    )

                    if magnitude_stored > 0 and magnitude_query > 0:
                        vector_score = dot_product / (
                            magnitude_stored * magnitude_query
                        )

            except (TypeError, ValueError, OverflowError):
                # Invalid or incompatible stored embeddings receive no
                # vector score; keyword matching can still contribute.
                vector_score = 0.0

        # Preserve the project's hybrid keyword/vector scoring approach.
        total_score = (keyword_score * 0.4) + (vector_score * 0.6)

        scored_chunks.append(
            {
                "chunk": chunk,
                "document": doc,
                "score": total_score,
            }
        )

    scored_chunks.sort(
        key=lambda item: item["score"],
        reverse=True,
    )

    return scored_chunks[:limit]
