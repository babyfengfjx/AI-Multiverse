# AI Multiverse Chat - Chrome Extension | AI 多重宇宙对话 - Chrome 浏览器扩展

[English] | [中文](#中文)

---

## English

This is a lightweight Chrome extension that allows you to broadcast messages to multiple AI chatbots simultaneously.

### 🚀 Supported Platforms
- **Gemini** (gemini.google.com)
- **Grok** (grok.com)
- **Kimi** (kimi.moonshot.cn)
- **DeepSeek** (chat.deepseek.com)
- **ChatGPT** (chatgpt.com)
- **Qwen (通义千问)** (chat.qwen.ai)
- **Yuanbao (腾讯元宝)** (yuanbao.tencent.com)

### 📂 Project Structure
The extension is built with vanilla JavaScript, HTML, and CSS. No build tools (like Webpack or React) are required, keeping the project simple and lightweight.

- `manifest.json`: Configuration file for the Chrome extension.
- `src/popup/`: User interface for the extension popup.
- `src/sidepanel/`: Side panel interface for persistent chat management.
- `src/background.js`: Background process coordinating tab management and messaging.
- `src/content/content.js`: Script running inside AI web pages to automate input and submission.
- `src/config.js`: Centralized configuration for all supported AI platforms.

### 🛠️ Installation Instructions

1.  **Open Chrome Extensions Page**
    - Open Google Chrome.
    - Type `chrome://extensions` in the address bar and press Enter.

2.  **Enable Developer Mode**
    - Turn **ON** the **"Developer mode"** toggle in the top-right corner.

3.  **Load the Extension**
    - Click **"Load unpacked"**.
    - Navigate to and select the folder where you downloaded and extracted this extension.
    - Click **Select**.

4.  **Pin the Extension**
    - Click the "Puzzle Piece" icon in the Chrome toolbar.
    - Find "AI Multiverse Chat" and click the "Pin" icon.

### 📖 How to Use

1.  Click the extension icon or open the side panel.
2.  Check the AI models you want to send your message to.
3.  Type your query in the text box.
4.  Click **"Send to All"**.
5.  **Note**: You must be logged into the respective AI services for this to work.

---

## 中文

这是一个轻量级的 Chrome 浏览器扩展，允许您同时向多个 AI 聊天机器人同步发送消息。

### 🚀 支持的平台
- **Gemini** (gemini.google.com)
- **Grok** (grok.com)
- **Kimi** (kimi.moonshot.cn)
- **DeepSeek** (chat.deepseek.com)
- **ChatGPT** (chatgpt.com)
- **通义千问 (Qwen)** (chat.qwen.ai)
- **腾讯元宝 (Yuanbao)** (yuanbao.tencent.com)

### 📂 项目结构
该扩展使用原生 JavaScript、HTML 和 CSS 构建。无需构建工具（如 Webpack 或 React），保持了项目的简单和轻量。

- `manifest.json`: 扩展程序的配置文件。
- `src/popup/`: 弹出窗口界面。
- `src/sidepanel/`: 侧边栏界面，提供更持久的对话管理。
- `src/background.js`: 后台进程，负责协调标签页管理和消息传递。
- `src/content/content.js`: 内容脚本，在 AI 网页内运行以实现自动输入和发送。
- `src/config.js`: 所有支持的 AI 平台的统一配置文件。

### 🛠️ 安装步骤

1.  **打开 Chrome 扩展程序页面**
    - 打开 Google Chrome 浏览器。
    - 在地址栏输入 `chrome://extensions` 并回车。

2.  **启用开发者模式**
    - 打开右上角的 **“开发者模式”** 开关。

3.  **加载扩展程序**
    - 点击左上角的 **"加载已解压的扩展程序"**。
    - 导航到并选择您下载并解压此扩展程序的文件夹。
    - 点击 **选择**。

4.  **固定扩展程序**
    - 点击 Chrome 工具栏中的“拼图”图标。
    - 找到“AI Multiverse Chat”并点击“固定”图标。

### 📖 使用方法

1.  点击扩展图标或打开侧边栏。
2.  勾选您想要发送消息的 AI 模型。
3.  在文本框中输入您的提问。
4.  点击 **“Send to All”**。
5.  **注意**：您需要先登录相应的 AI 服务才能正常使用。

