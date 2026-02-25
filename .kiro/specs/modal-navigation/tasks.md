# Implementation Plan: Modal Navigation

## Overview

This implementation plan breaks down the modal navigation feature into discrete, manageable tasks. Each task builds on previous work and includes testing requirements.

## Tasks

- [x] 1. Set up navigation state management
  - Create `modalNavigationState` object to track responses, current index, and navigation lock
  - Initialize state when modal opens with response collection
  - Add helper functions to get/set navigation state
  - _Requirements: 4.2_

- [ ]* 1.1 Write property test for navigation state initialization
  - **Property 7: Index Update Correctness**
  - **Validates: Requirements 4.2, 4.3**

- [x] 2. Implement NavigationController class
  - [x] 2.1 Create NavigationController class with constructor
    - Accept responses array and initial index
    - Store as instance properties
    - _Requirements: 4.1, 4.2_

  - [x] 2.2 Implement navigation methods
    - Add `canNavigatePrevious()` method
    - Add `canNavigateNext()` method
    - Add `navigatePrevious()` method
    - Add `navigateNext()` method
    - Add `getCurrentResponse()` method
    - Add `getPosition()` method
    - _Requirements: 2.1, 2.2, 4.3_

  - [ ]* 2.3 Write property tests for NavigationController
    - **Property 1: Arrow Button State Consistency**
    - **Property 2: Navigation Direction Correctness**
    - **Property 7: Index Update Correctness**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 4.2, 4.3**

- [x] 3. Add navigation arrow UI elements
  - [x] 3.1 Create HTML structure for navigation arrows
    - Add left arrow button with SVG icon
    - Add right arrow button with SVG icon
    - Add ARIA labels for accessibility
    - Insert into detail modal DOM
    - _Requirements: 1.1, 1.7_

  - [x] 3.2 Style navigation arrows with CSS
    - Position arrows on modal edges (fixed positioning)
    - Add hover effects and transitions
    - Style disabled state (opacity, cursor)
    - Ensure arrows don't obstruct content
    - Add z-index layering
    - _Requirements: 1.6, 1.7_

  - [ ]* 3.3 Write unit tests for arrow rendering
    - Test arrows are present when modal opens
    - Test hover effects apply correctly
    - _Requirements: 1.1, 1.7_

- [x] 4. Implement click navigation
  - [x] 4.1 Add click event listeners to navigation arrows
    - Attach listeners when modal opens
    - Remove listeners when modal closes
    - _Requirements: 2.1, 2.2_

  - [x] 4.2 Implement handleNavigationClick function
    - Check navigation lock flag
    - Create NavigationController instance
    - Call appropriate navigation method
    - Update modal content if navigation successful
    - Update navigation controls state
    - Update position indicator
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 4.3 Write property tests for click navigation
    - **Property 2: Navigation Direction Correctness**
    - **Property 3: Content Update Consistency**
    - **Property 4: Modal Dimensions Invariant**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 5. Implement keyboard navigation
  - [x] 5.1 Add keyboard event listener
    - Listen for keydown events on document
    - Check if modal is open before handling
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 5.2 Implement handleKeyboardNavigation function
    - Handle ArrowLeft key (navigate previous)
    - Handle ArrowRight key (navigate next)
    - Handle Escape key (close modal)
    - Prevent default browser behavior
    - Check for text selection before navigating
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [ ]* 5.3 Write property tests for keyboard navigation
    - **Property 2: Navigation Direction Correctness**
    - **Property 9: Keyboard Event Scope**
    - **Validates: Requirements 3.1, 3.2, 3.4, 3.5**

- [x] 6. Add position indicator UI
  - [x] 6.1 Create HTML structure for position indicator
    - Add text indicator ("X of Y")
    - Add dot indicator container
    - Position at bottom center of modal
    - _Requirements: 4.5, 6.1, 6.4_

  - [x] 6.2 Style position indicator with CSS
    - Center horizontally at bottom
    - Style text indicator
    - Style dot indicators (inactive and active states)
    - Add spacing and padding
    - _Requirements: 6.4, 6.5_

  - [x] 6.3 Implement updatePositionIndicator function
    - Update text indicator with current position
    - Generate and update dot indicators
    - Highlight active dot
    - _Requirements: 4.5, 6.3, 6.5_

  - [ ]* 6.4 Write property tests for position indicator
    - **Property 8: Position Indicator Accuracy**
    - **Property 12: Dot Indicator Synchronization**
    - **Validates: Requirements 4.5, 6.1, 6.3, 6.5**

- [x] 7. Implement modal content update logic
  - [x] 7.1 Create updateModalContent function
    - Update provider icon in header
    - Update provider name in header
    - Update response text in content area
    - Re-render Markdown if needed
    - Re-add copy buttons to code blocks
    - _Requirements: 2.3, 2.4, 6.2_

  - [x] 7.2 Create updateNavigationControls function
    - Enable/disable left arrow based on canNavigatePrevious
    - Enable/disable right arrow based on canNavigateNext
    - Update ARIA attributes
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [ ]* 7.3 Write property tests for content updates
    - **Property 3: Content Update Consistency**
    - **Property 1: Arrow Button State Consistency**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 2.3, 2.4**

