// options/options.js
import { i18n } from './i18n.js';
import { getSettings, saveSettings, addHistoryItem, getHistory } from '../modules/storage.js';
import { translateWithGoogle, translateWithGemini, containsCjk } from '../modules/translator.js';
import { applyTheme, renderUI, displayApiKeyStatus, renderHistory, showStatus } from '../modules/ui.js';
import { playTTS } from '../modules/tts.js';

async function handlePopupTranslate(text, targetLang, engine, resultEl, sourceDisplayEl, sourceContainerEl, listenBtn, listenOriginalBtn) {
  sourceDisplayEl.textContent = '';
  sourceContainerEl.innerHTML = '';
  listenBtn.classList.add('hidden');
  listenOriginalBtn.classList.add('hidden');
  resultEl.innerHTML = '<div class="loading-spinner"></div>';

  let sourceLang = 'und';

  try {
    const settings = await getSettings();
    let translatedText = '';
    let modelName = null;
    let finalEngine = engine.startsWith('gemini') ? 'gemini' : 'google';

    const detectedLangInfo = await browser.i18n.detectLanguage(text);
    sourceLang = detectedLangInfo.languages?.[0]?.language || 'und';
    if (sourceLang === 'und') {
      if (/[\u0900-\u097F]/.test(text)) sourceLang = 'hi';
      else if (/[\u0600-\u06FF]/.test(text)) sourceLang = 'ar';
      else if (/[\u0980-\u09FF]/.test(text)) sourceLang = 'bn';
      else if (/[\uAC00-\uD7A3]/.test(text)) sourceLang = 'ko';
      else if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) sourceLang = 'ja';
      else if (containsCjk(text)) sourceLang = 'zh';
      else if (/[\u0400-\u04FF]/.test(text)) sourceLang = 'ru';
      else if (/[àâçéèêëîïôûùüÿæœ]/i.test(text)) sourceLang = 'fr';
      else if (/[äöüß]/i.test(text)) sourceLang = 'de';
      else if (/[áéíóúüñ]/i.test(text)) sourceLang = 'es';
      else if (/[ãõàáâéêíóôõúç]/i.test(text)) sourceLang = 'pt';
    }

    const uiLang = (settings.UI_LANG || 'zh_TW').replace('_', '-');
    const displayLang = new Intl.DisplayNames([uiLang], { type: 'language' });

    if (sourceLang !== 'und') {
      try {
        const sourceLangName = displayLang.of(sourceLang);
        sourceDisplayEl.textContent = `${i18n.t('sourceLanguageLabel')}${sourceLangName}`;
      } catch (e) {
        sourceDisplayEl.textContent = `${i18n.t('sourceLanguageLabel')}${sourceLang}`;
      }
    }

    if (finalEngine === 'google') {
      translatedText = await translateWithGoogle(text, targetLang);
      modelName = null;
    } else {
      if (!settings.GEMINI_API_KEY) {
        alert(i18n.t("apiKeyStatusUnset"));
        document.getElementById('tab-settings').click();
        document.getElementById('apiKey').focus();
        resultEl.textContent = '';
        return;
      }
      modelName = engine;
      translatedText = await translateWithGemini(text, targetLang, settings.GEMINI_API_KEY, modelName, i18n.t);
      await saveSettings({ geminiKeyValid: true });
    }

    // --- 顯示翻譯來源標籤 ---
    sourceContainerEl.innerHTML = ''; // 清空舊標籤
    if (finalEngine === 'gemini' && modelName) {
      const geminiTag = document.createElement('span');
      geminiTag.className = 'engine-tag engine-gemini';
      geminiTag.textContent = i18n.t('engineTagGemini');

      const modelTag = document.createElement('span');
      modelTag.className = 'engine-tag model-tag';
      if (modelName.includes('flash')) {
        modelTag.classList.add('model-flash');
        modelTag.textContent = i18n.t('modelTagFlash');
      } else {
        modelTag.classList.add('model-pro');
        modelTag.textContent = i18n.t('modelTagPro');
      }
      sourceContainerEl.appendChild(geminiTag);
      sourceContainerEl.appendChild(modelTag);
    } else {
      const googleTag = document.createElement('span');
      googleTag.className = 'engine-tag engine-google';
      googleTag.textContent = i18n.t('engineOptionGoogle');
      sourceContainerEl.appendChild(googleTag);
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

    await addHistoryItem(text, translatedText, finalEngine, targetLang, sourceLang, modelName);

  } catch (error) {
    console.error(`Popup ${error.message.includes('API') ? 'Gemini' : 'Google'} 翻譯失敗:`, error);
    if (error.message === 'Invalid API Key') {
      await saveSettings({ geminiKeyValid: false });
      // 自動降級改用 Google 翻譯
      const fallbackText = await translateWithGoogle(text, targetLang);
      resultEl.textContent = fallbackText;

      const googleTag = document.createElement('span');
      googleTag.className = 'engine-tag engine-google';
      googleTag.textContent = i18n.t('engineOptionGoogle');
      sourceContainerEl.appendChild(googleTag);

      await addHistoryItem(text, fallbackText, 'google', targetLang, sourceLang, null);
    } else {
      resultEl.textContent = error.message.includes('API') ? i18n.t("errorGemini") : i18n.t("errorGoogle");
    }
  }
}

