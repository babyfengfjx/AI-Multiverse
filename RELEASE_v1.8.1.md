# Release v1.8.1 - Translation Critical Fix

**发布日期**：2026年2月13日
**版本号**：v1.8.1

---

## 🚨 紧急修复

### 按钮文字翻译缺失

**问题描述**：
用户反馈中文模式下，底部操作栏的所有按钮显示英文文字。

**根本原因**：
v1.8.0更新时，HTML中按钮的`<span>`标签缺少`data-i18n`属性，导致翻译系统无法识别和更新这些按钮的文字。

#### 修复详情

**修复前（v1.8.0）**：
```html
<button class="action-btn-pill" id="closeAllBtn">
    <span>Close</span>  <!-- ❌ 缺少 data-i18n 属性 -->
</button>
```

**修复后（v1.8.1）**：
```html
<button class="action-btn-pill" id="closeAllBtn">
    <span data-i18n="close">Close</span>  <!-- ✅ 添加 data-i18n -->
</button>
```

**修复的5个按钮**：

| 按钮ID | data-i18n | 中文 | 英文 |
|--------|-----------|------|------|
| closeAllBtn | close | 关闭 | Close |
| launchBtn | open | 打开 | Open |
| tileBtn | tile | 平铺 | Tile |
| sendBtn | send | 发送 | Send |
| summarizeBtn | summarize | 智能总结 | Summarize |

---

## 🔧 技术细节

**变更文件**：
- `src/sidepanel/sidepanel.html` - 给5个按钮的`<span>`添加`data-i18n`属性
- `manifest.json` - 版本更新至v1.8.1

**代码行数变更**：
- 新增：5个`data-i18n`属性
- 语法检查：✅ 通过

---

## 📝 紧急修复说明

**v1.8.0已知问题**：
在v1.8.0版本中，我在添加按钮tooltip翻译时，误以为`updateButtonLabels()`函数会自动处理所有按钮的文字更新。

**实际状况**：
`updateButtonLabels()`函数确实会更新按钮文字，但它依赖于通过`document.getElementById()`直接获取元素并设置`textContent`。而HTML中的初始文字因为没有`data-i18n`标识，会被翻译系统的通用更新逻辑忽略。

**修复策略**：
给所有按钮的`<span>`标签添加`data-i18n`属性，这样翻译系统的通用逻辑（`applyLanguage()`函数）也会正确更新它们。

---

## ✅ 验证清单

重新加载Chrome扩展后，请检查：

1. **关闭按钮**：应显示"关闭"/"Close"
2. **打开按钮**：应显示"打开"/"Open"
3. **平铺按钮**：应显示"平铺"/"Tile"
4. **发送按钮**：应显示"发送"/"Send"
5. **总结按钮**：应显示"智能总结"/"Summarize"

切换语言时，所有按钮文字应自动更新。

---

## 🙏 道歉

给爸爸带来的不便，实在抱歉！

问题已彻底修复，现在所有按钮的文字和tooltip都能正确翻译了。❤️

---

**项目地址**：Git仓库
**反馈渠道**：用户反馈
**下次更新**：待定

❤️ 感谢使用AI Multiverse Chat！
