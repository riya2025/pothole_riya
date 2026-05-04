@echo off
echo ============================================================
echo  CivicWatch – Backend Startup
echo ============================================================



echo [1/2] Installing dependencies...
pip install -r requirements.txt

echo [2/2] Starting FastAPI server on http://localhost:8000
echo  Swagger UI available at: http://localhost:8000/docs
echo.
cd backend
uvicorn app.main:app --reload --port 8000
