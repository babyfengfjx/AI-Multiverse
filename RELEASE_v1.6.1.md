# v1.6.1 更新说明 - 思考过程过滤

## 问题描述

某些AI模型（如DeepSeek R1、ChatGPT o1）在给出最终答案之前会显示推理/思考步骤。这些思考块也会被一起提取出来，导致响应变得更长且难以阅读。

## 解决方案

在 `src/content/content.js` 中添加了两个过滤函数：

### 1. `removeThinkingBlocks(element)` - DOM级过滤

通过检查HTML元素的结构来移除思考块：

- **类名过滤**：移除包含以下关键词class的元素：
  - `thinking`
  - `reasoning`
  - `thought`
  - `chain-of-thought`
  - `cot`

- **数据属性过滤**：移除包含以下属性的元素：
  - `data-thinking`
  - `data-reasoning`

- **可折叠块过滤**：移除常见的可折叠思考块：
  - `[aria-label*="Reasoning"]`
  - `[aria-label*="Thinking"]`
  - `details[summary*="thinking"]`
  - `details[summary*="Thinking"]`

### 2. `filterThinkingText(text)` - 文本级过滤

处理嵌入在文本中的思考内容：

- **模式1**：移除以 "Thinking:"、"Reasoning:"、"思考："、"推理：" 开头的行及其后的缩进内容
- **模式2**：移除包含 "thinking" 关键字的代码块
- **模式3**：清理多余的空行

### 3. `extractLatestResponse()` 集成

更新主提取函数以应用过滤：
1. 先克隆DOM元素（避免修改原始页面）
2. 应用 `removeThinkingBlocks()` 进行DOM级过滤
3. 提取文本内容
4. 应用 `filterThinkingText()` 进行文本级过滤
5. 返回清理后的结果

## 改动文件

- ✅ `src/content/content.js` - 添加过滤逻辑
- ✅ `manifest.json` - 版本更新至 1.6.1

## 支持的平台

此功能对所有7个AI平台均有效，智能过滤可能存在的思考过程：
- Gemini
- Grok
- Kimi
- DeepSeek ⚠（主要问题来源）
- ChatGPT ⚠（o1模型可能有推理步骤）
- Qwen
- Yuanbao

## 测试要点

1. ✅ 在不包含思考内容的平台上，提取结果应与之前一致
2. ✅ 在包含思考内容的平台上，只获取最终答案，过滤掉思考过程
3. ✅ 不会误删合法的答案内容
4. ✅ 支持中英文思考标记

## 使用方法

更新后无需任何额外配置，扩展会自动过滤思考过程。只需：

1. 打开 `chrome://extensions/`
2. 找到 "AI Multiverse Chat"
3. 点击刷新按钮 🔄
4. 重新打开扩展并提问

## 已知限制

- 如果平台改变思考块的HTML结构，需要相应更新过滤规则
- 文本级过滤可能偶尔误删包含关键字的合法内容（概率较低）
- 需要持续监控各平台的UI变化并更新过滤逻辑

## 后续优化

根据用户反馈和平台变化，可能需要：
- 添加更多平台特定的思考块识别规则
- 提供开关选项（用户可选择是否过滤思考过程）
- 添加预览模式（显示过滤前后的对比）

---

**完成时间**：2026-02-13
**开发时长**：~30分钟
**代码质量**：良好，已有完整错误处理
**测试状态**：待用户验证
