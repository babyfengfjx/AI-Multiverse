// 调试脚本 - 在浏览器控制台运行此脚本来检查手柄状态

console.log('=== 调试详情窗口调节手柄 ===');

// 1. 检查modal是否存在
const modal = document.querySelector('#detailModal');
console.log('1. Modal元素:', modal);
console.log('   Modal是否激活:', modal?.classList.contains('active'));

// 2. 检查modal content
const modalContent = document.querySelector('#detailModal .detail-content');
console.log('2. Modal Content:', modalContent);
if (modalContent) {
    console.log('   宽度:', modalContent.offsetWidth);
    console.log('   高度:', modalContent.offsetHeight);
    console.log('   Position:', window.getComputedStyle(modalContent).position);
}

// 3. 检查手柄
const handles = document.querySelectorAll('.modal-resize-handle');
console.log('3. 找到的手柄数量:', handles.length);

handles.forEach((handle, index) => {
    console.log(`   手柄 ${index + 1}:`);
    console.log('     类名:', handle.className);
    console.log('     位置:', handle.getBoundingClientRect());
    console.log('     Display:', window.getComputedStyle(handle).display);
    console.log('     Visibility:', window.getComputedStyle(handle).visibility);
    console.log('     Z-index:', window.getComputedStyle(handle).zIndex);
    console.log('     Width:', window.getComputedStyle(handle).width);
    console.log('     Background:', window.getComputedStyle(handle).background);
    console.log('     Cursor:', window.getComputedStyle(handle).cursor);
});

// 4. 检查是否有其他元素遮挡
if (modalContent) {
    const leftHandle = modalContent.querySelector('.modal-resize-handle-left');
    const rightHandle = modalContent.querySelector('.modal-resize-handle-right');
    
    if (leftHandle) {
        const leftRect = leftHandle.getBoundingClientRect();
        const elementAtLeft = document.elementFromPoint(leftRect.left + 10, leftRect.top + leftRect.height / 2);
        console.log('4. 左侧手柄位置的元素:', elementAtLeft);
        console.log('   是否是手柄本身:', elementAtLeft === leftHandle);
    }
    
    if (rightHandle) {
        const rightRect = rightHandle.getBoundingClientRect();
        const elementAtRight = document.elementFromPoint(rightRect.right - 10, rightRect.top + rightRect.height / 2);
        console.log('5. 右侧手柄位置的元素:', elementAtRight);
        console.log('   是否是手柄本身:', elementAtRight === rightHandle);
    }
}

// 5. 检查CSS是否正确加载
const testDiv = document.createElement('div');
testDiv.className = 'modal-resize-handle modal-resize-handle-left';
testDiv.style.position = 'absolute';
testDiv.style.top = '-9999px';
document.body.appendChild(testDiv);
const computedStyle = window.getComputedStyle(testDiv);
console.log('6. CSS样式测试:');
console.log('   Width:', computedStyle.width);
console.log('   Cursor:', computedStyle.cursor);
console.log('   Z-index:', computedStyle.zIndex);
console.log('   Background:', computedStyle.background);
document.body.removeChild(testDiv);

console.log('=== 调试完成 ===');
console.log('如果手柄数量为0,说明initModalResize()没有被调用');
console.log('如果手柄存在但不可见,检查z-index和position');
console.log('如果手柄被其他元素遮挡,需要调整层级关系');
