/**
 * AI Multiverse - Internationalization (i18n)
 * Supports: English (en), Chinese (zh-CN)
 */

const I18N = {
    en: {
        // Header
        logo: "AI Multiverse",
        switch_language: "Switch Language",
        toggle_theme: "Toggle Theme",
        choose_models: "Choose AI Models",
        summarize_settings: "Summarize Settings",

        // Tabs
        tab_chat: "Chat",
        tab_responses: "Responses",

        // History
        history_title: "Conversation",
        clear_all: "Clear All",
        view_detail: "View Detail",
        resend_message: "Resend",
        edit_message: "Edit",
        delete_message: "Delete",
        history_detail_title: "Message Detail",
        question: "Question",
        responses: "AI Responses",
        message_reloaded: "Message loaded to input box",
        edit_message_prompt: "Edit this message:",
        message_edited: "Message updated successfully",
        confirm_delete_message: "Are you sure you want to delete this message?",
        message_deleted: "Message deleted successfully",
        clear_history_confirm: "Clear all {count} history entries?",
        history_cleared: "History cleared successfully",
        history_empty: "History is already empty",
        no_messages: "No messages yet.",

        // Responses
        fetch_responses: "Fetch Responses",
        copy_all: "Copy All",
        copy: "Copy",
        summarize: "Summarize",
        summarizing: "Summarizing...",
        summary_title: "Summary",
        summary_model: "Summarized by {model}",
        summary_by: "by {model}",
        summary_check_window: "Checking summary window...",
        summary_empty: "No responses to summarize",
        summary_success: "Summary created successfully",
        summary_failed: "Summary failed",
        summary_failed_title: "Summary Failed",
        summary_failed_detail: "{error}",
        summary_generated: "Summary generated",
        summary_sent: "Summary sent",
        summary_sent_to: "Summary sent to {model}",
        summary_timeout: "Summary timeout",
        fetch_status_summary: "Fetch Summary",
        fetching: "Fetching...",
        no_responses: "No responses fetched yet.",
        extracting: "Extracting...",
        waiting_responses: "Waiting for responses",
        waiting_for: "Waiting for",
        completed: "completed",
        generating: "Generating...",
        failed: "Failed",
        timeout: "Timeout",
        error: "Error",
        characters: "ch",
        loading: "Loading...",
        missing: "Missing",
        settings_saved: "Settings saved",
        models: "models",

        // Buttons
        send: "Send",
        open: "Open",
        tile: "Tile",
        close: "Close",
        attach_file: "Attach",
        attach_files: "Attach Files",
        summarize_all: "Summarize all responses",
        smart_summarize: "Smart Summarize",
        
        // New v2.0 keys
        no_conversations: "Start your first conversation",
        select_at_least_one: "Please select at least one AI model",
        send_error: "Failed to send message",
        wait_for_responses: "Please wait for all responses to complete",
        summarize_error: "Failed to create summary",
        summarize_complete: "Summary completed",
        copy_success: "Copied to clipboard",

        // Summarize Settings Modal
        summarize_settings_title: "Summarize Settings",
        summarize_settings_subtitle: "Choose model and prompt for summarization",
        summarize_model_label: "Summarization Model",
        summarize_prompt_label: "Summarization Prompt",
        use_defaultPrompt: "Use Default Prompt",
        reset_prompt: "Reset Prompt",
        prompt_placeholder_custom: "Enter your custom summarization prompt...",

        // Status
        sending: "Sending...",
        tiled: "Tiling...",
        launching: "Launching...",
        closing: "Closing...",

        // Model Selection
        models_title: "AI Models",
        select_recipients: "Select recipients",
        confirm: "Confirm",

        // Provider Names
        gemini: "Gemini",
        grok: "Grok",
        kimi: "Kimi",
        deepseek: "DeepSeek",
        chatgpt: "ChatGPT",
        qwen: "Qwen",
        yuanbao: "Yuanbao",

        // Close All Modal
        close_all_title: "Close All Windows?",
        close_all_desc: "This will close all browser windows currently opened by AI Multiverse.",
        close_all_warning: "Are you sure you want to close all AI conversation windows? In-progress responses will not be saved.",
        cancel: "Cancel",
        confirm_close: "Confirm",

        // Detail Modal
        copy_response: "Copy This Response",
        copied: "Copied!",

        // Placeholders
        ask_anything: "Ask anything... (Enter to send)",
        prompt_placeholder_custom: "Enter your custom summarization prompt...",

        // File Upload
        file_select: "Select files to upload",
        file_preview: "Attached files",
        file_clear_all: "Clear all files",
        file_remove: "Remove",
        file_type_image: "Image",
        file_type_document: "Document",
        file_type_other: "File",
        file_uploading: "Uploading...",
        file_upload_failed: "Upload failed: {error}",
        file_unsupported: "Unsupported file type: {type}",
        file_too_large: "File too large: {max}MB max",
        file_size_too_large: "Total size too large: {max}MB max",
        drag_files_here: "Drop files here to upload",
        file_added: "Added: {name}",

        // Errors related to files
        err_file_read_failed: "Failed to read file",
        err_file_not_supported: "File type not supported by this provider",

        // Meta
        time_format: "• {count} AIs",

        // System Messages
        system: "System",
        processing: "Processing...",

        // Errors
        err_input_not_found: "Input element not found",
        err_script_injection_failed: "Script injection failed",
        err_no_response_selectors: "No response selectors configured",
        err_extraction_failed: "Failed to extract response",
        err_no_response: "No response",
        err_failed_tile: "Failed to tile window",
        err_failed_apply_layout: "Failed to apply layout",
        err_broadcast_failed: "Failed to broadcast message",
        err_input_too_long: "Input too long (max {max} characters)",
        err_invalid_input: "Invalid input",

        // Success Messages
        sent: "Sent!",
        broadcast_success: "Broadcast successful",

        // Date/Time Formats
        date_format: "YYYY-MM-DD",
        time_format: "HH:mm:ss",
        datetime_format: "YYYY-MM-DD HH:mm:ss",
        relative_time: {
            just_now: "Just now",
            minutes_ago: "{count} min ago",
            hours_ago: "{count} hour ago",
            days_ago: "{count} day ago"
        },

        // Modal Navigation
        prev_response: "Previous response",
        next_response: "Next response"
    },

    "zh-CN": {
        // Header
        logo: "AI 多重宇宙",
        switch_language: "切换语言",
        toggle_theme: "切换主题",
        choose_models: "选择 AI 模型",
        summarize_settings: "智能总结设置",

        // Tabs
        tab_chat: "对话",
        tab_responses: "响应",

        // History
        history_title: "对话历史",
        clear_all: "清空全部",
        view_detail: "查看详情",
        resend_message: "重发",
        edit_message: "编辑",
        delete_message: "删除",
        history_detail_title: "消息详情",
        question: "问题",
        responses: "AI 响应",
        message_reloaded: "消息已加载到输入框",
        edit_message_prompt: "编辑这条消息：",
        message_edited: "消息已更新",
        confirm_delete_message: "确定要删除这条消息吗？",
        message_deleted: "消息已删除",
        clear_history_confirm: "清空全部 {count} 条历史记录？",
        history_cleared: "历史记录已清空",
        history_empty: "历史记录已为空",
        no_messages: "还没有消息。",

        // Responses
        fetch_responses: "获取响应",
        copy_all: "复制全部",
        copy: "复制",
        summarize: "智能总结",
        summarizing: "总结中...",
        summary_title: "总结",
        summary_model: "由 {model} 总结",
        summary_by: "由 {model}",
        summary_check_window: "检查总结窗口...",
        summary_empty: "没有可总结的响应",
        summary_success: "总结创建成功",
        summary_failed: "总结失败",
        summary_failed_title: "总结失败",
        summary_failed_detail: "{error}",
        summary_generated: "已生成总结",
        summary_sent: "已发送总结",
        summary_sent_to: "总结已发送到 {model}",
        summary_timeout: "总结超时",
        fetch_status_summary: "获取总结",
        fetching: "获取中...",
        no_responses: "尚未获取响应。",
        extracting: "提取中...",
        waiting_responses: "等待回复",
        waiting_for: "等待",
        completed: "已完成",
        generating: "生成中...",
        failed: "失败",
        timeout: "超时",
        error: "错误",
        characters: "字",
        loading: "加载中...",
        missing: "未找到",
        settings_saved: "设置已保存",
        models: "个模型",

        // Buttons
        send: "发送",
        open: "打开",
        tile: "平铺",
        close: "关闭",
        attach_file: "附件",
        attach_files: "附加文件",
        summarize_all: "总结所有响应",
        smart_summarize: "智能总结",
        
        // New v2.0 keys
        no_conversations: "开始你的第一次对话",
        select_at_least_one: "请至少选择一个AI模型",
        send_error: "发送消息失败",
        wait_for_responses: "请等待所有响应完成",
        summarize_error: "创建总结失败",
        summarize_complete: "总结完成",
        copy_success: "已复制到剪贴板",

        // Summarize Settings Modal
        summarize_settings_title: "总结设置",
        summarize_settings_subtitle: "选择模型和提示词进行总结",
        summarize_model_label: "总结模型",
        summarize_prompt_label: "总结提示词",
        use_defaultPrompt: "使用默认提示词",
        reset_prompt: "重置提示词",
        prompt_placeholder_custom: "输入自定义的总结提示词...",

        // Status
        sending: "发送中...",
        tiled: "平铺中...",
        launching: "打开中...",
        closing: "关闭中...",

        // Model Selection
        models_title: "AI 模型",
        select_recipients: "选择接收方",
        confirm: "确认",

        // Provider Names
        gemini: "Gemini",
        grok: "Grok",
        kimi: "Kimi",
        deepseek: "DeepSeek",
        chatgpt: "ChatGPT",
        qwen: "通义千问",
        yuanbao: "腾讯元宝",

        // Close All Modal
        close_all_title: "关闭所有窗口？",
        close_all_desc: "这将关闭 AI Multiverse 当前打开的所有浏览器窗口。",
        close_all_warning: "确定要一键关闭所有 AI 对话窗口吗？正在运行的回答不会被保存。",
        cancel: "取消",
        confirm_close: "确定",

        // Detail Modal
        copy_response: "复制此响应",
        copied: "已复制！",

        // Placeholders
        ask_anything: "输入任何问题... (Enter 发送)",
        prompt_placeholder_custom: "输入您的自定义总结提示词...",

        // File Upload
        file_select: "选择要上传的文件",
        file_preview: "已附加文件",
        file_clear_all: "清空所有文件",
        file_remove: "移除",
        file_type_image: "图片",
        file_type_document: "文档",
        file_type_other: "文件",
        file_uploading: "上传中...",
        file_upload_failed: "上传失败：{error}",
        file_unsupported: "不支持的文件类型：{type}",
        file_too_large: "文件过大：最大 {max}MB",
        file_size_too_large: "总大小过大：最大 {max}MB",
        drag_files_here: "拖放文件到此处上传",
        file_added: "已添加：{name}",

        // Errors related to files
        err_file_read_failed: "读取文件失败",
        err_file_not_supported: "该提供商不支持此文件类型",

        // Meta
        time_format: "• {count} 个 AI",

        // System Messages
        system: "系统",
        processing: "处理中...",

        // Errors
        err_input_not_found: "未找到输入框",
        err_script_injection_failed: "脚本注入失败",
        err_no_response_selectors: "未配置响应选择器",
        err_extraction_failed: "提取响应失败",
        err_no_response: "暂无响应",
        err_failed_tile: "平铺窗口失败",
        err_failed_apply_layout: "应用布局失败",
        err_broadcast_failed: "广播消息失败",
        err_input_too_long: "输入过长（最多 {max} 个字符）",
        err_invalid_input: "无效输入",

        // Success Messages
        sent: "发送成功！",
        broadcast_success: "广播成功",

        // Date/Time Formats
        date_format: "YYYY年MM月DD日",
        time_format: "HH:mm:ss",
        datetime_format: "YYYY年MM月DD日 HH:mm:ss",
        relative_time: {
            just_now: "刚刚",
            minutes_ago: "{count} 分钟前",
            hours_ago: "{count} 小时前",
            days_ago: "{count} 天前"
        },

        // Modal Navigation
        prev_response: "上一个响应",
        next_response: "下一个响应"
    }
};

