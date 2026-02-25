# Bug Fix: Kimi 输入框无响应问题 (v1.8.3)

## 日期
2026-02-14

## 问题1: Kimi 输入框无响应

### 问题描述
发送消息后，Kimi 又没有任何响应了，输入框里面都不会输入任何内容。

### 根本原因
Kimi 的配置使用了 `fillMethod: 'content-script'`，这会在内容脚本中通过 `fillContentEditable` 函数填充输入框。但是这种方式无法正确触发 Kimi 内部的状态更新，导致：
1. 输入框虽然被填充，但 Kimi 的 React 状态没有更新
2. 发送按钮保持禁用状态
3. 消息无法发送

### 解决方案
将 Kimi 改回使用 `fillMethod: 'main-world'`，并在 `background.js` 的 `executeMainWorldFill` 函数中添加 Kimi 的专门处理逻辑：

1. 使用 `ceditFill` 函数填充 contenteditable 输入框
2. 额外触发 `input`、`change` 和 `keyup` 事件来更新 Kimi 的内部状态
3. 使用 100ms 延迟确保事件在正确的时机触发

### 修改的文件

#### src/config.js
```javascript
// 修改前
fillMethod: 'content-script',

// 修改后
fillMethod: 'main-world',
```

#### src/background.js
在 `executeMainWorldFill` 函数中添加 Kimi 的处理逻辑：

```javascript
// Kimi 使用 contenteditable div，需要特殊处理以确保内部状态正确更新
if (hostname.includes('kimi.moonshot.cn') || hostname.includes('kimi.com')) {
    const el = findEl(['div[contenteditable="true"]', 'div.chat-input', 'div[class*="input"]', 'div[class*="editor"]']);
    if (!el) return false;
    
    // 使用 contenteditable 填充逻辑
    ceditFill(el, val);
    
    // Kimi 需要额外的事件触发来更新发送按钮状态
    setTimeout(() => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
    }, 100);
    
    return true;
}
```

## 问题2: 翻译缺失警告

### 问题描述
控制台出现警告：`Translation missing: generating for language zh-CN`

### 根本原因
代码中使用了一些翻译键，但这些键在 `i18n.js` 中没有定义：
1. `confirm_close` - 在 `updateButtonLabels()` 函数中使用
2. `generating` - 在响应状态显示中使用

### 解决方案

#### src/sidepanel/sidepanel.js
修复 `confirm_close` 键的使用：
```javascript
// 修改前
if (confirmBtn) confirmBtn.textContent = t('confirm_close');

// 修改后
if (confirmBtn) confirmBtn.textContent = t('confirm');
```

#### src/i18n.js
添加缺失的 `generating` 翻译键：

英文：
```javascript
generating: "Generating...",
```

中文：
```javascript
generating: "生成中...",
```

## 技术细节

### 为什么 main-world 比 content-script 更好？
1. **直接访问页面的 JavaScript 环境**：main-world 脚本运行在页面的主 JavaScript 环境中，可以直接访问页面的 React 组件和状态
2. **事件触发更可靠**：在 main-world 中触发的事件会被 React 的事件系统正确捕获
3. **避免跨环境问题**：content-script 和页面的 JavaScript 环境是隔离的，事件可能无法正确传递

### Kimi 的输入框特点
- 使用 contenteditable div 而不是 textarea
- 依赖 React 状态管理输入内容
- 发送按钮的启用/禁用状态由 React 状态控制
- 需要正确的事件序列来触发状态更新

### 翻译系统
- 使用 `t(key, vars)` 函数获取翻译
- 支持变量替换，如 `t('summary_by', {model: 'Gemini'})`
- 如果翻译键不存在，会在控制台输出警告并返回键名本身

## 测试步骤

### Kimi 输入测试
1. 打开 Kimi 聊天页面 (kimi.moonshot.cn 或 kimi.com)
2. 在侧边栏输入一条消息
3. 选择 Kimi 作为目标
4. 点击发送
5. 验证：
   - [ ] 输入框被正确填充
   - [ ] 发送按钮变为可点击状态
   - [ ] 消息成功发送
   - [ ] Kimi 开始响应

### 翻译警告测试
1. 打开浏览器控制台
2. 切换语言（EN ↔ 中文）
3. 浏览各个界面和功能
4. 验证：
   - [ ] 控制台没有 "Translation missing" 警告
   - [ ] 所有文本正确显示对应语言
   - [ ] 按钮和提示文本正确翻译

## 相关问题
- 之前在 BUGFIX_PERSISTENCE_AND_KIMI_v1.7.8.md 中也修复过类似的 Kimi 输入问题
- 那次是将 `sendMethod` 从 'enter' 改为 'button'
- 这次是将 `fillMethod` 从 'content-script' 改回 'main-world'

## 注意事项
- Kimi 的 UI 可能会更新，需要定期检查选择器是否仍然有效
- 如果将来 Kimi 再次出现输入问题，应该检查：
  1. 输入框选择器是否正确
  2. fillMethod 是否设置正确
  3. 事件触发的时机和类型是否正确
- 添加新的翻译键时，确保在 i18n.js 的英文和中文部分都添加
