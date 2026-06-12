@echo off
rem Publie le site : commit + push = deploiement automatique en production.
rem Double-cliquer sur ce fichier, taper un message (ou Entree), c'est tout.
cd /d "%~dp0"

echo.
git status --short
echo.

set /p MSG=Message du commit (Entree = "Mise a jour du site") :
if "%MSG%"=="" set MSG=Mise a jour du site

git add -A
git commit -m "%MSG%"
if errorlevel 1 (
    echo.
    echo Rien a publier ou erreur de commit.
    pause
    exit /b 1
)

git push origin main
if errorlevel 1 (
    echo.
    echo ECHEC du push — verifiez votre connexion ou vos droits.
) else (
    echo.
    echo Pousse ! Le deploiement en production demarre automatiquement (GitHub Actions).
)
pause
