# 强制重新加载扩展

## 问题
修改了代码但界面没有变化。

## 解决方案

### 方法1：完全重新安装（推荐）

1. 打开 `chrome://extensions/`
2. 找到 "AI Multiverse" 扩展
3. 点击 **"移除"** 按钮（完全卸载）
4. 点击 **"加载已解压的扩展程序"**
5. 选择你的扩展目录（包含 manifest.json 的文件夹）
6. 打开扩展

### 方法2：清除缓存后重新加载

1. 打开 `chrome://settings/clearBrowserData`
2. 选择 **"缓存的图片和文件"**
3. 时间范围选择 **"过去 1 小时"**
4. 点击 **"清除数据"**
5. 打开 `chrome://extensions/`
6. 找到扩展，点击 **刷新图标** 🔄
7. **完全关闭Chrome浏览器**
8. 重新打开Chrome
9. 打开扩展

### 方法3：使用隐身模式测试

1. 打开 `chrome://extensions/`
2. 找到扩展，点击 **"详细信息"**
3. 启用 **"在无痕模式下启用"**
4. 打开隐身窗口（Ctrl+Shift+N）
5. 在隐身窗口中打开扩展

## 验证修改是否生效

打开扩展后，按 F12 打开开发者工具，在控制台运行：

```javascript
// 检查按钮是否存在
console.log('Summarize button:', document.getElementById('summarizeBtn'));
console.log('Copy all button:', document.getElementById('copyAllBtn'));

// 检查是否还有浮动按钮（应该是null）
console.log('Floating actions:', document.getElementById('floatingActions'));

// 检查按钮位置
const inputActions = document.querySelector('.input-actions');
if (inputActions) {
    const buttons = inputActions.querySelectorAll('button');
    console.log('Input action buttons:', buttons.length); // 应该是4个
    buttons.forEach((btn, i) => {
        console.log(`Button ${i}:`, btn.id);
    });
}
```

预期输出：
```
Summarize button: <button id="summarizeBtn">
Copy all button: <button id="copyAllBtn">
Floating actions: null
Input action buttons: 4
Button 0: attachFileBtn
Button 1: summarizeBtn
Button 2: copyAllBtn
Button 3: sendBtn
```

## 如果还是不行

### 检查文件是否真的被修改

在终端运行：
```bash
# 检查HTML
grep -A 5 "summarizeBtn" src/sidepanel/sidepanel.html

# 检查JS
grep "const summarizeBtn" src/sidepanel/sidepanel.js

# 检查是否还有浮动按钮
grep "floating-actions" src/sidepanel/sidepanel.html
```

### 检查manifest.json

确保 manifest.json 中的版本号：
```json
{
  "version": "2.0.0"
}
```

如果不是，修改版本号，这会强制Chrome重新加载扩展。

### 手动清理扩展数据

1. 打开 `chrome://extensions/`
2. 找到扩展ID（类似 `abcdefghijklmnopqrstuvwxyz123456`）
3. 打开文件管理器，导航到：
   - Windows: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions\[扩展ID]`
   - Mac: `~/Library/Application Support/Google/Chrome/Default/Extensions/[扩展ID]`
   - Linux: `~/.config/google-chrome/Default/Extensions/[扩展ID]`
4. 删除该文件夹
5. 重新加载扩展

## 最后的办法

如果以上方法都不行，尝试：

1. 完全关闭Chrome（确保所有Chrome进程都关闭）
2. 删除扩展目录中的所有 `.backup` 文件
3. 重新打开Chrome
4. 重新安装扩展

## 调试信息

如果还是有问题，请提供以下信息：

1. Chrome版本：在地址栏输入 `chrome://version/`
2. 扩展版本：在 `chrome://extensions/` 中查看
3. 控制台错误：按F12，查看Console标签页
4. 文件验证结果：运行上面的bash命令

---

**重要**: 每次修改代码后，都必须重新加载扩展！简单的刷新页面是不够的。
