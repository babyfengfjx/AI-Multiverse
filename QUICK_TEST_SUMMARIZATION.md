# 智能总结功能快速测试清单

## 测试前准备
1. ✅ 重新加载扩展（chrome://extensions/ → 点击刷新图标）
2. ✅ 打开 AI Multiverse 窗口
3. ✅ 按 F12 打开开发者工具
4. ✅ 切换到 Console 标签页
5. ✅ 清空控制台（点击 🚫 图标）

## 测试步骤

### 测试 1：基本功能测试
1. 选择 2 个 AI 模型（建议：Gemini + ChatGPT）
2. 输入问题："什么是人工智能？"
3. 点击发送
4. 观察控制台日志

**预期结果：**
- ✅ 看到 `💾 Saved question for summarization`
- ✅ 看到 `🎬 Starting response monitoring`
- ✅ 看到 `Starting response monitoring for providers`
- ✅ 看到 `Auto-summarize enabled: true`
- ✅ 看到监控循环日志（每秒一次）
- ✅ 看到每个模型的状态更新
- ✅ 看到 `✅ All responses received!`
- ✅ 看到 `🚀 Starting summarization`
- ✅ 看到 `📝 performSummarization() called`
- ✅ 看到 `📊 Full prompt constructed`
- ✅ 看到提示词长度信息
- ✅ 看到 `📤 Sending summarize_responses message`
- ✅ 看到后台日志 `[AI Multiverse Background] handleSummarizeResponses called`
- ✅ 看到内容脚本日志 `[AI Multiverse Content] handleFillAndSend called`
- ✅ 看到轮询日志 `Poll attempt X/60`
- ✅ 看到 `✅ Summary received successfully!`
- ✅ 在对话历史中看到总结结果（右侧，绿色背景）

### 测试 2：检查提示词完整性
在控制台中查找以下三行日志，比较长度是否一致：

```
[AI Multiverse] Total prompt length: XXXX
[AI Multiverse Background] Prompt length: XXXX
[AI Multiverse Content] Text length: XXXX
```

**预期结果：**
- ✅ 三个长度值应该完全相同
- ✅ 前 300 字符应该相同
- ✅ 后 300 字符应该相同（在 sidepanel 和 background 日志中）

### 测试 3：验证完成检测
在监控日志中查找：

```
[AI Multiverse] Progress: X/Y completed, Z successful
[AI Multiverse] Still waiting for: [...]
```

**预期结果：**
- ✅ 初始时 `X = 0`，`Still waiting for` 列出所有模型
- ✅ 随着响应到达，`X` 逐渐增加
- ✅ `Still waiting for` 列表逐渐减少
- ✅ 当 `X = Y` 时，才看到 `✅ All responses received!`
- ✅ 不应该看到 `not_open` 被计入 `completed`

### 测试 4：部分失败场景
1. 选择 3 个 AI 模型
2. 确保其中 1 个模型的窗口未打开
3. 输入问题并发送
4. 观察日志

**预期结果：**
- ✅ 未打开的模型显示 `still waiting (status: not_open)`
- ✅ 该模型不会被计入 `completed`
- ✅ 监控会持续到超时（120 秒）或其他模型完成
- ✅ 如果有成功响应，仍会触发总结（只用成功的响应）

## 常见问题排查

### 问题：总结没有触发

**检查清单：**
1. 查找 `Auto-summarize enabled: false`
   - 如果是 false，检查设置
   
2. 查找 `Is summarizing: true`
   - 如果是 true，说明已经在总结中
   
3. 查找 `No successful responses`
   - 检查是否所有模型都失败了
   
4. 查找 `Still waiting for: [...]`
   - 如果列表不为空，说明还在等待某些模型

### 问题：提示词被截断

**检查清单：**
1. 比较三个层级的长度值
2. 如果长度不一致：
   - 检查是否超过 Chrome 消息大小限制
   - 检查是否有特殊字符导致编码问题
   - 查看完整的错误日志

### 问题：过早触发总结

**检查清单：**
1. 查找 `Progress: X/Y completed`
   - X 应该等于 Y 才触发总结
   
2. 查找 `Still waiting for: [...]`
   - 应该为空才触发总结
   
3. 检查是否有 `not_open` 被错误计入 `completed`

## 成功标志

如果看到以下日志序列，说明功能正常：

```
✅ 保存问题
🎬 启动监控
📊 监控进度更新
✅ 所有响应接收完成
🚀 开始总结
📝 调用总结函数
📊 构建完整提示词
📤 发送到后台
📥 后台接收
📤 发送到内容脚本
📥 内容脚本接收
🔄 轮询总结结果
✅ 总结接收成功
```

## 报告问题

如果发现问题，请提供：
1. 完整的控制台日志（复制所有 `[AI Multiverse]` 开头的日志）
2. 选择的模型列表
3. 发送的问题内容
4. 观察到的异常行为
5. 浏览器版本和操作系统

## 下一步

测试通过后，可以：
1. 测试更复杂的场景（长问题、多模型、快速连续发送）
2. 测试不同的总结模型
3. 测试自定义总结提示词
4. 测试窗口宽度调整功能
5. 测试 Markdown 渲染功能
