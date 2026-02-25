#!/bin/bash

echo "=== 检查文件完整性 ==="
echo ""

echo "1. 检查HTML中的Header..."
if grep -q "sidebar-header" src/sidepanel/sidepanel.html; then
    echo "   ✅ HTML包含sidebar-header"
    
    # 检查header按钮
    buttons=("langToggleBtn" "themeToggleBtn" "summarizeSettingsBtn" "openModelsBtn" "clearHistoryBtn")
    for btn in "${buttons[@]}"; do
        if grep -q "id=\"$btn\"" src/sidepanel/sidepanel.html; then
            echo "   ✅ $btn 存在"
        else
            echo "   ❌ $btn 缺失"
        fi
    done
else
    echo "   ❌ HTML缺少sidebar-header"
fi

echo ""
echo "2. 检查CSS中的Header样式..."
if grep -q ".sidebar-header" src/sidepanel/sidepanel.css; then
    echo "   ✅ CSS包含sidebar-header样式"
else
    echo "   ❌ CSS缺少sidebar-header样式"
fi

echo ""
echo "3. 检查JS中的按钮引用..."
if grep -q "getElementById('openModelsBtn')" src/sidepanel/sidepanel.js; then
    echo "   ✅ JS包含按钮引用"
else
    echo "   ❌ JS缺少按钮引用"
fi

echo ""
echo "4. 检查JS中的事件监听..."
if grep -q "openModelsBtn.addEventListener" src/sidepanel/sidepanel.js; then
    echo "   ✅ JS包含事件监听"
else
    echo "   ❌ JS缺少事件监听"
fi

echo ""
echo "=== 检查完成 ==="
echo ""
echo "如果所有项目都是 ✅，但界面上看不到按钮，"
echo "说明Chrome使用了缓存的旧文件。"
echo ""
echo "解决方案："
echo "1. 修改 manifest.json 中的版本号"
echo "2. 或者完全卸载并重新安装扩展"
echo ""
