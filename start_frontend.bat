@echo off
echo ============================================================
echo  CivicWatch – Frontend Startup
echo ============================================================
echo [1/2] Installing npm packages...
cd frontend
npm install
echo [2/2] Starting React dev server on http://localhost:3000
npm start
