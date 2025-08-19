// background.js (模組)
import { i18n } from './options/i18n.js';
import { getSettings, saveSettings, addHistoryItem } from './modules/storage.js';
import { decideEngine, translateWithGoogle, translateWithGemini } from './modules/translator.js';

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

    if (engine === 'google') {
        translatedText = await translateWithGoogle(selectedText, targetLang);
    } else { // engine is 'gemini'
        if (!settings.GEMINI_API_KEY) {
            console.log("未設定 Gemini API Key，右鍵選單自動使用 Google 翻譯。");
            translatedText = await translateWithGoogle(selectedText, targetLang);
            engine = 'google'; // 將引擎更正為 google
        } else {
            translatedText = await translateWithGemini(selectedText, targetLang, settings.GEMINI_API_KEY, settings.GEMINI_MODEL, i18n.t);
            modelName = settings.GEMINI_MODEL; // 記錄使用的模型
            await saveSettings({ geminiKeyValid: true });
        }
    }
    
    // 【修改】統一在此處儲存紀錄，並傳入 modelName
    await addHistoryItem(selectedText, translatedText, engine, targetLang, modelName);

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
