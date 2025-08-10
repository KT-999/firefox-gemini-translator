/**
 * 根據主題設定調整頁面樣式。
 */
function applyTheme(theme) {
  document.body.className = theme;
}

/**
 * 顯示 API Key 的狀態，並在需要時提供可點擊的連結。
 * @param {string} apiKey - 使用者儲存的 API Key。
 * @param {boolean|undefined} isValid - 金鑰是否有效的旗標。
 */
function displayApiKeyStatus(apiKey, isValid) {
  const statusEl = document.getElementById("apiKeyStatus");
  if (!statusEl) return;

  statusEl.innerHTML = ''; // 清空現有內容

  // 建立一個可點擊的連結
  const createLink = (text) => {
    const link = document.createElement('a');
    link.href = "https://aistudio.google.com/app/apikey";
    link.target = "_blank"; // 在新分頁中開啟
    link.textContent = text;
    return link;
  };

  if (!apiKey) {
    const link = createLink("(尚未輸入，點此獲取)");
    statusEl.className = "key-status invalid"; // 使用 'invalid' class 來顯示紅色
    statusEl.appendChild(link);
  } else if (isValid === false) {
    const link = createLink("(金鑰無效，點此獲取)");
    statusEl.className = "key-status invalid";
    statusEl.appendChild(link);
  } else {
    // isValid 為 true 或 undefined (尚未驗證) 時
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
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-history-btn";
    copyBtn.textContent = "複製";
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(item.translated).then(() => {
        copyBtn.textContent = "已複製!";
        setTimeout(() => { copyBtn.textContent = "複製"; }, 1500);
      });
    };
    footerDiv.appendChild(timeSpan);
    footerDiv.appendChild(copyBtn);
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

    // 根據是否有輸入金鑰來決定其初始有效性狀態
    const isNewKeyPresent = !!newApiKey;

    const { translationHistory = [] } = await browser.storage.local.get("translationHistory");
    if (translationHistory.length > validMaxHistorySize) {
      translationHistory.length = validMaxHistorySize;
    }

    // 當使用者儲存金鑰時，如果金鑰為空，則立即標記為無效；
    // 如果不為空，則樂觀地假設它是有效的，直到翻譯失敗為止。
    await browser.storage.local.set({
      GEMINI_API_KEY: newApiKey,
      TRANSLATE_LANG: langSelect.value,
      THEME: themeSelect.value,
      maxHistorySize: validMaxHistorySize,
      translationHistory: translationHistory,
      geminiKeyValid: isNewKeyPresent 
    });

    // 立即根據金鑰是否存在來更新 UI
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
  
  // 監聽儲存空間變化，即時更新金鑰狀態和紀錄列表
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.translationHistory) {
        renderHistory(changes.translationHistory.newValue);
      }
      if (changes.geminiKeyValid || changes.GEMINI_API_KEY) {
        // 如果金鑰本身或其有效性狀態被改變，就重新讀取並更新狀態顯示
        browser.storage.local.get(["GEMINI_API_KEY", "geminiKeyValid"]).then(data => {
            displayApiKeyStatus(data.GEMINI_API_KEY, data.geminiKeyValid);
        });
      }
    }
  });
});
