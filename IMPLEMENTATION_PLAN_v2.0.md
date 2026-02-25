# 聊天界面重构实现计划 v2.0

## 当前进度
✅ 已备份原HTML文件
✅ 已创建设计文档

## 实现步骤

### 第1步：HTML结构重构 ⏳
**文件**: `src/sidepanel/sidepanel.html`

**改动**:
1. 移除标签栏 (tab-bar)
2. 移除旧的 chatTab 和 responsesTab
3. 创建新的对话流容器 (conversation-stream)
4. 将输入框移到底部固定位置
5. 保留所有模态框（详情、设置、模型选择等）

**新结构**:
```html
<div class="sidebar-container">
  <header>...</header>
  
  <!-- 主聊天界面 -->
  <div class="chat-interface">
    <div class="conversation-stream" id="conversationStream">
      <!-- 对话会动态插入这里 -->
    </div>
  </div>
  
  <!-- 输入区域（固定底部） -->
  <div class="input-section">
    <div class="file-preview">...</div>
    <div class="input-box">
      <textarea>...</textarea>
      <button>发送</button>
    </div>
  </div>
  
  <!-- 保留所有模态框 -->
  <div id="detailModal">...</div>
  <div id="modelsModal">...</div>
  ...
</div>
```

### 第2步：CSS样式重构
**文件**: `src/sidepanel/sidepanel.css`

**新增样式**:
1. `.chat-interface` - 主聊天界面容器
2. `.conversation-stream` - 对话流容器（可滚动）
3. `.conversation-item` - 单个对话项
4. `.conversation-item.collapsed` - 折叠状态
5. `.conversation-item.expanded` - 展开状态
6. `.conversation-question` - 问题显示
7. `.conversation-responses` - 响应卡片容器
8. `.input-section` - 固定底部输入区域

**移除样式**:
1. `.tab-bar` 相关
2. `.tab-content` 相关
3. `.history-section` 相关（旧的历史记录）

### 第3步：JavaScript数据结构
**文件**: `src/sidepanel/sidepanel.js`

**新数据结构**:
```javascript
// 对话记录结构
const conversations = [
  {
    id: timestamp,
    question: "用户问题",
    timestamp: 1234567890,
    providers: ['gemini', 'kimi', 'grok'],
    responses: {
      gemini: { status: 'ok', text: '...', html: '...', timestamp: xxx },
      kimi: { status: 'ok', text: '...', html: '...', timestamp: xxx },
      grok: { status: 'loading', text: '', html: '', timestamp: xxx }
    },
    summary: {
      model: 'gemini',
      text: '总结内容',
      html: '...',
      timestamp: 1234567891
    },
    collapsed: false,
    archived: false  // 是否已存档
  }
];
```

**核心函数**:
1. `createConversation(question, providers)` - 创建新对话
2. `updateConversationResponse(convId, provider, data)` - 更新响应
3. `checkAndArchiveConversation(convId)` - 检查并存档
4. `addSummaryToConversation(convId, summary)` - 添加总结
5. `toggleConversationCollapse(convId)` - 折叠/展开
6. `renderConversations()` - 渲染所有对话
7. `loadConversationsFromStorage()` - 加载历史
8. `saveConversationToStorage(convId)` - 保存到存储

### 第4步：核心逻辑实现

#### 4.1 发送消息流程
```javascript
async function handleSendMessage() {
  const question = promptInput.value.trim();
  const providers = getSelectedProviders();
  
  // 1. 创建对话记录
  const convId = createConversation(question, providers);
  
  // 2. 渲染对话（展开状态）
  renderConversations();
  
  // 3. 折叠之前的对话
  collapseOtherConversations(convId);
  
  // 4. 发送到各个AI
  await broadcastMessage(question, providers, files);
  
  // 5. 开始轮询响应
  startPollingResponses(convId, providers);
}
```

#### 4.2 响应轮询
```javascript
async function startPollingResponses(convId, providers) {
  const interval = setInterval(async () => {
    for (const provider of providers) {
      const response = await fetchResponse(provider);
      updateConversationResponse(convId, provider, response);
    }
    
    // 检查是否全部完成
    if (allResponsesComplete(convId)) {
      clearInterval(interval);
      archiveConversation(convId);
    }
    
    renderConversations();
  }, 2000);
}
```

#### 4.3 自动存档
```javascript
function archiveConversation(convId) {
  const conv = conversations.find(c => c.id === convId);
  conv.archived = true;
  
  // 保存到storage
  saveConversationToStorage(convId);
  
  console.log(`[Archive] Conversation ${convId} archived`);
}
```

#### 4.4 智能总结
```javascript
async function handleSummarize(convId) {
  const conv = conversations.find(c => c.id === convId);
  
  // 1. 生成总结
  const summary = await generateSummary(conv);
  
  // 2. 添加到对话
  addSummaryToConversation(convId, summary);
  
  // 3. 渲染
  renderConversations();
  
  // 4. 等待总结完成后存档
  waitForSummaryComplete(convId).then(() => {
    archiveConversation(convId);
  });
}
```

