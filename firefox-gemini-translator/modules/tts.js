// modules/tts.js
// 專門處理文字轉語音 (TTS) 的功能，支援長文自動分段與 Web Speech API 備援。

let currentAudio = null;
let isCancelled = false;

/**
 * 將長文切分為不超過 maxLen 的片段，避免 Google TTS 長度限制 (約 200 字元)。
 * @param {string} text
 * @param {number} maxLen
 * @returns {string[]}
 */
function splitTextIntoChunks(text, maxLen = 180) {
  const cleaned = text.trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxLen) return [cleaned];

  const chunks = [];
  // 先依標點符號與換行切分
  const sentences = cleaned.split(/(?<=[。！？.!?;；\n])\s*/);
  let current = '';

  for (const sentence of sentences) {
    if (!sentence) continue;
    if ((current + ' ' + sentence).trim().length <= maxLen) {
      current = (current ? current + ' ' : '') + sentence;
    } else {
      if (current) chunks.push(current);
      if (sentence.length <= maxLen) {
        current = sentence;
      } else {
        // 單句過長時強制依字數切分
        for (let i = 0; i < sentence.length; i += maxLen) {
          chunks.push(sentence.slice(i, i + maxLen));
        }
        current = '';
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * 使用瀏覽器內建 Web Speech API 作為備援發音。
 * @param {string} text
 * @param {string} langCode
 */
function playFallbackSpeechSynthesis(text, langCode) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.error("瀏覽器不支援 speechSynthesis 備援語音");
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error("備援語音播放失敗:", err);
  }
}

/**
 * 根據語言代碼播放語音。
 * @param {string} text - 要朗讀的文字。
 * @param {string} langCode - BCP 47 語言代碼 (e.g., "en", "zh-TW")。
 */
export async function playTTS(text, langCode) {
  if (!langCode || langCode === 'und' || !text) {
    console.error("無效的語言代碼或文字，無法播放語音:", langCode);
    return;
  }

  // 停止前一次正在播放的音訊
  isCancelled = true;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  const chunks = splitTextIntoChunks(text, 180);
  if (chunks.length === 0) return;

  isCancelled = false;

  try {
    for (const chunk of chunks) {
      if (isCancelled) break;
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${encodeURIComponent(langCode)}&client=tw-ob`;
      await new Promise((resolve, reject) => {
        const audio = new Audio(url);
        currentAudio = audio;
        audio.onended = () => resolve();
        audio.onerror = (e) => reject(e);
        audio.play().catch(reject);
      });
    }
  } catch (e) {
    console.warn("Google TTS 播放失敗，切換至瀏覽器內建語音備援:", e);
    playFallbackSpeechSynthesis(text, langCode);
  } finally {
    currentAudio = null;
  }
}
