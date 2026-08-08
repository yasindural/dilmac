@echo off
cd /d "%~dp0"
echo Dilmaç son hata kayitlari getiriliyor...
npx wrangler d1 execute dilmac-logs --remote --command "SELECT created_at, level, area, code, message, page, user_agent FROM error_logs ORDER BY id DESC LIMIT 50;"
echo.
pause
