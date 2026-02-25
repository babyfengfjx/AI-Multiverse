# 智能总结调试指南 v1.7.8

## 问题描述
1. 智能总结功能没有触发
2. 发送给总结模型的内容不完整（被截断）
3. 在所有模型回答完成前就开始总结

## 已实施的修复

### 1. 增强的日志记录
在以下文件中添加了详细的控制台日志：

#### `src/sidepanel/sidepanel.js`
- `startResponseMonitoring()`: 监控所有模型响应状态
  - 显示哪些模型已完成
  - 显示哪些模型仍在等待
  - 显示成功响应数量
  - 显示自动总结是否启用
  
- `performSummarization()`: 执行总结
  - 显示 `lastResponses` 的内容
  - 显示原始问题
  - 显示完整提示词的长度和内容片段
  - 显示每个响应的长度
  - 显示发送状态

#### `src/background.js`
- `handleSummarizeResponses()`: 处理总结请求
  - 显示接收到的提示词长度
  - 显示提示词的开头和结尾
  - 显示标签页创建和消息发送状态

#### `src/content/content.js`
- `handleFillAndSend()`: 填充和发送消息
  - 显示接收到的文本长度
  - 显示文本的开头部分

### 2. 修复的完成检测逻辑
在 `startResponseMonitoring()` 中：
- 只计算实际完成的响应（`status === 'ok'` 或真实的 `error`）
- 不计算 `not_open` 状态为已完成
- 添加待处理提供商列表显示

### 3. 改进的状态跟踪
- 添加表情符号标记关键日志点：
  - ✅ 成功状态
  - ❌ 错误状态
  - 🚀 开始操作
  - 📝 函数调用
  - 📊 数据统计
  - 📤 发送消息
  - 📥 接收消息
  - ⏸️ 跳过操作
  - ⚠️ 警告

## 调试步骤

### 第一步：打开开发者工具
1. 在 AI Multiverse 窗口中按 `F12` 或右键点击 → 检查
2. 切换到 Console 标签页
3. 清空控制台（点击 🚫 图标）

### 第二步：发送测试消息
1. 选择 2-3 个 AI 模型（建议选择响应快的模型）
2. 输入一个简单的问题，例如："什么是人工智能？"
3. 点击发送

### 第三步：观察控制台日志

#### 预期的日志流程：

```
[AI Multiverse] Starting response monitoring for providers: [...]
[AI Multiverse] Auto-summarize enabled: true
[AI Multiverse] Is summarizing: false

[AI Multiverse] Monitoring check 1/120
[AI Multiverse] gemini: still waiting (status: not_open)
[AI Multiverse] chatgpt: still waiting (status: not_open)
[AI Multiverse] Progress: 0/2 completed, 0 successful
[AI Multiverse] Still waiting for: gemini, chatgpt

[AI Multiverse] Monitoring check 2/120
[AI Multiverse] gemini: completed (1234 chars)
[AI Multiverse] chatgpt: still waiting (status: not_open)
[AI Multiverse] Progress: 1/2 completed, 1 successful
[AI Multiverse] Still waiting for: chatgpt

[AI Multiverse] Monitoring check 5/120
[AI Multiverse] gemini: completed (1234 chars)
[AI Multiverse] chatgpt: completed (2345 chars)
[AI Multiverse] Progress: 2/2 completed, 2 successful

[AI Multiverse] ✅ All responses received!
[AI Multiverse] Successful responses: 2
[AI Multiverse] Auto-summarize enabled: true
[AI Multiverse] Is summarizing: false
[AI Multiverse] Stored responses in lastResponses: gemini, chatgpt
[AI Multiverse] 🚀 Starting summarization with 2 successful responses

[AI Multiverse] 📝 performSummarization() called
[AI Multiverse] isSummarizing: false
[AI Multiverse] lastResponses keys: gemini, chatgpt
[AI Multiverse] lastQuestion: 什么是人工智能？
[AI Multiverse] Successful responses count: 2
[AI Multiverse] Original question length: 8
[AI Multiverse] ✅ Set isSummarizing = true
[AI Multiverse] Added loading message: summary-loading-xxxxx

[AI Multiverse] 📊 Full prompt constructed:
  - Prompt template length: 234
  - Question length: 45
  - Responses text length: 3579
  - Total prompt length: 3858
  - First 300 chars: [显示提示词开头]
  - Last 300 chars: [显示提示词结尾]
  - Responses included: gemini, chatgpt

[AI Multiverse] Using summary model: gemini Gemini
[AI Multiverse] 📤 Sending summarize_responses message to background...

[AI Multiverse Background] handleSummarizeResponses called
[AI Multiverse Background] Provider: gemini
[AI Multiverse Background] Prompt length: 3858
[AI Multiverse Background] Prompt first 300 chars: [...]
[AI Multiverse Background] Prompt last 300 chars: [...]
[AI Multiverse Background] Found existing tab: 123
[AI Multiverse Background] Content script ensured
[AI Multiverse Background] Sending fill_and_send message to tab 123
[AI Multiverse Background] Message sent successfully

[AI Multiverse Content] handleFillAndSend called
[AI Multiverse Content] Provider: gemini
[AI Multiverse Content] Text length: 3858
[AI Multiverse Content] Text first 300 chars: [...]

[AI Multiverse] 📥 Summarize send result: {status: 'ok'}
[AI Multiverse] Starting to poll for summary result...
[AI Multiverse] Poll attempt 1/60
[AI Multiverse] Summary data status: not_open text length: 0
[AI Multiverse] Poll attempt 2/60
[AI Multiverse] Summary data status: ok text length: 567
[AI Multiverse] ✅ Summary received successfully! Length: 567
```

