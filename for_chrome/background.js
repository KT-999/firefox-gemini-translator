// --- Helper Functions ---

/**
 * 儲存一筆翻譯紀錄。
 * @param {string} original - 原始文字。
 * @param {string} translated - 翻譯後的文字。
 */

importScripts('browser-polyfill.js');

async function saveToHistory(original, translated) {
  try {
    const { translationHistory = [], maxHistorySize = 20 } = await browser.storage.local.get([
      "translationHistory",
      "maxHistorySize"
    ]);

    // 建立新的紀錄項目
    const newEntry = {
      original,
      translated,
      timestamp: new Date().toISOString()
    };

    // 將新紀錄加到最前面
    const updatedHistory = [newEntry, ...translationHistory];

    // 如果紀錄超過最大數量，則移除最舊的紀錄
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
 * @param {string} text - 要檢查的文字。
 * @returns {boolean} - 如果文字中含有任何 CJK 字元，則回傳 true。
 */
function containsCjk(text) {
  const cjkRegex = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf\uac00-\ud7af]/;
  return cjkRegex.test(text);
}


/**
 * 使用 Google Translate API 進行翻譯。
 */
async function translateWithGoogle(text, targetLang, tabId) {
  try {
    const langCodeMap = { "繁體中文": "zh-TW", "簡體中文": "zh-CN", "英文": "en", "日文": "ja" };
    const tl = langCodeMap[targetLang] || "zh-TW";
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&dt=bd&dt=ss&dt=ex&q=${encodeURIComponent(text)}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Google API 錯誤: ${response.status}`);
    const data = await response.json();
    let translatedText = '';
    const allDefinitions = {};

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

    const dictionaryBlock = data.find(block => Array.isArray(block) && block.length > 0 && block[0] && typeof block[0][0] === 'string' && Array.isArray(block[0][1]));
    if (dictionaryBlock) {
      dictionaryBlock.forEach(part => {
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

    translatedText = Object.entries(allDefinitions).map(([pos, defSet]) => `${pos}: ${[...defSet].join(', ')}`).join('__NEWLINE__');

    if (!translatedText && data[0] && Array.isArray(data[0])) {
      translatedText = data[0].map(item => item[0]).join('');
    }

    if (!translatedText) throw new Error("從 Google 未收到翻譯結果");

    await saveToHistory(text, translatedText.replace(/__NEWLINE__/g, '\n'));
    browser.tabs.sendMessage(tabId, { type: "showTranslation", text: translatedText, engine: 'google' });
  } catch (err) {
    console.error("Google 翻譯發生錯誤", err);
    browser.tabs.sendMessage(tabId, { type: "showTranslation", text: "❌ Google 翻譯失敗" });
  }
}

/**
 * 使用 Gemini API 進行翻譯。
 */
async function translateWithGemini(text, apiKey, targetLang, tabId) {
  try {
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const prompt = `你是一個專業的翻譯引擎。請嚴格按照以下規則，將「」中的文字翻譯成${targetLang}。\n\n規則：\n1. **絕對不要**有任何解釋、前言、或額外補充說明。\n2. 如果原文是單一詞彙且有多種常見意思，請用「、」分隔後直接列出，例如：「令牌、象徵、代幣」。\n3. 如果原文是句子或片語，請直接提供最通順、最自然的單一翻譯結果。\n4. **絕對不要**使用任何 Markdown 格式，例如 * 或 -。\n\n原文：「${text}」`;

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 100, temperature: 0.1 }
      })
    });

    if (!response.ok) throw new Error(`API 錯誤: ${response.status}`);
    const data = await response.json();
    const translatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!translatedText) throw new Error("從 Gemini 未收到翻譯結果");

    await saveToHistory(text, translatedText);
    browser.tabs.sendMessage(tabId, { type: "showTranslation", text: translatedText, engine: 'gemini' });
  } catch (err) {
    console.error("Gemini 翻譯發生錯誤", err);
    browser.tabs.sendMessage(tabId, { type: "showTranslation", text: "❌ Gemini 翻譯失敗，請檢查網路或 API Key。" });
  }
}

// --- Main Logic ---

browser.contextMenus.create({
  id: "smart-translate",
  title: "智慧翻譯",
  contexts: ["selection"]
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "smart-translate") return;

  const selectedText = info.selectionText.trim();
  if (!selectedText) return;

  const { GEMINI_API_KEY, TRANSLATE_LANG } = await browser.storage.local.get(["GEMINI_API_KEY", "TRANSLATE_LANG"]);
  const targetLang = TRANSLATE_LANG || "繁體中文";

  let useGoogleTranslate = false;
  if (containsCjk(selectedText)) {
    useGoogleTranslate = selectedText.length <= 5;
  } else {
    const wordCount = selectedText.split(/\s+/).length;
    const characterCount = selectedText.length;
    useGoogleTranslate = wordCount <= 3 && characterCount < 30;
  }

  if (useGoogleTranslate) {
    await translateWithGoogle(selectedText, targetLang, tab.id);
  } else {
    if (!GEMINI_API_KEY) {
      browser.tabs.sendMessage(tab.id, { type: "showTranslation", text: "錯誤：翻譯句子需要 Gemini API Key，請先在設定頁輸入。" });
      return;
    }
    await translateWithGemini(selectedText, GEMINI_API_KEY, targetLang, tab.id);
  }
});
