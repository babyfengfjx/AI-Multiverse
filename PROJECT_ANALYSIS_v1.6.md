# AI Multiverse Chat v1.6 - 项目系统性检查报告

**分析日期**: 2026-02-12
**代码行数**: 4426行
**分析工具**: 静态代码分析 + 人工审查

---

## 📊 执行摘要

### 整体评价
- **代码质量**: ⭐⭐⭐⭐☆ (4/5) - 良好
- **功能完整性**: ⭐⭐⭐☆☆ (3/5) - 基础完善，高级功能待补充
- **安全性**: ⭐⭐⭐☆☆ (3/5) - 存在XSS风险需修复
- **性能**: ⭐⭐⭐⭐☆ (4/5) - 良好，有优化空间
- **可维护性**: ⭐⭐⭐⭐☆ (4/5) - 结构清晰，文档完善

### 关键发现
- 🔴 **Critical**: XSS安全漏洞（3处）需立即修复
- 🟡 **High**: 用户体验问题（alert阻塞）需优化
- 🟢 **Medium**: 性能优化机会（渲染优化）
- 🔵 **Low**: 功能增强建议（拖放、搜索等）

---

## 🐛 一、代码质量问题

### 1.1 安全漏洞（Critical）⚠️

#### 问题1: XSS注入风险
**位置**: `src/sidepanel/sidepanel.js:726`

```javascript
// ❌ 危险代码
const info = document.createElement('div');
info.innerHTML = `
    <div class="file-name">${file.name}</div>
    <div class="file-size">${formatFileSize(file.size)}</div>
`;
```

**风险**: 文件名可能包含恶意HTML代码，如：
```
<img src=x onerror=alert('XSS')>.png
```

**修复方案**:
```javascript
// ✅ 安全代码
const info = document.createElement('div');

const fileNameDiv = document.createElement('div');
fileNameDiv.className = 'file-name';
fileNameDiv.textContent = file.name; // 自动转义

const fileSizeDiv = document.createElement('div');
fileSizeDiv.className = 'file-size';
fileSizeDiv.textContent = formatFileSize(file.size);

info.appendChild(fileNameDiv);
info.appendChild(fileSizeDiv);
```

**影响范围**:
- line 325: 历史记录元数据
- line 389: 响应提供商名称
- line 401: 响应错误消息
- line 726: 文件名显示

**优先级**: 🔴 P0 - 需要在v1.6.1立即修复

---

#### 问题2: 响应内容XSS风险
**位置**: `src/sidepanel/sidepanel.js:401`

```javascript
// ❌ 直接插入响应内容
body.innerHTML = `<span style="color:var(--error)">${data.error || t('error')}</span>`;
```

虽然`data.error`来自可信的content script，但最佳实践仍应转义。

---

### 1.2 用户体验问题（High）

#### 问题1: 使用alert()阻塞UI
**位置**: `src/sidepanel/sidepanel.js:643, 652, 664`

```javascript
// ❌ 阻塞UI
alert(t('file_too_large', { max: (MAX_FILE_SIZE / 1024 / 1024).toFixed(0) }));
```

**影响**:
- 阻塞用户操作
- 不符合现代UX标准
- 无法自定义样式

**修复方案**: 实现Toast通知系统

```javascript
// ✅ 非阻塞通知
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        background: var(--bg-primary);
        color: var(--text-primary);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// 使用示例
showToast(t('file_too_large', { max: 10 }), 'error');
```

**CSS追加**:
```css
@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
}

.toast-error { border-left: 4px solid #ef4444; }
.toast-success { border-left: 4px solid #22c55e; }
.toast-info { border-left: 4px solid #3b82f6; }
```

**优先级**: 🟡 P1 - 建议v1.7实现

---

#### 问题2: 文件上传无进度反馈
**当前位置**: 上传是静默的，大文件(>5MB)可能让用户以为卡死

