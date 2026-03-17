@echo off
setlocal
cd /d "%~dp0"

echo [1/3] 啟動 TWSE Proxy...
start "Virtual Stock Game Proxy" /min cmd /c "cd /d "%~dp0" && npm run start:proxy"

timeout /t 2 /nobreak >nul

echo [2/3] 啟動前端伺服器...
start "Virtual Stock Game Frontend" /min cmd /c "cd /d "%~dp0" && npm run start:frontend"

timeout /t 3 /nobreak >nul

echo [3/3] 開啟遊戲頁面...
start "" "http://localhost:4173/?provider=auto"

echo.
echo 遊戲啟動中，瀏覽器應該會自動開啟。
echo 若要關閉，請把兩個命令視窗一起關掉。
echo.
pause
