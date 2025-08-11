/**
 * 根據主題設定調整頁面樣式。
 */
function applyTheme(theme) {
  document.body.className = theme;
}

/**
 * 顯示 API Key 的狀態，並在需要時提供可點擊的連結。
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
    const link = createLink("(尚未輸入，點此獲取)");
    statusEl.className = "key-status invalid";
    statusEl.appendChild(link);
  } else if (isValid === false) {
    const link = createLink("(金鑰無效，點此獲取)");
    statusEl.className = "key-status invalid";
    statusEl.appendChild(link);
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

    // --- 新增：複製原文按鈕 ---
    const copyOriginalBtn = document.createElement("button");
    copyOriginalBtn.className = "copy-history-btn";
    copyOriginalBtn.textContent = "複製原文";
    copyOriginalBtn.onclick = () => {
      navigator.clipboard.writeText(item.original).then(() => {
        copyOriginalBtn.textContent = "已複製!";
        setTimeout(() => { copyOriginalBtn.textContent = "複製原文"; }, 1500);
      });
    };

    // 修改：將原有的「複製」按鈕改名為「複製譯文」以作區分
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
        const updatedHistory = translationHistory.filter(historyItem => historyItem.timestamp !== item.timestamp);
        await browser.storage.local.set({ translationHistory: updatedHistory });
        renderHistory(updatedHistory);
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
  const apiKeyInput = document.getElementById("apiKey");
  const langSelect = document.getElementById("lang");
  const themeSelect = document.getElementById("theme");
  const maxHistoryInput = document.getElementById("maxHistorySize");
  const saveBtn = document.getElementById("saveBtn");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const status = document.getElementById("status");

  const settings = await browser.storage.local.get([
    "GEMINI_API_KEY", "TRANSLATE_LANG", "THEME", "maxHistorySize", "translationHistory", "geminiKeyValid"
  ]);

  if (settings.GEMINI_API_KEY) apiKeyInput.value = settings.GEMINI_API_KEY;
  if (settings.TRANSLATE_LANG) langSelect.value = settings.TRANSLATE_LANG;
  if (settings.THEME) themeSelect.value = settings.THEME;
  if (settings.maxHistorySize) maxHistoryInput.value = settings.maxHistorySize;
  
  applyTheme(settings.THEME || 'light');
  renderHistory(settings.translationHistory);
  displayApiKeyStatus(settings.GEMINI_API_KEY, settings.geminiKeyValid);

  themeSelect.onchange = () => applyTheme(themeSelect.value);

  saveBtn.onclick = async () => {
    const newMaxHistorySize = parseInt(maxHistoryInput.value, 10);
    const validMaxHistorySize = isNaN(newMaxHistorySize) ? 20 : newMaxHistorySize;
    const newApiKey = apiKeyInput.value.trim();
    const isNewKeyPresent = !!newApiKey;

    const { translationHistory = [] } = await browser.storage.local.get("translationHistory");
    if (translationHistory.length > validMaxHistorySize) {
      translationHistory.length = validMaxHistorySize;
    }

    await browser.storage.local.set({
      GEMINI_API_KEY: newApiKey,
      TRANSLATE_LANG: langSelect.value,
      THEME: themeSelect.value,
      maxHistorySize: validMaxHistorySize,
      translationHistory: translationHistory,
      geminiKeyValid: isNewKeyPresent 
    });

    displayApiKeyStatus(newApiKey, isNewKeyPresent);
    status.textContent = "✅ 設定已儲存";
    setTimeout(() => { status.textContent = ''; }, 2000);
  };

  clearHistoryBtn.onclick = async () => {
    if (confirm("確定要清除所有翻譯紀錄嗎？此操作無法復原。")) {
      await browser.storage.local.remove("translationHistory");
      renderHistory([]);
      status.textContent = "✅ 紀錄已清除";
      setTimeout(() => { status.textContent = ''; }, 2000);
    }
  };
  
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.translationHistory) {
        renderHistory(changes.translationHistory.newValue);
      }
      if (changes.geminiKeyValid || changes.GEMINI_API_KEY) {
        browser.storage.local.get(["GEMINI_API_KEY", "geminiKeyValid"]).then(data => {
            displayApiKeyStatus(data.GEMINI_API_KEY, data.geminiKeyValid);
        });
      }
    }
  });
});
