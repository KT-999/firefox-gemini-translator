// options/options.js
import { i18n } from './i18n.js';
import { getSettings, saveSettings, addHistoryItem, getHistory } from '../modules/storage.js';
import { decideEngine, translateWithGoogle, translateWithGemini, containsCjk } from '../modules/translator.js';
import { applyTheme, renderUI, displayApiKeyStatus, renderHistory, showStatus } from '../modules/ui.js';
import { playTTS } from '../modules/tts.js';

async function handlePopupTranslate(text, targetLang, resultEl, listenBtn, listenOriginalBtn) {
    listenBtn.classList.add('hidden');
    listenOriginalBtn.classList.add('hidden');
    resultEl.innerHTML = '<div class="loading-spinner"></div>';
    const sourceLangEl = document.getElementById('sourceLangDisplay');
    sourceLangEl.textContent = '';

    let sourceLang = 'und';

    try {
        const settings = await getSettings();
        const engine = decideEngine(text, settings.USE_GEMINI);
        let translatedText = '';
        let modelName = null;

        // 【修正】擴充後備語言偵測，新增印地文、阿拉伯文、孟加拉文、葡萄牙文等
        const detectedLangInfo = await browser.i18n.detectLanguage(text);
        sourceLang = detectedLangInfo.languages?.[0]?.language || 'und';
        if (sourceLang === 'und') {
            if (/[\u0900-\u097F]/.test(text)) {
                sourceLang = 'hi'; // 印地文
            } else if (/[\u0600-\u06FF]/.test(text)) {
                sourceLang = 'ar'; // 阿拉伯文
            } else if (/[\u0980-\u09FF]/.test(text)) {
                sourceLang = 'bn'; // 孟加拉文
            } else if (/[\uAC00-\uD7A3]/.test(text)) {
                sourceLang = 'ko'; // 韓文
            } else if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
                sourceLang = 'ja'; // 日文
            } else if (containsCjk(text)) {
                sourceLang = 'zh'; // 中文
            } else if (/[\u0400-\u04FF]/.test(text)) {
                sourceLang = 'ru'; // 俄文
            } else if (/[àâçéèêëîïôûùüÿæœ]/i.test(text)) {
                sourceLang = 'fr'; // 法文
            } else if (/[äöüß]/i.test(text)) {
                sourceLang = 'de'; // 德文
            } else if (/[áéíóúüñ]/i.test(text)) {
                sourceLang = 'es'; // 西班牙文
            } else if (/[ãõàáâéêíóôõúç]/i.test(text)) {
                sourceLang = 'pt'; // 葡萄牙文
            } else if (/^[a-z\u00C0-\u017F\s.,'’!-]+$/i.test(text)) {
                sourceLang = 'en'; // 擴展拉丁字母 (預設為英文/印尼文等)
            }
        }
        
        const uiLang = (settings.UI_LANG || 'zh_TW').replace('_', '-');
        const displayLang = new Intl.DisplayNames([uiLang], { type: 'language' });
        
        if (sourceLang !== 'und') {
            try {
                const sourceLangName = displayLang.of(sourceLang);
                sourceLangEl.textContent = `${i18n.t('sourceLanguageLabel')}${sourceLangName}`;
            } catch (e) {
                sourceLangEl.textContent = `${i18n.t('sourceLanguageLabel')}${sourceLang}`;
            }
        } else {
             sourceLangEl.textContent = '';
        }

        if (engine === 'google') {
            translatedText = await translateWithGoogle(text, targetLang);
        } else {
            if (!settings.GEMINI_API_KEY) {
                alert(i18n.t("apiKeyStatusUnset"));
                document.getElementById('tab-settings').click();
                document.getElementById('apiKey').focus();
                resultEl.textContent = '';
                return;
            }
            translatedText = await translateWithGemini(text, targetLang, settings.GEMINI_API_KEY, settings.GEMINI_MODEL, i18n.t);
            modelName = settings.GEMINI_MODEL;
            await saveSettings({ geminiKeyValid: true });
        }
        
        resultEl.textContent = translatedText;

        const langNameToCodeMap = { "繁體中文": "zh-TW", "簡體中文": "zh-CN", "英文": "en", "日文": "ja", "韓文": "ko", "法文": "fr", "德文": "de", "西班牙文": "es", "俄文": "ru", "印地文": "hi", "阿拉伯文": "ar", "孟加拉文": "bn", "葡萄牙文": "pt", "印尼文": "id" };
        const targetLangCode = langNameToCodeMap[targetLang];
        
        listenBtn.classList.remove('hidden');
        listenBtn.onclick = () => playTTS(translatedText, targetLangCode);

        if (sourceLang !== 'und') {
            listenOriginalBtn.classList.remove('hidden');
            listenOriginalBtn.onclick = () => playTTS(text, sourceLang);
        }
        
        await addHistoryItem(text, translatedText, engine, targetLang, sourceLang, modelName);

    } catch (error) {
        console.error(`Popup ${error.message.includes('API') ? 'Gemini' : 'Google'} 翻譯失敗:`, error);
        if (error.message === 'Invalid API Key') {
            await saveSettings({ geminiKeyValid: false });
        }
        resultEl.textContent = error.message.includes('API') ? i18n.t("errorGemini") : i18n.t("errorGoogle");
    }
}

