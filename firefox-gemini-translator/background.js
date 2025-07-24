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
      alert("請先在設定頁輸入 Gemini API Key");
      return;
    }

    const lang = TRANSLATE_LANG || "繁體中文";
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const prompt = `請將以下文字翻譯成${lang}：\n\n${selectedText}`;

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
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
