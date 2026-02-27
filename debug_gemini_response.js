// Gemini 响应提取调试脚本
// 在 Gemini 页面控制台运行

console.log('=== Gemini 响应提取调试 ===');

const selectors = [
    'model-response .markdown',
    'message-content .markdown',
    '.response-container .markdown',
    'div[data-message-id] .markdown',
    'model-response',
    'message-content'
];

console.log('\n检查每个选择器：');
selectors.forEach((sel, idx) => {
    try {
        const elements = document.querySelectorAll(sel);
        if (elements.length > 0) {
            const last = elements[elements.length - 1];
            const text = (last.innerText || last.textContent || '').trim();
            
            console.log(`\n${idx + 1}. ${sel}`);
            console.log('   找到:', elements.length, '个元素');
            console.log('   最后一个文本长度:', text.length);
            console.log('   前100字符:', text.substring(0, 100));
            console.log('   是否有前导空白:', text !== text.trimStart());
            
            // 检查是否包含多余的空白
            const lines = text.split('\n');
            const emptyLines = lines.filter(l => l.trim() === '').length;
            console.log('   总行数:', lines.length);
            console.log('   空行数:', emptyLines);
            
            if (emptyLines > 5) {
                console.warn('   ⚠️ 包含过多空行！');
            }
        } else {
            console.log(`\n${idx + 1}. ${sel} - 未找到`);
        }
    } catch (e) {
        console.log(`\n${idx + 1}. ${sel} - 错误:`, e.message);
    }
});

// 检查实际的 DOM 结构
console.log('\n\n=== DOM 结构分析 ===');
const modelResponse = document.querySelector('model-response');
if (modelResponse) {
    console.log('找到 model-response 元素');
    console.log('子元素数量:', modelResponse.children.length);
    console.log('子元素列表:');
    Array.from(modelResponse.children).forEach((child, idx) => {
        console.log(`  ${idx + 1}. ${child.tagName}.${child.className}`);
        const text = (child.innerText || child.textContent || '').trim();
        if (text.length > 0) {
            console.log(`     文本长度: ${text.length}`);
            console.log(`     前50字符: ${text.substring(0, 50)}`);
        }
    });
} else {
    console.log('未找到 model-response 元素');
}

// 查找 markdown 容器
console.log('\n\n=== Markdown 容器分析 ===');
const markdowns = document.querySelectorAll('.markdown, [class*="markdown"]');
console.log('找到', markdowns.length, '个 markdown 元素');
markdowns.forEach((md, idx) => {
    const text = (md.innerText || md.textContent || '').trim();
    if (text.length > 0) {
        console.log(`\n${idx + 1}. ${md.className}`);
        console.log('   文本长度:', text.length);
        console.log('   前100字符:', text.substring(0, 100));
    }
});

console.log('\n=== 调试完成 ===');
