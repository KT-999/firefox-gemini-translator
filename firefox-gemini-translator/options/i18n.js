/**
 * 專屬的 i18n 語言管理器
 * 解決 browser.i18n 無法由使用者設定動態切換語言的問題
 */
export const i18n = (() => {
  let messages = {};

  // 從 messages.json 檔案非同步載入翻譯
  async function loadMessages(lang) {
    try {
      // 根據 lang 決定檔案路徑
      const url = browser.runtime.getURL(`_locales/${lang}/messages.json`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`無法載入語言檔案: ${response.statusText}`);
      }
      messages = await response.json();
    } catch (error) {
      console.error(`載入 ${lang} 語言檔案失敗，將使用預設英文。`, error);
      // 如果載入失敗，嘗試載入英文作為備用
      if (lang !== 'en') {
        await loadMessages('en');
      }
    }
  }

  // 初始化管理器，決定要載入哪種語言
  async function init() {
    try {
      // 從儲存空間讀取使用者設定的語言
      const { UI_LANG } = await browser.storage.local.get('UI_LANG');
      let lang = UI_LANG;

      // 如果使用者從未設定過語言 (初次使用)，偵測瀏覽器語言
      if (!lang) {
        const browserLang = browser.i18n.getUILanguage(); // e.g., "zh-TW", "fr-CA"
        const supportedLangs = ['en', 'zh_TW', 'zh_CN', 'ja', 'ko', 'fr', 'de', 'es', 'ru', 'hi', 'ar', 'bn', 'pt', 'id'];
        const baseLang = browserLang.split('-')[0]; // e.g., "zh", "fr"

        if (browserLang === 'zh-CN') {
            lang = 'zh_CN';
        } else if (baseLang === 'zh') {
            lang = 'zh_TW';
        } else if (supportedLangs.includes(baseLang)) {
            lang = baseLang;
        } else {
            lang = 'en'; // 預設為英文
        }
      }
      
      await loadMessages(lang);
    } catch (e) {
      console.error("初始化 i18n 管理器失敗", e);
      await loadMessages('en'); // 發生任何錯誤都退回英文
    }
  }

  // 取得翻譯文字的主要函式，類似 browser.i18n.getMessage
  function t(key, substitutions = []) {
    // 針對 'uiLanguage' 這個 key 做硬編碼，永遠回傳固定的英文字串
    if (key === 'uiLanguage') {
      return 'UI Language:';
    }

    const messageData = messages[key];
    if (!messageData) {
      return key; // 找不到 key 就回傳 key 本身
    }

    let message = messageData.message;

    // 處理 placeholder，例如 ${text}
    if (messageData.placeholders) {
      Object.keys(messageData.placeholders).forEach((placeholder, index) => {
        const substitution = substitutions[index] || '';
        // 建立正則表達式來取代 ${placeholder}
        const regex = new RegExp(`\\$\\{${placeholder}\\}`, 'g');
        message = message.replace(regex, substitution);
      });
    }

    return message;
  }

  return {
    init,
    t,
  };
})();

