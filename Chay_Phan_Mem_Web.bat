@echo off
chcp 65001 >nul
title PHẦN MỀM GHÉP GIÁO ÁN 35 TUẦN TIỂU HỌC
cd /d "%~dp0"

echo =========================================================================
echo    PHẦN MỀM GHÉP GIÁO ÁN / KẾ HOẠCH BÀI DẠY 35 TUẦN (TIỂU HỌC)
echo    Ghép các môn: Tiếng Việt, Toán, Khoa học, LS^&ĐL, Đạo đức, Công nghệ...
echo =========================================================================
echo.
echo [*] Đang khởi động máy chủ Web cục bộ (Offline Local Server)...

:: Kiểm tra xem máy đã cài Node.js chưa
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [!] Máy tính của Thầy/Cô chưa cài đặt môi trường Node.js.
    echo [*] Đang tự động mở Bản HTML5 độc lập (Không cần cài đặt, chạy mọi máy)...
    echo.
    start "" "Ghep_Giao_An_HTML5.html"
    timeout /t 3 >nul
    exit /b
)

:: Mở trình duyệt sau 1.5 giây
start "" powershell -Command "Start-Sleep -Milliseconds 1500; Start-Process 'http://localhost:8080'"

:: Chạy server Node.js
node server.js

pause