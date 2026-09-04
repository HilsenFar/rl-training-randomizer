@echo off
rem RL Training Randomizer - add thousands of packs from Prejump.
rem Writes collections\prejump.json. Pass options through, e.g. scrape.cmd --sort newest
setlocal
cd /d "%~dp0"
set "NODE=%~dp0node\node.exe"
if not exist "%NODE%" set "NODE=node"
echo Scraping Prejump's public training-pack database...
"%NODE%" "%~dp0bin\scrape.mjs" %*
echo.
pause
endlocal
