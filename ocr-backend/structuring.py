"""
Transforme le texte brut extrait (peu importe sa source) en JSON structure
exploitable par ElmasRecruit : identite, contact, experiences, formations,
competences, langues.

Supporte deux backends LLM :
  - Claude (Anthropic) si ANTHROPIC_API_KEY est definie
  - DeepSeek si DEEPSEEK_API_KEY est definie (fallback)
  - Mode "raw" (pas de structuration LLM) si aucune cle n'est dispo
"""

import json
import os
import httpx


def _has_anthropic() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _has_deepseek() -> bool:
    return bool(os.environ.get("DEEPSEEK_API_KEY"))


EXTRACTION_PROMPT = """Tu recois le texte brut d'un CV, extrait par OCR ou parsing direct.
Le texte peut contenir des erreurs d'OCR, des sauts de ligne mal places, ou du bruit.

Extrait les informations suivantes et reponds UNIQUEMENT avec un objet JSON valide,
sans aucun texte avant ou apres, sans balises markdown. Si une information est
absente ou non identifiable, mets null (ou [] pour les listes).

Schema attendu :
{
  "nom_complet": string | null,
  "email": string | null,
  "telephone": string | null,
  "ville": string | null,
  "titre_poste_actuel": string | null,
  "annees_experience_totale": number | null,
  "experiences": [
    {
      "poste": string,
      "entreprise": string,
      "date_debut": string | null,
      "date_fin": string | null,
      "description": string | null
    }
  ],
  "formations": [
    {
      "diplome": string,
      "etablissement": string,
      "annee": string | null
    }
  ],
  "competences": [string],
  "langues": [{"langue": string, "niveau": string | null}],
  "confiance_extraction": "haute" | "moyenne" | "faible"
}

Mets "confiance_extraction" a "faible" si le texte semble tres corrompu (OCR
de mauvaise qualite) et que tu as du deviner beaucoup d'informations.

Texte du CV :
---
{cv_text}
---"""


def _structure_with_anthropic(raw_text: str) -> dict:
    """Appelle l'API Anthropic (Claude) pour structurer le texte brut en JSON."""
    api_key = os.environ["ANTHROPIC_API_KEY"]
    model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")

    prompt = EXTRACTION_PROMPT.replace("{cv_text}", raw_text[:15000])

    response = httpx.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": model,
            "max_tokens": 2000,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=60.0,
    )
    response.raise_for_status()
    data = response.json()

    raw_output = data["content"][0]["text"].strip()
    raw_output = raw_output.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        return json.loads(raw_output)
    except json.JSONDecodeError:
        return {
            "confiance_extraction": "faible",
            "erreur": "Echec du parsing JSON de la reponse Anthropic.",
            "raw_llm_output": raw_output[:500],
        }


def _structure_with_deepseek(raw_text: str) -> dict:
    """Appelle l'API DeepSeek pour structurer le texte brut en JSON."""
    api_key = os.environ["DEEPSEEK_API_KEY"]
    base_url = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    model = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

    prompt = EXTRACTION_PROMPT.replace("{cv_text}", raw_text[:15000])

    response = httpx.post(
        f"{base_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "max_tokens": 2000,
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
        },
        timeout=60.0,
    )
    response.raise_for_status()
    data = response.json()

    raw_output = data["choices"][0]["message"]["content"].strip()
    raw_output = raw_output.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        return json.loads(raw_output)
    except json.JSONDecodeError:
        return {
            "confiance_extraction": "faible",
            "erreur": "Echec du parsing JSON de la reponse DeepSeek.",
            "raw_llm_output": raw_output[:500],
        }


def structure_cv_text(raw_text: str) -> dict:
    """Appelle le LLM approprie pour structurer le texte brut en JSON.
    Priorite : Anthropic > DeepSeek > mode raw (pas de structuration)."""

    if not raw_text or len(raw_text.strip()) < 30:
        return {
            "nom_complet": None,
            "email": None,
            "telephone": None,
            "ville": None,
            "titre_poste_actuel": None,
            "annees_experience_totale": None,
            "experiences": [],
            "formations": [],
            "competences": [],
            "langues": [],
            "confiance_extraction": "faible",
            "erreur": "Texte extrait trop court ou vide — verifier la qualite du fichier source.",
        }

    if _has_anthropic():
        try:
            return _structure_with_anthropic(raw_text)
        except Exception as e:
            # Fallback DeepSeek
            if _has_deepseek():
                try:
                    return _structure_with_deepseek(raw_text)
                except Exception:
                    pass
            return {"confiance_extraction": "faible", "erreur": f"Erreur Anthropic: {str(e)[:200]}"}

    if _has_deepseek():
        try:
            return _structure_with_deepseek(raw_text)
        except Exception as e:
            return {"confiance_extraction": "faible", "erreur": f"Erreur DeepSeek: {str(e)[:200]}"}

    # Ni Anthropic ni DeepSeek : on retourne le texte brut + metadonnees minimales
    return {
        "nom_complet": None,
        "email": None,
        "telephone": None,
        "ville": None,
        "titre_poste_actuel": None,
        "annees_experience_totale": None,
        "experiences": [],
        "formations": [],
        "competences": [],
        "langues": [],
        "confiance_extraction": "moyenne",
        "texte_brut": raw_text[:5000],
        "note": "Aucun LLM configure (ANTHROPIC_API_KEY ou DEEPSEEK_API_KEY requis pour la structuration).",
    }
