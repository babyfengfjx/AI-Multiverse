// 测试三个关键修复的脚本
// 在浏览器控制台中运行

console.log('=== AI Multiverse v2.0.2 修复测试 ===\n');

// 测试1：元宝 API 监控
console.log('【测试1：元宝 API 监控】');
console.log('请在元宝页面提交一个问题，然后查看 Background Service Worker 日志');
console.log('预期日志：');
console.log('  [Network Monitor] ✓ yuanbao streaming started on tab XXX');
console.log('  [Network Monitor]   URL: https://yuanbao.tencent.com/api/chat');
console.log('  [Network Monitor] ✓ yuanbao streaming completed on tab XXX\n');

// 测试2：千问提交
console.log('【测试2：千问提交】');
console.log('请在千问页面通过侧边栏发送一个问题');
console.log('预期日志：');
console.log('  [AI Multiverse] Found button element: ...');
console.log('  [AI Multiverse] Clickable button: ...');
console.log('  [AI Multiverse] Button is enabled, clicking...');
console.log('  [AI Multiverse] Qwen: Using full click sequence');
console.log('  [AI Multiverse] Button clicked successfully\n');

// 测试3：Kimi 响应提取
console.log('【测试3：Kimi 响应提取】');
console.log('请在 Kimi 页面提交一个会生成表格的问题');
console.log('例如："列出5个编程语言的特点，用表格展示"');
console.log('预期结果：完成后应该显示完整内容（包括表格前的文字说明）\n');

// 辅助函数：检查配置
function checkConfig() {
    console.log('\n=== 配置检查 ===\n');
    
    // 检查元宝 API 模式
    console.log('【元宝 API 模式】');
    const yuanbaoPattern = /yuanbao\.tencent\.com\/api\/(user\/agent\/)?chat/;
    const testUrls = [
        'https://yuanbao.tencent.com/api/chat',
        'https://yuanbao.tencent.com/api/user/agent/chat'
    ];
    testUrls.forEach(url => {
        console.log(`  ${url}: ${yuanbaoPattern.test(url) ? '✓ 匹配' : '✗ 不匹配'}`);
    });
    
    // 检查千问按钮选择器
    console.log('\n【千问按钮选择器】');
    if (typeof AI_CONFIG !== 'undefined' && AI_CONFIG.qwen) {
        console.log('  配置的选择器数量:', AI_CONFIG.qwen.selectors.button.length);
        console.log('  第一个选择器:', AI_CONFIG.qwen.selectors.button[0]);
        console.log('  sendMethod:', AI_CONFIG.qwen.sendMethod);
    } else {
        console.log('  ✗ AI_CONFIG.qwen 未定义');
    }
    
    // 检查 Kimi 响应选择器
    console.log('\n【Kimi 响应选择器】');
    if (typeof AI_CONFIG !== 'undefined' && AI_CONFIG.kimi) {
        console.log('  配置的选择器数量:', AI_CONFIG.kimi.selectors.response.length);
        console.log('  第一个选择器:', AI_CONFIG.kimi.selectors.response[0]);
        const hasThinkingFilter = AI_CONFIG.kimi.selectors.response[0].includes(':not([class*="thinking"])');
        console.log('  包含思考过程过滤:', hasThinkingFilter ? '✓ 是' : '✗ 否');
    } else {
        console.log('  ✗ AI_CONFIG.kimi 未定义');
    }
}

// 辅助函数：测试千问按钮查找
function testQwenButton() {
    console.log('\n=== 千问按钮查找测试 ===\n');
    
    if (!window.location.hostname.includes('qianwen') && 
        !window.location.hostname.includes('tongyi') &&
        !window.location.hostname.includes('qwen')) {
        console.log('✗ 当前不在千问页面');
        return;
    }
    
    if (typeof AI_CONFIG === 'undefined' || !AI_CONFIG.qwen) {
        console.log('✗ AI_CONFIG.qwen 未定义');
        return;
    }
    
    const selectors = AI_CONFIG.qwen.selectors.button;
    console.log('测试', selectors.length, '个按钮选择器：\n');
    
    selectors.forEach((sel, idx) => {
        try {
            const elements = document.querySelectorAll(sel);
            if (elements.length > 0) {
                const el = elements[elements.length - 1];
                const isVisible = el.offsetParent !== null;
                const isDisabled = el.disabled || el.getAttribute('aria-disabled') === 'true';
                console.log(`${idx + 1}. ${sel}`);
                console.log(`   找到: ${elements.length} 个元素`);
                console.log(`   可见: ${isVisible ? '✓' : '✗'}`);
                console.log(`   启用: ${!isDisabled ? '✓' : '✗'}`);
                console.log(`   标签: ${el.tagName}`);
                console.log(`   类名: ${el.className}\n`);
            } else {
                console.log(`${idx + 1}. ${sel}`);
                console.log(`   找到: 0 个元素\n`);
            }
        } catch (e) {
            console.log(`${idx + 1}. ${sel}`);
            console.log(`   错误: ${e.message}\n`);
        }
    });
}

// 辅助函数：测试 Kimi 响应提取
function testKimiResponse() {
    console.log('\n=== Kimi 响应提取测试 ===\n');
    
    if (!window.location.hostname.includes('kimi')) {
        console.log('✗ 当前不在 Kimi 页面');
        return;
    }
    
    if (typeof AI_CONFIG === 'undefined' || !AI_CONFIG.kimi) {
        console.log('✗ AI_CONFIG.kimi 未定义');
        return;
    }
    
    const selectors = AI_CONFIG.kimi.selectors.response;
    console.log('测试', selectors.length, '个响应选择器：\n');
    
    selectors.forEach((sel, idx) => {
        try {
            const elements = document.querySelectorAll(sel);
            if (elements.length > 0) {
                const el = elements[elements.length - 1];
                const text = (el.innerText || el.textContent || '').trim();
                const hasThinking = el.querySelector('[class*="thinking"]') || 
                                   el.querySelector('[class*="thought"]');
                console.log(`${idx + 1}. ${sel}`);
                console.log(`   找到: ${elements.length} 个元素`);
                console.log(`   文本长度: ${text.length}`);
                console.log(`   包含思考过程: ${hasThinking ? '✓' : '✗'}`);
                console.log(`   文本预览: ${text.substring(0, 100)}...\n`);
            } else {
                console.log(`${idx + 1}. ${sel}`);
                console.log(`   找到: 0 个元素\n`);
            }
        } catch (e) {
            console.log(`${idx + 1}. ${sel}`);
            console.log(`   错误: ${e.message}\n`);
        }
    });
}

// 导出测试函数
window.testAIMultiverseFixes = {
    checkConfig,
    testQwenButton,
    testKimiResponse
};

console.log('测试函数已加载！');
console.log('使用方法：');
console.log('  testAIMultiverseFixes.checkConfig()      - 检查配置');
console.log('  testAIMultiverseFixes.testQwenButton()   - 测试千问按钮（需在千问页面）');
console.log('  testAIMultiverseFixes.testKimiResponse() - 测试 Kimi 响应（需在 Kimi 页面）');
