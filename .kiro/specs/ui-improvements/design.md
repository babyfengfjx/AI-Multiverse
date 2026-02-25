# Design Document

## Overview

This design document outlines the technical approach for implementing UI/UX improvements to the AI Multiverse Chrome Extension. The improvements focus on six main areas: hover-based action buttons for history messages, repositioning and state management of the summary button, fixing the summary functionality, enhancing the response detail modal width, adding Markdown rendering support for AI responses, and implementing a resizable detail modal with drag functionality.

## Architecture

The implementation will primarily involve modifications to the sidepanel component, which consists of:

- **sidepanel.html**: Structure and layout
- **sidepanel.js**: Event handling and state management
- **sidepanel.css**: Styling and animations

The changes will follow the existing architecture pattern of the extension, maintaining separation between presentation (CSS), behavior (JS), and structure (HTML).

## Components and Interfaces

### 1. History Message Component

**Current State:**
- Action buttons are always visible in the history footer
- Buttons use emoji icons (🔄, ✏️, 🗑️)
- Basic hover effects on individual buttons

**Proposed Changes:**
- Move action buttons to absolute positioning within history item
- Implement opacity-based show/hide on parent hover
- Apply glass morphism effect to button container
- Add smooth transitions for appearance/disappearance

**CSS Classes:**
```css
.history-item {
  position: relative;
}

.history-actions {
  position: absolute;
  right: 14px;
  bottom: 14px;
  opacity: 0;
  visibility: hidden;
  transform: translateY(10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.history-item:hover .history-actions {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.history-action-btn {
  background: rgba(61, 138, 255, 0.15);
  border: 1px solid rgba(61, 138, 255, 0.3);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
```

### 2. Summary Button Component

**Current State:**
- Located in responses toolbar
- Visibility toggled based on successful responses
- Opens settings modal on click

**Proposed Changes:**
- Relocate to chat input actions bar (right side, before send button)
- Add disabled state styling
- Implement response completion tracking
- Update state based on fetch responses completion

**HTML Structure:**
```html
<div class="right-actions">
  <button class="action-btn-pill" id="launchBtn">...</button>
  <button class="action-btn-pill" id="tileBtn">...</button>
  <button class="action-btn-pill summary-btn" id="summarizeBtnInline" disabled>
    <svg>...</svg>
    <span>Summary</span>
  </button>
  <button class="primary-btn-send" id="sendBtn">...</button>
</div>
```

**State Management:**
```javascript
// Track response completion
let responseCompletionState = {
  total: 0,
  completed: 0,
  allComplete: false
};

// Update summary button state
function updateSummaryButtonState() {
  const btn = document.getElementById('summarizeBtnInline');
  if (responseCompletionState.allComplete) {
    btn.disabled = false;
    btn.classList.add('active');
  } else {
    btn.disabled = true;
    btn.classList.remove('active');
  }
}
```

### 3. Summary Functionality

**Current Issue:**
- Button click opens modal but doesn't trigger summarization
- Missing connection between modal confirmation and actual summarization

**Fix Approach:**
- Ensure modal confirmation handler calls `performSummarization()`
- Add proper error handling and user feedback
- Implement loading states during summarization

**Event Flow:**
```
User clicks summary button
  → Open settings modal
  → User configures settings
  → User clicks confirm
  → Save settings
  → Close modal
  → Call performSummarization()
  → Show loading state
  → Send message to background script
  → Display result or error
```

### 4. Detail Modal Width

**Current State:**
- Fixed max-width of 1100px
- Width set to 94% of viewport

**Proposed Changes:**
- Increase max-width to 1400px or higher
- Maintain responsive behavior
- Ensure proper text wrapping and readability

**CSS Updates:**
```css
.detail-content {
  max-width: 1400px;
  width: 94%;
}

.detail-body {
  padding: 35px 50px;
  font-size: 15px;
  line-height: 1.9;
}
```

### 5. Markdown Rendering Component

**Current State:**
- AI responses displayed as plain text
- No formatting for code blocks, lists, or other Markdown elements
- Limited readability for structured content

**Proposed Changes:**
- Integrate a Markdown parsing library (marked.js - lightweight and fast)
- Add syntax highlighting library (highlight.js or Prism.js)
- Create custom CSS theme for rendered Markdown
- Implement copy-to-clipboard for code blocks
- Apply Markdown rendering to both response cards and detail modal

**Library Selection:**
- **marked.js**: Fast, lightweight Markdown parser (~20KB minified)
- **highlight.js**: Automatic language detection and syntax highlighting (~80KB with common languages)

