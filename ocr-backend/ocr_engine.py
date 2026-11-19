"""
Moteur OCR pour les CV scannes ou fournis en image.
Utilise PaddleOCR (gratuit, open-source, zero cle API requise).

Pour des CV avec mise en page tres complexe (colonnes multiples, design
graphique charge), DeepSeek-OCR-2 donne de meilleurs resultats mais demande
un GPU avec ~16GB VRAM. Cette implementation utilise PaddleOCR par defaut
car il tourne bien en CPU et suffit pour 95% des CV.
"""

from pathlib import Path
from pdf2image import convert_from_path
from paddleocr import PaddleOCR

_ocr_engine: PaddleOCR | None = None


def _get_engine() -> PaddleOCR:
    """Charge le modele une seule fois (singleton) — couteux a instancier."""
    global _ocr_engine
    if _ocr_engine is None:
        _ocr_engine = PaddleOCR(use_angle_cls=True, lang="fr")
    return _ocr_engine


def _ocr_image(image_path_or_array) -> str:
    engine = _get_engine()
    result = engine.ocr(image_path_or_array, cls=True)

    lines = []
    for page_result in result:
        if not page_result:
            continue
        for line in page_result:
            # line = [box_coords, (texte, score)]
            text = line[1][0]
            lines.append(text)

    return "\n".join(lines)


def ocr_image_file(file_path: str) -> str:
    """OCR direct sur un fichier image (jpg, png, webp)."""
    return _ocr_image(file_path)


def ocr_scanned_pdf(file_path: str, dpi: int = 300) -> str:
    """
    Convertit chaque page d'un PDF scanne en image, puis OCR chaque page.
    Necessite poppler installe sur le systeme (apt install poppler-utils).
    """
    pages = convert_from_path(file_path, dpi=dpi)

    full_text = []
    for i, page_image in enumerate(pages):
        tmp_path = f"/tmp/cv_ocr_page_{i}.png"
        page_image.save(tmp_path, "PNG")
        page_text = _ocr_image(tmp_path)
        full_text.append(page_text)
        Path(tmp_path).unlink(missing_ok=True)

    return "\n\n".join(full_text)
