// Gemini Response Selector Test
// Run this in Gemini console after getting a response

console.log('=== Gemini Selector Test ===');

const selectors = [
    'model-response .markdown.markdown-main-panel',
    'model-response .model-response-text',
    'message-content .markdown.markdown-main-panel',
    'model-response .markdown:not(.markdown-header):not(:empty)',
    'message-content .markdown:not(:empty)',
    'div[data-message-id] .markdown:not(:empty)',
    'model-response',
    'message-content'
];

selectors.forEach((sel, idx) => {
    try {
        const elements = document.querySelectorAll(sel);
        if (elements.length > 0) {
            const lastEl = elements[elements.length - 1];
            const text = (lastEl.innerText || lastEl.textContent || '').trim();
            
            // Count leading blank lines
            const lines = text.split('\n');
            let leadingBlanks = 0;
            for (const line of lines) {
                if (line.trim() === '') leadingBlanks++;
                else break;
            }
            
            console.log(`${idx + 1}. "${sel}"`);
            console.log(`   Found: ${elements.length} elements`);
            console.log(`   Text length: ${text.length}`);
            console.log(`   Leading blank lines: ${leadingBlanks}`);
            console.log(`   First 100 chars: "${text.substring(0, 100)}"`);
            console.log('');
        } else {
            console.log(`${idx + 1}. "${sel}" - NOT FOUND`);
        }
    } catch (e) {
        console.log(`${idx + 1}. "${sel}" - ERROR: ${e.message}`);
    }
});

console.log('=== Best Selector ===');
const best = selectors.find(sel => {
    try {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) {
            const text = (els[els.length - 1].innerText || '').trim();
            const lines = text.split('\n');
            let leadingBlanks = 0;
            for (const line of lines) {
                if (line.trim() === '') leadingBlanks++;
                else break;
            }
            return text.length > 0 && leadingBlanks < 3;
        }
    } catch (e) {}
    return false;
});

if (best) {
    console.log(`Best selector: "${best}"`);
    const el = document.querySelectorAll(best)[document.querySelectorAll(best).length - 1];
    console.log('Element:', el);
    console.log('Text preview:', (el.innerText || el.textContent).trim().substring(0, 200));
} else {
    console.log('No good selector found!');
}
