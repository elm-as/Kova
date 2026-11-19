"""
API ElmasRecruit — traitement de CV peu importe le format.

POST /cv/process
  - recoit un fichier (PDF, DOCX, image, TXT)
  - detecte le format et choisit la bonne route d'extraction
  - bascule en OCR automatiquement si le PDF est scanne
  - structure le resultat en JSON via LLM
  - retourne le JSON (et le stocke dans Supabase si configure)

Lancer en local :
  uvicorn main:app --reload --port 8000

Lancer en production (plusieurs workers) :
  uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
"""

import os
import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from extractors import (
    detect_format,
    extract_text_from_pdf,
    extract_text_from_docx,
    extract_text_from_txt,
    SUPPORTED_EXTENSIONS,
)
from ocr_engine import ocr_image_file, ocr_scanned_pdf
from structuring import structure_cv_text

app = FastAPI(title="ElmasRecruit OCR API", version="2.0")

# CORS — autorise le frontend React (localhost:5000) a appeler l'API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:5173", "http://127.0.0.1:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")


def _extract_raw_text(file_path: str, fmt: str) -> tuple[str, str]:
    """
    Retourne (texte_brut, methode_utilisee).
    Bascule automatiquement vers l'OCR si l'extraction native echoue
    ou si le contenu detecte est insuffisant (PDF scanne).
    """
    if fmt == "pdf":
        text, has_native_text = extract_text_from_pdf(file_path)
        if has_native_text:
            return text, "extraction_native_pdf"
        return ocr_scanned_pdf(file_path), "ocr_pdf_scanne"

    if fmt == "docx":
        text = extract_text_from_docx(file_path)
        return text, "extraction_native_docx"

    if fmt == "image":
        return ocr_image_file(file_path), "ocr_image"

    if fmt == "txt":
        return extract_text_from_txt(file_path), "lecture_directe_txt"

    raise ValueError(f"Format non gere : {fmt}")


def _store_in_supabase(candidate_data: dict, raw_text: str, filename: str) -> str | None:
    """Stocke le resultat dans Supabase. Retourne l'ID cree, ou None si non configure."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None

    import httpx

    record = {
        "id": str(uuid.uuid4()),
        "filename": filename,
        "raw_text": raw_text,
        "structured_data": candidate_data,
    }
    response = httpx.post(
        f"{SUPABASE_URL}/rest/v1/cv_candidates",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        json=record,
        timeout=15.0,
    )
    response.raise_for_status()
    return record["id"]


@app.post("/cv/process")
async def process_cv(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Format non supporte : {ext}. Formats acceptes : {sorted(SUPPORTED_EXTENSIONS)}",
        )

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        fmt = detect_format(tmp_path)
        raw_text, method = _extract_raw_text(tmp_path, fmt)

        if not raw_text.strip():
            raise HTTPException(
                status_code=422,
                detail="Aucun texte n'a pu etre extrait du fichier. Fichier corrompu ou illisible.",
            )

        structured = structure_cv_text(raw_text)
        record_id = _store_in_supabase(structured, raw_text, file.filename)

        return JSONResponse(
            {
                "candidate_id": record_id,
                "filename": file.filename,
                "extraction_method": method,
                "text_length": len(raw_text),
                "data": structured,
            }
        )
    finally:
        Path(tmp_path).unlink(missing_ok=True)


@app.get("/health")
async def health():
    return {"status": "ok", "ocr_engine": "PaddleOCR"}
