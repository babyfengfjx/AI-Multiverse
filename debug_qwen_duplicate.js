// 千问重复提交诊断脚本
// 在千问页面的控制台运行此脚本

console.log('=== 千问重复提交诊断 ===');

// 1. 检查输入框内容
const textbox = document.querySelector('div[role="textbox"]');
if (textbox) {
    console.log('输入框找到:', textbox);
    console.log('innerHTML:', textbox.innerHTML);
    console.log('innerText:', textbox.innerText);
    console.log('textContent:', textbox.textContent);
    
    // 检查是否有重复的段落
    const paragraphs = textbox.querySelectorAll('p');
    console.log('段落数量:', paragraphs.length);
    paragraphs.forEach((p, i) => {
        console.log(`段落 ${i}:`, p.textContent);
    });
} else {
    console.log('未找到输入框');
}

// 2. 监听输入事件
if (textbox) {
    ['beforeinput', 'input', 'change'].forEach(eventType => {
        textbox.addEventListener(eventType, (e) => {
            console.log(`事件: ${eventType}`, {
                data: e.data,
                inputType: e.inputType,
                content: textbox.textContent
            });
        });
    });
    console.log('已添加事件监听器');
}

// 3. 检查发送按钮
const btnSelectors = [
    'span[data-icon-type="qwpcicon-sendChat"]',
    'div[class*="operateBtn"]',
    'button:has(svg[data-icon-type="qwpcicon-sendChat"])',
    '.text-area-slot-container button'
];

btnSelectors.forEach(sel => {
    const btn = document.querySelector(sel);
    if (btn) {
        console.log('找到按钮:', sel, btn);
    }
});
