@echo off
echo ============================================
echo  ElmasRecruit — OCR Backend (PaddleOCR FREE)
echo ============================================
echo.
echo Installation des dependances Python...
cd /d "%~dp0ocr-backend"
pip install -r requirements.txt
echo.
echo Lancement du serveur OCR sur http://localhost:8000
echo Le modele PaddleOCR sera telecharge au premier lancement (~100 Mo)
echo.
uvicorn main:app --reload --port 8000
pause
