@echo off
chcp 65001 >nul
echo ========================================
echo     剑魄 - 击剑对战游戏启动器
echo ========================================
echo.
echo 正在检查 Node.js...

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未检测到 Node.js！
    echo.
    echo 请先安装 Node.js：
    echo 1. 访问 https://nodejs.org/
    echo 2. 下载并安装 LTS 版本
    echo 3. 安装完成后重新运行此脚本
    echo.
    pause
    exit /b 1
)

echo [成功] Node.js 已安装
node --version
echo.

echo 正在检查依赖...
if not exist "node_modules\" (
    echo [提示] 首次运行，正在安装依赖...
    echo 这可能需要几分钟时间，请耐心等待...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [错误] 依赖安装失败！
        echo 请检查网络连接或手动运行: npm install
        pause
        exit /b 1
    )
    echo.
    echo [成功] 依赖安装完成
) else (
    echo [成功] 依赖已存在
)

echo.
echo ========================================
echo 正在启动游戏...
echo ========================================
echo.
echo 游戏启动后，浏览器会自动打开
echo 如果没有自动打开，请手动访问：
echo.
echo     http://localhost:5173
echo.
echo 按 Ctrl+C 可以停止游戏服务器
echo ========================================
echo.

npm run dev