**修复方案**: 添加简单进度指示器

```javascript
function showUploadingProgress(uploaded, total, fileName) {
    const progressBar = document.createElement('div');
    progressBar.className = 'upload-progress';
    progressBar.innerHTML = `
        <div class="progress-bar" style="width: ${(uploaded/total)*100}%"></div>
        <div class="progress-text">Uploading ${fileName} - ${uploaded}/${total} files</div>
    `;
    // 显示在文件预览区上方
    filePreview.insertBefore(progressBar, filePreviewList);
    return progressBar;
}

async function uploadFiles(files, config, provider) {
    const progressBar = showUploadingProgress(0, files.length, provider);
    for (let i = 0; i < files.length; i++) {
        await uploadSingleFile(files[i], config, provider);
        updateProgressBar(progressBar, i + 1, files.length);
    }
    progressBar.remove();
}
```

**优先级**: 🟢 P2 - v1.8实现

---

### 1.3 内存泄漏风险（Medium）

#### 问题1: 事件监听器未清理
**现状**: 23个事件监听器，但无removeEventListener调用

**影响**: 在长时间运行或频繁操作时可能累积内存

**代码清单**:
```javascript
sidepanel.js: 23个addEventListener
- fileInput.addEventListener('change', handleFileSelect)
- attachFileBtn.addEventListener('click', ...)
- sendBtn.addEventListener('click', ...)
- resetLayoutBtn.addEventListener('click', ...)
- browseModeBtn.addEventListener('click', ...)
- launchBtn.addEventListener('click', ...)
- tileBtn.addEventListener('click', ...)
- closeAllBtn.addEventListener('click', ...)
- clearHistoryBtn.addEventListener('click', ...)
- fetchResponsesBtn.addEventListener('click', ...)
- copyAllBtn.addEventListener('click', ...)
- themeBtn.addEventListener('click', ...)
- langBtn.addEventListener('click', ...)
- browseModeBtn.addEventListener('click', ...)
- closeAllContent.addEventListener('click', ...)
- closeConfirm.addEventListener('click', ...)
- closeCancel.addEventListener('click', ...)
- promptInput.addEventListener('input', ...)
- promptInput.addEventListener('keydown', ...)
- // ... plus more in history render
```

**建议**:
```javascript
// 在sidepanel.js顶层添加
const cleanupFunctions = [];

function registerEvent(element, event, handler, options = {}) {
    element.addEventListener(event, handler, options);
    cleanupFunctions.push(() => {
        element.removeEventListener(event, handler, options);
    });
}

// 使用示例替代原生addEventListener
registerEvent(fileInput, 'change', handleFileSelect);

// 在需要清理时（如果有SPA切换）
function cleanup() {
    cleanupFunctions.forEach(fn => fn());
}
```

**优先级**: 🟢 P3 - 优化项，当前影响不大

---

#### 问题2: 定时器未跟踪
**现状**: 10处setTimeout/setInterval，无清理机制

**代码位置**:
```javascript
sidepanel.js: line 447, 449, 452 (autoRefresh)
background.js: 自动刷新定时器（多处）
content.js: delay()函数返回定时器，但未存储
```

**建议**:
```javascript
// 创建定时器管理器
const TimerManager = {
    timers: new Set(),

    settimeout(callback, delay, ...args) {
        const id = setTimeout(() => {
            callback(...args);
            this.timers.delete(id);
        }, delay);
        this.timers.add(id);
        return id;
    },

    clearAll() {
        this.timers.forEach(id => clearTimeout(id));
        this.timers.clear();
    }
};

// 使用
TimerManager.settimeout(() => fetchResponses(), 5000);
```

**优先级**: 🟢 P3 - 当前未发现实际内存问题

---

### 1.4 性能优化建议（Low）

#### 问题1: 全量DOM重绘
**位置**:
- line 307: `historyList.innerHTML = ''`
- line 345: `responsesGrid.innerHTML = ''`
- line 363: `responsesGrid.innerHTML = ''`
- line 703: `filePreviewList.innerHTML = ''`

