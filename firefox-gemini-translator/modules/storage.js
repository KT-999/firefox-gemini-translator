// modules/storage.js
// 這個模組集中處理所有與 browser.storage.local 的互動。

/**
 * 儲存一筆翻譯紀錄。
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
 */
export async function getSettings() {
    const defaults = {
        GEMINI_API_KEY: '',
        TRANSLATE_LANG: '繁體中文',
        UI_LANG: null,
        THEME: 'auto',
        maxHistorySize: 20,
        geminiKeyValid: false,
        USE_GEMINI: true,
        GEMINI_MODEL: 'gemini-1.5-flash-latest' // 【新增】預設模型
    };
    return browser.storage.local.get(defaults);
}

/**
 * 儲存設定。
 */
export async function saveSettings(settingsToSave) {
    return browser.storage.local.set(settingsToSave);
}

/**
 * 獲取翻譯歷史紀錄。
 */
export async function getHistory() {
    const { translationHistory = [] } = await browser.storage.local.get("translationHistory");
    return translationHistory;
}
