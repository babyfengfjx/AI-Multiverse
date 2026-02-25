# v1.7.5 清理无用按钮

## 概述

v1.7.5 清理了Reset和Browse按钮及其相关代码，因为用户发现这些按钮没有实际用处。

---

## 清理内容

### 1. HTML清理
**文件**: `src/sidepanel/sidepanel.html`

删除的按钮：
- `#resetLayoutBtn` - 重置布局按钮
- `#browseModeBtn` - 浏览模式按钮

保留了：
- `#launchBtn` - 打开AI窗口
- `#tileBtn` - 平铺窗口

### 2. JavaScript清理
**文件**: `src/sidepanel/sidepanel.js`

删除的内容：
```javascript
// 状态变量
let browseModeEnabled = false;

// DOM元素引用
const resetLayoutBtn = document.getElementById('resetLayoutBtn');
const browseModeBtn = document.getElementById('browseModeBtn');

// 事件监听器
resetLayoutBtn.addEventListener('click', () => { ... });
browseModeBtn.addEventListener('click', () => { ... });

// 初始化调用
loadBrowseMode();

// 完整函数
function loadBrowseMode() { ... }
function toggleBrowseMode() { ... }
function applyBrowseMode() { ... }

// 按钮标签更新
const resetSpan = resetLayoutBtn?.querySelector('span');
const browseSpan = browseModeBtn?.querySelector('span');
```

### 3. Background清理
**文件**: `src/background.js`

删除的内容：
```javascript
// 状态变量
let browseModeEnabled = false;

// Message handler
else if (request.action === 'browse_mode_changed') {
    browseModeEnabled = request.enabled || false;
    console.log('[AI Multiverse] Browse mode:', browseModeEnabled ? 'ENABLED' : 'DISABLED');
    sendResponse({ status: 'ok' });
}
```

### 4. 国际化清理
**文件**: `src/i18n.js`

删除的英文翻译：
- `reset_layout: "Reset"`
- `browse_mode: "Browse"`
- `layout_reset: "Layout reset!"`
- `browse_on: "Browse mode ON"`
- `browse_off: "Browse mode OFF"`

删除的中文翻译：
- `reset_layout: "重置"`
- `browse_mode: "浏览"`
- `layout_reset: "布局已重置！"`
- `browse_on: "浏览模式开启"`
- `browse_off: "浏览模式关闭"`

---

## 改动文件清单
- ✅ `src/sidepanel/sidepanel.html` - 删除2个按钮元素
- ✅ `src/sidepanel/sidepanel.js` - 删除约70行代码
- ✅ `src/background.js` - 删除约10行代码
- ✅ `src/i18n.js` - 删除10个翻译key
- ✅ `manifest.json` - 版本更新至1.7.5

---

## 代码质量
- ✅ 所有JS文件语法检查通过
- ✅ 无破坏性改动
- ✅ 代码更简洁易维护

---

## 影响
- ✅ 界面更简洁（减少2个无用按钮）
- ✅ 代码更精简（约90行代码）
- ✅ 用户体验更好（减少混淆）

---

**发布日期**: 2026-02-13
**版本号**: v1.7.5
**清理代码**: 约90行
**文档版本**: 1.0