**影响**: 当列表较长时（50条历史记录+7个响应），全部重绘会有闪烁

**优化方案**: 使用虚拟滚动或增量更新

```javascript
// 增量更新（简单方案）
function addToResponsesGrid(responseCard) {
    const firstCard = responsesGrid.querySelector('.response-card');
    if (firstCard) {
        responsesGrid.insertBefore(responseCard, firstCard);
    } else {
        responsesGrid.appendChild(responseCard);
    }
}

// 对于历史记录，可以保留recent 10条，其余隐藏
function renderHistory() {
    chrome.storage.local.get(['chat_history'], (result) => {
        const history = result.chat_history || [];
        historyList.innerHTML = '';

        // 只显示最近10条，其他可折叠
        const recentHistory = history.slice(-10);
        recentHistory.forEach(entry => {
            const card = createHistoryCard(entry);
            historyList.appendChild(card);
        });

        // 添加"显示全部"按钮
        if (history.length > 10) {
            const showAllBtn = document.createElement('button');
            showAllBtn.textContent = `Show all ${history.length}`;
            showAllBtn.onclick = () => renderAllHistory(history);
            historyList.appendChild(showAllBtn);
        }
    });
}
```

**优先级**: 🔵 P4 - 性能问题不严重

---

#### 问题2: 文件读取性能
**现状**: `readFileAsDataURL`读取大文件(>5MB)可能阻塞UI

**优化方案**:
```javascript
// 分块读取大文件
async function readFileInChunks(file, chunkSize = 1024 * 1024) { // 1MB chunks
    if (file.size < chunkSize) {
        return readFileAsDataURL(file);
    }

    const chunks = [];
    const totalChunks = Math.ceil(file.size / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        const chunkDataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.readAsDataURL(chunk);
        });

        chunks.push(chunkDataUrl);
        // 更新进度
        showProgress((i + 1) / totalChunks * 100);
    }

    return chunks.join('');
}
```

**优先级**: 🔵 P4 - 当前10MB限制下不是瓶颈

---

### 1.5 代码质量问题（Low）

#### 问题1: 未使用的变量/常量
**发现**: 39个const声明，部分可能未使用

**建议清理**:
```bash
# 在开发模式下添加ESLint检查
npm install --save-dev eslint
npx eslint src/ --ignore-pattern "*.min.js"
```

**人工检查**: 用静态分析工具标记未使用变量

---

#### 问题2: CSS类名重复
**发现**: 125个重复的CSS类名

**建议**: 统一CSS类命名规范
```css
/* 当前: 混合使用snake_case, camelCase, kebab-case */
.history-card { /* snake_case */ }
.responseCard { /* camelCase */ }
.file-preview { /* kebab-case */ }

/* 建议: 统一使用kebab-case */
.history-card { }
.response-card { }
.file-preview { }
```

---

## 💡 二、功能增强建议

### 2.1 用户体验（High Priority）

#### 功能1: Toast通知系统
**描述**: 替代alert，提供非阻塞、可样式的通知

**实现复杂度**: 低
**用户价值**: 高

**建议实现**:
```javascript
// src/toast.js
export class Toast {
    static show(message, options = {}) {
        const {
            type = 'info',  // success, error, warning, info
            duration = 3000,
            action = null,  // 可选操作按钮
            position = 'top-right'
        } = options;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type} toast-${position}`;
        toast.innerHTML = `
            <div class="toast-content">${message}</div>
            ${action ? `<button class="toast-action">${action.label}</button>` : ''}
            <button class="toast-close">×</button>
        `;

        document.body.appendChild(toast);

        // 自动关闭
        const timer = setTimeout(() => toast.remove(), duration);

        // 手动关闭
        toast.querySelector('.toast-close').onclick = () => {
            clearTimeout(timer);
            toast.remove();
        };

        // 操作按钮
        if (action) {
            toast.querySelector('.toast-action').onclick = () => {
                action.handler();
                clearTimeout(timer);
                toast.remove();
            };
        }

        return toast;
    }
}

