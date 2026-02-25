# Implementation Plan: UI Improvements

## Overview

This implementation plan breaks down the UI improvements into discrete, manageable tasks. Each task builds on previous work and includes specific file modifications and testing requirements.

## Tasks

- [x] 1. Implement hover-based action buttons for history messages
  - Modify CSS to add glass morphism effect and hover animations
  - Update HTML structure if needed for proper positioning
  - Add smooth transitions for button appearance/disappearance
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ]* 1.1 Write unit tests for action button visibility
  - Test that buttons are hidden by default
  - Test that buttons appear on hover
  - Test that buttons disappear when hover ends
  - _Requirements: 1.1, 1.2_

- [x] 2. Relocate and enhance summary button
  - [x] 2.1 Move summary button from responses toolbar to chat input area
    - Update HTML structure in sidepanel.html
    - Position button to the right of tile button, left of send button
    - _Requirements: 2.1_

  - [x] 2.2 Implement response completion tracking
    - Add state management for tracking response completion
    - Create updateSummaryButtonState() function
    - Hook into fetchResponses() to update state
    - _Requirements: 2.2, 2.3, 2.5_

  - [x] 2.3 Add disabled/enabled state styling
    - Create CSS classes for disabled and active states
    - Apply appropriate visual feedback
    - _Requirements: 2.2, 2.3_

- [ ]* 2.4 Write unit tests for summary button state management
  - Test state updates when responses complete
  - Test button enable/disable logic
  - Test state reset on new message
  - _Requirements: 2.2, 2.3, 2.5_

- [x] 3. Fix summary functionality
  - [x] 3.1 Verify modal confirmation handler
    - Ensure summarizeSettingsConfirmBtn click handler exists
    - Verify it calls performSummarization()
    - _Requirements: 3.1, 3.2_

  - [x] 3.2 Add error handling and user feedback
    - Add try-catch blocks in performSummarization()
    - Display loading state during summarization
    - Show success/error messages
    - _Requirements: 3.3, 3.4, 3.5_

  - [x] 3.3 Test summarization flow end-to-end
    - Verify button click opens modal
    - Verify modal confirmation triggers summarization
    - Verify result is displayed correctly
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]* 3.4 Write integration tests for summarization
  - Test complete flow from button click to result
  - Test error scenarios
  - Test loading states
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Enhance detail modal width
  - [x] 4.1 Update CSS for wider modal
    - Increase max-width to 1400px
    - Adjust padding for better readability
    - Ensure responsive behavior
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 4.2 Test modal at various viewport sizes
    - Test on small screens (< 1400px)
    - Test on large screens (> 1400px)
    - Verify text formatting and readability
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 4.3 Write responsive layout tests
  - Test modal width calculations at different viewport sizes
  - Test that modal never exceeds viewport boundaries
  - _Requirements: 4.2, 4.3, 4.5_

- [x] 5. Checkpoint - Verify all changes work together
  - Test hover interactions with history messages
  - Test summary button positioning and state
  - Test summarization functionality
  - Test modal width on different screens
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Integrate Markdown rendering libraries
  - [ ] 6.1 Add marked.js and highlight.js to project
    - Download marked.min.js and highlight.min.js
    - Add script tags to sidepanel.html
    - Add highlight.js CSS theme (e.g., github.css)
    - Verify libraries load correctly
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 6.2 Implement Markdown rendering function
    - Create renderMarkdown() function in sidepanel.js
    - Configure marked.js with highlight.js integration
    - Add HTML sanitization (use DOMPurify or custom sanitizer)
    - Add error handling and fallback to plain text
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [ ] 6.3 Apply Markdown rendering to response display
    - Update renderResponses() to use renderMarkdown()
    - Update detail modal to use renderMarkdown()
    - Ensure consistent rendering in both locations
    - _Requirements: 5.1, 5.6_

- [ ]* 6.4 Write property test for Markdown rendering
  - **Property 6: Markdown Rendering Completeness**
  - **Validates: Requirements 5.1, 5.2**
  - Generate random Markdown with various elements
  - Verify HTML output contains expected tags
  - _Requirements: 5.1, 5.2_

