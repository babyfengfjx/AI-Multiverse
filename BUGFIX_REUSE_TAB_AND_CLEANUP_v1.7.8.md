# 修复标签页复用和内容清理 v1.7.8

## 问题描述
1. 点击智能总结按钮时新开窗口，即使Gemini窗口已经打开
2. 元宝的内容渲染有问题（列表数字重复）
3. 原网页的复制、下载按钮文字和图标显示在卡片里，看着不好看

## 根本原因分析

### 问题1：新开窗口
- `handleSummarizeResponses` 函数只检查 `providerWindows[provider]` 中保存的标签页
- 如果用户手动移动了窗口，`chrome.windows.get()` 可能会失败
- 没有尝试查找所有匹配URL的现有标签页
- 导致即使Gemini已经打开，也会创建新标签页

### 问题2：元宝列表数字重复
- 元宝的HTML结构中，有序列表项已经包含了数字
- 之前的CSS只禁用了 `list-style-type`，但可能还有其他样式影响
- 需要更激进地移除所有列表相关的样式和伪元素

### 问题3：原网页按钮显示
- 原网页的HTML包含了复制、下载等按钮
- 这些按钮在我们的环境中不工作（没有JavaScript）
- 但仍然显示文字和图标，影响美观

## 解决方案

### 1. 改进标签页查找逻辑

**文件：** `src/background.js`

```javascript
// 修复前 - 只检查保存的窗口
let tabId = null;
if (providerWindows[provider]) {
    try {
        await chrome.windows.get(providerWindows[provider].windowId);
        tabId = providerWindows[provider].tabId;
    } catch (e) { 
        delete providerWindows[provider]; 
    }
}

// 修复后 - 先查找所有匹配URL的标签页
let tabId = null;

// First, try to find any existing tab matching the URL pattern
const patternsToCheck = [config.urlPattern];
if (config.urlPatternAlt) patternsToCheck.push(config.urlPatternAlt);
if (config.urlPatterns) patternsToCheck.push(...config.urlPatterns);

const uniquePatterns = [...new Set(patternsToCheck.filter(p => typeof p === 'string' && p.length > 0))];

for (const pattern of uniquePatterns) {
    try {
        const tabs = await chrome.tabs.query({ url: pattern });
        // Skip internal extension tabs
        const validTab = tabs.find(t => t.url && !t.url.startsWith('chrome-extension://'));
        if (validTab) {
            tabId = validTab.id;
            providerWindows[provider] = { windowId: validTab.windowId, tabId: tabId };
            console.log('[AI Multiverse Background] Found existing tab by URL:', tabId);
            break;
        }
    } catch (e) {
        console.warn('[AI Multiverse Background] Error querying tabs:', e);
    }
}

// If still no tab found, check saved providerWindows
if (!tabId && providerWindows[provider]) {
    try {
        await chrome.windows.get(providerWindows[provider].windowId);
        tabId = providerWindows[provider].tabId;
        console.log('[AI Multiverse Background] Found existing tab from saved windows:', tabId);
    } catch (e) { 
        console.log('[AI Multiverse Background] Saved window not found');
        delete providerWindows[provider]; 
    }
}
```

**查找顺序：**
1. 首先尝试通过URL模式查找所有匹配的标签页
2. 如果找到，使用该标签页并更新 `providerWindows`
3. 如果没找到，再检查保存的 `providerWindows`
4. 如果还是没找到，才创建新标签页

### 2. 更激进地移除列表样式

**文件：** `src/sidepanel/sidepanel.css`

