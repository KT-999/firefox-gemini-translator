// background.js (模組)
import { i18n } from './options/i18n.js';
import { getSettings, saveSettings, addHistoryItem } from './modules/storage.js';
import { decideEngine, translateWithGoogle, translateWithGoogleCloud, translateWithGemini, resolveGeminiModelName } from './modules/translator.js';
import { LANG_NAME_TO_CODE_MAP, detectSourceLanguage, getDisplayLanguageName } from './modules/languages.js';
import { formatGeminiModelLabel } from './modules/ui.js';
import { playTTS } from './modules/tts.js';

async function sendMessageToTab(tabId, message) {
    try {
        return await browser.tabs.sendMessage(tabId, message);
    } catch (e) {
        console.warn(`無法將訊息傳送至分頁 ${tabId}。`, e.message);
        return null;
    }
}

async function handleTranslation(selectedText, tabId, engineOverride = null) {
    const settings = await getSettings();
    const targetLang = settings.TRANSLATE_LANG || '繁體中文';

    try {
        let translatedText = '';
        let engine = '';
        let modelName = null;

        const contextEngineSetting = settings.CONTEXT_MENU_ENGINE;

        if (engineOverride) {
            engine = engineOverride;
        } else if (contextEngineSetting === 'smart') {
            engine = decideEngine(selectedText);
            if (engine === 'gemini') {
                modelName = settings.GEMINI_MODEL;
            }
        } else if (contextEngineSetting === 'google') {
            engine = 'google';
        } else if (contextEngineSetting === 'google-cloud') {
            engine = 'google-cloud';
        } else {
            engine = 'gemini';
            modelName = contextEngineSetting;
        }

        if (engine === 'google-cloud' && !settings.GOOGLE_CLOUD_API_KEY) {
            console.log("右鍵選單設定為 Google Cloud 但未提供 API Key，自動降級使用 Google 翻譯。");
            engine = 'google';
        } else if (engine === 'gemini') {
            if (!modelName) {
                modelName = settings.GEMINI_MODEL;
            }
            modelName = resolveGeminiModelName(modelName);
            if (!settings.GEMINI_API_KEY) {
                console.log("右鍵選單設定為 Gemini 但未提供 API Key，自動降級使用 Google 翻譯。");
                engine = 'google';
                modelName = null;
            }
        }

        const uiStrings = {
            copyOriginal: i18n.t("copyOriginal"),
            copyTranslated: i18n.t("copyTranslated"),
            copied: i18n.t("copied"),
            listenOriginalButtonTooltip: i18n.t("listenOriginalButtonTooltip"),
            listenButtonTooltip: i18n.t("listenButtonTooltip"),
            sourceLanguageLabel: i18n.t("sourceLanguageLabel"),
            engineOptionGoogle: i18n.t("engineOptionGoogle"),
            engineOptionGoogleCloud: i18n.t("engineOptionGoogleCloud"),
            engineTagGemini: i18n.t("engineTagGemini"),
            modelTagFlash: i18n.t("modelTagFlash"),
            modelTagPro: i18n.t("modelTagPro")
        };

        const modelLabel = modelName ? formatGeminiModelLabel(modelName) : '';

        // 立即向網頁發送載入中卡片，提升長文與 Gemini 翻譯時的即時回饋感
        if (!engineOverride) {
            await sendMessageToTab(tabId, {
                type: "showLoadingCard",
                data: {
                    originalText: selectedText,
                    engine,
                    modelName,
                    modelLabel,
                    uiStrings
                }
            });
        }

        if (engine === 'google') {
            translatedText = await translateWithGoogle(selectedText, targetLang);
        } else if (engine === 'google-cloud') {
            translatedText = await translateWithGoogleCloud(selectedText, targetLang, settings.GOOGLE_CLOUD_API_KEY);
            await saveSettings({ googleCloudKeyValid: true });
        } else { // engine is 'gemini'
            translatedText = await translateWithGemini(selectedText, targetLang, settings.GEMINI_API_KEY, modelName, i18n.t);
            await saveSettings({ geminiKeyValid: true });
        }

        const sourceLang = await detectSourceLanguage(selectedText);
        await addHistoryItem(selectedText, translatedText, engine, targetLang, sourceLang, modelName);

        const sourceLangName = getDisplayLanguageName(sourceLang, settings.UI_LANG || 'zh_TW');

        const messageData = {
            originalText: selectedText,
            translatedText: translatedText.replace(/\n/g, '__NEWLINE__'),
            engine,
            modelName,
            modelLabel,
            sourceLangCode: sourceLang,
            sourceLangName,
            targetLangCode: LANG_NAME_TO_CODE_MAP[targetLang] || 'zh-TW',
            uiStrings
        };

        await sendMessageToTab(tabId, { type: "showTranslationCard", data: messageData });

    } catch (error) {
        console.error("右鍵選單翻譯失敗:", error);
        if (error.message === 'Invalid API Key') {
            await saveSettings({ geminiKeyValid: false });
            console.log("Gemini API Key 無效，自動降級使用 Google 翻譯。");
            await handleTranslation(selectedText, tabId, 'google');
        } else if (error.message === 'Invalid Google Cloud API Key') {
            await saveSettings({ googleCloudKeyValid: false });
            console.log("Google Cloud API Key 無效，自動降級使用 Google 翻譯。");
            await handleTranslation(selectedText, tabId, 'google');
        } else {
            await sendMessageToTab(tabId, { type: "showError", text: i18n.t("errorGoogle") });
        }
    }
}

async function handleContextMenuClick(info, tab) {
    if (info.menuItemId !== "smart-translate") return;
    const selectedText = info.selectionText?.trim();
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

    if (browser.commands && browser.commands.onCommand) {
        browser.commands.onCommand.addListener(async (command) => {
            if (command === 'translate-selection') {
                const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                const activeTab = tabs?.[0];
                if (!activeTab?.id) return;
                const response = await sendMessageToTab(activeTab.id, { type: 'getSelectedText' });
                const selectedText = response?.selectedText?.trim();
                if (selectedText) {
                    await handleTranslation(selectedText, activeTab.id);
                }
            }
        });
    }

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
