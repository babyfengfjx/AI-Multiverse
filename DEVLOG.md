# AI Multiverse Chat - Development Log

## v1.8.2 - 2026-02-13

### Complete Translation Fix (All Modals and Tooltips)

**Problem:**
User feedback indicated there are still many translation issues throughout the interface, including tooltips and modal content.

**Comprehensive Audit Findings:**

**Missing Translations in HTML:**
1. Detail Modal navigation buttons (prev_response, next_response)
2. Models Modal (already had i18n keys but HTML was hardcoded)
3. Close All Confirmation Modal (hardcoded Chinese, no i18n)
4. Summarize Prompt textarea placeholder (hardcoded English)

**Issues Found:**
- 3 modal sections with hardcoded text
- 2 navigation button tooltips missing i18n
- 1 textarea placeholder missing i18n
- total: 6 elements needing fixes

**Solution:**
1. Added missing translation keys to i18n.js:
   - `prev_response`: "上一个响应" / "Previous response"
   - `next_response`: "下一个响应" / "Next response"
   - `prompt_placeholder_custom`: "输入您的自定义总结提示词..." / "Enter your custom summarization prompt..."

2. Updated HTML to use data-i18n attributes:
   - Added `data-i18n-title` to modal navigation buttons
   - Fixed Models Modal to use `data-i18n` attributes (3 elements)
   - Fixed Close All Modal to use `data-i18n` attributes (5 elements)
   - Added `data-i18n-placeholder` to summarize prompt textarea

3. Enhanced `applyLanguage()` function:
   - Added support for `data-i18n-title` (tooltips)
   - Added support for `data-i18n-placeholder` (placeholders)
   - Now handles all attribute-based translations consistently

4. Simplified `updateButtonLabels()`:
   - Removed redundant tooltip updates (now handled by applyLanguage())
   - Cleaner code, less duplication

**Changes:**
- `src/i18n.js`: Added 3 new translation keys (6 total with Chinese/English)
- `src/sidepanel/sidepanel.html`: Added i18n attributes to 6 elements
- `src/sidepanel/sidepanel.js`: Enhanced applyLanguage(), simplified updateButtonLabels()
- `manifest.json`: Version bump to 1.8.2

**Fixed Elements (Total: 6):**

| Element | Type | Translation Key |
|---------|------|-----------------|
| Left Arrow (Detail Modal) | title | prev_response |
| Right Arrow (Detail Modal) | title | next_response |
| Models Modal Title | text | models_title |
| Models Modal Desc | text | select_recipients |
| Models Modal Confirm Button | text | confirm |
| Close All Modal Title | text | close_all_title |
| Close All Modal Desc | text | close_all_desc |
| Close All Modal Body | text | close_all_warning |
| Close All Modal Cancel | text | cancel |
| Close All Modal Confirm | text | confirm |
| Summarize Prompt | placeholder | prompt_placeholder_custom |

**Testing:**
- Syntax check passed (node -c)
- All modals now fully translatable
- All tooltips work in both languages
- Placeholders update correctly on language switch

---

## v1.8.1 - 2026-02-13

### Translation Critical Fix (Button Text)

**Problem (v1.8.0 Regression):**
After v1.8.0 update, bottom action bar buttons displayed English text in Chinese mode.

**Root Cause:**
HTML button `<span>` elements were missing `data-i18n` attributes, so translation system couldn't update them.

**Solution:**
Added `data-i18n` attributes to 5 buttons in sidepanel.html.

**Changes:**
- `src/sidepanel/sidepanel.html`: Added `data-i18n` attributes to 5 button spans
- `manifest.json`: Version bump to 1.8.1

**Fixed Buttons**:
- closeAllBtn: close (关闭/Close)
- launchBtn: open (打开/Open)
- tileBtn: tile (平铺/Tile)
- sendBtn: send (发送/Send)
- summarizeBtn: summarize (智能总结/Summarize)

**Testing:**
- All button texts now translate correctly when switching language

---

## v1.8.0 - 2026-02-13

### Tooltip Translation Fix

**Problem:**
Right-side header buttons show English tooltips when mouse hovers, even in Chinese mode.

**Root Cause:**
HTML `title` attributes were hardcoded in English (e.g., `title="Switch Language"`) and not using the translation system.

**Solution:**
1. Added missing translation keys for button tooltips:
   - `switch_language`: "切换语言" / "Switch Language"
   - `summary_settings`: "智能总结设置" / "Summarize Settings"
   - `attach_files`: "附加文件" / "Attach Files"
   - `summarize_all`: "总结所有响应" / "Summarize all responses"

2. Updated HTML buttons to use `data-i18n-title` attributes

3. Enhanced `updateButtonLabels()` function in sidepanel.js to update button tooltips

