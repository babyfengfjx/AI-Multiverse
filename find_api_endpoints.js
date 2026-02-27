// API 端点查找工具
// 在每个 AI 平台页面的控制台运行此脚本，然后提交一个问题

console.log('=== API 端点查找工具 ===');
console.log('当前页面:', window.location.hostname);
console.log('');
console.log('请按以下步骤操作：');
console.log('1. 打开 Network 标签（在开发者工具中）');
console.log('2. 过滤 XHR/Fetch 请求');
console.log('3. 提交一个问题到 AI');
console.log('4. 查找正在进行的请求（通常是最长的那个）');
console.log('5. 复制该请求的 URL');
console.log('');

// 拦截所有 fetch 请求
const originalFetch = window.fetch;
const fetchLog = [];

window.fetch = function(...args) {
    const url = args[0];
    const startTime = Date.now();
    
    console.log('📡 Fetch 请求:', url);
    
    fetchLog.push({
        url: url,
        startTime: startTime,
        status: 'pending'
    });
    
    return originalFetch.apply(this, args).then(response => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log('✅ Fetch 完成:', url, `(${duration}ms)`);
        
        // 更新日志
        const logEntry = fetchLog.find(f => f.url === url && f.startTime === startTime);
        if (logEntry) {
            logEntry.status = 'completed';
            logEntry.endTime = endTime;
            logEntry.duration = duration;
        }
        
        return response;
    }).catch(error => {
        console.log('❌ Fetch 错误:', url, error);
        
        const logEntry = fetchLog.find(f => f.url === url && f.startTime === startTime);
        if (logEntry) {
            logEntry.status = 'error';
            logEntry.error = error.message;
        }
        
        throw error;
    });
};

// 拦截所有 XMLHttpRequest
const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;
const xhrLog = [];

XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._url = url;
    this._method = method;
    this._startTime = Date.now();
    
    console.log('📡 XHR 请求:', method, url);
    
    return originalOpen.apply(this, [method, url, ...args]);
};

XMLHttpRequest.prototype.send = function(...args) {
    const xhr = this;
    
    xhr.addEventListener('load', function() {
        const endTime = Date.now();
        const duration = endTime - xhr._startTime;
        
        console.log('✅ XHR 完成:', xhr._method, xhr._url, `(${duration}ms)`);
        
        xhrLog.push({
            method: xhr._method,
            url: xhr._url,
            status: xhr.status,
            duration: duration
        });
    });
    
    xhr.addEventListener('error', function() {
        console.log('❌ XHR 错误:', xhr._method, xhr._url);
    });
    
    return originalSend.apply(this, args);
};

console.log('');
console.log('✅ 监听已启动！');
console.log('现在提交一个问题，然后运行以下命令查看结果：');
console.log('');
console.log('// 查看所有 Fetch 请求');
console.log('console.table(fetchLog);');
console.log('');
console.log('// 查看所有 XHR 请求');
console.log('console.table(xhrLog);');
console.log('');
console.log('// 查找最长的请求（通常是流式 API）');
console.log('const longest = [...fetchLog, ...xhrLog].sort((a, b) => (b.duration || 0) - (a.duration || 0))[0];');
console.log('console.log("最长请求:", longest);');
