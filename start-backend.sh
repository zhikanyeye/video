#!/bin/bash

# 青云播后端服务启动脚本

echo "🚀 青云播 - 启动后端服务"
echo "=========================="

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未安装Node.js"
    echo "请先安装Node.js: https://nodejs.org/"
    exit 1
fi

# 进入后端目录
cd "$(dirname "$0")/backend"

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖包..."
    npm install
    
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
    
    echo "✅ 依赖安装完成"
fi

# 启动服务器
echo "🎯 启动后端服务..."
echo "服务地址: http://localhost:8090"
echo "按 Ctrl+C 停止服务"
echo "=========================="

npm start