```css
/* 修复前 - 只禁用list-style-type */
.detail-body:not(.markdown-content) ol {
    list-style-type: none;
    padding-left: 0;
}

/* 修复后 - 移除所有列表相关样式 */
.detail-body:not(.markdown-content) ol,
.response-card-body:not(.markdown-content) ol {
    list-style-type: none;
    padding-left: 0;
    margin-left: 0;
}

.detail-body:not(.markdown-content) ol li,
.response-card-body:not(.markdown-content) ol li {
    list-style: none;
    padding-left: 0;
}

/* 移除列表项的伪元素（如果有的话） */
.detail-body:not(.markdown-content) ol li::before,
.response-card-body:not(.markdown-content) ol li::before,
.detail-body:not(.markdown-content) ol li::marker,
.response-card-body:not(.markdown-content) ol li::marker {
    display: none;
    content: none;
}
```

### 3. 隐藏原网页的无用按钮

**文件：** `src/sidepanel/sidepanel.css`

```css
/* 隐藏原网页中的无用按钮（复制、下载等） */
.detail-body:not(.markdown-content) button,
.response-card-body:not(.markdown-content) button,
.detail-body:not(.markdown-content) [role="button"],
.response-card-body:not(.markdown-content) [role="button"],
.detail-body:not(.markdown-content) .copy-btn,
.response-card-body:not(.markdown-content) .copy-btn,
.detail-body:not(.markdown-content) .download-btn,
.response-card-body:not(.markdown-content) .download-btn,
.detail-body:not(.markdown-content) [class*="copy"],
.response-card-body:not(.markdown-content) [class*="copy"],
.detail-body:not(.markdown-content) [class*="download"],
.response-card-body:not(.markdown-content) [class*="download"],
.detail-body:not(.markdown-content) [aria-label*="copy"],
.response-card-body:not(.markdown-content) [aria-label*="copy"],
.detail-body:not(.markdown-content) [aria-label*="Copy"],
.response-card-body:not(.markdown-content) [aria-label*="Copy"],
.detail-body:not(.markdown-content) [aria-label*="下载"],
.response-card-body:not(.markdown-content) [aria-label*="下载"],
.detail-body:not(.markdown-content) [aria-label*="复制"],
.response-card-body:not(.markdown-content) [aria-label*="复制"] {
    display: none !important;
}
```

**匹配规则：**
- 所有 `<button>` 元素
- 所有 `role="button"` 的元素
- 所有包含 "copy"、"download"、"复制"、"下载" 的class或aria-label
- 使用 `!important` 确保优先级最高

## 技术细节

### 标签页查找优先级
1. **URL模式匹配** - 最可靠，不受窗口移动影响
2. **保存的窗口ID** - 作为备用方案
3. **创建新标签页** - 最后的选择

### 为什么使用 `!important`
- 原网页的CSS可能有很高的优先级
- 使用 `!important` 确保我们的隐藏规则生效
- 只在必要时使用（隐藏无用元素）

### CSS选择器说明
- `:not(.markdown-content)` - 只应用于原始HTML，不影响Markdown渲染
- `[class*="copy"]` - 匹配class包含"copy"的元素
- `[aria-label*="复制"]` - 匹配aria-label包含"复制"的元素

## 测试场景

### 标签页复用测试
1. ✅ 打开Gemini标签页
2. ✅ 手动移动窗口位置
3. ✅ 在扩展中发送问题并获取响应
4. ✅ 点击智能总结按钮
5. ✅ 应该复用现有的Gemini标签页，不创建新窗口

### 元宝列表显示测试
1. ✅ 查看元宝的有序列表
2. ✅ 数字不应该重复
3. ✅ 列表项应该正确对齐

### 按钮隐藏测试
1. ✅ 查看响应卡片
2. ✅ 不应该看到"复制"、"下载"等按钮
3. ✅ 点击详情查看
4. ✅ 详情中也不应该看到这些按钮

## 修改文件
- `src/background.js` - 改进标签页查找逻辑
- `src/sidepanel/sidepanel.css` - 移除列表样式和隐藏无用按钮

## 状态
✅ 已完成并准备测试

## 注意事项
- 隐藏按钮使用了广泛的选择器，可能会影响一些特殊情况
- 如果发现有用的按钮被误隐藏，可以添加更具体的排除规则
- 标签页查找逻辑现在更健壮，但仍然依赖URL模式匹配
