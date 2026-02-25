# 聊天界面重设计 v2.0

## 设计目标
将插件改造为真正的聊天工具，所有AI模型作为API使用，界面展示完整的对话历史。

## 核心改动

### 1. 界面结构
- **移除标签页**：不再有"对话"和"响应"两个标签
- **单一界面**：整个界面就是一个聊天流
- **对话流展示**：
  - 用户问题
  - AI响应卡片（多个并排或堆叠）
  - 总结卡片（如果有）
  - 下一个问题...

### 2. 卡片状态
- **展开状态**：当前最新的问题，卡片完整显示内容
- **折叠状态**：历史问题，卡片缩小为小高度（显示摘要）
- **点击展开**：点击折叠的卡片可以重新展开查看

### 3. 历史记录机制
```javascript
// 历史记录结构
{
  conversations: [
    {
      id: timestamp,
      question: "用户问题",
      timestamp: 1234567890,
      responses: {
        gemini: { status: 'ok', text: '...', html: '...' },
        kimi: { status: 'ok', text: '...', html: '...' },
        // ...
      },
      summary: {
        model: 'gemini',
        text: '总结内容',
        timestamp: 1234567891
      },
      collapsed: false  // 是否折叠
    },
    // ...
  ]
}
```

### 4. 自动存档逻辑
1. **响应完成存档**：所有选中的AI模型都响应完成后，自动存档
2. **总结完成存档**：智能总结完成后，更新历史记录
3. **冻结数据**：存档后的对话使用历史数据，不再实时更新
4. **启动加载**：插件启动时加载所有历史记录

### 5. 界面布局
```
┌─────────────────────────────────────┐
│ Header (Logo, 设置, 语言切换)        │
├─────────────────────────────────────┤
│                                     │
│ [对话1 - 折叠]                       │
│ ┌─ 问题：xxx                         │
│ └─ 3个AI已回答 ✓                    │
│                                     │
│ [对话2 - 折叠]                       │
│ ┌─ 问题：yyy                         │
│ └─ 5个AI已回答 ✓ 已总结 ✨          │
│                                     │
│ [对话3 - 展开]                       │
│ ┌─────────────────────────────────┐ │
│ │ 问题：zzz                        │ │
│ └─────────────────────────────────┘ │
│ ┌──────┐ ┌──────┐ ┌──────┐         │
│ │Gemini│ │ Kimi │ │ Grok │         │
│ │      │ │      │ │      │         │
│ │ ...  │ │ ...  │ │ ...  │         │
│ └──────┘ └──────┘ └──────┘         │
│ [智能总结] [复制全部]                │
│                                     │
├─────────────────────────────────────┤
│ 输入框 + 发送按钮                    │
└─────────────────────────────────────┘
```

## 实现步骤

### Phase 1: 数据结构和存储
1. 定义新的历史记录结构
2. 实现自动存档逻辑
3. 实现历史记录加载

### Phase 2: UI重构
1. 移除标签页
2. 创建对话流容器
3. 实现折叠/展开卡片
4. 调整输入框位置

### Phase 3: 逻辑调整
1. 发送消息后立即创建对话记录
2. 响应完成后更新并存档
3. 总结完成后更新并存档
4. 启动时加载历史记录

### Phase 4: 样式优化
1. 折叠卡片样式
2. 展开卡片样式
3. 过渡动画
4. 响应式布局

## 技术要点

### 1. 状态管理
```javascript
let conversations = [];  // 所有对话
let currentConversationId = null;  // 当前对话ID
let isLoadingHistory = false;  // 是否正在加载历史
```

### 2. 自动存档触发
```javascript
// 检查所有响应是否完成
function checkAllResponsesComplete(conversationId) {
  const conv = conversations.find(c => c.id === conversationId);
  const selectedProviders = getSelectedProviders();
  const allComplete = selectedProviders.every(p => 
    conv.responses[p] && conv.responses[p].status === 'ok'
  );
  if (allComplete) {
    saveConversationToStorage(conversationId);
  }
}
```

### 3. 折叠/展开逻辑
```javascript
function toggleConversation(conversationId) {
  const conv = conversations.find(c => c.id === conversationId);
  if (conv.id === currentConversationId) {
    // 当前对话不能折叠
    return;
  }
  conv.collapsed = !conv.collapsed;
  renderConversations();
}
```

### 4. 历史加载
```javascript
async function loadHistoryOnStartup() {
  const data = await chrome.storage.local.get(['conversations']);
  if (data.conversations) {
    conversations = data.conversations;
    renderConversations();
  }
}
```

## 用户体验优化

### 1. 加载状态
- 显示"加载历史记录..."
- 骨架屏效果

### 2. 滚动行为
- 新消息自动滚动到底部
- 展开历史对话滚动到该对话

### 3. 性能优化
- 虚拟滚动（如果对话很多）
- 懒加载历史对话内容

### 4. 交互反馈
- 折叠/展开动画
- 存档成功提示
- 加载进度显示

## 兼容性考虑

### 1. 旧数据迁移
- 读取旧的chat_history
- 转换为新格式
- 保存并清理旧数据

### 2. 降级方案
- 如果存储失败，仍然显示当前对话
- 提示用户存储空间不足

## 测试要点

1. 发送消息 → 创建对话 → 响应完成 → 自动存档
2. 智能总结 → 总结完成 → 更新存档
3. 重启插件 → 加载历史 → 显示所有对话
4. 折叠/展开 → 动画流畅 → 状态正确
5. 多次对话 → 历史累积 → 性能正常