**Implementation Approach:**
```javascript
// Import libraries (add to manifest.json)
// <script src="lib/marked.min.js"></script>
// <script src="lib/highlight.min.js"></script>

// Configure marked with highlight.js
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
  gfm: true
});

// Render function
function renderMarkdown(text) {
  try {
    const html = marked.parse(text);
    return sanitizeHTML(html); // Prevent XSS
  } catch (e) {
    console.error('Markdown parsing error:', e);
    return escapeHTML(text); // Fallback to plain text
  }
}

// Apply to response display
function displayResponse(text) {
  const container = document.querySelector('.response-content');
  container.innerHTML = renderMarkdown(text);
  
  // Add copy buttons to code blocks
  addCopyButtonsToCodeBlocks(container);
}
```

**CSS Styling:**
```css
/* Markdown base styles */
.markdown-content {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.7;
  color: #333;
}

.markdown-content h1, .markdown-content h2, .markdown-content h3 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-content h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
.markdown-content h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
.markdown-content h3 { font-size: 1.25em; }

.markdown-content code {
  background: #f6f8fa;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9em;
}

.markdown-content pre {
  background: #f6f8fa;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  position: relative;
}

.markdown-content pre code {
  background: none;
  padding: 0;
}

.markdown-content table {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
}

.markdown-content table th,
.markdown-content table td {
  border: 1px solid #dfe2e5;
  padding: 8px 13px;
}

.markdown-content table th {
  background: #f6f8fa;
  font-weight: 600;
}

.markdown-content blockquote {
  border-left: 4px solid #dfe2e5;
  padding-left: 16px;
  color: #6a737d;
  margin: 16px 0;
}

.markdown-content ul, .markdown-content ol {
  padding-left: 2em;
  margin: 16px 0;
}

.markdown-content a {
  color: #0366d6;
  text-decoration: none;
}

.markdown-content a:hover {
  text-decoration: underline;
}

/* Code block copy button */
.code-block-wrapper {
  position: relative;
}

.copy-code-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.2s;
}

.code-block-wrapper:hover .copy-code-btn {
  opacity: 1;
}

.copy-code-btn:hover {
  background: #fff;
}
```

**Security Considerations:**
- Sanitize HTML output to prevent XSS attacks
- Use DOMPurify library or implement custom sanitization
- Whitelist allowed HTML tags and attributes
- Escape user-generated content before parsing

### 6. Resizable Detail Modal Component

**Current State:**
- Fixed width modal
- No user control over modal size
- Width preference not persisted

**Proposed Changes:**
- Add resize handles to modal edges (left and right)
- Implement drag-to-resize functionality
- Store user preference in localStorage
- Add visual feedback during resize
- Constrain min/max width

**Implementation Approach:**
```javascript
// Modal resize state
let modalResizeState = {
  isResizing: false,
  startX: 0,
  startWidth: 0,
  minWidth: 600,
  maxWidth: 0.95 * window.innerWidth,
  currentWidth: localStorage.getItem('detailModalWidth') || 1400
};

// Initialize resize functionality
function initModalResize() {
  const modal = document.querySelector('.detail-content');
  const resizeHandleLeft = createResizeHandle('left');
  const resizeHandleRight = createResizeHandle('right');
  
  modal.appendChild(resizeHandleLeft);
  modal.appendChild(resizeHandleRight);
  
  // Apply saved width
  modal.style.width = modalResizeState.currentWidth + 'px';
  modal.style.maxWidth = 'none'; // Override CSS max-width
  
  // Attach event listeners
  resizeHandleLeft.addEventListener('mousedown', (e) => startResize(e, 'left'));
  resizeHandleRight.addEventListener('mousedown', (e) => startResize(e, 'right'));
}

function createResizeHandle(side) {
  const handle = document.createElement('div');
  handle.className = `modal-resize-handle modal-resize-handle-${side}`;
  return handle;
}

function startResize(e, side) {
  e.preventDefault();
  modalResizeState.isResizing = true;
  modalResizeState.startX = e.clientX;
  modalResizeState.startWidth = document.querySelector('.detail-content').offsetWidth;
  modalResizeState.resizeSide = side;
  
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
  
  // Add resizing class for visual feedback
  document.body.classList.add('modal-resizing');
}

function handleResize(e) {
  if (!modalResizeState.isResizing) return;
  
  const modal = document.querySelector('.detail-content');
  const deltaX = modalResizeState.resizeSide === 'right' 
    ? e.clientX - modalResizeState.startX 
    : modalResizeState.startX - e.clientX;
  
  let newWidth = modalResizeState.startWidth + (deltaX * 2); // *2 because we resize from center
  
  // Constrain width
  newWidth = Math.max(modalResizeState.minWidth, newWidth);
  newWidth = Math.min(modalResizeState.maxWidth, newWidth);
  
  modal.style.width = newWidth + 'px';
  modalResizeState.currentWidth = newWidth;
}

function stopResize() {
  if (!modalResizeState.isResizing) return;
  
  modalResizeState.isResizing = false;
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
  document.body.classList.remove('modal-resizing');
  
  // Save preference
  localStorage.setItem('detailModalWidth', modalResizeState.currentWidth);
}

// Update max width on window resize
window.addEventListener('resize', () => {
  modalResizeState.maxWidth = 0.95 * window.innerWidth;
  const modal = document.querySelector('.detail-content');
  if (modal && modal.offsetWidth > modalResizeState.maxWidth) {
    modal.style.width = modalResizeState.maxWidth + 'px';
  }
});
```