// Default language
let currentLang = 'zh-CN';

// ============================================================================
// TRANSLATION FUNCTIONS
// ============================================================================

/**
 * Get translation for a key with variable substitution
 * @param {string} key - Translation key (e.g., 'summary_failed')
 * @param {object} vars - Variables to replace (e.g., {model: 'Gemini'})
 * @returns {string} Translated text
 */
function t(key, vars = {}) {
    const parts = key.split('.');
    let value = I18N[currentLang];

    // Navigate through nested object
    for (const part of parts) {
        if (value && value[part]) {
            value = value[part];
        } else {
            console.warn(`Translation missing: ${key} for language ${currentLang}`);
            return key;
        }
    }

    // If it's a string, replace variables {var_name}
    if (typeof value === 'string') {
        return value.replace(/\{(\w+)\}/g, (match, varName) => {
            return vars[varName] !== undefined ? vars[varName] : match;
        });
    }

    return value;
}

/**
 * Set language
 * @param {string} lang - Language code ('en' or 'zh-CN')
 * @returns {boolean} Success status
 */
function setLanguage(lang) {
    if (I18N[lang]) {
        currentLang = lang;
        return true;
    }
    console.warn(`Language not supported: ${lang}`);
    return false;
}

/**
 * Get current language
 * @returns {string} Current language code
 */
