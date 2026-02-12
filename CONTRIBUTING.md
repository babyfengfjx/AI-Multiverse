# Contributing to AI Multiverse

Thank you for your interest in contributing to AI Multiverse! We welcome improvements, bug fixes, and new AI provider integrations.

## How to Add a New AI Provider

The core of this project is its modular `src/config.js` file. To support a new AI chatbot, follow these steps:

1.  **Locate `src/config.js`**:
    This file contains the configuration for all supported AI providers.

2.  **Add a New Entry**:
    Add a new object to the `AI_CONFIG` map using a unique ID (e.g., `claude`).

    ```javascript
    claude: {
        name: 'Claude',
        icon: 'icons/claude.png',
        urlPattern: '*://claude.ai/*',
        baseUrl: 'https://claude.ai/chats',
        selectors: {
            // CSS Selectors to find the input box and send button
            input: ['div.ProseMirror', 'textarea[placeholder*="Message Claude"]'],
            button: ['button[aria-label*="Send"]', 'div[role="button"]:has(svg)']
        },
        fillMethod: 'main-world', // 'main-world' (bypass React) or 'native'
        sendMethod: 'button'      // 'button' (click) or 'enter' (press Enter key)
    },
    ```

3.  **Update `manifest.json`** (if needed):
    - Add the new domain to `host_permissions`.
    - Add the new domain to `content_scripts` -> `matches`.

4.  **Add an Icon**:
    - Place a 24x24 or similar logo in `src/sidepanel/icons/`.
    - Ensure it is referenced in your config and in `src/sidepanel/sidepanel.html`.

5.  **Test It**:
    - Load the extension in Chrome.
    - Select the new provider.
    - Try sending a message!

## Code Style
- Use standard JavaScript (ES6+).
- No build tools (Webpack/React) unless absolutely necessary. Keep it lightweight.
- Use explicit variable names.

## Submitting a Pull Request
- Fork the repository.
- Create a new branch: `feature/add-claude-provider`.
- Commit your changes.
- Push to your branch and submit a PR!

We look forward to your contributions!
