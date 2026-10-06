// modules/languages.js
// 集中管理語言代碼映射、字元集檢查與來源語言偵測邏輯。

export const LANG_NAME_TO_CODE_MAP = {
  "繁體中文": "zh-TW",
  "簡體中文": "zh-CN",
  "英文": "en",
  "日文": "ja",
  "韓文": "ko",
  "法文": "fr",
  "德文": "de",
  "西班牙文": "es",
  "俄文": "ru",
  "印地文": "hi",
  "阿拉伯文": "ar",
  "孟加拉文": "bn",
  "葡萄牙文": "pt",
  "印尼文": "id"
};

export function containsCjk(text) {
  const cjkRegex = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf\uac00-\ud7af]/;
  return cjkRegex.test(text);
}

/**
 * 結合 browser.i18n.detectLanguage 與字元範圍 fallback 偵測文字語言代碼。
 * @param {string} text
 * @returns {Promise<string>} BCP 47 語言代碼或 'und'
 */
export async function detectSourceLanguage(text) {
  if (!text) return 'und';
  let sourceLang = 'und';
  try {
    const detectedLangInfo = await browser.i18n.detectLanguage(text);
    sourceLang = detectedLangInfo?.languages?.[0]?.language || 'und';
  } catch (e) {
    sourceLang = 'und';
  }

  if (sourceLang === 'und') {
    if (/[\u0900-\u097F]/.test(text)) sourceLang = 'hi';
    else if (/[\u0600-\u06FF]/.test(text)) sourceLang = 'ar';
    else if (/[\u0980-\u09FF]/.test(text)) sourceLang = 'bn';
    else if (/[\uAC00-\uD7A3]/.test(text)) sourceLang = 'ko';
    else if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) sourceLang = 'ja';
    else if (containsCjk(text)) sourceLang = 'zh';
    else if (/[\u0400-\u04FF]/.test(text)) sourceLang = 'ru';
    else if (/[àâçéèêëîïôûùüÿæœ]/i.test(text)) sourceLang = 'fr';
    else if (/[äöüß]/i.test(text)) sourceLang = 'de';
    else if (/[áéíóúüñ]/i.test(text)) sourceLang = 'es';
    else if (/[ãõàáâéêíóôõúç]/i.test(text)) sourceLang = 'pt';
    else if (/^[a-z\u00C0-\u017F\s.,'’!-]+$/i.test(text)) sourceLang = 'en';
  }
  return sourceLang;
}

/**
 * 將語言代碼轉為使用者介面語言的可讀名稱。
 * @param {string} sourceLang
 * @param {string} uiLang
 * @returns {string}
 */
export function getDisplayLanguageName(sourceLang, uiLang = 'zh_TW') {
  if (!sourceLang || sourceLang === 'und') return '';
  const normalizedUiLang = (uiLang || 'zh_TW').replace('_', '-');
  try {
    const displayLang = new Intl.DisplayNames([normalizedUiLang], { type: 'language' });
    return displayLang.of(sourceLang) || sourceLang;
  } catch (e) {
    return sourceLang;
  }
}
