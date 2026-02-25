# Drag and Drop File Upload - Implementation Notes

## 功能概述
允许用户通过拖放文件到输入区域来上传文件，替代点击"附件"按钮选择文件。

## 技术实现

###HTML修改 (sidepanel.html)
```html
<!-- 在chat-section中添加拖拽覆盖层 -->
<div id="dragOverlay" class="drag-overlay" style="display: none;">
    <div class="drag-overlay-content">
        <svg>...</svg>
        <p data-i18n="drag_files_here">Drop files here to upload</p>
    </div>
</div>
```

###CSS修改 (sidepanel.css)
```css
/* 拖拽覆盖层样式 */
.drag-overlay {
    position: absolute;
    background: rgba(61, 138, 255, 0.1);
    border: 2px dashed var(--accent);
    border-radius: 12px;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.2s ease;
}

.chat-section.drag-over {
    border: 2px dashed var(--accent);
    background: rgba(61, 138, 255, 0.05);
}

.drag-overlay-content {
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.05); }
}
```

###JS修改 (sidepanel.js)
```javascript
// 1. 阻止默认拖拽行为
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    chatSection.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// 2. 高亮拖拽区域
['dragenter', 'dragover'].forEach(eventName => {
    chatSection.addEventListener(eventName, highlight, false);
});

// 3. 移除高亮
['dragleave', 'drop'].forEach(eventName => {
    chatSection.addEventListener(eventName, unhighlight, false);
});

// 4. 处理文件拖放
chatSection.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = Array.from(dt.files);
    processDroppedFiles(files);
}

// 5. 处理拖放的文件
async function processDroppedFiles(files) {
    for (const file of files) {
        // 验证文件大小
        if (file.size > MAX_FILE_SIZE) {
            showNotification(t('file_too_large'), 'error');
            continue;
        }

        // 验证总大小
        const currentTotalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
        if (currentTotalSize + file.size > MAX_TOTAL_SIZE) {
            showNotification(t('file_size_too_large'), 'error');
            continue;
        }

        // 读取文件
        try {
            const fileData = await readFileAsDataURL(file);
            selectedFiles.push(fileData);
            renderFilePreview();
            showNotification(t('file_added', { name: file.name }), 'success');
        } catch (error) {
            showNotification(t('err_file_read_failed'), 'error');
        }
    }
}
```

### i18n修改 (i18n.js)
```javascript
// English
drag_files_here: "Drop files here to upload",
file_added: "Added: {name}",

// Chinese
drag_files_here: "拖放文件到此处上传",
file_added: "已添加：{name}",
```

## 用户体验流程

1. 用户将文件拖到聊天输入区域
2. 系统检测到拖拽事件，显示蓝色虚线边框和"Drop files here"提示
3. 用户松开鼠标，文件拖放到输入区
4. 系统验证文件大小（单文件10MB，总大小50MB）
5. 符合条件的文件添加到预览列表
6. 显示添加成功通知

## 特性

- ✅ 支持单文件和多文件拖放
- ✅ 拖拽视觉反馈（蓝色虚线边框、覆盖层提示）
- ✅ 文件大小验证（实时反馈错误）
- ✅ 中英文双语支持
- ✅ 与现有文件上传系统完全集成
- ✅ 优雅的动画效果（淡入、脉冲）

## 已知限制

- 拖拽区域仅限于chat-section
- 暂不支持拖放文件夹（仅支持文件）
- 使用临时showNotification函数（alert），将在v1.7替换为Toast

## 测试建议

1. 拖放单个文件
2. 拖放多个文件
3. 拖放超过大小限制的文件
4. 拖放导致总大小超限的文件
5. 拖放到textarea边缘
6. 中英文切换验证

## 后续增强

- 支持拖放文件夹（递归读取）
- Toast通知系统替换临时通知
- 拖放预览缩略图（图片文件）
- 拖拽区域扩展（整个侧边栏）

---

实现日期: 2026-02-12
版本: v1.6.1
