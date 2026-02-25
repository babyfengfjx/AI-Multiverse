# Design Document: Modal Navigation

## Overview

This document describes the design for implementing navigation functionality in the AI response detail modal. The feature allows users to browse through multiple AI responses using arrow buttons, keyboard shortcuts, and touch gestures without closing and reopening the modal.

## Architecture

### Component Structure

```
DetailModal
├── ModalHeader
│   ├── ProviderIcon
│   ├── ProviderName
│   └── CloseButton
├── NavigationControls
│   ├── LeftArrow
│   └── RightArrow
├── ModalContent
│   └── ResponseText (Markdown rendered)
├── PositionIndicator
│   ├── TextIndicator ("X of Y")
│   └── DotIndicator (visual dots)
└── ResizeHandles (existing)
```

### State Management

The modal navigation state will be managed through JavaScript variables:

```javascript
let modalNavigationState = {
    responses: [],           // Array of response objects
    currentIndex: 0,         // Current response index
    lastViewedIndex: 0,      // For persistence
    isNavigating: false      // Prevent concurrent navigation
};
```

### Data Flow

1. **Modal Open**: 
   - Collect all available responses from `lastResponses`
   - Determine the initial response (clicked card or last viewed)
   - Initialize navigation state
   - Render modal with navigation controls

2. **Navigation Action**:
   - Validate navigation is possible (not at boundary)
   - Update current index
   - Fetch new response data
   - Update modal content (header, text, position indicator)
   - Apply transition animation

3. **Modal Close**:
   - Save current index to session state
   - Clean up event listeners

## Components and Interfaces

### NavigationController

Manages navigation logic and state:

```javascript
class NavigationController {
    constructor(responses, initialIndex) {
        this.responses = responses;
        this.currentIndex = initialIndex;
    }
    
    canNavigatePrevious() {
        return this.currentIndex > 0;
    }
    
    canNavigateNext() {
        return this.currentIndex < this.responses.length - 1;
    }
    
    navigatePrevious() {
        if (this.canNavigatePrevious()) {
            this.currentIndex--;
            return this.getCurrentResponse();
        }
        return null;
    }
    
    navigateNext() {
        if (this.canNavigateNext()) {
            this.currentIndex++;
            return this.getCurrentResponse();
        }
        return null;
    }
    
    getCurrentResponse() {
        return this.responses[this.currentIndex];
    }
    
    getPosition() {
        return {
            current: this.currentIndex + 1,
            total: this.responses.length
        };
    }
}
```

### UI Components

#### Navigation Arrows

HTML structure:
```html
<button class="modal-nav-arrow modal-nav-left" aria-label="Previous response">
    <svg><!-- Left arrow icon --></svg>
</button>
<button class="modal-nav-arrow modal-nav-right" aria-label="Next response">
    <svg><!-- Right arrow icon --></svg>
</button>
```

CSS positioning:
- Fixed position on modal edges
- Left arrow: `left: 20px`
- Right arrow: `right: 20px`
- Vertical center: `top: 50%; transform: translateY(-50%)`
- Z-index above content but below close button

#### Position Indicator

HTML structure:
```html
<div class="modal-position-indicator">
    <span class="position-text">1 of 3</span>
    <div class="position-dots">
        <span class="dot active"></span>
        <span class="dot"></span>
        <span class="dot"></span>
    </div>
</div>
```

Positioning:
- Bottom center of modal
- `position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%)`

### Event Handlers

#### Click Navigation

```javascript
function handleNavigationClick(direction) {
    if (modalNavigationState.isNavigating) return;
    
    modalNavigationState.isNavigating = true;
    
    const controller = new NavigationController(
        modalNavigationState.responses,
        modalNavigationState.currentIndex
    );
    
    const newResponse = direction === 'prev' 
        ? controller.navigatePrevious()
        : controller.navigateNext();
    
    if (newResponse) {
        modalNavigationState.currentIndex = controller.currentIndex;
        updateModalContent(newResponse);
        updateNavigationControls(controller);
        updatePositionIndicator(controller.getPosition());
    }
    
    modalNavigationState.isNavigating = false;
}
```

#### Keyboard Navigation