### 第四步：检查问题

#### 问题 A：总结没有触发
查找以下日志：
- `Auto-summarize enabled: false` → 自动总结被禁用
- `Is summarizing: true` → 已经在总结中
- `No successful responses` → 没有成功的响应
- 没有看到 `🚀 Starting summarization` → 检查完成检测逻辑

#### 问题 B：提示词被截断
查找以下日志：
- 比较 `sidepanel.js` 中的 `Total prompt length` 
- 和 `background.js` 中的 `Prompt length`
- 和 `content.js` 中的 `Text length`
- 如果长度不一致，说明在传输过程中被截断

检查：
1. Chrome 消息大小限制（通常是 64MB，但实际可能更小）
2. 是否有特殊字符导致编码问题
3. 是否有中间件修改了消息

#### 问题 C：过早触发总结
查找以下日志：
- `Still waiting for: [...]` → 应该显示仍在等待的模型
- `Progress: X/Y completed` → X 应该等于 Y 才触发总结
- 如果看到 `not_open` 被计入 `completed`，说明逻辑有问题

### 第五步：报告问题
如果发现问题，请提供：
1. 完整的控制台日志（从发送消息到总结完成）
2. 选择的模型列表
3. 发送的问题内容
4. 观察到的异常行为

## Chrome 消息大小限制

Chrome Extension 的消息传递有以下限制：
- `chrome.runtime.sendMessage`: 理论上限 64MB
- `chrome.tabs.sendMessage`: 理论上限 64MB
- 实际限制可能更小，取决于：
  - 消息序列化后的大小
  - JSON 编码开销
  - 浏览器内存限制

### 如果遇到大小限制
可能的解决方案：
1. 分块发送（将大提示词分成多个部分）
2. 使用 `chrome.storage` 临时存储
3. 压缩内容
4. 限制每个响应的最大长度

## 测试场景

### 场景 1：正常流程
- 选择 2 个模型
- 发送简单问题
- 等待所有响应完成
- 验证总结触发

### 场景 2：部分失败
- 选择 3 个模型
- 其中 1 个未打开
- 验证只用成功的响应进行总结

### 场景 3：长响应
- 选择 2 个模型
- 发送复杂问题（需要长回答）
- 验证完整内容被发送到总结模型

### 场景 4：快速连续发送
- 发送第一个问题
- 在总结完成前发送第二个问题
- 验证不会混淆两次总结

## 下一步优化

如果调试发现特定问题，可以考虑：
1. 添加消息大小检查和警告
2. 实现提示词压缩或摘要
3. 添加用户可配置的响应长度限制
4. 实现更智能的错误恢复机制
5. 添加总结进度指示器