**CSS for Resize Handles:**
```css
.modal-resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  z-index: 10;
  transition: background-color 0.2s;
}

.modal-resize-handle-left {
  left: 0;
}

.modal-resize-handle-right {
  right: 0;
}

.modal-resize-handle:hover {
  background-color: rgba(61, 138, 255, 0.2);
}

.modal-resize-handle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 3px;
  height: 30px;
  background: rgba(61, 138, 255, 0.5);
  border-radius: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.modal-resize-handle:hover::after {
  opacity: 1;
}

body.modal-resizing {
  cursor: ew-resize;
  user-select: none;
}

body.modal-resizing * {
  cursor: ew-resize !important;
}

.detail-content {
  position: relative;
  transition: none; /* Disable transition during resize */
}
```

## Data Models

### Response Completion State
```javascript
{
  total: number,           // Total number of selected providers
  completed: number,       // Number of completed responses
  allComplete: boolean,    // Whether all responses are complete
  responses: {             // Response data by provider
    [providerId]: {
      status: 'ok' | 'error' | 'loading',
      text: string,
      error: string
    }
  }
}
```

### Summary Configuration
```javascript
{
  summarizeModel: string,        // Selected AI model for summarization
  customSummarizePrompt: string, // Custom prompt text
  lastQuestion: string           // Original question for context
}
```

### Modal Resize State
```javascript
{
  isResizing: boolean,     // Whether resize is in progress
  startX: number,          // Mouse X position at resize start
  startWidth: number,      // Modal width at resize start
  currentWidth: number,    // Current modal width
  resizeSide: 'left' | 'right',  // Which side is being resized
  minWidth: 600,           // Minimum allowed width (px)
  maxWidth: number         // Maximum allowed width (95% viewport)
}
```

