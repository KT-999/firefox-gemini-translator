// options/options.js
import { i18n } from './i18n.js';
import { getSettings, saveSettings, addHistoryItem, getHistory } from '../modules/storage.js';
import { translateWithGoogle, translateWithGoogleCloud, translateWithGemini, resolveGeminiModelName } from '../modules/translator.js';
import { LANG_NAME_TO_CODE_MAP, detectSourceLanguage, getDisplayLanguageName } from '../modules/languages.js';
import { applyTheme, renderUI, displayApiKeyStatus, displayGoogleCloudApiKeyStatus, renderHistory, showStatus, formatGeminiModelLabel } from '../modules/ui.js';
import { playTTS } from '../modules/tts.js';

async function handlePopupTranslate(text, targetLang, engineSelection, resultEl, listenBtn, listenOriginalBtn, copyResultBtn) {
  listenBtn.classList.add('hidden');
  listenOriginalBtn.classList.add('hidden');
  if (copyResultBtn) copyResultBtn.classList.add('hidden');
  resultEl.innerHTML = '<div class="loading-spinner"></div>';
  const sourceLangEl = document.getElementById('sourceLangDisplay');
  const sourceDisplayEl = document.getElementById('translationSourceDisplay');
  sourceLangEl.textContent = '';
  sourceDisplayEl.textContent = '';
  sourceDisplayEl.className = 'translation-source-display'; // Reset classes

  let sourceLang = 'und';

  try {
    const settings = await getSettings();
    let translatedText = '';
    let engine = 'google';
    let modelName = null;

    if (engineSelection === 'google') {
      engine = 'google';
      translatedText = await translateWithGoogle(text, targetLang);
    } else if (engineSelection === 'google-cloud') {
      engine = 'google-cloud';
      if (!settings.GOOGLE_CLOUD_API_KEY) {
        alert(i18n.t("apiKeyStatusUnset"));
        document.getElementById('tab-settings').click();
        document.getElementById('googleCloudApiKey').focus();
        resultEl.textContent = '';
        sourceDisplayEl.textContent = '';
        return;
      }
      translatedText = await translateWithGoogleCloud(text, targetLang, settings.GOOGLE_CLOUD_API_KEY);
      await saveSettings({ googleCloudKeyValid: true });
    } else { // A Gemini model is selected
      engine = 'gemini';
      modelName = resolveGeminiModelName(engineSelection);
      if (!settings.GEMINI_API_KEY) {
        alert(i18n.t("apiKeyStatusUnset"));
        document.getElementById('tab-settings').click();
        document.getElementById('apiKey').focus();
        resultEl.textContent = '';
        sourceDisplayEl.textContent = '';
        return;
      }
      translatedText = await translateWithGemini(text, targetLang, settings.GEMINI_API_KEY, modelName, i18n.t);
      await saveSettings({ geminiKeyValid: true });
    }

    sourceLang = await detectSourceLanguage(text);
    const sourceLangName = getDisplayLanguageName(sourceLang, settings.UI_LANG || 'zh_TW');
    sourceLangEl.textContent = sourceLangName ? `${i18n.t('sourceLanguageLabel')}${sourceLangName}` : '';

    resultEl.textContent = translatedText;

    let sourceText = '';
    if (engine === 'google') {
      sourceText = i18n.t("engineOptionGoogle");
      sourceDisplayEl.classList.add('engine-google');
    } else if (engine === 'google-cloud') {
      sourceText = i18n.t("engineOptionGoogleCloud");
      sourceDisplayEl.classList.add('engine-google-cloud');
    } else {
      sourceText = `${i18n.t("engineTagGemini")} ${formatGeminiModelLabel(modelName)}`.trim();
      if (modelName.includes('flash')) {
        sourceDisplayEl.classList.add('model-flash');
      } else if (modelName.includes('pro')) {
        sourceDisplayEl.classList.add('model-pro');
      }
    }
    sourceDisplayEl.textContent = sourceText;

    const targetLangCode = LANG_NAME_TO_CODE_MAP[targetLang] || 'zh-TW';

    listenBtn.classList.remove('hidden');
    listenBtn.onclick = () => playTTS(translatedText, targetLangCode);

    if (sourceLang !== 'und') {
      listenOriginalBtn.classList.remove('hidden');
      listenOriginalBtn.onclick = () => playTTS(text, sourceLang);
    }

    if (copyResultBtn) {
      copyResultBtn.classList.remove('hidden');
      copyResultBtn.onclick = () => {
        navigator.clipboard.writeText(translatedText).then(() => {
          showStatus("copied", document.getElementById("status"));
        });
      };
    }

    await addHistoryItem(text, translatedText, engine, targetLang, sourceLang, modelName);

  } catch (error) {
    console.error(`Popup ${error.message.includes('API') ? 'Gemini' : 'Google'} 翻譯失敗:`, error);
    if (error.message === 'Invalid API Key') {
      await saveSettings({ geminiKeyValid: false });
      console.log("Popup Gemini API Key 無效，自動降級使用 Google 翻譯。");
      await handlePopupTranslate(text, targetLang, 'google', resultEl, listenBtn, listenOriginalBtn, copyResultBtn);
    } else if (error.message === 'Invalid Google Cloud API Key') {
      await saveSettings({ googleCloudKeyValid: false });
      console.log("Popup Google Cloud API Key 無效，自動降級使用 Google 翻譯。");
      await handlePopupTranslate(text, targetLang, 'google', resultEl, listenBtn, listenOriginalBtn, copyResultBtn);
    } else {
      const isGeminiEngine = !['google', 'google-cloud'].includes(engineSelection);
      resultEl.textContent = isGeminiEngine ? i18n.t("errorGemini") : i18n.t("errorGoogle");
      sourceDisplayEl.textContent = 'Error';
    }
  }
}