- [x] 8. Implement copy button synchronization
  - [x] 8.1 Update copy button event handler
    - Get current response from navigation state
    - Copy current response text (not cached text)
    - Update copy button feedback
    - _Requirements: 2.7_

  - [ ]* 8.2 Write property test for copy button
    - **Property 5: Copy Button Synchronization**
    - **Validates: Requirements 2.7**

- [x] 9. Implement touch/swipe navigation
  - [x] 9.1 Add touch event listeners
    - Listen for touchstart events
    - Listen for touchend events
    - Store touch coordinates
    - _Requirements: 7.1, 7.2_

  - [x] 9.2 Implement swipe detection logic
    - Calculate swipe distance
    - Check against minimum threshold
    - Determine swipe direction
    - Trigger appropriate navigation
    - Distinguish from text selection
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

  - [ ]* 9.3 Write property tests for swipe navigation
    - **Property 2: Navigation Direction Correctness**
    - **Property 10: Swipe Distance Threshold**
    - **Property 11: Swipe vs Text Selection**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.5**

- [x] 10. Implement navigation state persistence
  - [x] 10.1 Save navigation state on modal close
    - Store current index in session variable
    - Associate with current response set
    - _Requirements: 5.1_

  - [x] 10.2 Restore navigation state on modal open
    - Check for saved index
    - Validate saved index is still valid
    - Initialize modal with saved index if available
    - _Requirements: 5.2, 5.5_

  - [x] 10.3 Reset navigation state on new message
    - Clear saved index when new message sent
    - Reset to first response
    - _Requirements: 5.3_

  - [ ]* 10.4 Write unit tests for state persistence
    - Test state saves on close
    - Test state restores on reopen
    - Test state resets on new message
    - Test handling of invalid saved index
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [x] 11. Integrate navigation with existing modal
  - [x] 11.1 Modify showDetail function
    - Collect all available responses
    - Determine initial index (clicked card or saved)
    - Initialize NavigationController
    - Render navigation UI
    - Set up event listeners
    - _Requirements: 4.1, 4.2_

  - [x] 11.2 Modify closeDetailBtn handler
    - Save current navigation state
    - Clean up event listeners
    - Reset navigation lock
    - _Requirements: 5.1_

  - [x] 11.3 Handle single response case
    - Hide navigation arrows if only one response
    - Show position indicator as "1 of 1"
    - Disable keyboard/swipe navigation
    - _Requirements: 1.3, 1.5_

  - [ ]* 11.4 Write integration tests
    - Test opening modal initializes navigation
    - Test closing modal saves state
    - Test single response hides arrows
    - Test multiple responses shows arrows
    - _Requirements: 1.1, 4.1, 4.2, 5.1_

- [x] 12. Add transition animations
  - [x] 12.1 Create CSS animations for content transitions
    - Fade out old content
    - Fade in new content
    - Slide transition (optional)
    - _Requirements: 2.6_

  - [x] 12.2 Apply animations during navigation
    - Trigger animation on content update
    - Wait for animation to complete
    - Prevent navigation during animation
    - _Requirements: 2.6_

- [x] 13. Handle edge cases and error recovery
  - [x] 13.1 Implement rapid navigation prevention
    - Use isNavigating flag
    - Ignore navigation requests while navigating
    - _Requirements: 2.1, 2.2_

  - [x] 13.2 Handle response removal during navigation
    - Detect if current response removed
    - Navigate to nearest valid index
    - Close modal if no responses remain
    - _Requirements: 4.4_

  - [x] 13.3 Ensure navigation doesn't interfere with resize
    - Check if resize is active before navigating
    - Maintain current response during resize
    - _Requirements: 2.5_

  - [ ]* 13.4 Write unit tests for edge cases
    - Test rapid navigation prevention
    - Test response removal handling
    - Test navigation during resize
    - _Requirements: 2.1, 2.2, 4.4_

- [x] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Add accessibility features
  - [x] 15.1 Add ARIA live regions for position announcements
    - Announce position changes to screen readers
    - Format as "Showing response 2 of 3"
    - _Requirements: 6.1_

  - [x] 15.2 Ensure keyboard focus management
    - Maintain focus within modal during navigation
    - Focus on modal content after navigation
    - _Requirements: 3.4_

  - [x] 15.3 Test with screen readers
    - Verify navigation arrows are announced
    - Verify position changes are announced
    - Verify keyboard navigation works with screen reader

- [x] 16. Final testing and polish
  - [x] 16.1 Cross-browser testing
    - Test in Chrome/Edge
    - Test in Firefox
    - Test in Safari (desktop and iOS)
    - Test touch gestures on mobile devices

  - [x] 16.2 Performance optimization
    - Throttle rapid navigation attempts
    - Use passive event listeners for touch
    - Optimize animation performance

  - [x] 16.3 Visual polish
    - Verify arrow positioning doesn't obstruct content
    - Ensure smooth animations
    - Test in different modal widths
    - Verify position indicator visibility

- [x] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows

