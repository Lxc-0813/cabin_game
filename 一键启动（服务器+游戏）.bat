@echo off
chcp 65001 >nul
echo ========================================
echo    剑魄 - 一键启动（服务器+游戏）
echo ========================================
echo.
echo 这个脚本会同时启动：
echo 1. 联机服务器（端口 3001）
echo 2. 游戏客户端（端口 5173）
echo.
echo 适用于：想要自己既当服务器又玩游戏
echo.
echo ========================================
echo.

echo 正在检查 Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未检测到 Node.js！
    pause
    exit /b 1
)

echo [成功] Node.js 已安装
echo.

if not exist "node_modules\" (
    echo [提示] 正在安装依赖...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [错误] 依赖安装失败！
        pause
        exit /b 1
    )
)

echo [成功] 环境检查完成
echo.
echo ========================================
echo 正在启动...
echo ========================================
echo.
echo 服务器和游戏启动后：
echo 1. 浏览器访问 http://localhost:5173
echo 2. 点击"局域网对战"
echo 3. 服务器地址填写：http://localhost:3001
echo.
echo 按 Ctrl+C 停止所有服务
echo ========================================
echo.

npm run dev:all
