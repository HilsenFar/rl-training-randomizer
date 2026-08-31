@echo off
rem RL Training Randomizer — roll a pack in a console window.
rem Pass any options through, e.g.:  roll.cmd --n 3 --category aerials
setlocal
cd /d "%~dp0"
set "NODE=%~dp0node\node.exe"
if not exist "%NODE%" set "NODE=node"
"%NODE%" "%~dp0bin\randomize.mjs" %*
echo.
pause
endlocal
