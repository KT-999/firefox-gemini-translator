// background.js (模組)
import { i18n } from './options/i18n.js';
import { getSettings, saveSettings, addHistoryItem } from './modules/storage.js';
import { decideEngine, translateWithGoogle, translateWithGemini, containsCjk } from './modules/translator.js';
import { playTTS } from './modules/tts.js';

async function sendMessageToTab(tabId, message) {
    try {
        await browser.tabs.sendMessage(tabId, message);
    } catch (e) {
        console.warn(`無法將訊息傳送至分頁 ${tabId}。`, e.message);
    }
}

async function handleTranslation(selectedText, tabId) {
    const settings = await getSettings();
    const targetLang = settings.TRANSLATE_LANG || '繁體中文';

    try {
        let translatedText = '';
        let engine = '';
        let modelName = null;

        const contextEngineSetting = settings.CONTEXT_MENU_ENGINE;

        if (contextEngineSetting === 'smart') {
            engine = decideEngine(selectedText);
            if (engine === 'gemini') {
                modelName = settings.GEMINI_MODEL;
            }
        } else if (contextEngineSetting === 'google') {
            engine = 'google';
        } else {
            engine = 'gemini';
            modelName = contextEngineSetting;
        }

        if (engine === 'google') {
            translatedText = await translateWithGoogle(selectedText, targetLang);
        } else { // engine is 'gemini'
            if (!settings.GEMINI_API_KEY) {
                console.log("右鍵選單設定為 Gemini 但未提供 API Key，自動降級使用 Google 翻譯。");
                engine = 'google';
                modelName = null;
                translatedText = await translateWithGoogle(selectedText, targetLang);
            } else {
                translatedText = await translateWithGemini(selectedText, targetLang, settings.GEMINI_API_KEY, modelName, i18n.t);
                await saveSettings({ geminiKeyValid: true });
            }
        }

        const detectedLangInfo = await browser.i18n.detectLanguage(selectedText);
        let sourceLang = detectedLangInfo.languages?.[0]?.language || 'und';
        if (sourceLang === 'und') {
            if (/[\u0900-\u097F]/.test(selectedText)) sourceLang = 'hi';
            else if (/[\u0600-\u06FF]/.test(selectedText)) sourceLang = 'ar';
            else if (/[\u0980-\u09FF]/.test(selectedText)) sourceLang = 'bn';
            else if (/[\uAC00-\uD7A3]/.test(selectedText)) sourceLang = 'ko';
            else if (/[\u3040-\u309F\u30A0-\u30FF]/.test(selectedText)) sourceLang = 'ja';
            else if (containsCjk(selectedText)) sourceLang = 'zh';
            else if (/[\u0400-\u04FF]/.test(selectedText)) sourceLang = 'ru';
            else if (/[àâçéèêëîïôûùüÿæœ]/i.test(selectedText)) sourceLang = 'fr';
            else if (/[äöüß]/i.test(selectedText)) sourceLang = 'de';
            else if (/[áéíóúüñ]/i.test(selectedText)) sourceLang = 'es';
            else if (/[ãõàáâéêíóôõúç]/i.test(selectedText)) sourceLang = 'pt';
            else if (/^[a-z\u00C0-\u017F\s.,'’!-]+$/i.test(selectedText)) sourceLang = 'en';
        }

        await addHistoryItem(selectedText, translatedText, engine, targetLang, sourceLang, modelName);

        const uiLang = (settings.UI_LANG || 'zh_TW').replace('_', '-');
        const displayLang = new Intl.DisplayNames([uiLang], { type: 'language' });
        let sourceLangName = '';
        if (sourceLang !== 'und') {
            try {
                sourceLangName = displayLang.of(sourceLang);
            } catch (e) {
                sourceLangName = sourceLang;
            }
        }

        const langNameToCodeMap = { "繁體中文": "zh-TW", "簡體中文": "zh-CN", "英文": "en", "日文": "ja", "韓文": "ko", "法文": "fr", "德文": "de", "西班牙文": "es", "俄文": "ru", "印地文": "hi", "阿拉伯文": "ar", "孟加拉文": "bn", "葡萄牙文": "pt", "印尼文": "id" };

        const messageData = {
            originalText: selectedText,
            translatedText: translatedText.replace(/\n/g, '__NEWLINE__'),
            engine,
            modelName,
            sourceLangCode: sourceLang,
            sourceLangName,
            targetLangCode: langNameToCodeMap[targetLang] || 'zh-TW',
            uiStrings: {
                copyOriginal: i18n.t("copyOriginal"),
                copyTranslated: i18n.t("copyTranslated"),
                copied: i18n.t("copied"),
                listenOriginalButtonTooltip: i18n.t("listenOriginalButtonTooltip"),
                listenButtonTooltip: i18n.t("listenButtonTooltip"),
                sourceLanguageLabel: i18n.t("sourceLanguageLabel"),
                engineOptionGoogle: i18n.t("engineOptionGoogle"),
                engineTagGemini: i18n.t("engineTagGemini"),
                modelTagFlash: i18n.t("modelTagFlash"),
                modelTagPro: i18n.t("modelTagPro")
            }
        };

        await sendMessageToTab(tabId, { type: "showTranslationCard", data: messageData });

    } catch (error) {
        console.error("右鍵選單翻譯失敗:", error);
        if (error.message === 'Invalid API Key') {
            await saveSettings({ geminiKeyValid: false });
            console.log("Gemini API Key 無效，自動降級使用 Google 翻譯。");
            // Retry with google by calling the function again but forcing google
            await handleTranslation(selectedText, tabId);
        } else {
            await sendMessageToTab(tabId, { type: "showError", text: i18n.t("errorGoogle") });
        }
    }
}


async function handleContextMenuClick(info, tab) {
    if (info.menuItemId !== "smart-translate") return;
    const selectedText = info.selectionText.trim();
    if (!selectedText || !tab?.id) return;
    await handleTranslation(selectedText, tab.id);
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
        } else if (message.type === 'playTTS') {
            playTTS(message.text, message.langCode);
        }
    });
}

initialize();

