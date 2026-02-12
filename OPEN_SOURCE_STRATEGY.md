# AI Multiverse - Open Source Strategy & Roadmap to Excellence

## 1. Vision & Core Philosophy
To become the **definitive browser extension** for power users who leverage multiple LLMs simultaneously. 
**"One Prompt, Infinite Perspectives."**

### key Differentiators (Why this project wins):
- **Privacy First**: No intermediate servers. All data stays local on the user's browser.
- **Zero-Config**: Works out of the box with existing login sessions.
- **Lightweight**: Vanilla JS, no heavy frameworks, instant load times.
- **Community Driven**: Easy for anyone to add a new AI provider with just a few lines of JSON/JS.

---

## 2. Immediate "Repo Polish" (The First Impression)
Before open-sourcing, the repository needs to look professional and welcoming.

### Action Items:
- [ ] **LICENSE**: Add an `MIT License` (permissive, encourages adoption) or `GPLv3` (copyleft, ensures improvements stay open).
- [ ] **README.md Overhaul**:
    - **Badges**: License, Version, Chrome Web Store status.
    - **Demo GIF**: A high-quality screen recording of the "Open -> Tile -> Send" workflow.
    - **Features List**: Clearly list supported providers (Gemini, Grok, Kimi, DeepSeek, ChatGPT, Qwen, Yuanbao).
- [ ] **CONTRIBUTING.md**: A guide on how to add a new provider. This is critical for scaling.
    - Example: "To add a provider, add its config in `background.js` and its selectors in `content.js`."
- [ ] **Issue Templates**: Create GitHub Issue templates for "Bug Report" (e.g., "Selector Broken on ChatGPT") and "Feature Request".

---

## 3. Architectural Evolution (Code Quality)
To be a "Top Tier" project, the codebase must be maintainable and extensible.

### Current State vs. Target State:

| Current | Target (v2.0) |
| :--- | :--- |
| **Monolithic Config**: All providers hardcoded in `background.js` & `content.js`. | **Plugin/Adapter Pattern**: Each provider has its own file (e.g., `src/providers/chatgpt.js`, `src/providers/grok.js`). |
| **Hardcoded Selectors**: CSS selectors buried in `content.js` logic. | **Dynamic Configuration**: Selectors loaded from a JSON file (or remote URL) so they can be updated without extension updates. |
| **Vanilla JS**: Simple, fast. | **TypeScript (Optional)**: If the project grows, migrating to TypeScript will prevent many bugs. |

### Proposed Directory Structure:
```text
src/
  core/           # Message passing, window management, tiling logic
  providers/      # Individual logic for each AI
    chatgpt.js
    claude.js
    deepseek.js
  ui/             # Sidepanel logic
  utils/          # Helpers (DOM injection, wait functions)
```

---

## 4. Killer Features Roadmap (The "Wow" Factor)
These features will distinguish AI Multiverse from simple "chat wrappers".

### 4.1. The "Consensus & Comparison" Engine
- **visual Comparison**: A mode to define a "Rubric" (e.g., "Accuracy", "Creativity").
- **Local LLM Judge**: Use a lightweight local mode (like Ollama or Chrome's built-in Nano Gemini) to **summarize** the 5 different answers into one final answer. **This is a game-changer.**

### 4.2. Prompt Library & Macros
- **System Prompts**: Allow users to set a global "Persona" (e.g., "You act as a Senior Python Developer") that is silently prefixed to every message.
- **Quick Actions**: Right-click text on ANY webpage -> "Send to All AIs".

### 4.3. "Battle Mode" (Performance Metrics)
- Show real-time metrics: "Time to First Token", "Total Generation Time" for each provider. Gamify the speed of models.

### 4.4. Local & Custom Models
- Support **Ollama** / **LM Studio** endpoints (http://localhost:11434).
- Allow users to add "Custom OpenAI-compatible API" endpoints.

---

## 5. User Experience (UX) Excellence
- **Keyboard-First Design**: Ensure every action (Change Model, Tile, Send, Clear) has a hotkey.
- **Dark/Light Mode Sync**: Automatically detect system theme.
- **Data Export**: "Export Conversation to Markdown/PDF" button that stitches together the Q&A from all providers into a single report.

---

## 6. Community & Growth Strategy
- **Chrome Web Store**: Publish it officially. This builds trust.
- **Product Hunt Launch**: Prepare a launch kit (Logo, Screenshots, Video).
- **Discord Community**: Create a space for users to report broken selectors (since AI sites change frontend code often).

## Summary Advice
You have built a very solid **" MVP Plus"**. The core logic (Window Tiling, CSP Bypass, Event Simulation) is robust. 
**The next step is not adding more features, but modularizing the code so the community can maintain the 50+ AI providers that will eventually be requested.**
