#!/bin/bash

echo "=== 验证最终修改 ==="
echo ""

echo "1. 检查HTML中是否移除了浮动按钮..."
if grep -q "floating-actions" src/sidepanel/sidepanel.html; then
    echo "   ❌ HTML 仍包含浮动按钮"
else
    echo "   ✅ HTML 已移除浮动按钮"
fi

echo ""
echo "2. 检查HTML中是否添加了输入框按钮..."
if grep -q "summarizeBtn" src/sidepanel/sidepanel.html; then
    echo "   ✅ HTML 包含智能总结按钮"
else
    echo "   ❌ HTML 缺少智能总结按钮"
fi

if grep -q "copyAllBtn" src/sidepanel/sidepanel.html; then
    echo "   ✅ HTML 包含复制全部按钮"
else
    echo "   ❌ HTML 缺少复制全部按钮"
fi

echo ""
echo "3. 检查JS中是否移除了卡片点击事件..."
if grep -q 'onclick="window.showResponseDetail' src/sidepanel/sidepanel.js; then
    echo "   ❌ JS 仍包含卡片点击事件"
else
    echo "   ✅ JS 已移除卡片点击事件"
fi

echo ""
echo "4. 检查JS中是否更新了按钮引用..."
if grep -q "summarizeBtn = document.getElementById" src/sidepanel/sidepanel.js; then
    echo "   ✅ JS 包含新的按钮引用"
else
    echo "   ❌ JS 缺少新的按钮引用"
fi

echo ""
echo "5. 检查CSS中是否移除了浮动按钮样式..."
if grep -q ".floating-btn" src/sidepanel/sidepanel.css; then
    echo "   ⚠️  CSS 仍包含浮动按钮样式（可能是注释）"
else
    echo "   ✅ CSS 已移除浮动按钮样式"
fi

echo ""
echo "=== 验证完成 ==="
echo ""
echo "请重新加载扩展："
echo "1. 打开 chrome://extensions/"
echo "2. 点击刷新按钮 🔄"
echo "3. 关闭并重新打开扩展"
echo ""
