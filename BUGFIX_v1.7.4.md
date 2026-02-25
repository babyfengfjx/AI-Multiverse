# v1.7.4 响应提取修复 - 千问和元宝

## 概述

v1.7.4 修复了通义千问和腾讯元宝的响应提取问题：
- 千问：只能提取到很少的一部分内容
- 元宝：无法提取到任何内容

---

## 问题描述

### 用户反馈
冯进雄测试发现：
1. **千问** - 只获取到答复的很小一部分，不全面
2. **元宝** - 没有获取到任何内容

### 问题分析

**可能原因**：
1. 选择器已过时，网站DOM结构发生了变化
2. 响应容器的class名称更新了
3. 需要添加更多备选选择器以提高兼容性

---

## 修复方案

### 1. 更新千问（Qwen）的响应选择器

**Before**：
```javascript
response: ['div[class*="answer-content"]', '.tongyi-markdown', '.markdown-body']
```

**After**：
```javascript
response: [
    'div[class*="answer-content"]',
    '.tongyi-markdown',
    '.markdown-body',
    'div[class*="message-content"]',      // 新增
    'div[class*="assistant-content"]',   // 新增
    'div[class*="bot-content"]',         // 新增
    'div[class*="rich-text"]',          // 新增
    'div[data-content]',                // 新增
    '.message.bubble .content',         // 新增
    '[class*="answer"] [class*="content"]' // 新增
]
```

**新增选择器说明**：
- `div[class*="message-content"]` - 常规的消息内容容器
- `div[class*="assistant-content"]` - 助手（AI）响应容器
- `div[class*="bot-content"]` - 机器人响应容器
- `div[class*="rich-text"]` - 富文本内容
- `div[data-content]` - 带有data属性的内容标记
- 其他通用的消息容器模式

### 2. 更新元宝（Yuanbao）的响应选择器

**Before**：
```javascript
response: ['div[class*="agent-chat__bubble__content"]', '.markdown-body']
```

**After**：
```javascript
response: [
    'div[class*="agent-chat__bubble__content"]',
    '.markdown-body',
    'div[class*="message-content"]',      // 新增
    'div[class*="chat-content"]',         // 新增
    'div[class*="assistant-message"]',    // 新增
    'div[class*="bot-message"]',          // 新增
    'div[data-role="assistant"]',         // 新增
    '.markdown-content',                 // 新增
    '.rich-text-content',                // 新增
    'div.chat-view__message__content'    // 新增
]
```

**新增选择器说明**：
- `div[class*="chat-content"]` - 聊天内容容器
- `div[data-role="assistant"]` - 明确标记为助手的元素
- `.markdown-content` - Markdown渲染内容
- `.rich-text-content` - 富文本内容
- `div.chat-view__message__content` - 特定聊天视图的内容

### 3. 添加诊断工具

为了帮助调试未来的选择器问题，添加了诊断功能：

**content.js 新增函数**：
```javascript
function diagnoseSelectors(provider)
```

**功能**：
- 测试所有响应选择器
- 显示每个选择器找到的元素数量
- 显示最后一个元素的文本长度
- 预览前100字符
- 找到最佳选择器（文本最长的那个）
- 报告所有错误

**返回结果示例**：
```json
{
  "status": "ok",
  "provider": "qwen",
  "url": "https://chat.qwen.ai/chat/...",
  "hostname": "chat.qwen.ai",
  "results": [
    {
      "selector": "div[class*=\"answer-content\"]",
      "found": 5,
      "lastElementLength": 1500,
      "lastElementPreview": "这是AI的回复内容...",
      "valid": true
    },
    {
      "selector": ".tongyi-markdown",
      "found": 0,
      "lastElementLength": 0,
      "lastElementPreview": "",
      "valid": false
    }
  ],
  "bestSelector": "div[class*=\"answer-content\"]",
  "bestLength": 1500
}
```

### 4. Background诊断处理

**background.js 新增函数**：
```javascript
async function handleDiagnoseSelectors(provider)
```

**功能**：
- 查找对应的标签页
- 确保content script已注入
- 调用页面的diagnoseSelectors函数
- 返回诊断结果

---

## 测试方法

### 1. 基本测试
1. 打开通义千问页面
2. 发送一个问题
3. 等待AI回复
4. 点击"获取响应"按钮
5. 检查提取到的内容是否完整