// 使用
Toast.show('File uploaded successfully', {
    type: 'success',
    action: { label: 'Undo', handler: () => undoUpload() }
});
```

---

#### 功能2: 拖放文件上传
**描述**: 支持拖放文件到输入框或专门区域

**实现复杂度**: 中
**用户价值**: 高

**建议实现**:
```javascript
// 在sidepanel.js中添加
const dropZone = document.querySelector('.input-container');

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
        if (file.size > MAX_FILE_SIZE) {
            Toast.show(t('file_too_large'), { type: 'error' });
            return;
        }
        // 处理文件
    });
});
```

**CSS**:
```css
.drag-over {
    border: 2px dashed var(--accent);
    background: rgba(59, 130, 246, 0.1);
}
```

---

#### 功能3: 响应卡片单独刷新
**描述**: 每个响应卡片有刷新按钮，无需全部重新获取

**实现复杂度**: 低
**用户价值**: 高

**建议实现**:
```javascript
function createResponseCard(data) {
    const card = document.createElement('div');
    card.className = 'response-card';
    card.dataset.provider = data.provider;

    // 添加刷新按钮
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'refresh-btn';
    refreshBtn.innerHTML = '↺';
    refreshBtn.title = t('refresh_response');
    refreshBtn.onclick = () => {
        refreshBtn.classList.add('loading');
        fetchSingleResponse(data.provider).then(content => {
            updateResponseCardContent(card, content);
        }).finally(() => {
            refreshBtn.classList.remove('loading');
        });
    };

    card.appendChild(refreshBtn);
    // ... 其他内容

    return card;
}

