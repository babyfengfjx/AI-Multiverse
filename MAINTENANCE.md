# AI Multiverse - Maintenance & Developer Journal

This document serves as a "Memory Root" for AI coding assistants. It records critical bugs, solved edge cases, and architectural decisions to prevent regression during future iterations.

## 🚨 Critical Bugs & Solutions

### 1. Script Injection Sequence (Race Condition)
- **Problem**: `content.js` depends on global `AI_CONFIG` defined in `config.js`. When injected dynamically via `background.js`, `content.js` often executed before `config.js` finished loading, resulting in `AI_CONFIG is undefined` errors.
- **Fix**: In `ensureContentScript`, always inject `src/config.js` and `src/content/content.js` in the SAME `executeScript` call array.
- **Rule**: Never assume `config.js` is already present in a newly opened tab.

### 2. DeepSeek Selector Ambiguity
- **Problem**: DeepSeek's UI uses many generic `div[role="button"]`. Using broad selectors often triggers the "Toggle Sidebar" button instead of "Send Message".
- **Fix**: Use path-based SVG detection. For example, the send button SVG usually contains unique path data (e.g., `path[d*="M16.5"]`).
- **Rule**: For providers with complex/dynamic classes, prioritize ARIA labels or SVG path attributes over generic class/tag selectors.

### 3. Grok Rich Text Editor (Tiptap/ProseMirror)
- **Problem**: Grok uses a complex editor where `textarea.value = x` does not update the internal React/ProseMirror state. 
- **Fix**: Use `MAIN` world injection. Focus the element, use `document.execCommand('insertText', false, text)`, and dispatch a sequence of `input` and `change` events.
- **Rule**: Always use `MAIN` world for "Rich Text" input boxes to bypass framework-level state blocking.

### 4. Image/Icon Path Fragility
- **Problem**: Local relative paths like `icons/logo.png` behave differently when resolved by a Content Script (pointing to the host domain) vs. the Sidepanel (pointing to `chrome-extension://`).
- **Fix**: Use official remote Favicon URLs in `config.js` for universal availability, or ensure proper `chrome.runtime.getURL` wrapping if using local assets.

---

## 🏗 Architectural Decisions

### 1. `Main-World` vs `Isolated-World`
- Filling inputs and clicking buttons is done in the `MAIN` world via `chrome.scripting.executeScript` to interact with React/Vue/Slate.js internal listeners.
- Response extraction is done in the `ISOLATED` world for security and privacy.

### 2. Provider-Aware Filling Logic
- We avoid a "one size fits all" filling strategy. Each provider has a dedicated branch in `background.js` -> `executeMainWorldFill` to handle their specific framework (React, Slate.js, Tiptap, etc.).

### 3. UI Aesthetics & Accessibility
- **Glassmorphism**: Use `backdrop-filter: blur()` and semi-transparent backgrounds for a premium feel.
- **Explicit Labels**: Prefer "Icon + Text" buttons in action bars over "Icon only" to avoid user confusion (e.g., Open, Tile, Close labels).
- **Modals**: Keep the main chat interface clean by moving configuration (Model Selection) into a modal triggered by a header settings button.

---

## 📈 Future Roadmap Notes
- **Selector Fragility**: AI providers change their DOM often. Check `config.js` first if a provider stops responding.
- **Performance**: Fetching responses from 7+ tabs can be slow. Consider adding a "Refresh" button per card instead of only a global "Fetch All".
- **Smart Detection**: If a tab is closed, the UI should ideally show a "Launch" button directly inside the response card.
