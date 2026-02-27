// Kimi Response Selector Test
// Run this in Kimi console after getting a response

console.log('=== Kimi Selector Test ===');

const selectors = [
    'div[class*="segment--assistant"]',
    '[class*="segment--assistant"]',
    '[class*="segment--assistant"] [class*="content"]',
    '[class*="segment--assistant"] [class*="message-body"]',
    '[class*="message-item"][class*="assistant"]',
    '[class*="msg"][class*="assistant"]',
    '.markdown-body',
    '[class*="chat-segment"][class*="assistant"]'
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
            console.log(`   First 150 chars: "${text.substring(0, 150)}"`);
            console.log(`   Last 100 chars: "${text.substring(text.length - 100)}"`);
            console.log('');
        } else {
            console.log(`${idx + 1}. "${sel}" - NOT FOUND`);
        }
    } catch (e) {
        console.log(`${idx + 1}. "${sel}" - ERROR: ${e.message}`);
    }
});

console.log('=== Best Selector (longest content) ===');
let bestSelector = null;
let maxLength = 0;

selectors.forEach(sel => {
    try {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) {
            const text = (els[els.length - 1].innerText || '').trim();
            if (text.length > maxLength) {
                maxLength = text.length;
                bestSelector = sel;
            }
        }
    } catch (e) {}
});

if (bestSelector) {
    console.log(`Best selector: "${bestSelector}"`);
    console.log(`Text length: ${maxLength}`);
    const el = document.querySelectorAll(bestSelector)[document.querySelectorAll(bestSelector).length - 1];
    console.log('Element:', el);
    console.log('Full text preview (first 300 chars):', (el.innerText || el.textContent).trim().substring(0, 300));
} else {
    console.log('No good selector found!');
}

console.log('\n=== Network API Check ===');
console.log('Check the Network tab for:');
console.log('URL pattern: /apiv2/kimi.gateway.chat.v1.ChatService/Chat');
console.log('Look for: MESSAGE_STATUS_GENERATING → MESSAGE_STATUS_COMPLETED');
console.log('\nThe response should contain JSON like:');
console.log('{"op":"set","mask":"message.status","message":{"status":"MESSAGE_STATUS_COMPLETED"}}');

console.log('\n=== DOM Structure ===');
const assistantSegments = document.querySelectorAll('[class*="segment--assistant"]');
if (assistantSegments.length > 0) {
    console.log(`Found ${assistantSegments.length} assistant segments`);
    const last = assistantSegments[assistantSegments.length - 1];
    console.log('Last segment classes:', last.className);
    console.log('Children count:', last.children.length);
    console.log('Children:');
    Array.from(last.children).forEach((child, idx) => {
        const text = (child.innerText || child.textContent || '').trim();
        console.log(`  ${idx + 1}. ${child.tagName}.${child.className} - ${text.length} chars`);
    });
}
