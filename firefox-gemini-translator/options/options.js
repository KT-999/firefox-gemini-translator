/**
 * 根據主題設定調整頁面樣式。
 */
function applyTheme(theme) {
  let finalTheme = theme;
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    finalTheme = prefersDark ? 'dark' : 'light';
  }
  document.body.className = finalTheme;
}

/**
 * 使用 i18n 管理器來渲染整個頁面的 UI 文字。
 */
function renderUI() {
  // 更新所有帶有 data-i18n 屬性的元素
  document.querySelectorAll('[data-i18n]').forEach(elem => {
    const key = elem.getAttribute('data-i18n');
    elem.textContent = i18n.t(key);
  });

  // 更新 placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(elem => {
    const key = elem.getAttribute('data-i18n-placeholder');
    elem.placeholder = i18n.t(key);
  });

  // 更新 title
  document.querySelectorAll('[data-i18n-title]').forEach(elem => {
    const key = elem.getAttribute('data-i18n-title');
    elem.title = i18n.t(key);
  });

  // 更新頁面標題
  document.title = i18n.t('optionsTitle');
}


/**
 * 顯示 API Key 的狀態。
 */
function displayApiKeyStatus(apiKey, isValid) {
  const statusEl = document.getElementById("apiKeyStatus");
  if (!statusEl) return;
  statusEl.innerHTML = '';
  const createLink = (text) => {
    const link = document.createElement('a');
    link.href = "https://aistudio.google.com/app/apikey";
    link.target = "_blank";
    link.textContent = text;
    return link;
  };

  if (!apiKey) {
    statusEl.appendChild(createLink(i18n.t("apiKeyStatusUnset")));
    statusEl.className = "key-status invalid";
  } else if (isValid === false) {
    statusEl.appendChild(createLink(i18n.t("apiKeyStatusInvalid")));
    statusEl.className = "key-status invalid";
  } else {
    const span = document.createElement('span');
    span.textContent = i18n.t("apiKeyStatusValid");
    statusEl.className = "key-status valid";
    statusEl.appendChild(span);
  }
}

/**
 * 渲染翻譯紀錄列表。
 */
function renderHistory(history = []) {
  const container = document.getElementById("historyContainer");
  if (!container) return;
  container.innerHTML = "";
  if (history.length === 0) {
    container.textContent = i18n.t("noHistory");
    return;
  }

  history.forEach(item => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "history-item";

    if (item.engine) {
      const engineTag = document.createElement("span");
      engineTag.className = `engine-tag engine-${item.engine}`;
      engineTag.textContent = item.engine;
      itemDiv.appendChild(engineTag);
    }

    const originalP = document.createElement("p");
    originalP.className = "original-text";
    originalP.textContent = item.original;
    const translatedP = document.createElement("p");
    translatedP.className = "translated-text";
    translatedP.textContent = item.translated;
    const footerDiv = document.createElement("div");
    footerDiv.className = "history-item-footer";
    const timeSpan = document.createElement("span");
    timeSpan.textContent = new Date(item.timestamp).toLocaleString();
    const buttonGroup = document.createElement("div");
    buttonGroup.className = "history-item-buttons";
    
    const copyOriginalBtn = document.createElement("button");
    copyOriginalBtn.className = "copy-history-btn";
    copyOriginalBtn.textContent = i18n.t("copyOriginal");
    copyOriginalBtn.onclick = () => {
      navigator.clipboard.writeText(item.original).then(() => {
        copyOriginalBtn.textContent = i18n.t("copied");
        setTimeout(() => { copyOriginalBtn.textContent = i18n.t("copyOriginal"); }, 1500);
      });
    };

    const copyTranslatedBtn = document.createElement("button");
    copyTranslatedBtn.className = "copy-history-btn";
    copyTranslatedBtn.textContent = i18n.t("copyTranslated");
    copyTranslatedBtn.onclick = () => {
      navigator.clipboard.writeText(item.translated).then(() => {
        copyTranslatedBtn.textContent = i18n.t("copied");
        setTimeout(() => { copyTranslatedBtn.textContent = i18n.t("copyTranslated"); }, 1500);
      });
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-history-btn";
    deleteBtn.textContent = i18n.t("delete");
    deleteBtn.onclick = async () => {
      const confirmMessage = i18n.t("confirmDeleteHistoryItem", [item.original]);
      if (confirm(confirmMessage)) {
        const { translationHistory = [] } = await browser.storage.local.get("translationHistory");
        const updatedHistory = translationHistory.filter(h => h.timestamp !== item.timestamp);
        await browser.storage.local.set({ translationHistory: updatedHistory });
      }
    };

    buttonGroup.appendChild(copyOriginalBtn);
    buttonGroup.appendChild(copyTranslatedBtn);
    buttonGroup.appendChild(deleteBtn);
    footerDiv.appendChild(timeSpan);
    footerDiv.appendChild(buttonGroup);
    itemDiv.appendChild(originalP);
    itemDiv.appendChild(translatedP);
    itemDiv.appendChild(footerDiv);
    container.appendChild(itemDiv);
  });
}

/**
 * 頁面載入完成後執行的主要函式。
 */
