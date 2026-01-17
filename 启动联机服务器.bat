@echo off
chcp 65001 >nul
echo ========================================
echo   剑魄 - 局域网联机服务器启动器
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
echo 正在获取本机 IP 地址...
echo ========================================
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    set IP=%%a
    set IP=!IP:~1!
    echo 你的局域网 IP 地址：!IP!
)

echo.
echo ========================================
echo 正在启动联机服务器...
echo ========================================
echo.
echo 服务器启动后，告诉朋友连接到：
echo.
echo     http://你的IP地址:3001
echo.
echo 然后再运行"启动游戏.bat"来启动客户端
echo.
echo 按 Ctrl+C 可以停止服务器
echo ========================================
echo.

npm run server
