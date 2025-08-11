/**
 * 根據主題設定調整頁面樣式，新增支援 'auto' 模式。
 * @param {string} theme - 'light', 'dark', 或 'auto'
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
    statusEl.appendChild(createLink("(尚未輸入，點此獲取)"));
    statusEl.className = "key-status invalid";
  } else if (isValid === false) {
    statusEl.appendChild(createLink("(金鑰無效，點此獲取)"));
    statusEl.className = "key-status invalid";
  } else {
    const span = document.createElement('span');
    span.textContent = "(已儲存)";
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
    container.textContent = "尚無翻譯紀錄。";
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
    copyOriginalBtn.textContent = "複製原文";
    copyOriginalBtn.onclick = () => {
      navigator.clipboard.writeText(item.original).then(() => {
        copyOriginalBtn.textContent = "已複製!";
        setTimeout(() => { copyOriginalBtn.textContent = "複製原文"; }, 1500);
      });
    };
    const copyTranslatedBtn = document.createElement("button");
    copyTranslatedBtn.className = "copy-history-btn";
    copyTranslatedBtn.textContent = "複製譯文";
    copyTranslatedBtn.onclick = () => {
      navigator.clipboard.writeText(item.translated).then(() => {
        copyTranslatedBtn.textContent = "已複製!";
        setTimeout(() => { copyTranslatedBtn.textContent = "複製譯文"; }, 1500);
      });
    };
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-history-btn";
    deleteBtn.textContent = "刪除";
    deleteBtn.onclick = async () => {
      if (confirm(`確定要刪除這筆紀錄嗎？\n\n原文：${item.original}`)) {
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
document.addEventListener("DOMContentLoaded", async () => {
  // 取得所有需要的 DOM 元素
  const tabSettingsBtn = document.getElementById('tab-settings');
  const tabHistoryBtn = document.getElementById('tab-history');
  const viewSettings = document.getElementById('view-settings');
  const viewHistory = document.getElementById('view-history');
  
  const apiKeyInput = document.getElementById("apiKey");
  const toggleApiKeyBtn = document.getElementById("toggleApiKey");
  const langSelect = document.getElementById("lang");
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
  const showStatus = (message) => {
    status.textContent = message;
    status.classList.add('show');
    setTimeout(() => { status.classList.remove('show'); }, 2500);
  };

  // --- 載入設定 ---
  const settings = await browser.storage.local.get([
    "GEMINI_API_KEY", "TRANSLATE_LANG", "THEME", "maxHistorySize", "translationHistory", "geminiKeyValid"
  ]);

  // 填入設定值
  apiKeyInput.value = settings.GEMINI_API_KEY || '';
  langSelect.value = settings.TRANSLATE_LANG || '繁體中文';
  themeSelect.value = settings.THEME || 'auto';
  maxHistoryInput.value = settings.maxHistorySize || 20;

  // 應用主題與渲染歷史紀錄
  applyTheme(themeSelect.value);
  renderHistory(settings.translationHistory);
  displayApiKeyStatus(settings.GEMINI_API_KEY, settings.geminiKeyValid);

  // --- 事件監聽 ---
  themeSelect.addEventListener('change', () => {
    applyTheme(themeSelect.value);
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themeSelect.value === 'auto') {
      applyTheme('auto');
    }
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
      THEME: themeSelect.value,
      maxHistorySize: isNaN(newMaxHistorySize) ? 20 : newMaxHistorySize,
      geminiKeyValid: !!apiKeyInput.value.trim()
    });
    showStatus("設定已儲存");
    // 立即更新 API Key 狀態顯示
    displayApiKeyStatus(apiKeyInput.value.trim(), !!apiKeyInput.value.trim());
  });

  clearHistoryBtn.addEventListener('click', async () => {
    if (confirm("確定要清除所有翻譯紀錄嗎？此操作無法復原。")) {
      await browser.storage.local.set({ translationHistory: [] });
      showStatus("紀錄已清除");
    }
  });
  
  // 監聽 storage 變化以即時更新 UI
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    if (changes.translationHistory) {
      renderHistory(changes.translationHistory.newValue);
    }
    if (changes.geminiKeyValid || changes.GEMINI_API_KEY) {
      browser.storage.local.get(["GEMINI_API_KEY", "geminiKeyValid"]).then(data => {
        displayApiKeyStatus(data.GEMINI_API_KEY, data.geminiKeyValid);
      });
    }
    if (changes.THEME) {
      themeSelect.value = changes.THEME.newValue || 'auto';
      applyTheme(themeSelect.value);
    }
  });
});
