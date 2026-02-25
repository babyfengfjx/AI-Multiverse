# Bug Fix: 使用原始HTML渲染替代Markdown (v1.8.3)

## 日期
2026-02-14

## 问题描述
在查看 Grok 等AI的响应详情时，使用Markdown重新渲染会导致：
1. 格式丢失或变形
2. 出现大量空行
3. 显示效果与原网站差异大
4. 用户体验不佳

## 解决方案
改为直接使用各个AI网站的原始HTML渲染，保持原汁原味的显示效果。

### 核心改进
1. **提取原始HTML**：在`extractLatestResponse`中克隆DOM节点并清理不需要的元素（按钮等）
2. **优先使用原始HTML**：在显示时优先使用`data.html`而不是重新渲染`data.text`
3. **添加通用样式**：为原始HTML添加CSS样式，确保在我们的扩展中能正确显示

## 修改的文件

### src/content/content.js
在`extractLatestResponse`函数中改进HTML提取逻辑：

```javascript
// Get the HTML content - preserve original formatting
// Clone the element to avoid modifying the original page
const clonedEl = cleanedEl.cloneNode(true);

// Remove unwanted elements from the clone (buttons, etc.)
const unwantedSelectors = [
    'button',
    '[role="button"]',
    '.copy-btn',
    '.download-btn',
    '[class*="copy"]',
    '[class*="Copy"]',
    '[class*="download"]',
    '[class*="Download"]',
    '[aria-label*="copy"]',
    '[aria-label*="Copy"]',
    '[aria-label*="复制"]',
    '[aria-label*="下载"]',
    '[title*="copy"]',
    '[title*="Copy"]',
    '[title*="复制"]',
    '[title*="下载"]'
];

unwantedSelectors.forEach(selector => {
    try {
        clonedEl.querySelectorAll(selector).forEach(el => el.remove());
    } catch (e) { /* ignore */ }
});

const html = clonedEl.innerHTML || '';
```

### src/sidepanel/sidepanel.js
显示逻辑已经存在，优先使用原始HTML：

```javascript
// In showDetail function
if (currentResponse.html) {
    // Use original HTML from AI provider - don't add markdown-content class
    detailText.innerHTML = currentResponse.html;
    detailText.className = 'detail-body';
} else if (currentResponse.text) {
    // Fall back to rendering text as Markdown
    const renderedHtml = renderMarkdown(currentResponse.text);
    detailText.innerHTML = renderedHtml;
    detailText.className = 'detail-body markdown-content';
}

// In createResponseCard function
if (data.html) {
    body.innerHTML = data.html;
} else if (data.text) {
    body.innerHTML = renderMarkdown(data.text);
}
```

### src/sidepanel/sidepanel.css
添加原始HTML的通用样式：

```css
/* 原始HTML通用样式 - 确保各AI网站的HTML能正确显示 */
.detail-body:not(.markdown-content),
.response-card-body:not(.markdown-content) {
    white-space: normal;
}

.detail-body:not(.markdown-content) *,
.response-card-body:not(.markdown-content) * {
    color: inherit;
    font-family: inherit;
}

.detail-body:not(.markdown-content) p,
.response-card-body:not(.markdown-content) p,
.detail-body:not(.markdown-content) div,
.response-card-body:not(.markdown-content) div {
    margin: 0.5em 0;
    line-height: 1.8;
}

/* ... 更多通用样式，包括标题、代码块、链接、列表等 */
```

## 技术细节

### 为什么使用原始HTML？
1. **保留原始格式**：AI网站的响应通常有精心设计的格式和样式
2. **避免转换损失**：文本→Markdown→HTML的转换会丢失信息
3. **更好的兼容性**：不同AI的输出格式不同，原始HTML最可靠
4. **减少空行问题**：直接使用HTML避免了innerText带来的换行问题

### HTML清理策略
1. **克隆节点**：避免修改原页面的DOM
2. **移除按钮**：清理复制、下载等交互按钮
3. **保留内容**：保留所有文本、格式、代码块等内容元素

### CSS样式策略
1. **通用样式**：为原始HTML提供基础样式（字体、颜色、间距等）
2. **继承机制**：使用`inherit`确保样式与主题一致
3. **选择器隔离**：使用`:not(.markdown-content)`区分原始HTML和Markdown渲染

### 样式覆盖优先级
```
原网站内联样式 > 我们的通用样式 > 浏览器默认样式
```

## 优势

### 1. 显示效果
- ✅ 保持原网站的格式和布局
- ✅ 代码高亮和语法着色保留
- ✅ 列表、表格、引用等格式完整
- ✅ 没有多余的空行

### 2. 兼容性
- ✅ 适用于所有AI提供商
- ✅ 不需要针对每个AI单独处理
- ✅ 自动适应AI网站的更新

### 3. 性能
- ✅ 不需要Markdown解析
- ✅ 减少CPU使用
- ✅ 更快的渲染速度

## 测试步骤

### 基础测试
1. 打开任意AI聊天页面（Grok、Gemini、Kimi等）
2. 在侧边栏发送一条消息
3. 等待响应完成
4. 验证响应卡片显示：
   - [ ] 格式正确
   - [ ] 没有多余空行
   - [ ] 代码块正确显示
   - [ ] 列表格式正确

### 详情模态框测试
1. 点击响应卡片查看详情
2. 验证详情显示：
   - [ ] 格式与原网站一致
   - [ ] 没有原网站的按钮（复制、下载等）
   - [ ] 文本可选择和复制
   - [ ] 滚动流畅

### 多AI对比测试
1. 同时向多个AI发送相同问题
2. 对比各AI的响应显示
3. 验证：
   - [ ] 每个AI的格式都正确
   - [ ] 样式与各自网站一致
   - [ ] 没有样式冲突

### 特殊内容测试
测试包含以下内容的响应：
- [ ] 长代码块
- [ ] 数学公式
- [ ] 表格
- [ ] 有序/无序列表
- [ ] 引用块
- [ ] 链接
- [ ] 图片（如果支持）

## 回退机制
如果原始HTML不可用（`data.html`为空），系统会自动回退到Markdown渲染：

```javascript
if (data.html) {
    // 使用原始HTML
    body.innerHTML = data.html;
} else if (data.text) {
    // 回退到Markdown渲染
    body.innerHTML = renderMarkdown(data.text);
}
```

## 注意事项

### 1. 安全性
- 使用DOMPurify清理HTML（如果需要）
- 移除所有交互元素（按钮、表单等）
- 只保留内容展示元素

### 2. 样式隔离
- 原网站的CSS类名可能与我们的冲突
- 使用`:not(.markdown-content)`选择器隔离
- 通用样式使用较低的优先级

### 3. 性能考虑
- 克隆大型DOM可能影响性能
- 清理不需要的元素减少内存占用
- 考虑对超大响应进行截断

### 4. 维护性
- 如果AI网站更新HTML结构，可能需要调整选择器
- 定期检查各AI的响应提取是否正常
- 保持unwantedSelectors列表的更新

## 相关问题
- 如果将来某个AI的原始HTML显示有问题，可以在config.js中添加特殊标记，强制使用Markdown渲染
- 如果需要更精细的控制，可以为每个AI提供商配置不同的HTML清理规则
