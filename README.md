# AI Multiverse Chat - Chrome Extension

This is a lightweight Chrome extension that allows you to broadcast messages to multiple AI chatbots simultaneously.

## Supported Platforms
- **Gemini** (gemini.google.com)
- **Grok** (grok.x.ai)
- **Kimi** (kimi.moonshot.cn)
- **DeepSeek** (chat.deepseek.com)

## Project Structure
The extension is built with vanilla JavaScript, HTML, and CSS. No build tools (like Webpack or React) are required, which keeps the project simple and the file count low.

- `manifest.json`: The configuration file that tells Chrome how to load the extension.
- `src/popup/`: Contains the user interface you see when clicking the extension icon.
- `src/background.js`: Runs in the background to coordinate opening tabs and sending messages.
- `src/content/content.js`: The script that runs *inside* the AI web pages to type and send your message.

## Installation Instructions

1.  **Open Chrome Extensions Page**
    - Open Google Chrome.
    - In the address bar, type `chrome://extensions` and press Enter.

2.  **Enable Developer Mode**
    - Look for the **"Developer mode"** toggle in the top-right corner of the page and turn it **ON**.

3.  **Load the Extension**
    - Click the **"Load unpacked"** button that appears in the top-left area.
    - In the file selection dialog, navigate to and select this folder:
      `/home/babyfengfjx/Documents/AI-all-IN-one`
    - Click **Select** (or **Open**).

4.  **Pin the Extension**
    - Click the "Puzzle Piece" icon in the Chrome toolbar.
    - Find "AI Multiverse Chat" and click the "Pin" icon to keep it visible.

## How to Use

1.  Click the extension icon.
2.  Select which AIs you want to send the message to via the checkboxes.
3.  Type your query in the text box.
4.  Click **"Send to All"**.
5.  The extension will:
    - Check if you have the AI's tab open. 
    - If not, it will open a new tab for you.
    - It will note the status in the popup log.
    - **Note**: You must be logged into the respective AI services for this to work.