async function main() {
  // 優先初始化 i18n 管理器
  await i18n.init();
  
  // 然後才渲染 UI
  renderUI();

  // 取得所有需要的 DOM 元素
  const tabSettingsBtn = document.getElementById('tab-settings');
  const tabHistoryBtn = document.getElementById('tab-history');
  const viewSettings = document.getElementById('view-settings');
  const viewHistory = document.getElementById('view-history');
  
  const apiKeyInput = document.getElementById("apiKey");
  const toggleApiKeyBtn = document.getElementById("toggleApiKey");
  const langSelect = document.getElementById("lang");
  const uiLangSelect = document.getElementById("uiLang");
  const themeSelect = document.getElementById("theme");
  const maxHistoryInput = document.getElementById("maxHistorySize");
  const saveBtn = document.getElementById("saveBtn");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const status = document.getElementById("status");

  // --- 頁籤切換邏輯 ---
  function switchTab(activeTab) {
    if (activeTab === 'settings') {
      tabSettingsBtn.classList.add('active');
      tabHistoryBtn.classList.remove('active');
      viewSettings.classList.add('active');
      viewHistory.classList.remove('active');
    } else {
      tabSettingsBtn.classList.remove('active');
      tabHistoryBtn.classList.add('active');
      viewSettings.classList.remove('active');
      viewHistory.classList.add('active');
    }
  }
  tabSettingsBtn.addEventListener('click', () => switchTab('settings'));
  tabHistoryBtn.addEventListener('click', () => switchTab('history'));

  // --- 狀態通知 ---
  const showStatus = (messageKey) => {
    status.textContent = i18n.t(messageKey);
    status.classList.add('show');
    setTimeout(() => { status.classList.remove('show'); }, 2500);
  };

  // --- 載入設定 ---
  const settings = await browser.storage.local.get([
    "GEMINI_API_KEY", "TRANSLATE_LANG", "UI_LANG", "THEME", "maxHistorySize", "translationHistory", "geminiKeyValid"
  ]);

  // 填入設定值
  apiKeyInput.value = settings.GEMINI_API_KEY || '';
  langSelect.value = settings.TRANSLATE_LANG || i18n.t("langZhTw");
  
  // 【修改處】修正初次載入時 UI 語言下拉選單的預設值
  let initialUiLang = settings.UI_LANG;
  if (!initialUiLang) {
    const browserLang = browser.i18n.getUILanguage();
    if (browserLang.startsWith('zh')) {
      initialUiLang = 'zh_TW';
    } else {
      initialUiLang = 'en';
    }
  }
  uiLangSelect.value = initialUiLang;

  themeSelect.value = settings.THEME || 'auto';
  maxHistoryInput.value = settings.maxHistorySize || 20;

  // 應用主題與渲染歷史紀錄
  applyTheme(themeSelect.value);
  renderHistory(settings.translationHistory);
  displayApiKeyStatus(settings.GEMINI_API_KEY, settings.geminiKeyValid);

  // --- 事件監聽 ---
  uiLangSelect.addEventListener('change', async (e) => {
      const newLang = e.target.value;
      await i18n.loadMessages(newLang);
      renderUI();
      // 重新渲染歷史紀錄和 API 狀態，因為裡面的文字也需要更新
      const currentHistory = (await browser.storage.local.get("translationHistory")).translationHistory;
      renderHistory(currentHistory);
      const currentApiKey = (await browser.storage.local.get(["GEMINI_API_KEY", "geminiKeyValid"]));
      displayApiKeyStatus(currentApiKey.GEMINI_API_KEY, currentApiKey.geminiKeyValid);
  });

  themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themeSelect.value === 'auto') applyTheme('auto');
  });

  toggleApiKeyBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    toggleApiKeyBtn.querySelector('.icon-eye').classList.toggle('hidden', isPassword);
    toggleApiKeyBtn.querySelector('.icon-eye-off').classList.toggle('hidden', !isPassword);
  });

  saveBtn.addEventListener('click', async () => {
    const newMaxHistorySize = parseInt(maxHistoryInput.value, 10);
    await browser.storage.local.set({
      GEMINI_API_KEY: apiKeyInput.value.trim(),
      TRANSLATE_LANG: langSelect.value,
      UI_LANG: uiLangSelect.value,
      THEME: themeSelect.value,
      maxHistorySize: isNaN(newMaxHistorySize) ? 20 : newMaxHistorySize,
      geminiKeyValid: !!apiKeyInput.value.trim()
    });
    // 通知背景腳本語言已變更，以便更新右鍵選單
    browser.runtime.sendMessage({ type: 'languageChanged' });
    showStatus("statusSaved");
    displayApiKeyStatus(apiKeyInput.value.trim(), !!apiKeyInput.value.trim());
  });

  clearHistoryBtn.addEventListener('click', async () => {
    if (confirm(i18n.t("confirmClearAllHistory"))) {
      await browser.storage.local.set({ translationHistory: [] });
      showStatus("statusCleared");
    }
  });
  
  // 監聽 storage 變化以即時更新 UI
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.translationHistory) {
      renderHistory(changes.translationHistory.newValue);
    }
  });
}

document.addEventListener("DOMContentLoaded", main);
