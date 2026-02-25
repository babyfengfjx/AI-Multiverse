# Bug Fix: 移除Markdown渲染，使用原始HTML (v1.8.3)

## 日期
2026-02-14

## 问题描述
1. 使用Markdown重新渲染AI响应会导致格式丢失和变形
2. Kimi等AI的响应中出现"复制"图标和文字，这些在原网页上是按钮，但在我们的显示中变成了内容
3. 各个AI的显示效果与原网站差异大

## 解决方案
完全移除Markdown渲染，改为：
1. **优先使用原始HTML**：直接显示AI网站的原始HTML
2. **回退到纯文本**：如果没有HTML，显示纯文本（不经过Markdown渲染）
3. **增强按钮清理**：在提取HTML时移除所有按钮、图标和相关文本
4. **CSS隐藏**：通过CSS隐藏任何残留的按钮和图标

## 修改的文件

### 1. src/content/content.js
增强HTML清理逻辑，移除按钮、SVG图标和相关文本：

```javascript
// Remove unwanted elements from the clone (buttons, icons, etc.)
const unwantedSelectors = [
    'button',
    '[role="button"]',
    '.copy-btn',
    '.download-btn',
    '[class*="copy"]',
    '[class*="Copy"]',
    '[class*="download"]',
    '[class*="Download"]',
    '[class*="icon"]',
    '[class*="Icon"]',
    '[aria-label*="copy"]',
    '[aria-label*="Copy"]',
    '[aria-label*="复制"]',
    '[aria-label*="下载"]',
    '[aria-label*="download"]',
    '[title*="copy"]',
    '[title*="Copy"]',
    '[title*="复制"]',
    '[title*="下载"]',
    '[title*="download"]',
    'svg[class*="copy"]',
    'svg[class*="Copy"]',
    'svg[aria-label*="copy"]',
    'svg[aria-label*="Copy"]',
    'svg[aria-label*="复制"]',
    // ... more selectors
];

// Additional cleanup: remove standalone SVG icons
const svgs = clonedEl.querySelectorAll('svg');
svgs.forEach(svg => {
    const parent = svg.parentElement;
    if (parent && parent.textContent.trim().length < 10) {
        const text = parent.textContent.trim().toLowerCase();
        if (text.includes('复制') || text.includes('copy') || text === '') {
            parent.remove();
        }
    }
});

// Remove empty elements left after button removal
clonedEl.querySelectorAll('div:empty, span:empty').forEach(el => {
    const style = window.getComputedStyle(el);
    if (!style.backgroundImage && !style.backgroundColor && !style.border) {
        el.remove();
    }
});
```

### 2. src/sidepanel/sidepanel.js
修改所有AI响应显示逻辑，不使用Markdown渲染：

#### showDetail函数
```javascript
// 修改前
if (currentResponse.html) {
    detailText.innerHTML = currentResponse.html;
    detailText.className = 'detail-body';
} else if (currentResponse.text) {
    const renderedHtml = renderMarkdown(currentResponse.text);
    detailText.innerHTML = renderedHtml;
    detailText.className = 'detail-body markdown-content';
}

// 修改后
if (currentResponse.html) {
    detailText.innerHTML = currentResponse.html;
    detailText.className = 'detail-body';
} else if (currentResponse.text) {
    detailText.textContent = currentResponse.text;  // 纯文本，不渲染
    detailText.className = 'detail-body';
}
```

#### 模态框导航
```javascript
// 修改前
if (response.html) {
    detailText.innerHTML = response.html;
    detailText.className = 'detail-body';
} else if (response.text) {
    detailText.innerHTML = renderMarkdown(response.text);
    detailText.className = 'detail-body markdown-content';
}

// 修改后
if (response.html) {
    detailText.innerHTML = response.html;
    detailText.className = 'detail-body';
} else if (response.text) {
    detailText.textContent = response.text;  // 纯文本，不渲染
    detailText.className = 'detail-body';
}
```

#### createResponseCard函数
```javascript
// 修改前
if (data.html) {
    body.innerHTML = data.html;
} else if (data.text) {
    body.innerHTML = renderMarkdown(data.text);
}

// 修改后
if (data.html) {
    body.innerHTML = data.html;
} else if (data.text) {
    body.textContent = data.text;  // 纯文本，不渲染
}
```

### 3. src/sidepanel/sidepanel.css
增强CSS隐藏规则，包括SVG图标：

