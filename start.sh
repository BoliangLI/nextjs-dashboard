#!/bin/bash

# Next.js Dashboard 启动脚本
# 使用 pnpm 进行依赖安装、构建和启动

set -e  # 遇到错误时退出

echo "======================================"
echo "Next.js Dashboard 启动脚本"
echo "======================================"
echo ""

# 检查并显示 Node.js 版本
if ! command -v node &> /dev/null; then
    echo "❌ 错误: Node.js 未安装"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"
echo ""

# 检查 pnpm 是否安装
if ! command -v pnpm &> /dev/null; then
    echo "⚠️  未检测到 pnpm"
    echo "正在使用 npm 安装 pnpm..."
    echo ""
    
    # 检查 npm 是否可用
    if ! command -v npm &> /dev/null; then
        echo "❌ 错误: npm 也未安装，无法自动安装 pnpm"
        echo "请先安装 Node.js: https://nodejs.org/"
        exit 1
    fi
    
    # 使用 npm 全局安装 pnpm
    npm install -g pnpm
    
    echo ""
    echo "✅ pnpm 安装完成"
    echo ""
fi

echo "✅ 检测到 pnpm 版本: $(pnpm -v)"
echo ""

# 1. 安装依赖
echo "📦 步骤 1/3: 安装依赖..."
echo "======================================"
pnpm install
echo ""
echo "✅ 依赖安装完成"
echo ""

# 2. 构建项目
echo "🔨 步骤 2/3: 构建生产版本..."
echo "======================================"
pnpm build
echo ""
echo "✅ 构建完成"
echo ""

# 3. 启动生产服务器
echo "🚀 步骤 3/3: 启动生产服务器..."
echo "======================================"
echo "服务器将在 http://localhost:3000 启动"
echo "按 Ctrl+C 停止服务器"
echo ""
pnpm start