async function fetchSingleResponse(provider) {
    return new Promise((resolve) => {
        chrome.tabs.query(
            { url: AI_CONFIG[provider].urlPattern },
            (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'extract_response',
                        provider
                    }, resolve);
                }
            }
        );
    });
}
```

---

### 2.2 响应管理（Medium Priority）

#### 功能4: 响应内容复制
**描述**: 一键复制响应内容到剪贴板

**实现复杂度**: 低
**用户价值**: 高

**建议实现**:
```javascript
function addCopyButton(responseCard, content) {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = t('copy');
    copyBtn.onclick = async () => {
        try {
            await navigator.clipboard.writeText(content);
            Toast.show(t('copied', { type: 'success' }));
        } catch (err) {
            console.error('Copy failed:', err);
            Toast.show(t('copy_failed'), { type: 'error' });
        }
    };
    responseCard.querySelector('.response-actions').appendChild(copyBtn);
}
```

---

#### 功能5: 响应对比视图
**描述**: 并排对比多个平台的不同响应

**实现复杂度**: 高
**用户价值**: 中

**建议实现**:
```javascript
function startComparisonMode() {
    isComparisonMode = true;
    responsesGrid.classList.add('comparison-mode');
    responsesGrid.style.display = 'grid';
    responsesGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';

    // 为每个响应添加对比控件
    document.querySelectorAll('.response-card').forEach(card => {
        const controls = document.createElement('div');
        controls.className = 'comparison-controls';
        controls.innerHTML = `
            <button class="select-for-comparison">+</button>
            <button class="highlight-differences">Diff</button>
        `;
        card.appendChild(controls);
    });
}
```

---

### 2.3 历史管理（Low Priority）

#### 功能6: 历史记录搜索
**描述**: 快速搜索历史消息

**实现复杂度**: 中
**用户价值**: 中

**建议实现**:
```javascript
function searchHistory(query) {
    chrome.storage.local.get(['chat_history'], (result) => {
        const history = result.chat_history || [];
        const filtered = history.filter(entry =>
            entry.text.toLowerCase().includes(query.toLowerCase()) ||
            entry.providers.some(p => p.toLowerCase().includes(query))
        );
        renderSearchResults(filtered);
    });
}
```

---

#### 功能7: 历史记录编辑/删除
**描述**: 重发、编辑、删除历史消息

**实现复杂度**: 低
**用户价值**: 中

**建议实现**:
```javascript
function addHistoryActions(card, entry) {
    const actions = document.createElement('div');
    actions.className = 'history-actions';
    actions.innerHTML = `
        <button class="resend" title="${t('resend')}">↺</button>
        <button class="edit" title="${t('edit')}">✎</button>
        <button class="delete" title="${t('delete')}">🗑</button>
    `;

    actions.querySelector('.resend').onclick = () => {
        promptInput.value = entry.text;
        entry.providers.forEach(p => toggleProvider(p));
        sendMessage();
    };

    actions.querySelector('.edit').onclick = () => {
        const newText = prompt(t('edit_message'), entry.text);
        if (newText) {
            entry.text = newText;
            saveHistory();
            renderHistory();
        }
    };

    actions.querySelector('.delete').onclick = () => {
        if (confirm(t('confirm_delete'))) {
            deleteHistoryEntry(entry.timestamp);
        }
    };
}
```

---

### 2.4 文件处理增强（Medium Priority）

#### 功能8: 图片预览缩略图
**描述**: 悬停或点击查看大图

**实现复杂度**: 中
**用户价值**: 中

**建议实现**:
```javascript
function addImagePreview(fileItem, file) {
    if (!file.type.startsWith('image/')) return;

    const img = document.createElement('img');
    img.src = file.data;
    img.className = 'file-thumbnail';
    img.style.display = 'none';

    // 点击查看
    fileItem.onclick = () => {
        const modal = createModal(`
            <img src="${file.data}" style="max-width:100%; max-height:80vh;">
        `);
        modal.show();
    };
}
```

---

#### 功能9: 自动图片压缩
**描述**: 自动压缩大图片以节省传输时间

**实现复杂度**: 高
**用户价值**: 低

**建议实现**:
```javascript
async function compressImage(file, maxSizeKB = 500) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    return new Promise((resolve) => {
        img.onload = () => {
            // 计算压缩比例
            const ratio = Math.sqrt(maxSizeKB * 1024 / file.size);
            const width = img.width * ratio;
            const height = img.height * ratio;

            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, 0, 0, width, height);

            // 导出压缩后的图片
            canvas.toBlob((blob) => {
                resolve(new File([blob], file.name, { type: file.type }));
            }, file.type, 0.7); // 质量70%
        };

        img.src = URL.createObjectURL(file);
    });
}
```

---

### 2.5 高级功能（Low Priority）

#### 功能10: 消息模板
**描述**: 保存常用消息模板

**实现复杂度**: 中
**用户价值**: 低

**建议实现**:
```javascript
// UI添加模板按钮
const templateBtn = document.getElementById('templateBtn');
const templateList = document.getElementById('templateList');