```css
/* 隐藏SVG图标和相关文本（复制、下载等） */
.detail-body:not(.markdown-content) svg[class*="copy"],
.response-card-body:not(.markdown-content) svg[class*="copy"],
.detail-body:not(.markdown-content) svg[class*="Copy"],
.response-card-body:not(.markdown-content) svg[class*="Copy"],
.detail-body:not(.markdown-content) svg[aria-label*="复制"],
.response-card-body:not(.markdown-content) svg[aria-label*="复制"],
.detail-body:not(.markdown-content) svg[aria-label*="copy"],
.response-card-body:not(.markdown-content) svg[aria-label*="copy"],
.detail-body:not(.markdown-content) [class*="icon"]:not([class*="markdown"]):not([class*="code"]):not(code):not(pre),
.response-card-body:not(.markdown-content) [class*="icon"]:not([class*="markdown"]):not([class*="code"]):not(code):not(pre),
.detail-body:not(.markdown-content) [class*="Icon"]:not([class*="markdown"]):not([class*="code"]):not(code):not(pre),
.response-card-body:not(.markdown-content) [class*="Icon"]:not([class*="markdown"]):not([class*="code"]):not(code):not(pre) {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    width: 0 !important;
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
}
```

## 保留Markdown渲染的地方

以下功能仍然使用Markdown渲染，因为它们是我们自己生成的内容：

1. **总结功能**：`showSummaryDetail`函数
2. **历史记录中的总结**：`renderHistory`函数中的总结条目
3. **总结结果显示**：总结卡片的内容

这些地方使用Markdown是合理的，因为：
- 总结是由AI生成的纯文本，需要格式化
- 我们控制总结的格式，不会有按钮等问题
- 总结内容通常包含Markdown格式（标题、列表等）

## 技术细节

### 清理策略的三层防护

1. **DOM清理**（content.js）：
   - 克隆DOM节点
   - 使用选择器移除按钮和图标
   - 检查SVG父元素的文本内容
   - 移除空元素

2. **CSS隐藏**（sidepanel.css）：
   - 使用`:not(.markdown-content)`选择器
   - 隐藏所有可能的按钮和图标
   - 使用`!important`确保优先级

3. **回退机制**（sidepanel.js）：
   - 优先使用清理后的HTML
   - 如果没有HTML，使用纯文本
   - 不使用Markdown渲染

### 为什么不使用Markdown渲染？

1. **格式丢失**：AI的响应通常有复杂的HTML结构，转换为文本再渲染会丢失格式
2. **按钮问题**：Markdown渲染无法识别和移除原网站的按钮
3. **性能问题**：Markdown解析和渲染需要额外的CPU时间
4. **兼容性问题**：不同AI的输出格式不同，Markdown无法统一处理

### 使用textContent vs innerHTML

- `textContent`：设置纯文本，自动转义HTML标签
- `innerHTML`：设置HTML内容，保留格式和结构

对于AI响应：
- 有HTML时使用`innerHTML`（已清理）
- 无HTML时使用`textContent`（安全）

## 测试步骤

### 基础测试
1. 向各个AI发送消息
2. 检查响应卡片：
   - [ ] 没有"复制"按钮或文字
   - [ ] 没有SVG图标
   - [ ] 格式与原网站一致
   - [ ] 内容完整

### Kimi特殊测试
1. 向Kimi发送消息
2. 查看响应详情
3. 验证：
   - [ ] 没有"复制"图标
   - [ ] 没有"复制"文字
   - [ ] 代码块正常显示
   - [ ] 列表格式正确

### 其他AI测试
对每个AI（Gemini、Grok、DeepSeek、ChatGPT、Qwen、Yuanbao）：
1. 发送包含代码的消息
2. 检查响应显示
3. 验证：
   - [ ] 代码块正确显示
   - [ ] 没有原网站的按钮
   - [ ] 格式保持一致

### 总结功能测试
1. 获取多个AI的响应
2. 点击总结按钮
3. 验证：
   - [ ] 总结内容正确渲染（使用Markdown）
   - [ ] 格式美观
   - [ ] 代码块有复制按钮（我们自己的）

## 优势

### 1. 显示质量
- ✅ 保持原网站的完整格式
- ✅ 没有多余的按钮和图标
- ✅ 代码高亮和样式保留
- ✅ 表格、列表等格式完整

### 2. 性能
- ✅ 不需要Markdown解析
- ✅ 减少CPU使用
- ✅ 更快的渲染速度
- ✅ 更少的内存占用

### 3. 维护性
- ✅ 代码更简单
- ✅ 不需要维护Markdown渲染逻辑
- ✅ 自动适应AI网站的更新
- ✅ 更少的bug

### 4. 用户体验
- ✅ 与原网站一致的显示效果
- ✅ 没有混淆的按钮和图标
- ✅ 更清晰的内容展示
- ✅ 更好的可读性

## 注意事项

### 1. 安全性
- 使用`textContent`设置纯文本，避免XSS
- 清理HTML时移除所有交互元素
- 只保留内容展示元素

### 2. 兼容性
- 如果AI网站更新HTML结构，可能需要调整清理规则
- 定期检查各AI的响应提取是否正常
- 保持unwantedSelectors列表的更新

### 3. 回退机制
- 如果HTML清理失败，回退到纯文本
- 如果纯文本也没有，显示错误信息
- 总结功能保持使用Markdown

## 相关文件
- `src/content/content.js` - HTML提取和清理
- `src/sidepanel/sidepanel.js` - 响应显示逻辑
- `src/sidepanel/sidepanel.css` - 样式和隐藏规则
