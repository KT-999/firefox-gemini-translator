browser.contextMenus.create({
  id: "translate-with-gemini",
  title: "使用 Gemini 翻譯",
  contexts: ["selection"]
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "translate-with-gemini") return;

  const selectedText = info.selectionText;
  if (!selectedText) return;

  try {
    const { GEMINI_API_KEY, TRANSLATE_LANG } = await browser.storage.local.get([
      "GEMINI_API_KEY", "TRANSLATE_LANG"
    ]);

    if (!GEMINI_API_KEY) {
      // 在 content script 中顯示提示，而非使用 alert
      browser.tabs.sendMessage(tab.id, {
        type: "showTranslation",
        text: "錯誤：請先在附加元件的設定頁面輸入您的 Gemini API Key。"
      });
      return;
    }

    const lang = TRANSLATE_LANG || "繁體中文";
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    // --- 全新的、更精確的提示詞 ---
    const prompt = `你是一個專業的翻譯引擎。請嚴格按照以下規則，將「」中的文字翻譯成${lang}。

規則：
1.  **絕對不要**有任何解釋、前言、或額外補充說明。
2.  如果原文是單一詞彙且有多種常見意思，請用「、」分隔後直接列出，例如：「令牌、象徵、代幣」。
3.  如果原文是句子或片語，請直接提供最通順、最自然的單一翻譯結果。
4.  **絕對不要**使用任何 Markdown 格式，例如 * 或 -。

原文：「${selectedText}」`;

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // 增加 generationConfig 來限制模型輸出
        generationConfig: {
          maxOutputTokens: 100,
          temperature: 0.1,
        }
      })
    });

    if (!response.ok) throw new Error(`API 錯誤: ${response.status}`);
    const data = await response.json();

    const translatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!translatedText) throw new Error("沒有收到翻譯結果");

    browser.tabs.sendMessage(tab.id, {
      type: "showTranslation",
      text: translatedText
    });

  } catch (err) {
    console.error("翻譯發生錯誤", err);
    browser.tabs.sendMessage(tab.id, {
      type: "showTranslation",
      text: "❌ 翻譯失敗，請檢查網路或 API Key。"
    });
  }
});
