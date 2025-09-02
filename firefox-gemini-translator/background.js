// background.js (模組)
import { i18n } from './options/i18n.js';
import { getSettings, saveSettings, addHistoryItem } from './modules/storage.js';
import { decideEngine, translateWithGoogle, translateWithGemini, containsCjk } from './modules/translator.js';

async function sendMessageToTab(tabId, message) {
  try {
    await browser.tabs.sendMessage(tabId, message);
  } catch (e) {
    console.warn(`無法將訊息傳送至分頁 ${tabId}。`, e.message);
  }
}

async function handleContextMenuClick(info, tab) {
  if (info.menuItemId !== "smart-translate") return;
  const selectedText = info.selectionText.trim();
  if (!selectedText || !tab?.id) return;

  try {
    const settings = await getSettings();
    let engine = decideEngine(selectedText, settings.USE_GEMINI);
    const targetLang = settings.TRANSLATE_LANG || '繁體中文';
    let translatedText = '';
    let modelName = null;

    // 【修正】擴充後備語言偵測，新增印地文、阿拉伯文、孟加拉文、葡萄牙文等
    const detectedLangInfo = await browser.i18n.detectLanguage(selectedText);
    let sourceLang = detectedLangInfo.languages?.[0]?.language || 'und';
    if (sourceLang === 'und') {
        if (/[\u0900-\u097F]/.test(selectedText)) {
            sourceLang = 'hi'; // 印地文
        } else if (/[\u0600-\u06FF]/.test(selectedText)) {
            sourceLang = 'ar'; // 阿拉伯文
        } else if (/[\u0980-\u09FF]/.test(selectedText)) {
            sourceLang = 'bn'; // 孟加拉文
        } else if (/[\uAC00-\uD7A3]/.test(selectedText)) {
            sourceLang = 'ko'; // 韓文
        } else if (/[\u3040-\u309F\u30A0-\u30FF]/.test(selectedText)) {
            sourceLang = 'ja'; // 日文
        } else if (containsCjk(selectedText)) {
            sourceLang = 'zh'; // 中文
        } else if (/[\u0400-\u04FF]/.test(selectedText)) {
            sourceLang = 'ru'; // 俄文
        } else if (/[àâçéèêëîïôûùüÿæœ]/i.test(selectedText)) {
            sourceLang = 'fr'; // 法文
        } else if (/[äöüß]/i.test(selectedText)) {
            sourceLang = 'de'; // 德文
        } else if (/[áéíóúüñ]/i.test(selectedText)) {
            sourceLang = 'es'; // 西班牙文
        } else if (/[ãõàáâéêíóôõúç]/i.test(selectedText)) {
            sourceLang = 'pt'; // 葡萄牙文
        } else if (/^[a-z\u00C0-\u017F\s.,'’!-]+$/i.test(selectedText)) {
            sourceLang = 'en'; // 擴展拉丁字母 (預設為英文/印尼文等)
        }
    }

    if (engine === 'google') {
        translatedText = await translateWithGoogle(selectedText, targetLang);
    } else { // engine is 'gemini'
        if (!settings.GEMINI_API_KEY) {
            console.log("未設定 Gemini API Key，右鍵選單自動使用 Google 翻譯。");
            translatedText = await translateWithGoogle(selectedText, targetLang);
            engine = 'google'; // 將引擎更正為 google
        } else {
            translatedText = await translateWithGemini(selectedText, targetLang, settings.GEMINI_API_KEY, settings.GEMINI_MODEL, i18n.t);
            modelName = settings.GEMINI_MODEL;
            await saveSettings({ geminiKeyValid: true });
        }
    }
    
    await addHistoryItem(selectedText, translatedText, engine, targetLang, sourceLang, modelName);

    const uiStrings = {
        copy: i18n.t("popupCopy"),
        copied: i18n.t("popupCopied"),
        close: i18n.t("popupClose")
    };
    await sendMessageToTab(tab.id, { type: "showTranslation", text: translatedText.replace(/\n/g, '__NEWLINE__'), engine, ui: uiStrings });

  } catch (error) {
    console.error("右鍵選單翻譯失敗:", error);
    if (error.message === 'Invalid API Key') {
        await saveSettings({ geminiKeyValid: false });
        await handleContextMenuClick(info, tab);
    } else {
        await sendMessageToTab(tab.id, { type: "showTranslation", text: i18n.t("errorGoogle") });
    }
  }
}

async function initialize() {
    await i18n.init();
    browser.contextMenus.create({
        id: "smart-translate",
        title: i18n.t("contextMenuTitle"),
        contexts: ["selection"]
    });
    browser.contextMenus.onClicked.addListener(handleContextMenuClick);
    browser.runtime.onMessage.addListener(async (message) => {
        if (message.type === 'languageChanged') {
            await i18n.init();
            browser.contextMenus.update("smart-translate", {
                title: i18n.t("contextMenuTitle")
            });
        }
    });
}

initialize();