templateBtn.onclick = () => {
    const templates = getSavedTemplates();
    templateList.innerHTML = templates.map(t => `
        <div class="template-item" data-content="${t.content}">
            <div class="template-name">${t.name}</div>
            <button class="use-template">${t('use')}</button>
        </div>
    `).join('');
};
```

---

#### 功能11: 平台分组
**描述**: 将平台分组管理（如"中文AI"、"代码AI"）

**实现复杂度**: 高
**用户价值**: 低

---

## 🎯 三、优化优先级路线图

### 立即修复（v1.6.1）
1. 🔴 XSS漏洞修复 - 文件名、历史记录、响应内容转义
2. 🟡 替换alert为Toast - 3处alert调用
3. 🟡 添加响应卡片单独刷新按钮

### 短期实现（v1.7）
4. 🟢 拖放文件上传
5. 🟢 响应内容复制功能
6. 🟢 文件上传进度指示器
7. 🟢 图片缩略图预览

### 中期规划（v1.8）
8. 🔵 历史记录编辑/删除
9. 🔵 消息搜索功能
10. 🔵 响应对比视图
11. 🔵 响应导出功能

### 长期优化（v2.0）
12. 🔢 消息模板系统
13. 🔢 平台分组管理
14. 🔢 自定义设置页面
15. 🔢 性能优化（虚拟滚动）

---

## 📏 四、代码质量评分细则

| 维度 | 得分 | 说明 |
|------|------|------|
| **架构设计** | 9/10 | MVP架构清晰，分离良好 |
| **代码规范** | 7/10 | 基本规范，但有XSS风险 |
| **错误处理** | 8/10 | try-catch完善，有重试机制 |
| **性能优化** | 7/10 | 无严重性能问题，有优化空间 |
| **安全隐患** | 6/10 | XSS风险需修复，无其他严重问题 |
| **可维护性** | 8/10 | 文档完善，代码结构清晰 |
| **用户体验** | 7/10 | 基础功能完整，高级功能待补充 |
| **测试覆盖** | 4/10 | 无自动化测试，仅有手动测试清单 |
| **平均分** | **7.0/10** | **良好** |

---

## 📚 五、技术债务清单

### 高优先级技术债
1. **XSS防护缺失** - 需要引入DOMPurify或手动转义
2. **无自动化测试** - 建议引入Jest + Playwright
3. **alert使用** - 需要实现Toast系统

### 中优先级技术债
1. **事件监听器未清理** - 可能导致微小内存泄漏
2. **全量DOM重绘** - 可用虚拟滚动优化
3. **无代码分割** - 所有代码打包在一个文件

### 低优先级技术债
1. **CSS类名不统一** - 建议统一为kebab-case
2. **未使用变量** - 清理39个const声明
3. **无TypeScript** - 大型项目建议迁移

---

## 💰 六、投入产出分析

### 高ROI功能（低成本高价值）
1. **Toast通知** - 2小时开发，显著提升UX
2. **响应内容复制** - 1小时开发，用户高频使用
3. **响应单独刷新** - 2小时开发，解决核心痛点

### 中ROI功能（中等成本中等价值）
1. **拖放文件上传** - 4小时开发，符合用户习惯
2. **图片缩略图预览** - 3小时开发，提升体验
3. **历史记录编辑** - 3小时开发，增加灵活性

### 低ROI功能（高成本低价值）
1. **响应对比视图** - 8小时开发，使用频率低
2. **平台分组管理** - 10小时开发，复杂度高
3. **消息模板系统** - 6小时开发，替代方案（剪贴板历史）可用

---

## ✅ 七、行动建议

### 团队建议
1. 立即修复XSS漏洞（v1.6.1）
2. 引入ESLint进行代码质量检查
3. 添加单元测试和E2E测试

### 开发流程建议
1. 使用Git branches管理feature
2. 添加Code Review流程
3. 建立Release Notes模板

### 文档建议
1. 添加API文档（JSDoc）
2. 完善开发者指南
3. 添加故障排除指南

---

**报告生成时间**: 2026-02-12
**分析工具**: 人工审查 + 静态代码分析
**报告版本**: v1.0
**下一次审查**: v1.7发布前

---

## 附录：快速修复代码片段

```javascript
// A. XSS防护函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// B. Toast通知系统
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;top:20px;right:20px;...';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

// C. 文件名安全显示
const fileName = document.createElement('div');
fileName.className = 'file-name';
fileName.textContent = file.name; // 自动转义

// D. 响应卡片刷新按钮
const refreshBtn = document.createElement('button');
refreshBtn.className = 'refresh-btn';
refreshBtn.innerHTML = '↺';
refreshBtn.onclick = () => { /* 刷新逻辑 */ };
```
