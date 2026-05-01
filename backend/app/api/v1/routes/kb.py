"""
KB Article routes — HIL-5 draft review and publication workflow.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.kb_article import KBArticle, KBArticleStatus
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/kb", tags=["Knowledge Base"])


@router.get("/drafts")
async def list_kb_drafts(db: AsyncSession = Depends(get_db)):
    """List all KB articles pending HIL-5 review."""
    result = await db.execute(
        select(KBArticle)
        .where(KBArticle.status == KBArticleStatus.DRAFT)
        .order_by(KBArticle.created_at.desc())
    )
    drafts = result.scalars().all()
    return {
        "status": "success",
        "data": [
            {
                "id": d.id,
                "title": d.title,
                "content": d.content,
                "source_ticket_ref": d.source_ticket_ref,
                "status": d.status.value,
                "created_at": d.created_at.isoformat(),
            }
            for d in drafts
        ],
    }


@router.get("/articles")
async def list_published_articles(db: AsyncSession = Depends(get_db)):
    """List all published KB articles."""
    result = await db.execute(
        select(KBArticle)
        .where(KBArticle.status == KBArticleStatus.PUBLISHED)
        .order_by(KBArticle.published_at.desc())
    )
    articles = result.scalars().all()
    return {
        "status": "success",
        "data": [
            {
                "id": a.id,
                "title": a.title,
                "content": a.content,
                "source_ticket_ref": a.source_ticket_ref,
                "published_at": a.published_at.isoformat() if a.published_at else None,
            }
            for a in articles
        ],
    }


@router.post("/drafts/{article_id}/publish")
async def publish_kb_article(article_id: int, db: AsyncSession = Depends(get_db)):
    """HIL-5: Publish a KB article draft. Upserts it into Qdrant for RAG."""
    result = await db.execute(select(KBArticle).where(KBArticle.id == article_id))
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(status_code=404, detail="KB article not found")
    if article.status == KBArticleStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Article already published")

    try:
        from app.core.qdrant import store_kb_document
        await store_kb_document(
            filename=f"kb_article_{article.id}",
            text=f"{article.title}\n\n{article.content}",
            doc_type="kb_article",
        )
        logger.info(f"KB article {article_id} indexed in Qdrant")
    except Exception as e:
        logger.warning(f"Qdrant indexing skipped for KB article {article_id}: {e}")

    article.status = KBArticleStatus.PUBLISHED
    article.published_at = datetime.now(timezone.utc)
    db.add(article)
    await db.commit()
    await db.refresh(article)

    logger.info(f"KB article '{article.title}' published")
    return {"status": "success", "message": f"Article '{article.title}' published successfully."}


@router.post("/drafts/{article_id}/reject")
async def reject_kb_article(article_id: int, db: AsyncSession = Depends(get_db)):
    """HIL-5: Reject a KB article draft."""
    result = await db.execute(select(KBArticle).where(KBArticle.id == article_id))
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(status_code=404, detail="KB article not found")

    article.status = KBArticleStatus.REJECTED
    db.add(article)
    await db.commit()

    logger.info(f"KB article '{article.title}' rejected")
    return {"status": "success", "message": "Article rejected."}
