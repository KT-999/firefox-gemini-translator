// options/options.js
import { i18n } from './i18n.js';
import { getSettings, saveSettings, addHistoryItem, getHistory } from '../modules/storage.js';
import { decideEngine, translateWithGoogle, translateWithGemini } from '../modules/translator.js';
import { applyTheme, renderUI, displayApiKeyStatus, renderHistory, showStatus } from '../modules/ui.js';
import { playTTS } from '../modules/tts.js';

async function handlePopupTranslate(text, targetLang, resultEl, listenBtn) {
    listenBtn.classList.add('hidden');
    resultEl.innerHTML = '<div class="loading-spinner"></div>';

    try {
        const settings = await getSettings();
        const engine = decideEngine(text, settings.USE_GEMINI);
        let translatedText = '';

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
            // 【修改】傳入模型名稱
            translatedText = await translateWithGemini(text, targetLang, settings.GEMINI_API_KEY, settings.GEMINI_MODEL, i18n.t);
            await saveSettings({ geminiKeyValid: true });
        }
        
        resultEl.textContent = translatedText;
        listenBtn.classList.remove('hidden');
        listenBtn.onclick = () => playTTS(translatedText, targetLang);
        await addHistoryItem(text, translatedText, engine, targetLang);

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
    geminiModelSelect: document.getElementById('geminiModelSelect'), // 【新增】
    geminiModelContainer: document.getElementById('geminiModelContainer') // 【新增】
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
  dom.geminiModelSelect.value = settings.GEMINI_MODEL; // 【新增】
  
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

  // 【新增】根據 Gemini 開關狀態，顯示或隱藏模型選擇器
  function toggleModelSelectorVisibility() {
      dom.geminiModelContainer.style.display = dom.useGeminiSwitch.checked ? '' : 'none';
  }
  toggleModelSelectorVisibility(); // 初始化
  dom.useGeminiSwitch.addEventListener('change', toggleModelSelectorVisibility);

  dom.translateBtn.addEventListener('click', () => {
    const text = dom.translateInput.value.trim();
    if (!text) return;
    handlePopupTranslate(text, dom.popupTargetLang.value, dom.translateResult, dom.popupListenBtn);
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
      GEMINI_MODEL: dom.geminiModelSelect.value // 【新增】
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
