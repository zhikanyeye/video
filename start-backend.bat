@echo off
chcp 65001 >nul

echo 🚀 青云播 - 启动后端服务
echo ==========================

REM 检查Node.js是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未安装Node.js
    echo 请先安装Node.js: https://nodejs.org/
    pause
    exit /b 1
)

REM 进入后端目录
cd /d "%~dp0backend"

REM 检查是否已安装依赖
if not exist "node_modules" (
    echo 📦 安装依赖包...
    call npm install
    
    if %errorlevel% neq 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
    
    echo ✅ 依赖安装完成
)

REM 启动服务器
echo 🎯 启动后端服务...
echo 服务地址: http://localhost:8090
echo 按 Ctrl+C 停止服务
echo ==========================

call npm start

pause
