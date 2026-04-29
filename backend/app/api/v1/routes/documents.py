import fitz  # PyMuPDF
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from typing import Literal

from app.api.deps import require_manager_or_admin
from app.core.logging import get_logger
from app.core.qdrant import store_kb_document
from app.models.user import User

logger = get_logger(__name__)
router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    doc_type: Literal["kb", "sla"] = "kb",
    current_user: User = Depends(require_manager_or_admin)
):
    """
    Upload a KB or SLA document. Supports PDF and TXT.
    Extracts text and embeds it into Qdrant.
    """
    if not file.filename.endswith(('.pdf', '.txt')):
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported.")
        
    content = await file.read()
    text = ""
    
    try:
        if file.filename.endswith('.pdf'):
            # Extract text using PyMuPDF
            doc = fitz.open(stream=content, filetype="pdf")
            for page in doc:
                text += page.get_text()
            doc.close()
        elif file.filename.endswith('.txt'):
            text = content.decode('utf-8')
    except Exception as e:
        logger.error(f"Failed to process document {file.filename}: {e}")
        raise HTTPException(status_code=500, detail="Failed to process document content.")
        
    if not text.strip():
        raise HTTPException(status_code=400, detail="Document appears to be empty or text could not be extracted.")
        
    try:
        # Embed and store in Qdrant
        await store_kb_document(filename=file.filename, text=text, doc_type=doc_type)
        return {
            "status": "success",
            "message": f"Successfully processed {file.filename} as {doc_type}.",
            "extracted_length": len(text)
        }
    except Exception as e:
        logger.error(f"Failed to embed document {file.filename}: {e}")
        raise HTTPException(status_code=500, detail="Failed to embed document into Qdrant.")