### Markdown Rendering Configuration
```javascript
{
  options: {
    breaks: true,          // Convert line breaks to <br>
    gfm: true,            // GitHub Flavored Markdown
    highlight: function,   // Syntax highlighting function
    sanitize: false       // We'll use DOMPurify instead
  },
  sanitizeConfig: {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 
                    'em', 'code', 'pre', 'a', 'ul', 'ol', 'li', 'blockquote',
                    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'img'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class']
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Action Button Visibility Consistency
*For any* history message item, when the mouse enters the item boundary, the action buttons should become visible, and when the mouse leaves, the buttons should become hidden.
**Validates: Requirements 1.1, 1.2**

### Property 2: Summary Button State Correctness
*For any* set of selected AI providers, the summary button should be disabled if and only if not all providers have completed their responses.
**Validates: Requirements 2.2, 2.3**

### Property 3: Summary Button Position Invariance
*For any* viewport size, the summary button should always be positioned to the right of the tile button and to the left of the send button in the chat input area.
**Validates: Requirements 2.1**

### Property 4: Summarization Trigger Completeness
*For any* valid summarization request (with at least one successful response), clicking the summary button and confirming settings should result in either a successful summarization or an error message being displayed.
**Validates: Requirements 3.1, 3.2, 3.3, 3.5**

### Property 5: Modal Width Responsiveness
*For any* viewport width, the detail modal width should be the minimum of (1400px, 94% of viewport width), ensuring it never exceeds the viewport boundaries.
**Validates: Requirements 4.1, 4.2, 4.3**

### Property 6: Markdown Rendering Completeness
*For any* valid Markdown text containing common elements (headings, bold, italic, code blocks, lists, tables, links, blockquotes), the rendered HTML should contain the corresponding HTML tags for each Markdown element.
**Validates: Requirements 5.1, 5.2**

### Property 7: Syntax Highlighting Application
*For any* code block with a specified language, the rendered output should include syntax highlighting CSS classes applied to the code elements.
**Validates: Requirements 5.3**

### Property 8: Markdown Parsing Fallback
*For any* invalid or malformed Markdown text, when parsing fails, the system should return the original text content unchanged (escaped for safety).
**Validates: Requirements 5.5**

### Property 9: Code Block Copy Functionality
*For any* rendered code block, clicking the copy button should copy the code content to the clipboard without including syntax highlighting markup.
**Validates: Requirements 5.7**

### Property 10: Modal Resize Width Constraints
*For any* resize operation on the detail modal, the resulting width should always be constrained between 600px (minimum) and 95% of viewport width (maximum).
**Validates: Requirements 6.3, 6.4**

### Property 11: Modal Resize Persistence
*For any* modal width set by the user, after saving to localStorage and reloading the page, the modal width should be restored to the same value.
**Validates: Requirements 6.5**

### Property 12: Modal Horizontal Centering Invariance
*For any* resize operation, the modal should remain horizontally centered in the viewport, with equal margins on left and right sides.
**Validates: Requirements 6.7**

## Error Handling

### History Message Interactions
- **Missing DOM elements**: Gracefully handle cases where action buttons or history items are not found
- **Event listener failures**: Use try-catch blocks around event handlers
- **Animation interruptions**: Ensure transitions complete properly even if user rapidly hovers/unhovers

### Summary Button
- **No responses available**: Disable button and show tooltip explaining why
- **Incomplete responses**: Keep button disabled until all responses complete
- **Network failures**: Display error message and allow retry

### Summarization Process
- **Model not available**: Show error message indicating the selected model is not accessible
- **Timeout**: Implement timeout for summarization requests (30 seconds)
- **Empty responses**: Validate that there are responses to summarize before proceeding
- **Background script errors**: Handle cases where background script is not responding

### Modal Width
- **Small viewports**: Ensure modal doesn't break layout on mobile-sized screens
- **Very large viewports**: Cap maximum width to maintain readability
- **Content overflow**: Ensure scrolling works properly with increased width

### Markdown Rendering
- **Parsing errors**: Catch exceptions during Markdown parsing and fall back to plain text
- **XSS attacks**: Sanitize all HTML output using DOMPurify or equivalent
- **Missing libraries**: Check if marked.js and highlight.js are loaded before use
- **Invalid HTML**: Handle cases where Markdown produces malformed HTML
- **Large content**: Implement performance safeguards for very large Markdown documents
- **Syntax highlighting failures**: Fall back to plain code block if language detection fails

### Modal Resizing
- **Viewport too small**: Prevent resize when viewport is smaller than minimum modal width
- **Rapid resize events**: Throttle resize calculations to prevent performance issues
- **localStorage errors**: Handle cases where localStorage is not available or quota exceeded
- **Invalid stored width**: Validate stored width value and fall back to default if invalid
- **Concurrent resize operations**: Prevent multiple simultaneous resize operations
- **Mouse leave during resize**: Ensure resize completes properly even if mouse leaves window

## Testing Strategy

### Unit Testing
- Test individual CSS class applications
- Test state management functions (updateSummaryButtonState, etc.)
- Test event handler logic in isolation
- Test DOM manipulation functions
- Test Markdown parsing with various input formats
- Test HTML sanitization functions
- Test resize calculation functions
- Test localStorage read/write operations

### Integration Testing
- Test hover interactions with actual DOM elements
- Test summary button state changes based on response completion
- Test modal opening/closing with new width
- Test summarization flow from button click to result display
- Test Markdown rendering in both response cards and detail modal
- Test code block copy functionality end-to-end
- Test modal resize with mouse drag events
- Test width persistence across page reloads

### Manual Testing
- Verify visual appearance of glass effect buttons
- Test hover behavior across different browsers
- Verify summary button positioning at various viewport sizes
- Test modal width at different screen resolutions
- Verify summarization actually triggers and completes
- Verify Markdown rendering quality and visual appeal
- Test syntax highlighting for various programming languages
- Test modal resize smoothness and responsiveness
- Verify modal centering during resize
- Test on different screen sizes and resolutions

### Property-Based Testing
Each correctness property should be implemented as a property-based test with minimum 100 iterations. Tests should be tagged with:
- **Feature: ui-improvements, Property 1**: Action Button Visibility Consistency
- **Feature: ui-improvements, Property 2**: Summary Button State Correctness
- **Feature: ui-improvements, Property 3**: Summary Button Position Invariance
- **Feature: ui-improvements, Property 4**: Summarization Trigger Completeness
- **Feature: ui-improvements, Property 5**: Modal Width Responsiveness
- **Feature: ui-improvements, Property 6**: Markdown Rendering Completeness
- **Feature: ui-improvements, Property 7**: Syntax Highlighting Application
- **Feature: ui-improvements, Property 8**: Markdown Parsing Fallback
- **Feature: ui-improvements, Property 9**: Code Block Copy Functionality
- **Feature: ui-improvements, Property 10**: Modal Resize Width Constraints
- **Feature: ui-improvements, Property 11**: Modal Resize Persistence
- **Feature: ui-improvements, Property 12**: Modal Horizontal Centering Invariance

Note: For this UI-focused feature, property-based testing will focus on state consistency and DOM behavior rather than traditional input/output properties. Unit tests will be more appropriate for visual verification.
