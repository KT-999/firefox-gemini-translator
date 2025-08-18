// modules/tts.js
// 專門處理文字轉語音 (TTS) 的功能。

/**
 * 播放翻譯結果的語音。
 * @param {string} text - 要朗讀的文字。
 * @param {string} langName - 語言的完整名稱 (e.g., "繁體中文")。
 */
export function playTTS(text, langName) {
    const langCodeMap = { "繁體中文": "zh-TW", "簡體中文": "zh-CN", "英文": "en", "日文": "ja", "韓文": "ko", "法文": "fr", "德文": "de", "西班牙文": "es", "俄文": "ru" };
    const langCode = langCodeMap[langName];
    if (!langCode) {
        console.error("找不到對應的語言代碼:", langName);
        return;
    }
    
    // Google TTS URL，使用 'tw-ob' client 參數以避免 reCAPTCHA
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${langCode}&client=tw-ob`;
    
    const audio = new Audio(url);
    audio.play().catch(e => console.error("播放語音失敗:", e));
}
