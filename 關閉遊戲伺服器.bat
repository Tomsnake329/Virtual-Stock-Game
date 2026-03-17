@echo off
setlocal
cd /d "%~dp0"

echo 正在關閉 4173 與 8787 相關程序...
for %%P in (4173 8787) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr :%%P ^| findstr LISTENING') do (
    taskkill /PID %%A /F >nul 2>nul
  )
)

echo 已嘗試關閉遊戲相關伺服器。
echo 若仍有殘留視窗，可手動關掉名為 Virtual Stock Game Proxy / Frontend 的 cmd 視窗。
pause
