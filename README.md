# AI Multiverse Chat | AI 多重宇宙对话

> **One Chat, Infinite Answers.** A powerful, lightweight Chrome extension to broadcast your queries across all major AI platforms simultaneously.
> 
> **一次提问，多维作答。** 一个强大且轻量的 Chrome 扩展程序，可将您的提问同步广播到所有主流 AI 平台。

[English] | [中文](#中文)

---

## English

AI Multiverse Chat (v2.0) transforms your browser into a unified command center for artificial intelligence. Stop switching tabs—start comparing the world's best models in one seamless interface.

### ✨ Key Features (v2.0)
- **🚀 Broadcast Engine**: Send prompts to Gemini, ChatGPT, DeepSeek, Qwen (通义千问), Kimi, Grok, and Yuanbao (腾讯元宝) at once.
- **🪄 Smart Summary**: Tired of reading 7 different long answers? Use the "✨ Summarize" feature to distill all responses into a single, cohesive action plan or takeaway.
- **💎 Premium UX**: Modern glassmorphic design, smooth animations, and a sidebar that feels like a native OS application.
- **📐 Resizable Detail View**: Deep-dive into specific answers with an expandable detail modal that **remembers your preferred width** across sessions.
- **⚡ High-Speed Detection**: New "Zero-Latency" status engine detects AI completion by tracking UI button states—no more waiting for arbitrary timers.
- **📂 Multi-Modal Support**: Seamlessly attach images and documents to your prompts (supported for Gemini, Grok, Kimi, etc.).
- **🧩 Smart Navigation**: Floating "Jump to Summary" (✨) button appears dynamically to help you navigate long conversation threads.

### 🛠️ Supported Platforms
- **OpenAI**: ChatGPT
- **Google**: Gemini
- **DeepSeek**: DeepSeek Chat
- **Anthropic-alternative**: Grok (X.AI)
- **Local Powerhouses**: Kimi, Qwen (通义千问), Yuanbao (腾讯元宝)

### 📂 Project Architecture
Built with **Pure Vanilla JS, HTML5, and CSS3**. Clean, fast, and secure.
- `src/sidepanel/`: Core chat interface (v2.0 modern UI).
- `src/content/`: Intelligent automation bridge for AI websites.
- `src/config.js`: Centralized selector and pattern management.
- `src/background.js`: Cross-tab synchronization orchestrator.

### 🏗️ Installation (Developer Mode)
1. **Download**: Clone or download this repository to your computer.
2. **Open Extensions**: Go to `chrome://extensions` in your browser.
3. **Developer Mode**: Toggle **ON** the "Developer mode" in the top-right corner.
4. **Load**: Click **"Load unpacked"** and select the extension folder you just downloaded.
5. **Pin**: Click the Puzzle icon in your toolbar and Pin **AI Multiverse Chat** for easy access.

### 📖 Usage
1. Open the **AI Multiverse** sidebar from your extensions toolbar.
2. Select your target AI providers using the model selector.
3. Type your query (and attach files if needed).
4. Hit **Enter** or click **Send**.
5. Click the ✨ icon to generate a cross-model synthesis of the answers.

---

## 中文

AI 多重宇宙对话 (v2.0) 将您的浏览器转变为统一的 AI 指挥中心。无需在不同标签页间反复横跳——在一个无缝界面中同步对比全球顶尖模型的回答。

### ✨ 核心功能 (v2.0)
- **🚀 同步广播**: 一键向 Gemini, ChatGPT, DeepSeek, 通义千问, Kimi, Grok 和 腾讯元宝发送指令。
- **🪄 智能总结**: 讨厌阅读多个冗长的回答？使用 “✨ 总结” 功能，将所有平台的回答浓缩成一份精准的行动指南。
- **💎 极致体验**: 现代毛玻璃效果、流畅动画，侧边栏交互感如原生系统应用般顺滑。
- **📐 可调宽度查看器**: 详情模态框支持手动调整宽度，并能 **自动记住您的布局偏好**，下次打开依然贴合心意。
- **⚡ 零延迟检测**: 全新的 UI 状态追踪引擎，通过识别 AI 平台的提交按钮状态实时感知输出完成，无需尴尬等待。
- **📂 多模态支持**: 支持为您的提问附加图片和各类文档（适用于 Gemini, Grok, Kimi 等）。
- **🧩 智能导航**: 当展开长对话时，右下角会自动悬浮 “✨ 直达总结” 按钮，快速定位核心结论。

### 🛠️ 支持平台
- **国际主流**: ChatGPT, Gemini, Grok
- **国产之光**: DeepSeek, Kimi, 通义千问, 腾讯元宝

### 📂 项目架构
基于 **纯原生 JS, HTML5 和 CSS3** 构建。纯净、快速、安全。
- `src/sidepanel/`: 核心聊天界面 (v2.0 现代 UI)。
- `src/content/`: 针对各 AI 站点的智能化自动化桥梁。
- `src/config.js`: 集中化的选择器与模式管理配置。
- `src/background.js`: 负责跨标签页同步的核心调度。

### 🏗️ 安装说明 (开发者模式)
1. **下载**: 将代码仓库下载或克隆到您的电脑本地。
2. **扩展管理**: 在 Chrome 地址栏输入 `chrome://extensions` 并回车。
3. **开发者模式**: 确保右上角的“开发者模式”开关已 **开启**。
4. **加载**: 点击 **“加载已解压的扩展程序”**，选择您刚才下载的项目文件夹。
5. **固定**: 点击浏览器工具栏的“拼图”图标，将 **AI Multiverse Chat** 固定。

### 📖 使用方法
1. 从工具栏点击图标开启 **AI Multiverse** 侧边栏。
2. 在模型选择器中勾选您想要对话的 AI 平台。
3. 输入您的问题（如需上传附件请点击附件图标）。
4. 按 **Enter** 或点击 **发送**。
5. 等待回答完成后，点击 ✨ 图标生成多模型的综合总结。

---

**License**: MIT
**Privacy**: This extension works purely locally in your browser and does not collect any user data. 所有数据均存储在您的本地浏览器中，不经过任何第三方服务器。
