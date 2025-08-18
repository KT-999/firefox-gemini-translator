// modules/storage.js
// 這個模組集中處理所有與 browser.storage.local 的互動。

/**
 * 儲存一筆翻譯紀錄。
 * @param {string} original - 原始文字。
 * @param {string} translated - 翻譯後的文字。
 * @param {string} engine - 使用的翻譯引擎 ('google' 或 'gemini')。
 * @param {string} targetLang - 目標語言。
 */
export async function addHistoryItem(original, translated, engine, targetLang) {
  try {
    const { translationHistory = [], maxHistorySize = 20 } = await browser.storage.local.get(["translationHistory", "maxHistorySize"]);
    if (!original || !translated) return;

    const newEntry = {
      original, translated, engine, targetLang,
      timestamp: new Date().toISOString()
    };

    const updatedHistory = [newEntry, ...translationHistory];
    if (updatedHistory.length > maxHistorySize) {
      updatedHistory.length = maxHistorySize;
    }
    await browser.storage.local.set({ translationHistory: updatedHistory });
  } catch (err) {
    console.error("儲存翻譯紀錄失敗：", err);
  }
}

/**
 * 獲取所有設定。
 * @returns {Promise<object>} 包含所有設定的物件。
 */
export async function getSettings() {
    const defaults = {
        GEMINI_API_KEY: '',
        TRANSLATE_LANG: '繁體中文',
        UI_LANG: null,
        THEME: 'auto',
        maxHistorySize: 20,
        geminiKeyValid: false,
        USE_GEMINI: true
    };
    return browser.storage.local.get(defaults);
}

/**
 * 儲存設定。
 * @param {object} settingsToSave - 要儲存的設定物件。
 */
export async function saveSettings(settingsToSave) {
    return browser.storage.local.set(settingsToSave);
}

/**
 * 獲取翻譯歷史紀錄。
 * @returns {Promise<Array>} 翻譯歷史紀錄陣列。
 */
export async function getHistory() {
    const { translationHistory = [] } = await browser.storage.local.get("translationHistory");
    return translationHistory;
}