- [ ]* 6.5 Write property test for syntax highlighting
  - **Property 7: Syntax Highlighting Application**
  - **Validates: Requirements 5.3**
  - Generate code blocks with different languages
  - Verify syntax highlighting classes are applied
  - _Requirements: 5.3_

- [ ]* 6.6 Write property test for parsing fallback
  - **Property 8: Markdown Parsing Fallback**
  - **Validates: Requirements 5.5**
  - Generate invalid Markdown
  - Verify original text is preserved
  - _Requirements: 5.5_

- [ ] 7. Implement Markdown styling and code block features
  - [ ] 7.1 Create Markdown CSS theme
    - Add .markdown-content styles to sidepanel.css
    - Style headings, lists, tables, blockquotes
    - Style code blocks with proper padding and scrolling
    - Add responsive styles for different screen sizes
    - _Requirements: 5.4, 5.7_

  - [ ] 7.2 Implement code block copy functionality
    - Add copy button to each code block
    - Implement clipboard copy on button click
    - Add visual feedback (e.g., "Copied!" message)
    - Handle copy errors gracefully
    - _Requirements: 5.7_

  - [ ] 7.3 Test Markdown rendering with real AI responses
    - Test with responses containing code blocks
    - Test with responses containing tables
    - Test with responses containing lists and nested elements
    - Verify visual quality and readability
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7_

- [ ]* 7.4 Write property test for code block copy
  - **Property 9: Code Block Copy Functionality**
  - **Validates: Requirements 5.7**
  - Simulate copy button clicks
  - Verify clipboard content matches code
  - _Requirements: 5.7_

- [ ] 8. Implement resizable detail modal
  - [ ] 8.1 Create resize handle elements
    - Add resize handle divs to detail modal
    - Style handles with hover effects
    - Position handles on left and right edges
    - _Requirements: 6.1, 6.6_

  - [ ] 8.2 Implement drag-to-resize functionality
    - Add mousedown event listeners to handles
    - Implement handleResize() function with width calculation
    - Add mousemove and mouseup event listeners
    - Apply width constraints (600px min, 95% viewport max)
    - _Requirements: 6.2, 6.3, 6.4_

  - [ ] 8.3 Implement width persistence
    - Save modal width to localStorage on resize end
    - Load saved width on modal open
    - Validate stored width and use default if invalid
    - _Requirements: 6.5_

  - [ ] 8.4 Ensure modal centering during resize
    - Update resize logic to maintain horizontal centering
    - Test centering at various widths
    - _Requirements: 6.7_

- [ ]* 8.5 Write property test for width constraints
  - **Property 10: Modal Resize Width Constraints**
  - **Validates: Requirements 6.3, 6.4**
  - Simulate resize operations with random deltas
  - Verify width stays within bounds
  - _Requirements: 6.3, 6.4_

- [ ]* 8.6 Write property test for width persistence
  - **Property 11: Modal Resize Persistence**
  - **Validates: Requirements 6.5**
  - Set width, save, reload, verify restoration
  - _Requirements: 6.5_

- [ ]* 8.7 Write property test for modal centering
  - **Property 12: Modal Horizontal Centering Invariance**
  - **Validates: Requirements 6.7**
  - Resize modal and verify center position
  - _Requirements: 6.7_

- [ ] 9. Checkpoint - Test new features
  - Test Markdown rendering with various content types
  - Test code block copy functionality
  - Test modal resize with mouse drag
  - Test width persistence across page reloads
  - Verify modal stays centered during resize
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Final polish and cross-browser testing
  - Test in Chrome (primary target)
  - Verify animations are smooth
  - Check accessibility (keyboard navigation, screen readers)
  - Verify all i18n strings are properly displayed
  - Test Markdown rendering across different AI providers
  - Test modal resize on different screen sizes
  - _Requirements: All_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Focus on one task at a time to maintain code quality
