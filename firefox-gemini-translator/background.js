// --- Helper Functions ---

/**
 * 【修改】儲存一筆翻譯紀錄，新增 targetLang 參數。
 * @param {string} original - 原始文字。
 * @param {string} translated - 翻譯後的文字。
 * @param {string} engine - 使用的翻譯引擎 ('google' 或 'gemini')。
 * @param {string} targetLang - 目標語言。
 */
async function saveToHistory(original, translated, engine, targetLang) {
  try {
    const { translationHistory = [], maxHistorySize = 20 } = await browser.storage.local.get(["translationHistory", "maxHistorySize"]);

    const newEntry = {
      original,
      translated,
      engine,
      targetLang, // 儲存目標語言
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
 * 檢查文字是否包含中日韓 (CJK) 字元。
 */
function containsCjk(text) {
  const cjkRegex = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf\uac00-\ud7af]/;
  return cjkRegex.test(text);
}

/**
 * 安全地向分頁發送訊息，並處理可能的連線錯誤。
 */
async function sendMessageToTab(tabId, message) {
  try {
    await browser.tabs.sendMessage(tabId, message);
  } catch (e) {
    console.warn(`無法將訊息傳送至分頁 ${tabId}。Content script 可能未被注入或分頁不支援。`, e.message);
  }
}


/**
 * 使用 Google Translate API 進行翻譯。
 */
async function translateWithGoogle(text, targetLang, tabId) {
  const uiStrings = {
      copy: i18n.t("popupCopy"),
      copied: i18n.t("popupCopied"),
      close: i18n.t("popupClose")
  };

  try {
    const langCodeMap = { "繁體中文": "zh-TW", "簡體中文": "zh-CN", "英文": "en", "日文": "ja", "韓文": "ko", "法文": "fr", "德文": "de", "西班牙文": "es", "俄文": "ru" };
    const tl = langCodeMap[targetLang] || "zh-TW";
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&dt=bd&dt=ss&dt=ex&q=${encodeURIComponent(text)}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Google API 錯誤: ${response.status}`);
    
    const data = await response.json();
    let translatedText = '';
    
    const allDefinitions = {};
    if (data[1] || data[5] || (data[12] && data[12].length > 0)) {
        const synonymBlocks = [data[1], data[5]].filter(Boolean);
        synonymBlocks.forEach(block => {
            if (Array.isArray(block)) {
                block.forEach(part => {
                    if (!Array.isArray(part) || part.length < 2) return;
                    const partOfSpeech = part[0];
                    const words = part[1];
                    if (typeof partOfSpeech === 'string' && Array.isArray(words)) {
                        if (!allDefinitions[partOfSpeech]) allDefinitions[partOfSpeech] = new Set();
                        words.forEach(word => allDefinitions[partOfSpeech].add(word));
                    }
                });
            }
        });
        if (data[12] && Array.isArray(data[12])) {
             data[12].forEach(part => {
                if (!Array.isArray(part) || part.length < 2) return;
                const partOfSpeech = part[0];
                const definitions = part[1];
                 if (typeof partOfSpeech === 'string' && Array.isArray(definitions)) {
                    if (!allDefinitions[partOfSpeech]) allDefinitions[partOfSpeech] = new Set();
                    definitions.forEach(def => {
                        if (def && typeof def[0] === 'string') allDefinitions[partOfSpeech].add(def[0]);
                    });
                }
            });
        }
    }
    translatedText = Object.entries(allDefinitions)
      .map(([pos, defSet]) => `${pos}: ${[...defSet].join(', ')}`)
      .join('__NEWLINE__');
    if (!translatedText && data[0] && Array.isArray(data[0])) {
      translatedText = data[0].map(item => item[0]).join('');
    }

    if (!translatedText) throw new Error("從 Google 未收到翻譯結果");

    // 【修改】儲存時傳入 targetLang
    await saveToHistory(text, translatedText.replace(/__NEWLINE__/g, '\n'), 'google', targetLang);
    await sendMessageToTab(tabId, { type: "showTranslation", text: translatedText, engine: 'google', ui: uiStrings });

  } catch (err) {
    console.error("Google 翻譯發生錯誤", err);
    await sendMessageToTab(tabId, { type: "showTranslation", text: i18n.t("errorGoogle"), engine: 'google', ui: uiStrings });
  }
}

/**
 * 使用 Gemini API 進行翻譯。
 */
async function translateWithGemini(text, apiKey, targetLang, tabId) {
  const uiStrings = {
      copy: i18n.t("popupCopy"),
      copied: i18n.t("popupCopied"),
      close: i18n.t("popupClose")
  };

  try {
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const prompt = i18n.t("promptSystem", [targetLang, text]);

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 100, temperature: 0.1 }
      })
    });

    if (!response.ok && response.status === 400) throw new Error('Invalid API Key');
    if (!response.ok) throw new Error(`API 網路錯誤: ${response.status}`);

    const data = await response.json();
    const translatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!translatedText) throw new Error("從 Gemini 未收到翻譯結果");

    await browser.storage.local.set({ geminiKeyValid: true });
    // 【修改】儲存時傳入 targetLang
    await saveToHistory(text, translatedText, 'gemini', targetLang);
    await sendMessageToTab(tabId, { type: "showTranslation", text: translatedText, engine: 'gemini', ui: uiStrings });

  } catch (err) {
    console.error("Gemini 翻譯發生錯誤:", err.message);
    if (err.message === 'Invalid API Key') {
      console.log(i18n.t("errorInvalidKey"));
      await browser.storage.local.set({ geminiKeyValid: false });
      await translateWithGoogle(text, targetLang, tabId);
    } else {
      await sendMessageToTab(tabId, { type: "showTranslation", text: i18n.t("errorGemini"), engine: 'gemini', ui: uiStrings });
    }
  }
}

// --- Main Logic ---

// 創建或更新右鍵選單
function setupContextMenu() {
    browser.contextMenus.create({
        id: "smart-translate",
        title: i18n.t("contextMenuTitle"),
        contexts: ["selection"]
    });
}

// 監聽來自設定頁的語言變更請求
browser.runtime.onMessage.addListener((message) => {
    if (message.type === 'languageChanged') {
        // 重新初始化語言並更新右鍵選單
        i18n.init().then(() => {
            browser.contextMenus.update("smart-translate", {
                title: i18n.t("contextMenuTitle")
            });
        });
    }
});


browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "smart-translate") return;
  const selectedText = info.selectionText.trim();
  if (!selectedText) return;

  if (!tab || typeof tab.id === 'undefined') {
      console.error("無法獲取有效的 Tab ID。");
      return;
  }

  const { GEMINI_API_KEY, TRANSLATE_LANG } = await browser.storage.local.get(["GEMINI_API_KEY", "TRANSLATE_LANG"]);
  const targetLang = TRANSLATE_LANG || i18n.t("langZhTw");

  let useGoogleTranslate = false;
  if (containsCjk(selectedText)) {
    useGoogleTranslate = selectedText.length <= 5;
  } else {
    const wordCount = selectedText.split(/\s+/).length;
    const characterCount = selectedText.length;
    useGoogleTranslate = wordCount <= 3 && characterCount < 30;
  }

  if (!useGoogleTranslate && GEMINI_API_KEY) {
    await translateWithGemini(selectedText, GEMINI_API_KEY, targetLang, tab.id);
  } else {
    await translateWithGoogle(selectedText, targetLang, tab.id);
  }
});

// 初始化 i18n 管理器並設定右鍵選單
i18n.init().then(setupContextMenu);
