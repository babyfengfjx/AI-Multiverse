#!/bin/bash

echo "=== 验证 v2.0 修改 ==="
echo ""

echo "1. 检查 HTML 中的浮动按钮..."
if grep -q "floating-actions" src/sidepanel/sidepanel.html; then
    echo "   ✅ HTML 包含浮动按钮"
else
    echo "   ❌ HTML 缺少浮动按钮"
fi

echo ""
echo "2. 检查 CSS 中的浮动按钮样式..."
if grep -q ".floating-btn" src/sidepanel/sidepanel.css; then
    echo "   ✅ CSS 包含浮动按钮样式"
else
    echo "   ❌ CSS 缺少浮动按钮样式"
fi

echo ""
echo "3. 检查 JS 中的 updateFloatingButtons 函数..."
if grep -q "updateFloatingButtons" src/sidepanel/sidepanel.js; then
    echo "   ✅ JS 包含 updateFloatingButtons 函数"
else
    echo "   ❌ JS 缺少 updateFloatingButtons 函数"
fi

echo ""
echo "4. 检查 JS 中的 isCurrentConversation 判断..."
if grep -q "isCurrentConversation" src/sidepanel/sidepanel.js; then
    echo "   ✅ JS 包含当前对话判断"
else
    echo "   ❌ JS 缺少当前对话判断"
fi

echo ""
echo "5. 检查响应卡片的 onclick 事件..."
if grep -q 'onclick="window.showResponseDetail' src/sidepanel/sidepanel.js; then
    echo "   ✅ 响应卡片有点击事件"
else
    echo "   ❌ 响应卡片缺少点击事件"
fi

echo ""
echo "6. 检查 CSS 中响应卡片是否移除了 max-height..."
if grep -A 5 ".response-card-body" src/sidepanel/sidepanel.css | grep -q "max-height"; then
    echo "   ⚠️  CSS 仍然包含 max-height（可能需要移除）"
else
    echo "   ✅ CSS 已移除 max-height 限制"
fi

echo ""
echo "=== 验证完成 ==="
echo ""
echo "如果所有项目都是 ✅，请按以下步骤操作："
echo "1. 打开 Chrome，访问 chrome://extensions/"
echo "2. 找到 AI Multiverse 扩展"
echo "3. 点击刷新/重新加载按钮 🔄"
echo "4. 关闭当前扩展窗口"
echo "5. 重新打开扩展"
echo ""
