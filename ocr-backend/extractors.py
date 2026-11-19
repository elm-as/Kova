"""
Detection de format + extraction native de texte (sans OCR).
Utilise quand le fichier contient deja du texte selectionnable
(PDF natif, DOCX, TXT). Pour les scans/images, voir ocr_engine.py.
"""

from pathlib import Path
import pdfplumber
import docx


SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg", ".webp", ".txt"}


def detect_format(file_path: str) -> str:
    """Retourne 'pdf', 'docx', 'image' ou 'txt' selon l'extension."""
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf":
        return "pdf"
    if ext in (".docx", ".doc"):
        return "docx"
    if ext in (".png", ".jpg", ".jpeg", ".webp"):
        return "image"
    if ext == ".txt":
        return "txt"
    raise ValueError(f"Format non supporte : {ext}")


def extract_text_from_pdf(file_path: str) -> tuple[str, bool]:
    """
    Extrait le texte natif d'un PDF.
    Retourne (texte, has_native_text). Si has_native_text=False,
    le PDF est probablement scanne -> il faut passer par l'OCR.
    """
    text_parts = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            text_parts.append(page_text)

    full_text = "\n".join(text_parts).strip()
    # Heuristique : moins de 20 caracteres extraits par page = PDF scanne
    has_native_text = len(full_text) > 20 * len(text_parts) if text_parts else False
    return full_text, has_native_text


def extract_text_from_docx(file_path: str) -> str:
    """Extrait le texte d'un fichier Word (paragraphes + tableaux)."""
    document = docx.Document(file_path)
    parts = [p.text for p in document.paragraphs if p.text.strip()]

    for table in document.tables:
        for row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells)
            if row_text.strip(" |"):
                parts.append(row_text)

    return "\n".join(parts).strip()


def extract_text_from_txt(file_path: str) -> str:
    return Path(file_path).read_text(encoding="utf-8", errors="ignore").strip()
