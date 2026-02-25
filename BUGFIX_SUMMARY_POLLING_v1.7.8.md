# Bug Fix: Summary Polling Gets Old Response (v1.7.8)

## Date
2024-02-13

## Issue

**Problem**: 总结的内容根本就不是最终总结的内容，而是上一次的 Gemini 回答的内容

**Root Cause**:
- Summary polling logic starts immediately after sending the summary request
- It fetches the "latest response" from Gemini page using `fetch_all_responses`
- But this response is the **OLD response** (from previous question), not the **NEW summary**
- The polling doesn't detect whether the response has changed or is new

**Expected Behavior**:
- Send summary prompt to Gemini
- Wait for Gemini to start generating NEW response
- Continuously monitor Gemini's response
- Detect when NEW response appears (different from previous)
- Capture the complete NEW summary response

## Solution

Implemented a **change detection** mechanism in the polling logic:

### 1. Capture Previous Response (Before Sending)
```javascript
// Before sending summary request, capture current response
let previousResponseText = '';
let previousResponseLength = 0;
const preCheckResult = await chrome.runtime.sendMessage({
    action: 'fetch_all_responses',
    providers: [summarizeModel]
});
if (preCheckResult && preCheckResult.status === 'ok') {
    const preData = preCheckResult.responses[summarizeModel];
    if (preData && preData.text) {
        previousResponseText = preData.text;
        previousResponseLength = preData.text.length;
    }
}
```

### 2. Send Summary Request
```javascript
chrome.runtime.sendMessage({
    action: 'summarize_responses',
    provider: summarizeModel,
    prompt: fullPrompt
});
```

### 3. Poll with Change Detection
```javascript
const pollForSummary = async () => {
    const fetchResult = await chrome.runtime.sendMessage({
        action: 'fetch_all_responses',
        providers: [summarizeModel]
    });
    
    const summaryData = fetchResult.responses[summarizeModel];
    const currentText = summaryData.text;
    const currentLength = currentText.length;
    
    // Check if this is a NEW response
    const isNewResponse = currentText !== previousResponseText && currentLength > 100;
    const hasGrown = currentLength > previousResponseLength + 50;
    
    if (isNewResponse || hasGrown) {
        // Got NEW summary!
        addSummaryResultToHistory(summarizeModel, currentText);
        return;
    }
    
    // Continue polling...
};
```

### Key Changes

1. **Pre-capture**: Capture previous response before sending summary request
2. **Change detection**: Compare current response with previous response
3. **Multiple checks**:
   - Content is different: `currentText !== previousResponseText`
   - Length is sufficient: `currentLength > 100`
   - Or length has grown: `currentLength > previousResponseLength + 50`
4. **Longer initial delay**: Wait 5 seconds before first poll (give Gemini time to start)
5. **Longer timeout**: 120 attempts (2 minutes) instead of 60 seconds

## Technical Details

### Detection Logic
```javascript
const isNewResponse = currentText !== previousResponseText && currentLength > 100;
const hasGrown = currentLength > previousResponseLength + 50;

if (isNewResponse || hasGrown) {
    // This is the NEW summary response!
}
```

### Timing
- **Initial delay**: 5 seconds (was 2 seconds)
  - Gives Gemini time to start generating new response
  - Prevents capturing the old response immediately
- **Poll interval**: 1 second
- **Max attempts**: 120 (2 minutes total)
  - Summary generation can take longer than regular responses

### Why This Works

1. **Before sending**: We know what the OLD response looks like
2. **After sending**: Gemini starts generating NEW response
3. **During polling**: We can detect when the response changes
4. **Result**: We capture the NEW summary, not the old response

## Files Modified

- `src/sidepanel/sidepanel.js`
  - `performSummarization()`: Added pre-capture logic
  - `pollForSummary()`: Added change detection logic
  - Increased timeout from 60s to 120s
  - Increased initial delay from 2s to 5s

## Testing Checklist

- [x] Send a question to multiple AI models
- [x] Wait for responses to complete
- [x] Click "智能总结" button
- [x] Verify summary request is sent to Gemini
- [x] Wait for summary to complete (may take 30-60 seconds)
- [x] Verify summary content is NEW (not old response)
- [x] Verify summary is saved to history
- [x] Reload extension and verify summary persists

## Console Logs

The fix adds detailed logging:
```
[AI Multiverse] 📸 Captured previous response length: 1234
[AI Multiverse] 📤 Sending summarize_responses message to background...
[AI Multiverse] Starting to poll for summary result...
[AI Multiverse] Will detect NEW response (different from previous)
[AI Multiverse] Poll attempt 1/120
[AI Multiverse] Response check: {
  currentLength: 1234,
  previousLength: 1234,
  isNewResponse: false,
  hasGrown: false,
  isDifferent: false
}
[AI Multiverse] ⏳ Still waiting for NEW response...
[AI Multiverse] Poll attempt 5/120
[AI Multiverse] Response check: {
  currentLength: 2500,
  previousLength: 1234,
  isNewResponse: true,
  hasGrown: true,
  isDifferent: true
}
[AI Multiverse] ✅ NEW summary detected! Length: 2500
```

## Notes

- Summary generation typically takes 20-60 seconds depending on:
  - Number of responses being summarized
  - Length of each response
  - Gemini's current load
- The 5-second initial delay ensures we don't capture the old response
- The 2-minute timeout is sufficient for most summaries
- Change detection is robust: checks both content difference and length growth

## Related Issues

This fix resolves the core issue where users were seeing old responses instead of new summaries. The previous polling logic had no way to distinguish between old and new responses.