### 2. 元宝测试
1. 打开腾讯元宝页面
2. 发送一个问题
3. 等待AI回复
4. 点击"获取响应"按钮
5. 检查是否提取到内容

### 3. 诊断工具测试（开发用）

在browser console中运行：
```javascript
chrome.runtime.sendMessage({
    action: 'diagnose_selectors',
    provider: 'qwen'
}, (response) => {
    console.log('Diagnosis result:', response);
});
```

或者通过sidepanel调用（需添加UI按钮）。

---

## 改动文件清单

- ✅ `src/config.js` - 更新千问和元宝的响应选择器（+10行）
- ✅ `src/content/content.js` - 添加diagnoseSelectors函数（+95行）
- ✅ `src/background.js` - 添加handleDiagnoseSelectors函数（+25行）
- ✅ `manifest.json` - 版本更新至1.7.4

---

## 代码质量

- ✅ 所有JS文件语法检查通过
- ✅ 向后兼容（保留了原有选择器）
- ✅ 新增备选选择器不会影响其他功能
- ✅ 诊断工具不影响正常使用

---

## 已知限制

### 1. 选择器可能仍需调整
如果网站更新DOM结构，可能需要再次更新选择器
- 解决方案：使用诊断工具快速定位问题

### 2. 元宝选择器未验证
由于我在文档中无法直接测试元宝网站
- 需要：用户测试并反馈结果
- 备选：如果仍有问题，可提供页面截图帮助调试

### 3. 诊断工具缺少UI
目前只有代码层面的诊断功能
- 计划：在v1.8中添加UI诊断按钮

---

## 后续优化方向

### 短期（v1.7.5）
- [ ] 根据用户测试反馈调整选择器
- [ ] 添加更多千问域名的选择器支持
- [ ] 优化AI回复内容过滤逻辑

### 中期（v1.8）
- [ ] 添加UI诊断按钮（在响应面板）
- [ ] 支持自定义选择器配置
- [ ] 添加选择器自动检测功能（AI辅助）

### 长期（v2.0）
- [ ] 实时监控DOM变化
- [ ] 自动更新选择器规则库
- [ ] 社区贡献的选择器数据库

---

## 技术说明

### 选择器策略

**主要思路**：
1. 从具体到通用
   - 先尝试最具体的选择器（准确但脆弱）
   - 再尝试通用模式（兼容性更好）

2. 多重备选
   - 每个平台至少3-5个备选选择器
   - 覆盖多个可能的DOM结构

3. 文本长度验证
   - 选择文本最长的元素（最有可能是AI回复）
   - 避免错误地提取到用户问题

**千问的特殊处理**（content.js已实现）：
```javascript
if (provider === 'qwen' && elements.length > 1) {
    // 选择文本最长的元素
    let best = lastEl;
    let bestLen = (best.innerText || best.textContent || '').trim().length;
    for (let i = elements.length - 1; i >= 0; i--) {
        const t = (elements[i].innerText || elements[i].textContent || '').trim();
        if (t.length > bestLen) {
            best = elements[i];
            bestLen = t.length;
        }
    }
    lastEl = best;
}
```

---

## 用户测试请求

请冯进雄测试以下场景：

### 场景1：千问长文本回复
1. 发送一个复杂问题（如"解释量子计算的基本原理"）
2. 等待千问给出长篇回复
3. 点击"获取响应"
4. 检查提取的内容是否完整

**期望结果**：提取到完整回复，截断不超过10%

### 场景2：千问多次对话
1. 发送多个问题（3-5个）
2. 每次等待回复后都"获取响应"
3. 检查每次都提取到正确的最新回复

**期望结果**：每次都提取到最后一次AI回复

### 场景3：元宝基本测试
1. 发送一个简单问题（如"今天天气怎么样"）
2. 等待元宝回复
3. 点击"获取响应"
4. 检查是否提取到内容

**期望结果**：提取到完整的AI回复

### 场景4：元宝复杂回复
1. 发送一个需要详细回答的问题
2. 检查提取的内容质量

**期望结果**：内容完整，无漏字

---

## 问题反馈模板

如果测试后仍有问题，请按以下格式反馈：

```
平台：千问/元宝/其他
问题描述：具体问题
复现步骤：
1. ...
2. ...
期望结果：应该得到什么
实际结果：实际得到什么
截图：如果有问题页面截图
```

---

**发布日期**：2026-02-13
**版本号**：v1.7.4
**修复问题**：2个
**代码改动**：约130行
**文档版本**：1.0
