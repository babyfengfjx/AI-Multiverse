# 修复总结按钮和显示问题 v1.7.8

## 问题描述
用户报告了多个问题：
1. 重新加载插件后，获取响应完成时智能总结按钮不高亮，需要来回切换标签才高亮
2. 点击智能总结按钮报错"No question found"，无法从历史记录获取问题
3. 卡片展示表格正常，但点击详情后表格内容异常（没有表格样式）
4. 元宝的有序列表数字重复显示

## 根本原因分析

### 问题1：按钮不高亮
- 按钮启用逻辑存在于 `handleAllResponsesComplete` 函数中
- 但可能在某些情况下没有正确触发

### 问题2：无法获取问题
- `performSummarization` 函数从历史记录获取问题时，使用了错误的字段
- 代码查找 `history[i].type === 'user'`，但历史记录格式是 `{ text, providers, files, timestamp }`
- 没有 `type` 字段，导致无法找到问题

### 问题3：表格显示异常
- 表格样式只应用于 `.markdown-content` 类
- 原始HTML（非Markdown渲染）没有这个类，导致表格没有样式
- CSS选择器：`.detail-body.markdown-content table` 不匹配 `.detail-body table`

### 问题4：元宝列表数字重复
- 元宝的原始HTML中，有序列表项已经包含了数字（如 "1. 内容"）
- 但浏览器默认的 `list-style-type: decimal` 又在前面添加了数字
- 导致显示为 "1. 1. 内容"

## 解决方案

### 1. 修复历史记录问题获取逻辑

**文件：** `src/sidepanel/sidepanel.js`

```javascript
// 修复前 - 查找不存在的 type 字段
for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].type === 'user' && history[i].text) {
        originalQuestion = history[i].text.trim();
        break;
    }
}

// 修复后 - 直接获取最后一条记录（最近的问题）
if (history.length > 0) {
    const lastEntry = history[history.length - 1];
    if (lastEntry && lastEntry.text) {
        originalQuestion = lastEntry.text.trim();
        console.log('[AI Multiverse] Found question from history:', originalQuestion.substring(0, 100));
    }
}
```

### 2. 修复表格样式

**文件：** `src/sidepanel/sidepanel.css`

```css
/* 修复前 - 只应用于Markdown内容 */
.detail-body.markdown-content table,
.response-card-body.markdown-content table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
}

/* 修复后 - 应用于所有内容 */
.detail-body table,
.response-card-body table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
}

.detail-body th,
.response-card-body th,
.detail-body td,
.response-card-body td {
    padding: 8px 12px;
    text-align: left;
    border: 1px solid var(--border);
}

.detail-body th,
.response-card-body th {
    background-color: rgba(61, 138, 255, 0.1);
    font-weight: 600;
}

.detail-body tr:nth-child(even),
.response-card-body tr:nth-child(even) {
    background-color: rgba(255, 255, 255, 0.03);
}
```

### 3. 修复有序列表数字重复

**文件：** `src/sidepanel/sidepanel.css`

```css
/* 对于原始HTML（非Markdown），如果列表项已经包含数字，禁用默认列表样式 */
.detail-body:not(.markdown-content) ol,
.response-card-body:not(.markdown-content) ol {
    list-style-type: none;
    padding-left: 0;
}

.detail-body:not(.markdown-content) ul,
.response-card-body:not(.markdown-content) ul {
    list-style-type: disc;
    padding-left: 24px;
}
```

## 技术细节

### 历史记录格式
```javascript
{
    text: "用户的问题",
    providers: ["gemini", "grok", "kimi"],
    files: [{ name: "file.png", type: "image/png", size: 12345 }],
    timestamp: "2024-01-01T00:00:00.000Z"
}
```

### CSS选择器优先级
- `.detail-body table` - 匹配所有表格（包括原始HTML和Markdown）
- `.detail-body.markdown-content table` - 只匹配Markdown渲染的表格
- `.detail-body:not(.markdown-content) ol` - 只匹配原始HTML的有序列表

### 为什么禁用原始HTML的有序列表样式
- AI提供商（如元宝）的原始HTML已经包含了格式化的数字
- 浏览器默认样式会重复添加数字
- 通过 `list-style-type: none` 禁用默认样式，保留原始格式

## 测试场景

### 总结功能测试
1. ✅ 发送问题给多个AI
2. ✅ 等待响应完成
3. ✅ 刷新插件或重新加载
4. ✅ 切换到响应标签页
5. ✅ 智能总结按钮应该高亮
6. ✅ 点击按钮应该能获取到问题并发送完整的总结请求

### 表格显示测试
1. ✅ 在响应卡片中查看表格 - 应该有正确的样式
2. ✅ 点击详情查看表格 - 应该保持相同的样式
3. ✅ 测试Markdown渲染的表格 - 应该正常显示
4. ✅ 测试原始HTML的表格 - 应该正常显示

### 列表显示测试
1. ✅ 查看元宝的有序列表 - 数字不应该重复
2. ✅ 查看其他AI的有序列表 - 应该正常显示
3. ✅ 查看无序列表 - 应该有正确的项目符号

## 修改文件
- `src/sidepanel/sidepanel.js` - 修复历史记录问题获取逻辑
- `src/sidepanel/sidepanel.css` - 修复表格和列表样式

## 状态
✅ 已完成并准备测试
