# v2.0 测试说明

## 重要提示
**所有代码修改已完成！** 但Chrome扩展需要手动重新加载才能看到变化。

## 第一步：重新加载扩展

### 方法A：快速重新加载（推荐）
1. 在Chrome地址栏输入：`chrome://extensions/`
2. 找到 "AI Multiverse" 或 "AI 多重宇宙"
3. 点击右下角的 **刷新图标** 🔄
4. **关闭当前打开的扩展窗口**（重要！）
5. 重新打开扩展

### 方法B：完全重新安装
1. 打开 `chrome://extensions/`
2. 点击"移除"卸载扩展
3. 点击"加载已解压的扩展程序"
4. 选择扩展目录
5. 打开扩展

## 第二步：验证修改

### 1. 检查浮动按钮（最重要）

打开扩展后，**发送一条测试消息**，然后检查：

- ✅ 右下角应该出现两个圆形浮动按钮
  - 上面的按钮：智能总结（对话气泡图标）
  - 下面的按钮：复制全部（复制图标）
- ✅ 浮动按钮应该固定在右下角，不随滚动移动
- ✅ 鼠标悬停时按钮应该有动画效果（向上移动）

**如果看不到浮动按钮**：
- 确认已经发送了至少一条消息
- 按F12打开开发者工具，在控制台输入：
  ```javascript
  document.getElementById('floatingActions')
  ```
  应该返回一个元素，而不是null

### 2. 检查响应卡片完整显示

- ✅ 响应卡片应该显示完整内容，不被截断
- ✅ 没有"..."省略号
- ✅ 没有渐变遮罩效果
- ✅ 内容可以完整阅读

**验证方法**：
- 发送一个会产生长回答的问题
- 检查响应卡片是否显示完整内容
- 按F12，选择一个响应卡片，查看样式：
  ```javascript
  const card = document.querySelector('.response-card-body');
  const styles = window.getComputedStyle(card);
  console.log('max-height:', styles.maxHeight); // 应该是 'none' 或很大的值
  console.log('overflow:', styles.overflow); // 应该是 'visible' 或 'auto'
  ```

### 3. 检查卡片可点击

- ✅ 点击响应卡片的任何位置都应该打开详情模态框
- ✅ 不仅仅是卡片内容区域，整个卡片都可以点击

### 4. 检查当前对话完整展示

- ✅ 发送第一条消息后，对话应该完整展开显示
- ✅ 发送第二条消息后：
  - 第一条对话应该折叠成小卡片
  - 第二条对话（当前对话）应该完整展开
- ✅ 点击折叠的对话可以重新展开

### 5. 检查浮动按钮功能

#### 智能总结按钮
- ✅ 在响应未完成时应该是禁用状态（灰色，不可点击）
- ✅ 在所有响应完成后应该变为可用状态
- ✅ 点击后应该开始生成总结
- ✅ 已有总结后应该再次禁用

#### 复制全部按钮
- ✅ 始终可用
- ✅ 点击后应该复制当前对话的所有响应
- ✅ 应该显示"已复制到剪贴板"的提示

## 第三步：调试（如果有问题）

### 打开开发者工具
按 F12 或右键点击扩展窗口 → 检查

### 运行诊断命令

```javascript
// 1. 检查版本
console.log('Version:', document.querySelector('.floating-actions') ? 'v2.0' : 'old version');

// 2. 检查浮动按钮
const floatingActions = document.getElementById('floatingActions');
console.log('Floating actions element:', floatingActions);
console.log('Display style:', floatingActions?.style.display);

// 3. 检查当前对话ID
console.log('Current conversation ID:', window.currentConversationId);

// 4. 检查所有对话
console.log('Conversations:', window.conversations);

// 5. 强制显示浮动按钮（测试用）
if (floatingActions) {
    floatingActions.style.display = 'flex';
    console.log('Forced floating actions to display');
}

// 6. 检查响应卡片样式
const cards = document.querySelectorAll('.response-card-body');
console.log('Found', cards.length, 'response cards');
if (cards.length > 0) {
    const styles = window.getComputedStyle(cards[0]);
    console.log('Card styles:', {
        maxHeight: styles.maxHeight,
        overflow: styles.overflow,
        cursor: styles.cursor
    });
}

// 7. 检查点击事件
const responseCards = document.querySelectorAll('.response-card');
console.log('Response cards with onclick:', 
    Array.from(responseCards).filter(c => c.onclick).length
);
```

### 常见问题排查

#### 问题1：浮动按钮不显示
```javascript
// 检查元素是否存在
console.log(document.getElementById('floatingActions'));

// 检查是否有当前对话
console.log('Current conv:', window.currentConversationId);

// 手动触发更新
if (typeof window.updateFloatingButtons === 'function') {
    window.updateFloatingButtons();
}
```

#### 问题2：卡片内容被截断
```javascript
// 检查CSS
const card = document.querySelector('.response-card-body');
if (card) {
    console.log('Computed styles:', {
        maxHeight: getComputedStyle(card).maxHeight,
        overflow: getComputedStyle(card).overflow,
        maskImage: getComputedStyle(card).maskImage
    });
}
```

#### 问题3：卡片不能点击
```javascript
// 检查点击事件
const cards = document.querySelectorAll('.response-card');
cards.forEach((card, i) => {
    console.log(`Card ${i}:`, {
        hasOnclick: !!card.onclick,
        cursor: getComputedStyle(card).cursor,
        pointerEvents: getComputedStyle(card).pointerEvents
    });
});
```

## 第四步：完整测试流程

1. **清空历史**（可选）
   - 点击右上角的垃圾桶图标
   - 确认清空

2. **发送第一条消息**
   - 选择2-3个AI模型
   - 输入测试问题："请用100字介绍一下人工智能"
   - 点击发送

3. **观察响应加载**
   - 响应卡片应该逐个显示
   - 状态从"加载中"变为"完成"
   - 内容应该完整显示

4. **检查浮动按钮**
   - 右下角应该出现两个圆形按钮
   - 智能总结按钮应该从禁用变为可用

5. **测试智能总结**
   - 等待所有响应完成
   - 点击智能总结按钮
   - 应该出现总结卡片

6. **测试复制功能**
   - 点击复制全部按钮
   - 应该显示"已复制"提示
   - 粘贴到文本编辑器验证

7. **发送第二条消息**
   - 输入新问题
   - 第一条对话应该折叠
   - 第二条对话应该完整展开

8. **测试展开/折叠**
   - 点击折叠的第一条对话
   - 应该重新展开
   - 浮动按钮应该仍然操作第二条对话

9. **测试卡片点击**
   - 点击任意响应卡片
   - 应该打开详情模态框
   - 显示完整响应内容

10. **测试历史持久化**
    - 关闭扩展窗口
    - 重新打开扩展
    - 所有对话应该还在

## 成功标准

所有以下项目都应该是 ✅：

- [ ] 浮动按钮显示在右下角
- [ ] 响应卡片显示完整内容
- [ ] 卡片可以点击查看详情
- [ ] 当前对话完整展开
- [ ] 历史对话自动折叠
- [ ] 智能总结功能正常
- [ ] 复制全部功能正常
- [ ] 对话可以展开/折叠
- [ ] 历史记录持久化
- [ ] 主题切换正常
- [ ] 语言切换正常

## 如果还是不行

1. 完全关闭Chrome浏览器
2. 删除扩展
3. 重新打开Chrome
4. 重新加载扩展
5. 清除浏览器缓存
6. 联系开发者并提供：
   - 浏览器控制台的错误信息
   - 上述诊断命令的输出
   - 截图

---

**记住：每次修改代码后都必须重新加载扩展！**
