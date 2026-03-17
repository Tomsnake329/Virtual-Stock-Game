@echo off
setlocal
cd /d "%~dp0"

echo [0/4] 先關閉舊的遊戲伺服器...
for %%P in (4173 8787) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr :%%P ^| findstr LISTENING') do (
    taskkill /PID %%A /F >nul 2>nul
  )
)

timeout /t 1 /nobreak >nul

echo [1/4] 啟動 TWSE Proxy...
start "Virtual Stock Game Proxy" /min cmd /c "cd /d "%~dp0" && npm run start:proxy"

timeout /t 2 /nobreak >nul

echo [2/4] 啟動前端伺服器...
start "Virtual Stock Game Frontend" /min cmd /c "cd /d "%~dp0" && npm run start:frontend"

timeout /t 3 /nobreak >nul

set TS=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TS=%TS: =0%

echo [3/4] 開啟最新頁面...
start "" "http://localhost:4173/?provider=auto&v=%TS%"

echo.
echo 遊戲啟動中，瀏覽器應該會自動開啟最新版本。
echo 若畫面仍像舊版，請在頁面按 Ctrl + F5 強制重新整理。
echo 若要關閉，可直接執行「關閉遊戲伺服器.bat」。
echo.
pause