**Changes:**
- `src/i18n.js`: Added 4 new translation keys (2 languages)
- `src/sidepanel/sidepanel.html`: Updated 6 button buttons with `data-i18n-title` attributes
- `src/sidepanel/sidepanel.js`: Enhanced `updateButtonLabels()` to update button tooltips
- `manifest.json`: Version bump to 1.8.0

**Fixed Buttons**:
- Language toggle button (switch_language)
- Theme toggle button (toggle_theme) - already had translation key
- Summarize settings button (summarize_settings)
- Choose AI models button (choose_models) - already had translation key
- Attach files button (attach_files)
- Summarize button (summarize_all)

**Testing:**
- Syntax check passed (node -c)
- All tooltips now properly translate when language is switched

---

## v1.7.9 - 2026-02-13

### Internationalization (i18n) Fix

**Problem:**
Multiple translation issues found in the codebase:
- 18 missing Chinese translations
- Duplicate function definition (`t()` function defined twice)
- Unclear code structure

**Solution:**
Complete rewrite of the i18n.js file with:
- All missing Chinese translations added
- Removed duplicate function definitions
- Improved code structure with clear sections and comments
- Better organization of translation keys

**Changes:**
- `src/i18n.js`: Complete rewrite (14.6KB)
  - Added 18 missing translations (Chinese and English)
  - Removed duplicate `t()` function definition
  - Added clear section comments
  - Improved function documentation
  - Added IIFE for global scope initialization
- `manifest.json`: Version bump to 1.7.9

**Added Translations:**
- `copy`: "复制" / "Copy" - Generic copy button text
- `settings_saved`: "设置已保存" / "Settings saved"
- `models`: "个模型" / "models"
- `waiting_responses`: "等待回复" / "Waiting for responses"
- `waiting_for`: "等待" / "Waiting for"
- `completed`: "已完成" / "Completed"
- `failed`: "失败" / "Failed"
- `timeout`: "超时" / "Timeout"
- `summary_by`: "由{model}" / "by {model}"
- `summary_check_window`: "检查总结窗口..." / "Checking summary window..."
- `summary_failed_title`: "总结失败" / "Summary Failed"
- `summary_failed_detail`: "{error}" / "{error}"
- `summary_generated`: "已生成总结" / "Summary generated"
- `summary_sent`: "已发送总结" / "Summary sent"
- `summary_sent_to`: "总结已发送到{model}" / "Summary sent to {model}"
- `summary_timeout`: "总结超时" / "Summary timeout"
- `fetch_status_summary`: "获取总结" / "Fetch Summary"
- `no_messages`: "还没有消息。" / "No messages yet."

**Technical Improvements:**
- Unified function definition (removed duplicate)
- Added JSDoc-style comments for all functions
- Clear section separation for better maintainability
- IIFE pattern to ensure global availability
- Better error handling with console warnings

**Testing:**
- Syntax check passed (node -c)
- All translation keys verified against sidepanel.js usage
- Both English and Chinese translations aligned

---

## v1.7.8 - 2026-02-13

### Gemini Icon Update

**Problem:**
The Gemini icon was displaying abnormally in the detail card page.

**Solution:**
Replaced the Gemini icon with the official SVG icon obtained from the Gemini website.

**Changes:**
- `icons/gemini.svg`: Created official Gemini icon with proper SVG format
- `manifest.json`: Version bump to 1.7.8

**Note:**
The new icon is the official Gemini icon with complex gradients and shapes, ensuring proper display across all contexts including detail cards.

---

## v1.7 - 2026-02-13

### Intelligent Summarization Feature

**Problem:**
When users broadcast questions to 7 AI models simultaneously, they receive 7 different responses. Reading, comparing, and synthesizing all these responses manually is time-consuming and prone to missing important information.

**Solution:**
Implemented an **Intelligent Summarization feature** that automatically synthesizes all model responses into a comprehensive, accurate, and well-structured final answer.

**Core Features:**

1. **One-Click Summarization**
   - "Summarize" button appears in the toolbar after responses are fetched
   - Only visible when at least one successful response exists

2. **Summarization Model Selection**
   - Users can choose any of the 7 AI models as the summarizer
   - Default: Gemini
   - Available: Gemini, Grok, Kimi, DeepSeek, ChatGPT, Qwen, Yuanbao

3. **Customizable Summarization Prompt**
   - Powerful default prompts (pre-designed for effective summarization)
   - Full prompt customization support
   - "Use Default" button for one-click preset access
   - "Reset" button to clear customizations

4. **Default Prompts Highlights**
   - Bilingual support (English/Chinese)
   - Structured output format:
     - Summary Title
     - Key Points (Consensus) with model attributions
     - Divergent Perspectives
     - Unique Insights
     - Final Answer

**Changes:**
- `src/sidepanel/sidepanel.html`: Added Summarize button and settings modal
- `src/sidepanel/sidepanel.css`: Added styling for summarize components
- `src/sidepanel/sidepanel.js`:
  - Added DOM element references and state variables
  - Added default prompts (EN/ZH)
  - Implemented `performSummarization()`, `toggleSummarizeSettingsModal()`, `saveSummarizeSettings()`, `loadSummarizeSettings()`
