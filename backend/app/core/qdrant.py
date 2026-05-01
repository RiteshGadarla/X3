"""
Qdrant Vector Database Service
Provides async Qdrant client for:
  1. Deduplication hashing (AG-03) — fingerprint tickets and find duplicates
  2. Spam prevention — 60-second hash cache to reject rapid duplicate submissions
  3. Graph state caching — fast ticket state lookups
  4. Similarity index — vector matching
"""

import hashlib
import json
import uuid
from typing import Optional
from datetime import datetime, timezone

from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models as rest
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# ── Singleton async Qdrant pool ───────────────────────────────────────────────

_client: Optional[AsyncQdrantClient] = None

TICKETS_COLLECTION = "csagent_tickets"
STATE_COLLECTION = "csagent_state"
SPAM_COLLECTION = "csagent_spam"
KB_COLLECTION = "csagent_kb"

async def get_qdrant() -> AsyncQdrantClient:
    """Get the global async Qdrant client. Creates one if it doesn't exist."""
    global _client
    if _client is None:
        settings = get_settings()
        url = settings.qdrant_url
        if not url:
            logger.info("QDRANT_URL not configured, using default localhost:6333")
            _client = AsyncQdrantClient(host="localhost", port=6333)
        else:
            _client = AsyncQdrantClient(url=url)

        try:
            _client.set_model("BAAI/bge-small-en-v1.5")
            collections = await _client.get_collections()
            collection_names = [c.name for c in collections.collections]
            
            if TICKETS_COLLECTION not in collection_names:
                await _client.create_collection(
                    collection_name=TICKETS_COLLECTION,
                    vectors_config=_client.get_fastembed_vector_params()
                )
            if STATE_COLLECTION not in collection_names:
                await _client.create_collection(
                    collection_name=STATE_COLLECTION,
                    vectors_config=rest.VectorParams(size=1, distance=rest.Distance.DOT)
                )
            if SPAM_COLLECTION not in collection_names:
                await _client.create_collection(
                    collection_name=SPAM_COLLECTION,
                    vectors_config=rest.VectorParams(size=1, distance=rest.Distance.DOT)
                )
            if KB_COLLECTION not in collection_names:
                await _client.create_collection(
                    collection_name=KB_COLLECTION,
                    vectors_config=_client.get_fastembed_vector_params()
                )
            logger.info("⚡ Qdrant connected and collections verified")
        except Exception as e:
            logger.error(f"❌ Qdrant connection failed: {e}")
            _client = None
            raise
    return _client


async def close_qdrant():
    """Close the Qdrant connection."""
    global _client
    if _client:
        await _client.close()
        _client = None
        logger.info("Qdrant connection closed")


# ═══════════════════════════════════════════════════════════════════════════
# 1. SPAM PREVENTION — 60-second hash dedup
# ═══════════════════════════════════════════════════════════════════════════

def _ticket_fingerprint(email: str, subject: str, description: str) -> str:
    raw = f"{email.lower().strip()}|{subject.lower().strip()}|{description.lower().strip()[:500]}"
    return hashlib.sha256(raw.encode()).hexdigest()

async def check_spam_duplicate(email: str, subject: str, description: str, ttl: int = 60) -> bool:
    client = await get_qdrant()
    fp = _ticket_fingerprint(email, subject, description)
    now = datetime.now(timezone.utc).timestamp()
    
    records, _ = await client.scroll(
        collection_name=SPAM_COLLECTION,
        scroll_filter=rest.Filter(
            must=[
                rest.FieldCondition(key="hash", match=rest.MatchValue(value=fp)),
                rest.FieldCondition(key="timestamp", range=rest.Range(gte=now - ttl))
            ]
        ),
        limit=1
    )
    
    if records:
        logger.warning(f"Spam check: DUPLICATE detected within {ttl}s (fingerprint: {fp[:12]}…)")
        return True  # Is spam
        
    # Store the new fingerprint
    point_id = str(uuid.uuid4())
    await client.upsert(
        collection_name=SPAM_COLLECTION,
        points=[
            rest.PointStruct(
                id=point_id,
                vector=[0.0],
                payload={"hash": fp, "timestamp": now}
            )
        ]
    )
    logger.info(f"Spam check: New submission (fingerprint: {fp[:12]}…)")
    return False

# ═══════════════════════════════════════════════════════════════════════════
# 2. DEDUP HASHING (AG-03) — find similar recent tickets
# ═══════════════════════════════════════════════════════════════════════════

async def store_ticket_fingerprint(ticket_ref: str, subject: str, description: str, category: str):
    client = await get_qdrant()
    text = f"{subject} {description} {category}"
    
    if not text.strip():
        return
        
    point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, ticket_ref))
    now = datetime.now(timezone.utc).timestamp()
    
    await client.add(
        collection_name=TICKETS_COLLECTION,
        documents=[text],
        metadata=[{"ticket_ref": ticket_ref, "timestamp": now}],
        ids=[point_id]
    )
    logger.info(f"Qdrant: Stored fingerprint for {ticket_ref}")

