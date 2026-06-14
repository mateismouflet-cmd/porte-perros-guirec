@echo off
title Marees Perros-Guirec
cd /d "%~dp0app"

echo Demarrage de l'application Marees Perros-Guirec...
echo (laisser cette fenetre ouverte, la fermer arrete l'application)
echo.

rem Ouvre le navigateur apres 4 secondes, le temps que le serveur demarre
start "" /b cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000"

npm run dev
