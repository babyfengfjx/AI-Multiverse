# 如何重新加载Chrome扩展

## 问题
修改了扩展代码后，界面没有变化。

## 原因
Chrome扩展需要手动重新加载才能应用新的代码。

## 解决方法

### 方法1：在扩展管理页面重新加载（推荐）

1. 打开Chrome，在地址栏输入：`chrome://extensions/`
2. 找到 "AI Multiverse" 或 "AI 多重宇宙" 扩展
3. 点击右下角的 **刷新图标** 🔄（或者点击"重新加载"按钮）
4. 关闭当前打开的扩展窗口
5. 重新打开扩展（点击工具栏图标或使用快捷键）

### 方法2：使用开发者模式

1. 打开 `chrome://extensions/`
2. 确保右上角的"开发者模式"已开启
3. 找到你的扩展
4. 点击"重新加载"按钮
5. 关闭并重新打开扩展窗口

### 方法3：完全重新安装

如果上述方法不起作用：

1. 打开 `chrome://extensions/`
2. 点击"移除"按钮卸载扩展
3. 点击"加载已解压的扩展程序"
4. 选择你的扩展目录
5. 打开扩展

## 验证修改是否生效

打开扩展后，检查以下内容：

### 1. 检查浮动按钮
- 右下角应该有两个圆形浮动按钮
- 一个是智能总结（对话气泡图标）
- 一个是复制全部（复制图标）

### 2. 检查响应卡片
- 发送一条消息
- 响应卡片应该显示完整内容（不截断）
- 点击卡片任何位置应该能打开详情模态框

### 3. 检查当前对话
- 当前对话应该完整展开显示
- 发送新消息后，之前的对话应该折叠成小卡片

### 4. 检查控制台
按 F12 打开开发者工具，在控制台中输入：
```javascript
console.log('Version check:', document.querySelector('.floating-actions') ? 'v2.0 loaded' : 'old version');
```

如果显示 "v2.0 loaded"，说明新版本已加载。

## 常见问题

### Q: 重新加载后还是没变化？
A: 尝试以下步骤：
1. 完全关闭Chrome浏览器
2. 重新打开Chrome
3. 打开 `chrome://extensions/`
4. 重新加载扩展
5. 打开扩展

### Q: 浮动按钮不显示？
A: 检查：
1. 是否已经发送了至少一条消息？（浮动按钮只在有当前对话时显示）
2. 打开开发者工具（F12），查看是否有JavaScript错误
3. 检查 `floatingActions` 元素的 `display` 样式

### Q: 卡片还是被截断？
A: 检查：
1. 打开开发者工具（F12）
2. 选择一个响应卡片
3. 查看 `.response-card-body` 的样式
4. 确认没有 `max-height` 和 `overflow: hidden`

## 调试命令

在浏览器控制台（F12）中运行这些命令来调试：

```javascript
// 检查浮动按钮元素是否存在
console.log('Floating actions:', document.getElementById('floatingActions'));

// 检查当前对话ID
console.log('Current conversation ID:', window.currentConversationId);

// 检查所有对话
console.log('All conversations:', window.conversations);

// 强制显示浮动按钮（测试用）
document.getElementById('floatingActions').style.display = 'flex';

// 检查响应卡片样式
const card = document.querySelector('.response-card-body');
if (card) {
    const styles = window.getComputedStyle(card);
    console.log('Card max-height:', styles.maxHeight);
    console.log('Card overflow:', styles.overflow);
}
```

## 文件检查清单

确认以下文件已被修改：

- [ ] `src/sidepanel/sidepanel.html` - 包含 `<div class="floating-actions">`
- [ ] `src/sidepanel/sidepanel.css` - 包含 `.floating-btn` 样式
- [ ] `src/sidepanel/sidepanel.js` - 包含 `updateFloatingButtons()` 函数

## 如果还是不行

1. 检查文件路径是否正确
2. 确认修改的是正确的文件（不是 `_v2` 版本）
3. 查看浏览器控制台是否有错误信息
4. 尝试清除浏览器缓存：
   - 打开 `chrome://settings/clearBrowserData`
   - 选择"缓存的图片和文件"
   - 点击"清除数据"
   - 重新加载扩展

---

**重要提示**: 每次修改扩展代码后，都必须重新加载扩展才能看到变化！