async def find_similar_tickets(ticket_ref: str, subject: str, description: str, category: str, threshold: float = 0.8) -> list[dict]:
    client = await get_qdrant()
    text = f"{subject} {description} {category}"

    if not text.strip():
        return []

    # Search within the last 30 days (BRD: recurring issue = 3 in 30 days)
    now = datetime.now(timezone.utc).timestamp()
    hits = await client.query(
        collection_name=TICKETS_COLLECTION,
        query_text=text,
        query_filter=rest.Filter(
            must=[
                rest.FieldCondition(key="timestamp", range=rest.Range(gte=now - 2592000))
            ]
        ),
        limit=6
    )
    
    matches = []
    for hit in hits:
        if hit.payload and hit.payload.get("ticket_ref") == ticket_ref:
            continue
            
        if hit.score >= threshold:
            matches.append({
                "ticket_ref": hit.payload.get("ticket_ref"),
                "similarity": round(hit.score, 3),
                "shared_keywords": ["embedded-vector-match"],
            })
            
    matches.sort(key=lambda m: m["similarity"], reverse=True)
    
    if matches:
        logger.info(f"Qdrant: Found {len(matches)} similar tickets for {ticket_ref} (top: {matches[0]['similarity']})")
        
    return matches[:5]

# ═══════════════════════════════════════════════════════════════════════════
# 3. GRAPH STATE CACHING — fast ticket state lookups
# ═══════════════════════════════════════════════════════════════════════════

async def cache_ticket_state(ticket_ref: str, state: dict, ttl: int = 3600):
    client = await get_qdrant()
    clean_state = {}
    for k, v in state.items():
        if isinstance(v, datetime):
            clean_state[k] = v.isoformat()
        elif isinstance(v, (str, int, float, bool, type(None))):
            clean_state[k] = v
        elif isinstance(v, (list, dict)):
            clean_state[k] = v
            
    point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"state_{ticket_ref}"))
    now = datetime.now(timezone.utc).timestamp()
    
    await client.upsert(
        collection_name=STATE_COLLECTION,
        points=[
            rest.PointStruct(
                id=point_id,
                vector=[0.0],
                payload={"ticket_ref": ticket_ref, "state": json.dumps(clean_state), "timestamp": now}
            )
        ]
    )
    logger.info(f"Qdrant: Cached state for {ticket_ref}")

async def get_cached_ticket_state(ticket_ref: str) -> Optional[dict]:
    client = await get_qdrant()
    point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"state_{ticket_ref}"))
    
    records = await client.retrieve(
        collection_name=STATE_COLLECTION,
        ids=[point_id],
        with_payload=True
    )
    
    if records and records[0].payload:
        logger.info(f"Qdrant: Cache HIT for {ticket_ref}")
        return json.loads(records[0].payload.get("state", "{}"))
        
    logger.info(f"Qdrant: Cache MISS for {ticket_ref}")
    return None

async def invalidate_ticket_state(ticket_ref: str):
    client = await get_qdrant()
    point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"state_{ticket_ref}"))
    await client.delete(
        collection_name=STATE_COLLECTION,
        points_selector=rest.PointIdsList(points=[point_id])
    )

# ═══════════════════════════════════════════════════════════════════════════
# 4. QDRANT STATS — for monitoring/health checks
# ═══════════════════════════════════════════════════════════════════════════

async def get_qdrant_stats() -> dict:
    try:
        client = await get_qdrant()
        tickets_info = await client.get_collection(TICKETS_COLLECTION)
        return {
            "connected": True,
            "engine": "qdrant",
            "active_ticket_fingerprints": tickets_info.points_count,
        }
    except Exception as e:
        return {"connected": False, "error": str(e)}

# ═══════════════════════════════════════════════════════════════════════════
# 5. KNOWLEDGE BASE (Phase 3)
# ═══════════════════════════════════════════════════════════════════════════

async def store_kb_document(filename: str, text: str, doc_type: str = "kb"):
    """Chunk the text and store in the KB_COLLECTION."""
    client = await get_qdrant()
    
    # Simple chunking by paragraph/newlines
    chunks = [c.strip() for c in text.split('\n\n') if len(c.strip()) > 20]
    
    if not chunks:
        return
        
    documents = []
    metadata = []
    ids = []
    now = datetime.now(timezone.utc).timestamp()
    
    for idx, chunk in enumerate(chunks):
        documents.append(chunk)
        metadata.append({"filename": filename, "doc_type": doc_type, "timestamp": now, "chunk_index": idx})
        ids.append(str(uuid.uuid4()))
        
    await client.add(
        collection_name=KB_COLLECTION,
        documents=documents,
        metadata=metadata,
        ids=ids
    )
    logger.info(f"Qdrant: Stored {len(chunks)} chunks for document {filename}")

async def search_kb_document(query: str, limit: int = 3, threshold: float = 0.5) -> list[str]:
    """Search the KB_COLLECTION for relevant chunks to answer a query."""
    client = await get_qdrant()
    
    if not query.strip():
        return []
        
    hits = await client.query(
        collection_name=KB_COLLECTION,
        query_text=query,
        limit=limit
    )
    
    results = []
    for hit in hits:
        if hit.score >= threshold and hit.document:
            results.append(hit.document)
            
    if results:
        logger.info(f"Qdrant: Found {len(results)} KB chunks for query: '{query[:20]}...'")
    else:
        logger.info(f"Qdrant: No relevant KB chunks found for query: '{query[:20]}...'")
        
    return results
