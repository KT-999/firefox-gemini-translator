// modules/tts.js
// 專門處理文字轉語音 (TTS) 的功能。

/**
 * 根據語言代碼播放語音。
 * @param {string} text - 要朗讀的文字。
 * @param {string} langCode - BCP 47 語言代碼 (e.g., "en", "zh-TW")。
 */
export function playTTS(text, langCode) {
    if (!langCode || langCode === 'und') {
        console.error("無效的語言代碼，無法播放語音:", langCode);
        return;
    }
    
    // Google TTS URL，使用 'tw-ob' client 參數以避免 reCAPTCHA
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${langCode}&client=tw-ob`;
    
    const audio = new Audio(url);
    audio.play().catch(e => console.error("播放語音失敗:", e));
}
