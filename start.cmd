@echo off
rem RL Training Randomizer — open the web UI in your browser.
setlocal
cd /d "%~dp0"
set "NODE=%~dp0node\node.exe"
if not exist "%NODE%" set "NODE=node"
start "" "http://127.0.0.1:8343"
"%NODE%" "%~dp0bin\serve.mjs"
endlocal
