# ElmasRecruit OCR Backend — PaddleOCR (FREE, offline, zero API key)

API Python de traitement de CV tous formats (PDF natif, PDF scanne, DOCX, image, TXT).
Utilise **PaddleOCR** (open-source, gratuit, zero cle API, tourne en CPU).

## Installation unique

```powershell
# Windows — lancer le .bat
.\start-ocr-backend.bat

# Ou manuellement :
cd ocr-backend
pip install -r requirements.txt
```

> **PaddleOCR** telecharge son modele au premier lancement (~100 Mo). Patiente 30s-1min. Apres ca, c'est instantane.

## Lancement

```powershell
cd ocr-backend
uvicorn main:app --reload --port 8000
```

Le serveur est accessible sur `http://localhost:8000`.

Verification : `http://localhost:8000/health` → `{"status": "ok", "ocr_engine": "PaddleOCR"}`

## Variables d'environnement (optionnelles)

```powershell
# Structuration LLM (optionnel — priorite Anthropic > DeepSeek)
$env:ANTHROPIC_API_KEY="sk-ant-..."       # Claude (meilleur)
$env:DEEPSEEK_API_KEY="sk-..."            # DeepSeek (fallback, plus rapide)

# Stockage Supabase (optionnel)
$env:SUPABASE_URL="https://xxxx.supabase.co"
$env:SUPABASE_SERVICE_KEY="..."
```

Si **aucune cle LLM** n'est definie, l'API retourne le texte brut + metadonnees. Le frontend React prendra le relais avec son propre LLM pour l'analyse.

## Logique de routage

| Format detecte | Methode | Besoin cle API |
|---|---|---|
| PDF natif | `pdfplumber` | ❌ |
| PDF scanne | conversion images + PaddleOCR | ❌ |
| DOCX | `python-docx` | ❌ |
| Image (jpg/png/webp) | PaddleOCR direct | ❌ |
| TXT | lecture directe | ❌ |
| Structuration en JSON | Claude ou DeepSeek | optionnel |

## Usage

```powershell
curl -X POST http://localhost:8000/cv/process -F "file=@cv_candidat.pdf"
```

Reponse :
```json
{
  "candidate_id": "...",
  "filename": "cv_candidat.pdf",
  "extraction_method": "extraction_native_pdf",
  "text_length": 3421,
  "data": {
    "nom_complet": "Jean Dupont",
    "email": "jean.dupont@email.com",
    "competences": ["Python", "React", ...],
    ...
  }
}
```

## Architecture cote frontend

```
[React App :5000]
     │
     ├─ upload PDF/DOCX/Image
     │
     ├─ 1. pdf.js (client-side, rapide)
     │     └─ echec (scan/image) →
     │
     ├─ 2. OCR Python Backend :8000  ← NOUVEAU
     │     └─ PaddleOCR (gratuit, CPU, zero cle)
     │
     └─ 3. OCR.space API (fallback si backend down)
```