function getLanguage() {
    return currentLang;
}

/**
 * Get available languages
 * @returns {string[]} Array of language codes
 */
function getAvailableLanguages() {
    return Object.keys(I18N);
}

// ============================================================================
// DATE/TIME FORMATTING FUNCTIONS
// ============================================================================

/**
 * Format date/time according to current language
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @param {string} formatType - 'date', 'time', or 'datetime'
 * @returns {string} Formatted date/time string
 */
function formatDateTime(timestamp, formatType = 'datetime') {
    const date = new Date(timestamp);

    if (!date || isNaN(date.getTime())) {
        return '';
    }

    const lang = currentLang;

    // Use Intl.DateTimeFormat for proper localization
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    };

    if (formatType === 'date') {
        delete options.hour;
        delete options.minute;
    } else if (formatType === 'time') {
        delete options.year;
        delete options.month;
        delete options.day;
    } else if (formatType === 'datetime') {
        // For datetime, include seconds
        options.second = '2-digit';
    }

    const locale = lang === 'zh-CN' ? 'zh-CN' : 'en-US';
    return date.toLocaleString(locale, options);
}

/**
 * Format relative time (e.g., "5 min ago")
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Relative time string
 */
function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000); // seconds

    const lang = currentLang;
    const relatives = I18N[lang]?.relative_time || I18N.en.relative_time;

    if (diff < 60) {
        return relatives.just_now;
    }

    const minutes = Math.floor(diff / 60);
    if (minutes < 60) {
        return relatives.minutes_ago.replace('{count}', minutes);
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return relatives.hours_ago.replace('{count}', hours);
    }

    const days = Math.floor(hours / 24);
    return relatives.days_ago.replace('{count}', days);
}

// ============================================================================
// EXPORT FOR GLOBAL SCOPE
// ============================================================================

// Use IIFE to ensure functions are available globally
(function initI18N() {
    window.t = window.t || t;
    window.formatDateTime = window.formatDateTime || formatDateTime;
    window.formatRelativeTime = window.formatRelativeTime || formatRelativeTime;
    window.setLanguage = window.setLanguage || setLanguage;
    window.getLanguage = window.getLanguage || getLanguage;
    window.getAvailableLanguages = window.getAvailableLanguages || getAvailableLanguages;
    window.I18N = window.I18N || I18N;
})();