function toggleGeminiModelSelector() {
  const contextMenuEngine = document.getElementById('contextMenuEngineSelect').value;
  const geminiModelContainer = document.getElementById('geminiModelContainer');
  geminiModelContainer.style.display = contextMenuEngine === 'smart' ? '' : 'none';
}

async function main() {
  await i18n.init();
  renderUI();

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
    removeApiKeyBtn: document.getElementById("removeApiKey"),
    googleCloudApiKeyInput: document.getElementById("googleCloudApiKey"),
    toggleGoogleCloudApiKeyBtn: document.getElementById("toggleGoogleCloudApiKey"),
    removeGoogleCloudApiKeyBtn: document.getElementById("removeGoogleCloudApiKey"),
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
    popupEngineSelect: document.getElementById('popupEngineSelect'),
    popupListenBtn: document.getElementById('popupListenBtn'),
    popupListenOriginalBtn: document.getElementById('popupListenOriginalBtn'),
    popupCopyResultBtn: document.getElementById('popupCopyResultBtn'),
    geminiModelSelect: document.getElementById('geminiModelSelect'),
    contextMenuEngineSelect: document.getElementById('contextMenuEngineSelect')
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
  const defaultTargetLang = settings.TRANSLATE_LANG || '繁體中文';
  const defaultPopupEngine = 'google';

  const normalizeSelectValue = (select, value, fallback) => {
    const hasValue = Array.from(select.options).some(option => option.value === value);
    return hasValue ? value : fallback;
  };
  dom.apiKeyInput.value = settings.GEMINI_API_KEY;
  dom.googleCloudApiKeyInput.value = settings.GOOGLE_CLOUD_API_KEY;
  dom.langSelect.value = settings.TRANSLATE_LANG || defaultTargetLang;
  dom.popupTargetLang.value = normalizeSelectValue(
    dom.popupTargetLang,
    settings.POPUP_TRANSLATE_LANG || settings.TRANSLATE_LANG,
    defaultTargetLang
  );
  const migrateModelValue = (val) => {
    if (val === 'gemini-3-pro-preview') return 'gemini-3.1-pro-preview';
    if (val === 'gemini-3.1-flash-lite-preview') return 'gemini-3.1-flash-lite';
    return val;
  };
  dom.popupEngineSelect.value = normalizeSelectValue(
    dom.popupEngineSelect,
    migrateModelValue(settings.POPUP_TRANSLATE_ENGINE),
    defaultPopupEngine
  );
  const normalizedGeminiModel = normalizeSelectValue(dom.geminiModelSelect, migrateModelValue(settings.GEMINI_MODEL), 'gemini-3.8-flash');
  const normalizedContextMenuEngine = normalizeSelectValue(dom.contextMenuEngineSelect, migrateModelValue(settings.CONTEXT_MENU_ENGINE), 'smart');
  dom.geminiModelSelect.value = normalizedGeminiModel;
  dom.contextMenuEngineSelect.value = normalizedContextMenuEngine;
  if (normalizedGeminiModel !== settings.GEMINI_MODEL || normalizedContextMenuEngine !== settings.CONTEXT_MENU_ENGINE) {
    await saveSettings({
      GEMINI_MODEL: normalizedGeminiModel,
      CONTEXT_MENU_ENGINE: normalizedContextMenuEngine
    });
  }

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
  displayGoogleCloudApiKeyStatus(settings.GOOGLE_CLOUD_API_KEY, settings.googleCloudKeyValid);
  toggleGeminiModelSelector();

  dom.contextMenuEngineSelect.addEventListener('change', toggleGeminiModelSelector);

  const savePopupSelection = async () => {
    await saveSettings({
      POPUP_TRANSLATE_LANG: dom.popupTargetLang.value,
      POPUP_TRANSLATE_ENGINE: dom.popupEngineSelect.value
    });
  };

  const triggerPopupTranslate = async () => {
    const text = dom.translateInput.value.trim();
    if (!text) return;
    await savePopupSelection();
    handlePopupTranslate(text, dom.popupTargetLang.value, dom.popupEngineSelect.value, dom.translateResult, dom.popupListenBtn, dom.popupListenOriginalBtn, dom.popupCopyResultBtn);
  };

  dom.translateBtn.addEventListener('click', triggerPopupTranslate);
  dom.translateInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      triggerPopupTranslate();
    }
  });

  dom.popupTargetLang.addEventListener('change', savePopupSelection);
  dom.popupEngineSelect.addEventListener('change', savePopupSelection);

  dom.uiLangSelect.addEventListener('change', async (e) => {
    await i18n.init({ langOverride: e.target.value });
    renderUI();
    renderHistory(await getHistory());
    const currentSettings = await getSettings();
    displayApiKeyStatus(currentSettings.GEMINI_API_KEY, currentSettings.geminiKeyValid);
    displayGoogleCloudApiKeyStatus(currentSettings.GOOGLE_CLOUD_API_KEY, currentSettings.googleCloudKeyValid);
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
  dom.toggleGoogleCloudApiKeyBtn.addEventListener('click', () => {
    const isPassword = dom.googleCloudApiKeyInput.type === 'password';
    dom.googleCloudApiKeyInput.type = isPassword ? 'text' : 'password';
    dom.toggleGoogleCloudApiKeyBtn.querySelector('.icon-eye').classList.toggle('hidden', isPassword);
    dom.toggleGoogleCloudApiKeyBtn.querySelector('.icon-eye-off').classList.toggle('hidden', !isPassword);
  });

  if (dom.removeApiKeyBtn) {
    dom.removeApiKeyBtn.addEventListener('click', async () => {
      dom.apiKeyInput.value = '';
      await saveSettings({ GEMINI_API_KEY: '', geminiKeyValid: false });
      displayApiKeyStatus('', false);
    });
  }

  dom.removeGoogleCloudApiKeyBtn.addEventListener('click', async () => {
    dom.googleCloudApiKeyInput.value = '';
    await saveSettings({ GOOGLE_CLOUD_API_KEY: '', googleCloudKeyValid: false });
    displayGoogleCloudApiKeyStatus('', false);
  });

  dom.saveBtn.addEventListener('click', async () => {
    const settingsToSave = {
      GEMINI_API_KEY: dom.apiKeyInput.value.trim(),
      GOOGLE_CLOUD_API_KEY: dom.googleCloudApiKeyInput.value.trim(),
      TRANSLATE_LANG: dom.langSelect.value,
      UI_LANG: dom.uiLangSelect.value,
      THEME: dom.themeSelect.value,
      maxHistorySize: parseInt(dom.maxHistoryInput.value, 10) || 20,
      geminiKeyValid: !!dom.apiKeyInput.value.trim(),
      googleCloudKeyValid: !!dom.googleCloudApiKeyInput.value.trim(),
      GEMINI_MODEL: dom.geminiModelSelect.value,
      CONTEXT_MENU_ENGINE: dom.contextMenuEngineSelect.value
    };
    await saveSettings(settingsToSave);
    browser.runtime.sendMessage({ type: 'languageChanged' });
    showStatus("statusSaved", dom.status);
    displayApiKeyStatus(settingsToSave.GEMINI_API_KEY, settingsToSave.geminiKeyValid);
    displayGoogleCloudApiKeyStatus(settingsToSave.GOOGLE_CLOUD_API_KEY, settingsToSave.googleCloudKeyValid);
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
