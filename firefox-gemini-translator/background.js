// --- Helper Functions ---

/**
 * 使用 Google Translate API 進行翻譯，並優先取得詳細的字典結果。
 * @param {string} text - 要翻譯的文字。
 * @param {string} targetLang - 目標語言的名稱 (例如 "繁體中文")。
 * @param {number} tabId - 當前分頁的 ID。
 */
async function translateWithGoogle(text, targetLang, tabId) {
  try {
    const langCodeMap = {
      "繁體中文": "zh-TW",
      "簡體中文": "zh-CN",
      "英文": "en",
      "日文": "ja"
    };
    const tl = langCodeMap[targetLang] || "zh-TW";
    // 修改 API 參數，加入 dt=bd 來請求字典資料 (dictionary)
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&dt=bd&q=${encodeURIComponent(text)}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Google API 錯誤: ${response.status}`);

    const data = await response.json();
    let translatedText = '';

    // --- 全新的、更穩健的字典格式解析邏輯 ---
    const dictionaryBlock = data.find(block =>
      Array.isArray(block) &&
      block.length > 0 &&
      block[0] && typeof block[0][0] === 'string' && // 檢查詞性是否為字串
      Array.isArray(block[0][1])       // 檢查定義列表是否存在
    );

    if (dictionaryBlock) {
      // 如果找到了字典區塊，就格式化它
      translatedText = dictionaryBlock.map(part => {
        const partOfSpeech = part[0]; // 詞性，例如 "noun" 或 "名詞"
        // 修正：Google API 回傳的完整單字在 part[1][i][0]
        const definitions = part[1].map(def => def[0]).filter(Boolean); // 過濾掉空的定義
        if (definitions.length === 0) return null; // 如果該詞性沒有有效定義，則跳過
        return `${partOfSpeech}: ${definitions.join(', ')}`;
      }).filter(Boolean).join('__NEWLINE__'); // 使用特殊標記替代換行符，並過濾掉空行
    }

    // 如果沒有找到字典資料，則退回使用標準翻譯
    if (!translatedText && data[0] && Array.isArray(data[0])) {
      translatedText = data[0].map(item => item[0]).join('');
    }

    if (!translatedText) throw new Error("從 Google 未收到翻譯結果");

    // 移除 (G) 標記，直接傳送處理好的文字
    browser.tabs.sendMessage(tabId, {
      type: "showTranslation",
      text: translatedText,
      engine: 'google'
    });
  } catch (err) {
    console.error("Google 翻譯發生錯誤", err);
    browser.tabs.sendMessage(tabId, {
      type: "showTranslation",
      text: "❌ Google 翻譯失敗"
    });
  }
}

/**
 * 使用 Gemini API 進行翻譯。
 * @param {string} text - 要翻譯的文字。
 * @param {string} apiKey - 使用者的 Gemini API Key。
 * @param {string} targetLang - 目標語言的名稱 (例如 "繁體中文")。
 * @param {number} tabId - 當前分頁的 ID。
 */
async function translateWithGemini(text, apiKey, targetLang, tabId) {
  try {
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const prompt = `你是一個專業的翻譯引擎。請嚴格按照以下規則，將「」中的文字翻譯成${targetLang}。

規則：
1.  **絕對不要**有任何解釋、前言、或額外補充說明。
2.  如果原文是單一詞彙且有多種常見意思，請用「、」分隔後直接列出，例如：「令牌、象徵、代幣」。
3.  如果原文是句子或片語，請直接提供最通順、最自然的單一翻譯結果。
4.  **絕對不要**使用任何 Markdown 格式，例如 * 或 -。

原文：「${text}」`;

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 100,
          temperature: 0.1,
        }
      })
    });

    if (!response.ok) throw new Error(`API 錯誤: ${response.status}`);
    const data = await response.json();
    const translatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!translatedText) throw new Error("從 Gemini 未收到翻譯結果");

    browser.tabs.sendMessage(tabId, {
      type: "showTranslation",
      text: translatedText,
      engine: 'gemini'
    });
  } catch (err) {
    console.error("Gemini 翻譯發生錯誤", err);
    browser.tabs.sendMessage(tabId, {
      type: "showTranslation",
      text: "❌ Gemini 翻譯失敗，請檢查網路或 API Key。"
    });
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

  const { GEMINI_API_KEY, TRANSLATE_LANG } = await browser.storage.local.get([
    "GEMINI_API_KEY", "TRANSLATE_LANG"
  ]);
  const targetLang = TRANSLATE_LANG || "繁體中文";

  const wordCount = selectedText.split(/\s+/).length;
  const characterCount = selectedText.length;
  const isSimpleText = wordCount <= 3 && characterCount < 30;

  if (isSimpleText) {
    await translateWithGoogle(selectedText, targetLang, tab.id);
  } else {
    if (!GEMINI_API_KEY) {
      browser.tabs.sendMessage(tabId, {
        type: "showTranslation",
        text: "錯誤：翻譯句子需要 Gemini API Key，請先在設定頁輸入。"
      });
      return;
    }
    await translateWithGemini(selectedText, GEMINI_API_KEY, targetLang, tab.id);
  }
});
