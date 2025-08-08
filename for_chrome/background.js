importScripts('browser-polyfill.js');

// --- 一次性安裝設定 ---
browser.runtime.onInstalled.addListener(() => {
  // 為了避免開發時重載造成衝突，先移除所有已存在的選單，再重新建立。
  browser.contextMenus.removeAll().then(() => {
    browser.contextMenus.create({
      id: "smart-translate",
      title: "智慧翻譯",
      contexts: ["selection"]
    });
    console.log("智慧翻譯右鍵選單已成功建立或更新。");
  });
});


// --- Helper Functions (您的原始程式碼) ---

async function saveToHistory(original, translated) {
  try {
    const { translationHistory = [], maxHistorySize = 20 } = await browser.storage.local.get([
      "translationHistory",
      "maxHistorySize"
    ]);
    const newEntry = {
      original,
      translated,
      timestamp: new Date().toISOString()
    };
    const updatedHistory = [newEntry, ...translationHistory];
    if (updatedHistory.length > maxHistorySize) {
      updatedHistory.length = maxHistorySize;
    }
    await browser.storage.local.set({ translationHistory: updatedHistory });
    console.log("翻譯紀錄已成功儲存。"); // 新增日誌以供除錯
  } catch (err) {
    console.error("儲存翻譯紀錄失敗：", err);
  }
}

function containsCjk(text) {
  const cjkRegex = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf\uac00-\ud7af]/;
  return cjkRegex.test(text);
}

// **【重構】** 此函式現在只負責翻譯並回傳結果，不再儲存或顯示
async function translateWithGoogle(text, targetLang) {
  const langCodeMap = { "繁體中文": "zh-TW", "簡體中文": "zh-CN", "英文": "en", "日文": "ja" };
  const tl = langCodeMap[targetLang] || "zh-TW";
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&dt=bd&dt=ss&dt=ex&q=${encodeURIComponent(text)}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google API 錯誤: ${response.status}`);
  const data = await response.json();
  
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

  let translatedText = Object.entries(allDefinitions).map(([pos, defSet]) => `${pos}: ${[...defSet].join(', ')}`).join('__NEWLINE__');
  if (!translatedText && data[0] && Array.isArray(data[0])) {
    translatedText = data[0].map(item => item[0]).join('');
  }

  if (!translatedText) throw new Error("從 Google 未收到翻譯結果");
  return translatedText;
}

// **【重構】** 此函式現在只負責翻譯並回傳結果，不再儲存或顯示
async function translateWithGemini(text, apiKey, targetLang) {
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
  return translatedText;
}

// --- Main Logic (重構後) ---

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

  // **【重構】** 將所有後續處理集中於此，並用 try...catch 包覆
  try {
    let translatedText;
    let engine;

    if (useGoogleTranslate) {
      engine = 'google';
      translatedText = await translateWithGoogle(selectedText, targetLang);
    } else {
      if (!GEMINI_API_KEY) {
        throw new Error("翻譯句子需要 Gemini API Key，請先在設定頁輸入。");
      }
      engine = 'gemini';
      translatedText = await translateWithGemini(selectedText, GEMINI_API_KEY, targetLang);
    }

    // 翻譯成功後，先儲存再顯示
    // 儲存時，將 Google 翻譯的特殊換行符號轉回標準換行符
    const textToSave = (engine === 'google') ? translatedText.replace(/__NEWLINE__/g, '\n') : translatedText;
    await saveToHistory(selectedText, textToSave);

    // 傳送訊息以顯示結果
    browser.tabs.sendMessage(tab.id, { type: "showTranslation", text: translatedText, engine: engine })
      .catch(error => {
        console.log(`傳送訊息到分頁 ${tab.id} 失敗。可能此頁面不支援或需重新整理。錯誤: ${error.message}`);
      });

  } catch (err) {
    // 統一處理所有翻譯過程中的錯誤
    console.error("翻譯流程發生錯誤:", err);
    browser.tabs.sendMessage(tab.id, { type: "showTranslation", text: `❌ ${err.message}` })
      .catch(error => {
        console.log(`傳送錯誤訊息到分頁 ${tab.id} 失敗。錯誤: ${error.message}`);
      });
  }
});
