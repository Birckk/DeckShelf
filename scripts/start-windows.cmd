@echo off
setlocal
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22.12 or newer from https://nodejs.org and try again.
  pause
  exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number); if(a<22 || (a===22 && b<12)) process.exit(1)"
if errorlevel 1 (
  echo Please upgrade to Node.js 22.12 or newer from https://nodejs.org.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Setting up DeckShelf for the first time...
  call npm.cmd ci
  if errorlevel 1 goto failed
)
call npm.cmd run build
if errorlevel 1 goto failed
echo.
echo Open http://127.0.0.1:4317 in your browser.
echo Keep this window open while using the archive. Press Ctrl+C to stop.
echo.
call npm.cmd start
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo The archive could not start. Check the message above.
pause
exit /b 1