async function main() {
  await i18n.init();
  renderUI();

  const dom = {
    tabs: {
        translate: { btn: document.getElementById('tab-translate'), view: document.getElementById('view-translate') },
        settings: { btn: document.getElementById('tab-settings'), view: document.getElementById('view-settings') },
        history: { btn: document.getElementById('tab-history'), view: document.getElementById('view-history') },
    },
    apiKeyInput: document.getElementById("apiKey"),
    toggleApiKeyBtn: document.getElementById("toggleApiKey"),
    langSelect: document.getElementById("lang"),
    uiLangSelect: document.getElementById("uiLang"),
    themeSelect: document.getElementById("theme"),
    maxHistoryInput: document.getElementById("maxHistorySize"),
    saveBtn: document.getElementById("saveBtn"),
    clearHistoryBtn: document.getElementById("clearHistoryBtn"),
    status: document.getElementById("status"),
    translateInput: document.getElementById('translateInput'),
    translateBtn: document.getElementById('translateBtn'),
    translateResult: document.getElementById('translateResult'),
    popupTargetLang: document.getElementById('popupTargetLang'),
    useGeminiSwitch: document.getElementById('useGeminiSwitch'),
    popupListenBtn: document.getElementById('popupListenBtn'),
    popupListenOriginalBtn: document.getElementById('popupListenOriginalBtn'),
    geminiModelSelect: document.getElementById('geminiModelSelect'),
    geminiModelContainer: document.getElementById('geminiModelContainer')
  };

  function switchTab(activeKey) {
    Object.keys(dom.tabs).forEach(key => {
        const isActive = key === activeKey;
        dom.tabs[key].btn.classList.toggle('active', isActive);
        dom.tabs[key].view.classList.toggle('active', isActive);
    });
  }
  Object.keys(dom.tabs).forEach(key => {
    dom.tabs[key].btn.addEventListener('click', () => switchTab(key));
  });

  const settings = await getSettings();
  const defaultTargetLang = i18n.t("langZhTw");
  dom.apiKeyInput.value = settings.GEMINI_API_KEY;
  dom.langSelect.value = settings.TRANSLATE_LANG || defaultTargetLang;
  dom.popupTargetLang.value = settings.TRANSLATE_LANG || defaultTargetLang;
  dom.useGeminiSwitch.checked = settings.USE_GEMINI;
  dom.geminiModelSelect.value = settings.GEMINI_MODEL;
  
  let initialUiLang = settings.UI_LANG;
  if (!initialUiLang) {
    const browserLang = browser.i18n.getUILanguage();
    const baseLang = browserLang.split('-')[0];
    if (browserLang === 'zh-CN') initialUiLang = 'zh_CN';
    else if (baseLang === 'zh') initialUiLang = 'zh_TW';
    else {
      const availableOptions = Array.from(dom.uiLangSelect.options).map(o => o.value);
      if (availableOptions.includes(baseLang)) initialUiLang = baseLang;
      else initialUiLang = 'en';
    }
  }
  dom.uiLangSelect.value = initialUiLang;
  dom.themeSelect.value = settings.THEME;
  dom.maxHistoryInput.value = settings.maxHistorySize;

  applyTheme(dom.themeSelect.value);
  renderHistory(await getHistory());
  displayApiKeyStatus(settings.GEMINI_API_KEY, settings.geminiKeyValid);

  function toggleModelSelectorVisibility() {
      dom.geminiModelContainer.style.display = dom.useGeminiSwitch.checked ? '' : 'none';
  }
  toggleModelSelectorVisibility();
  dom.useGeminiSwitch.addEventListener('change', toggleModelSelectorVisibility);

  dom.translateBtn.addEventListener('click', () => {
    const text = dom.translateInput.value.trim();
    if (!text) return;
    handlePopupTranslate(text, dom.popupTargetLang.value, dom.translateResult, dom.popupListenBtn, dom.popupListenOriginalBtn);
  });

  dom.uiLangSelect.addEventListener('change', async (e) => {
      await i18n.loadMessages(e.target.value);
      renderUI();
      renderHistory(await getHistory());
      const currentSettings = await getSettings();
      displayApiKeyStatus(currentSettings.GEMINI_API_KEY, currentSettings.geminiKeyValid);
  });

  dom.themeSelect.addEventListener('change', () => applyTheme(dom.themeSelect.value));
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (dom.themeSelect.value === 'auto') applyTheme('auto');
  });

  dom.toggleApiKeyBtn.addEventListener('click', () => {
    const isPassword = dom.apiKeyInput.type === 'password';
    dom.apiKeyInput.type = isPassword ? 'text' : 'password';
    dom.toggleApiKeyBtn.querySelector('.icon-eye').classList.toggle('hidden', isPassword);
    dom.toggleApiKeyBtn.querySelector('.icon-eye-off').classList.toggle('hidden', !isPassword);
  });

  dom.saveBtn.addEventListener('click', async () => {
    const settingsToSave = {
      GEMINI_API_KEY: dom.apiKeyInput.value.trim(),
      TRANSLATE_LANG: dom.langSelect.value,
      UI_LANG: dom.uiLangSelect.value,
      THEME: dom.themeSelect.value,
      maxHistorySize: parseInt(dom.maxHistoryInput.value, 10) || 20,
      geminiKeyValid: !!dom.apiKeyInput.value.trim(),
      USE_GEMINI: dom.useGeminiSwitch.checked,
      GEMINI_MODEL: dom.geminiModelSelect.value
    };
    await saveSettings(settingsToSave);
    browser.runtime.sendMessage({ type: 'languageChanged' });
    showStatus("statusSaved", dom.status);
    displayApiKeyStatus(settingsToSave.GEMINI_API_KEY, settingsToSave.geminiKeyValid);
  });

  dom.clearHistoryBtn.addEventListener('click', async () => {
    if (confirm(i18n.t("confirmClearAllHistory"))) {
      await saveSettings({ translationHistory: [] });
      showStatus("statusCleared", dom.status);
    }
  });
  
  browser.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local' && changes.translationHistory) {
      renderHistory(changes.translationHistory.newValue);
    }
  });
}

document.addEventListener("DOMContentLoaded", main);