```javascript
function handleKeyboardNavigation(event) {
    if (!detailModal.classList.contains('active')) return;
    
    // Ignore if user is selecting text
    if (window.getSelection().toString().length > 0) return;
    
    switch(event.key) {
        case 'ArrowLeft':
            event.preventDefault();
            handleNavigationClick('prev');
            break;
        case 'ArrowRight':
            event.preventDefault();
            handleNavigationClick('next');
            break;
        case 'Escape':
            event.preventDefault();
            closeDetailModal();
            break;
    }
}

document.addEventListener('keydown', handleKeyboardNavigation);
```

#### Touch/Swipe Navigation

```javascript
let touchStartX = 0;
let touchEndX = 0;
const SWIPE_THRESHOLD = 50; // minimum pixels for swipe

function handleTouchStart(event) {
    touchStartX = event.changedTouches[0].screenX;
}

function handleTouchEnd(event) {
    touchEndX = event.changedTouches[0].screenX;
    handleSwipe();
}

function handleSwipe() {
    const swipeDistance = touchEndX - touchStartX;
    
    if (Math.abs(swipeDistance) < SWIPE_THRESHOLD) return;
    
    if (swipeDistance > 0) {
        // Swipe right - go to previous
        handleNavigationClick('prev');
    } else {
        // Swipe left - go to next
        handleNavigationClick('next');
    }
}

detailModal.addEventListener('touchstart', handleTouchStart);
detailModal.addEventListener('touchend', handleTouchEnd);
```

## Data Models

### Response Object

```javascript
{
    provider: 'gemini',           // Provider ID
    name: 'Gemini',               // Display name
    icon: 'path/to/icon.svg',     // Provider icon
    text: 'Response text...',     // Response content
    html: '<p>Response...</p>',   // Rendered HTML
    status: 'ok',                 // Response status
    length: 1234                  // Text length
}
```

### Navigation State