async function main() {
  await i18n.init();
  renderUI();

  // 顯示版本號
  const manifest = browser.runtime.getManifest();
  const versionDisplay = document.getElementById('version-display');
  if (versionDisplay) {
    versionDisplay.textContent = `v${manifest.version}`;
  }

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
    popupEngineSelect: document.getElementById('popupEngine'),
    sourceLangDisplay: document.getElementById('sourceLangDisplay'),
    translationSourceContainer: document.getElementById('translation-source-container'),
    popupListenBtn: document.getElementById('popupListenBtn'),
    popupListenOriginalBtn: document.getElementById('popupListenOriginalBtn'),
    geminiModelSelect: document.getElementById('geminiModelSelect'),
    geminiModelContainer: document.getElementById('geminiModelContainer'),
    contextMenuEngineSelect: document.getElementById('contextMenuEngine')
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
  dom.apiKeyInput.value = settings.GEMINI_API_KEY;
  dom.langSelect.value = settings.TRANSLATE_LANG;
  dom.popupTargetLang.value = settings.TRANSLATE_LANG;
  dom.geminiModelSelect.value = settings.GEMINI_SMART_MODEL;
  dom.contextMenuEngineSelect.value = settings.CONTEXT_MENU_ENGINE;

  let initialUiLang = settings.UI_LANG;
  if (!initialUiLang) {
    const browserLang = browser.i18n.getUILanguage();
    const baseLang = browserLang.split('-')[0];
    if (browserLang === 'zh-CN') initialUiLang = 'zh_CN';
    else if (baseLang === 'zh') initialUiLang = 'zh_TW';
    else {
      const availableOptions = Array.from(dom.uiLangSelect.options).map(o => o.value);
      initialUiLang = availableOptions.includes(baseLang) ? baseLang : 'en';
    }
  }
  dom.uiLangSelect.value = initialUiLang;
  dom.themeSelect.value = settings.THEME;
  dom.maxHistoryInput.value = settings.maxHistorySize;

  applyTheme(dom.themeSelect.value);
  renderHistory(await getHistory());
  displayApiKeyStatus(settings.GEMINI_API_KEY, settings.geminiKeyValid);

  function toggleGeminiModelSelector() {
    const isSmartMode = dom.contextMenuEngineSelect.value === 'smart';
    dom.geminiModelContainer.style.display = isSmartMode ? '' : 'none';
  }
  toggleGeminiModelSelector();
  dom.contextMenuEngineSelect.addEventListener('change', toggleGeminiModelSelector);

  dom.translateBtn.addEventListener('click', () => {
    const text = dom.translateInput.value.trim();
    if (!text) return;
    handlePopupTranslate(
      text,
      dom.popupTargetLang.value,
      dom.popupEngineSelect.value,
      dom.translateResult,
      dom.sourceLangDisplay,
      dom.translationSourceContainer,
      dom.popupListenBtn,
      dom.popupListenOriginalBtn
    );
  });

  dom.uiLangSelect.addEventListener('change', async (e) => {
    await i18n.loadMessages(e.target.value);
    renderUI();
    // Re-render version after UI re-render
    const manifest = browser.runtime.getManifest();
    versionDisplay.textContent = `v${manifest.version}`;
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
      CONTEXT_MENU_ENGINE: dom.contextMenuEngineSelect.value,
      GEMINI_SMART_MODEL: dom.geminiModelSelect.value
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