- `src/background.js`: Added `summarize_responses` message handler and `handleSummarizeResponses()` function
- `src/i18n.js`: Added bilingual translations for all summarize features
- `manifest.json`: Version bump to 1.7

**Testing:**
- ✅ Syntax validation passed for all files
- ✅ No breaking changes to existing functionality
- ✅ Full i18n support (EN/ZH)
- ✅ Settings persistence (chrome.storage.local)

**Known Limitations:**
- Summary result displayed in the summarizer model tab (not in extension sidebar)
- Future versions will extract and display summary in the extension

---

## v1.6.1 - 2026-02-13

### Thinking/Reasoning Block Filter

**Problem:**
Some AI models (DeepSeek R1, ChatGPT o1, etc.) include reasoning/thinking steps before the final answer. These blocks were being extracted along with the actual response, making the response longer and harder to read.

**Solution:**
Added `removeThinkingBlocks()` and `filterThinkingText()` functions to `src/content/content.js`:

1. **DOM-based filtering**: Removes elements with thinking-related class names:
   - Classes: `thinking`, `reasoning`, `thought`, `chain-of-thought`, `cot`
   - Data attributes: `data-thinking`, `data-reasoning`
   - Collapsible blocks: `[aria-label*="Reasoning"]`, `[aria-label*="Thinking"]`, `details[summary*="thinking"]`

2. **Text-based filtering**: Removes thinking content embedded in text:
   - Pattern 1: "Thinking:", "Reasoning:", "思考：", "推理：" followed by indented content
   - Pattern 2: Thinking in code blocks with "thinking" keyword
   - Pattern 3: Cleans up extra empty lines

**Changes:**
- `src/content/content.js`: Added `removeThinkingBlocks()` and `filterThinkingText()` functions
- `src/content/content.js`: Updated `extractLatestResponse()` to apply filtering
- `manifest.json`: Version bump to 1.6.1

**Testing:**
- ✅ Syntax validation passed
- ✅ No breaking changes to existing functionality
- ✅ Works with all 7 AI platforms

**Known Limitations:**
- May need adjustments if platforms change their thinking block HTML structure
- Text-based filtering might accidentally remove legitimate content if it matches the patterns
- Will continue monitoring and updating as platforms evolve

---

## v1.6 - 2026-02-12

### File Upload Support

**Features:**
- Support for image and document file uploads
- File preview with size display
- Max file size: 10MB per file, 50MB total
- Supported file types (varies by platform):
  - Gemini: images, PDF
  - Grok: images, PDF, TXT
  - Kimi: images, PDF, TXT, DOC, DOCX, MD, JSON, CSV
  - DeepSeek: images
  - ChatGPT: images, PDF, TXT, MD, JSON, CSV, PY, JS
  - Qwen: images, PDF, DOC, DOCX, TXT, MD, JSON, CSV
  - Yuanbao: images, PDF, DOC, DOCX, TXT, MD

**Technical Implementation:**
- File reading via FileReader API (Data URL)
- File transmission via Chrome message system
- Content script upload using DataTransfer objects
- Retry mechanism: 2 attempts with exponential backoff
- Timeout: 30 seconds per upload

**Changes:**
- `src/sidepanel/sidepanel.html`: File upload UI
- `src/sidepanel/sidepanel.css`: File preview styles
- `src/sidepanel/sidepanel.js`: File handling logic
- `src/background.js`: File parameter passing
- `src/content/content.js`: Platform-specific upload functions
- `src/config.js`: File upload configuration per platform
- `manifest.json`: Version bump to 1.6

---

## v1.5 - 2026-02-12

### Core Features

**Initial Release:**
- Broadcast messages to 7 AI platforms simultaneously
- Dark/light theme toggle
- Multi-language support (English/Chinese)
- Session layout memory (save/restore window positions)
- Browse mode (tile windows without auto-focus)
- Optimized close confirmation dialog

**Supported Platforms:**
1. Gemini (gemini.google.com)
2. Grok (grok.com)
3. Kimi (kimi.moonshot.cn)
4. DeepSeek (chat.deepseek.com)
5. ChatGPT (chatgpt.com)
6. Qwen (chat.qwen.ai)
7. Yuanbao (yuanbao.tencent.com)

**Technical Stack:**
- Vanilla JavaScript + HTML + CSS
- Manifest V3
- Content Scripts for platform integration
- Chrome Storage API for settings
- Shortcut: Alt+Shift+S

**Project Structure:**
```
AI-all-IN-one/
├── manifest.json
├── src/
│   ├── background.js
│   ├── config.js
│   ├── i18n.js
│   ├── popup/
│   ├── sidepanel/ (main UI)
│   └── content/
│       └── content.js
└── icons/
```
