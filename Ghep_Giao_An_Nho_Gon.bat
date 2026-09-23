@echo off
chcp 65001 >nul
title PHẦN MỀM GHÉP GIÁO ÁN 35 TUẦN (BẢN NHẸ GỌN)
cd /d "%~dp0"

echo =========================================================================
echo    PHẦN MỀM GHÉP GIÁO ÁN / KẾ HOẠCH BÀI DẠY 35 TUẦN (TIỂU HỌC)
echo    Bản chạy nhanh gọn - Hỗ trợ kéo thả thư mục hoặc chọn thư mục
echo =========================================================================
echo.

set "TARGET_DIR=%~1"

if not "%TARGET_DIR%"=="" goto RUN_MERGE

echo [*] Đang mở hộp thoại để bạn chọn thư mục chứa giáo án...
for /f "usebackq delims=" %%I in (`powershell.exe -ExecutionPolicy Bypass -File "%~dp0browse-folder.ps1"`) do set "TARGET_DIR=%%I"

if "%TARGET_DIR%"=="" (
    echo.
    echo [!] Bạn chưa chọn thư mục nào.
    echo     Mẹo: Bạn có thể KÉO THẢ thư mục giáo án thả trực tiếp vào biểu tượng file này!
    echo.
    echo Nhấn phím bất kỳ để thoát...
    pause >nul
    exit /b
)

:RUN_MERGE
echo.
echo [*] Đang thực hiện ghép giáo án tại thư mục:
echo     "%TARGET_DIR%"
echo.

node "%~dp0cli_merge.js" "%TARGET_DIR%"

echo.
echo Nhấn phím bất kỳ để đóng cửa sổ này...
pause >nul