```javascript
{
    responses: [Response],        // Array of response objects
    currentIndex: 0,              // Current position (0-based)
    lastViewedIndex: 0,           // Last viewed position
    isNavigating: false           // Navigation lock flag
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Arrow Button State Consistency
*For any* response collection and current index, the left arrow should be enabled if and only if there exists a previous response (index > 0), and the right arrow should be enabled if and only if there exists a next response (index < total - 1)
**Validates: Requirements 1.2, 1.3, 1.4, 1.5**

### Property 2: Navigation Direction Correctness
*For any* valid navigation action (click, keyboard, or swipe), navigating previous should decrease the index by 1 and display the previous response, and navigating next should increase the index by 1 and display the next response
**Validates: Requirements 2.1, 2.2, 3.1, 3.2, 7.1, 7.2**

### Property 3: Content Update Consistency
*For any* navigation action, after switching responses, the modal header should display the new provider's name and icon, and the modal content should display the new response's text
**Validates: Requirements 2.3, 2.4**

### Property 4: Modal Dimensions Invariant
*For any* navigation action, the modal's width and position should remain unchanged before and after the navigation
**Validates: Requirements 2.5**

### Property 5: Copy Button Synchronization
*For any* navigation state, clicking the copy button should copy the text of the currently displayed response, not any previously viewed response
**Validates: Requirements 2.7**

### Property 6: Response Order Preservation
*For any* response collection, the order of responses should match the provider selection order and should remain constant throughout the session
**Validates: Requirements 4.1**

### Property 7: Index Update Correctness
*For any* navigation action, the current index should be incremented by 1 for next navigation and decremented by 1 for previous navigation, and should never go below 0 or above (total - 1)
**Validates: Requirements 4.2, 4.3**

### Property 8: Position Indicator Accuracy
*For any* navigation state, the position indicator should display "X of Y" where X equals (currentIndex + 1) and Y equals the total number of responses
**Validates: Requirements 4.5, 6.1, 6.3**

### Property 9: Keyboard Event Scope
*For any* keyboard event, navigation should only occur when the detail modal is open and focused, and should not occur when text is selected
**Validates: Requirements 3.4, 3.5**

### Property 10: Swipe Distance Threshold
*For any* touch gesture, navigation should only trigger if the swipe distance exceeds the minimum threshold, preventing accidental navigation
**Validates: Requirements 7.5**

### Property 11: Swipe vs Text Selection
*For any* touch interaction, if the user is selecting text, swipe navigation should not trigger
**Validates: Requirements 7.3**

### Property 12: Dot Indicator Synchronization
*For any* navigation state with multiple responses, the active dot in the visual indicator should correspond to the current index
**Validates: Requirements 6.5**

## Error Handling

### Edge Cases

1. **Single Response**: 
   - Hide or disable both navigation arrows
   - Position indicator shows "1 of 1"
   - Keyboard/swipe navigation does nothing

2. **Response Removed During Navigation**:
   - If current response is removed, navigate to nearest valid index
   - If all responses removed, close modal
   - Update position indicator accordingly

3. **Rapid Navigation**:
   - Use `isNavigating` flag to prevent concurrent navigation
   - Queue navigation requests if needed
   - Ensure animations complete before next navigation

4. **Modal Resize During Navigation**:
   - Navigation should not interfere with resize operation
   - Maintain current response when resizing

### Error Recovery

- If navigation fails, stay on current response
- Log errors to console for debugging
- Show user-friendly error message if critical failure
- Gracefully degrade if touch events not supported

## Testing Strategy

### Unit Tests

1. **NavigationController Tests**:
   - Test `canNavigatePrevious()` at boundaries
   - Test `canNavigateNext()` at boundaries
   - Test index updates for navigation methods
   - Test `getPosition()` accuracy

2. **Event Handler Tests**:
   - Test click handlers update state correctly
   - Test keyboard handlers respond to correct keys
   - Test keyboard handlers ignore events when modal closed
   - Test swipe handlers calculate distance correctly

3. **UI Update Tests**:
   - Test modal content updates with new response
   - Test position indicator updates correctly
   - Test arrow button states update correctly
   - Test dot indicators update correctly

### Property-Based Tests

Each correctness property should be implemented as a property-based test with minimum 100 iterations:

1. **Property 1 Test**: Generate random response collections and indices, verify arrow states
2. **Property 2 Test**: Generate random navigation sequences, verify index changes
3. **Property 3 Test**: Generate random responses, verify content updates
4. **Property 4 Test**: Generate random navigation actions, verify dimensions unchanged
5. **Property 5 Test**: Generate random navigation states, verify copy button copies current response
6. **Property 6 Test**: Generate random provider selections, verify order preservation
7. **Property 7 Test**: Generate random navigation sequences, verify index bounds
8. **Property 8 Test**: Generate random navigation states, verify indicator text
9. **Property 9 Test**: Generate random keyboard events with different modal states
10. **Property 10 Test**: Generate random swipe distances, verify threshold behavior
11. **Property 11 Test**: Generate random touch interactions with text selection
12. **Property 12 Test**: Generate random navigation states, verify dot highlighting

### Integration Tests

1. Open modal → navigate → verify content changes
2. Navigate to boundary → verify arrow disabled
3. Close and reopen modal → verify last viewed response
4. Send new message → verify navigation state reset
5. Navigate with keyboard → verify same behavior as click
6. Swipe on touch device → verify navigation works

### Manual Testing

1. Visual verification of arrow positioning
2. Animation smoothness during navigation
3. Touch gesture feel and responsiveness
4. Accessibility with screen readers
5. Cross-browser compatibility

## Performance Considerations

1. **Lazy Loading**: Only render visible response, not all responses
2. **Event Throttling**: Throttle rapid navigation attempts
3. **Animation Performance**: Use CSS transforms for smooth animations
4. **Memory Management**: Clean up event listeners on modal close
5. **Touch Event Optimization**: Use passive event listeners where possible

## Accessibility

1. **ARIA Labels**: Add descriptive labels to navigation arrows
2. **Keyboard Navigation**: Full keyboard support (arrows, Escape)
3. **Focus Management**: Maintain focus within modal during navigation
4. **Screen Reader**: Announce position changes ("Showing response 2 of 3")
5. **High Contrast**: Ensure arrows visible in high contrast mode

## Browser Compatibility

- Chrome/Edge: Full support (primary target)
- Firefox: Full support
- Safari: Full support (test touch events on iOS)
- Mobile browsers: Test touch/swipe gestures

## Future Enhancements

1. **Thumbnail Preview**: Show small previews of adjacent responses
2. **Keyboard Shortcuts**: Add Home/End keys for first/last response
3. **Mouse Wheel**: Navigate with mouse wheel
4. **Animation Options**: Allow users to disable animations
5. **Quick Jump**: Click on dot indicators to jump to specific response