### 第5步：渲染逻辑

#### 5.1 渲染对话流
```javascript
function renderConversations() {
  const stream = document.getElementById('conversationStream');
  stream.innerHTML = '';
  
  if (conversations.length === 0) {
    stream.innerHTML = '<div class="empty-state">开始你的第一次对话</div>';
    return;
  }
  
  conversations.forEach(conv => {
    const convEl = createConversationElement(conv);
    stream.appendChild(convEl);
  });
  
  // 滚动到最新对话
  scrollToLatest();
}
```

#### 5.2 创建对话元素
```javascript
function createConversationElement(conv) {
  const div = document.createElement('div');
  div.className = `conversation-item ${conv.collapsed ? 'collapsed' : 'expanded'}`;
  div.dataset.id = conv.id;
  
  if (conv.collapsed) {
    // 折叠状态：只显示问题和摘要
    div.innerHTML = `
      <div class="conversation-header" onclick="toggleConversation(${conv.id})">
        <div class="conversation-question-collapsed">${conv.question}</div>
        <div class="conversation-meta">
          ${getResponseCount(conv)} 个AI已回答
          ${conv.summary ? '✨ 已总结' : ''}
        </div>
      </div>
    `;
  } else {
    // 展开状态：显示完整内容
    div.innerHTML = `
      <div class="conversation-question">${conv.question}</div>
      <div class="conversation-responses">
        ${renderResponseCards(conv)}
      </div>
      ${conv.summary ? renderSummaryCard(conv.summary) : ''}
      <div class="conversation-actions">
        <button onclick="handleSummarize(${conv.id})">智能总结</button>
        <button onclick="copyAllResponses(${conv.id})">复制全部</button>
      </div>
    `;
  }
  
  return div;
}
```

### 第6步：存储管理

#### 6.1 存储结构
```javascript
// chrome.storage.local
{
  conversations: [
    { id, question, responses, summary, ... },
    ...
  ],
  settings: {
    selectedProviders: ['gemini', 'kimi'],
    summarizeModel: 'gemini',
    ...
  }
}
```

#### 6.2 加载历史
```javascript
async function loadConversationsFromStorage() {
  const data = await chrome.storage.local.get(['conversations']);
  if (data.conversations) {
    conversations = data.conversations;
    renderConversations();
  }
}
```

#### 6.3 保存对话
```javascript
async function saveConversationToStorage(convId) {
  const conv = conversations.find(c => c.id === convId);
  
  // 获取现有数据
  const data = await chrome.storage.local.get(['conversations']);
  const stored = data.conversations || [];
  
  // 更新或添加
  const index = stored.findIndex(c => c.id === convId);
  if (index >= 0) {
    stored[index] = conv;
  } else {
    stored.push(conv);
  }
  
  // 保存
  await chrome.storage.local.set({ conversations: stored });
}
```

### 第7步：动画和交互

#### 7.1 折叠/展开动画
```css
.conversation-item {
  transition: all 0.3s ease;
}

.conversation-item.collapsed {
  max-height: 80px;
  overflow: hidden;
}

.conversation-item.expanded {
  max-height: none;
}
```

#### 7.2 滚动行为
```javascript
function scrollToLatest() {
  const stream = document.getElementById('conversationStream');
  stream.scrollTop = stream.scrollHeight;
}

function scrollToConversation(convId) {
  const el = document.querySelector(`[data-id="${convId}"]`);
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
```

## 测试计划

### 测试1：基本对话流程
1. 输入问题并发送
2. 验证创建新对话
3. 验证响应卡片显示
4. 验证所有响应完成后自动存档

### 测试2：智能总结
1. 点击智能总结按钮
2. 验证总结卡片显示
3. 验证总结完成后更新存档

### 测试3：折叠/展开
1. 发送新问题
2. 验证旧对话自动折叠
3. 点击折叠的对话
4. 验证展开显示完整内容

### 测试4：历史加载
1. 重启插件
2. 验证加载所有历史对话
3. 验证折叠状态正确
4. 验证可以展开查看

### 测试5：多次对话
1. 连续发送多个问题
2. 验证对话流正确显示
3. 验证性能正常
4. 验证存储空间使用合理

## 注意事项

1. **向后兼容**：需要迁移旧的chat_history数据
2. **性能优化**：对话很多时考虑虚拟滚动
3. **存储限制**：监控storage使用，必要时清理旧对话
4. **错误处理**：网络错误、存储失败等
5. **用户体验**：加载状态、动画流畅度

## 下一步行动

由于这是一个大型重构，建议：
1. 先完成HTML和CSS的基础结构
2. 实现核心的数据结构和存储逻辑
3. 实现渲染和交互
4. 逐步测试和优化

是否继续实现？
