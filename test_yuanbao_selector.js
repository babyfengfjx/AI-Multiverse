// Yuanbao Response Selector Test
// Run this in Yuanbao console after getting a response

console.log('=== Yuanbao Selector Test ===');

const selectors = [
    'div.agent-chat__bubble__content',
    'div[class*="agent-chat__bubble__content"]',
    'div[class*="bubble__content"]',
    'div[class*="chat__bubble"]',
    '.markdown-body',
    'div[class*="message-content"]',
    'div[class*="chat-content"]',
    'div[class*="assistant-message"]',
    'div[class*="bot-message"]',
    'div[data-role="assistant"]',
    '.markdown-content',
    '.rich-text-content',
    'div.chat-view__message__content',
    'div[class*="answer"]',
    'div[class*="response"]',
    'div[class*="reply"]'
];

selectors.forEach((sel, idx) => {
    try {
        const elements = document.querySelectorAll(sel);
        if (elements.length > 0) {
            const lastEl = elements[elements.length - 1];
            const text = (lastEl.innerText || lastEl.textContent || '').trim();
            
            console.log(`${idx + 1}. "${sel}"`);
            console.log(`   Found: ${elements.length} elements`);
            console.log(`   Text length: ${text.length}`);
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
            return text.length > 50; // At least 50 chars
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

console.log('\n=== Network API Check ===');
console.log('Check the Network tab for:');
console.log('URL pattern: /api/user/agent/conversation/v1/detail');
console.log('This should appear when you submit a question');
