/**
 * 根據主題設定調整頁面樣式。
 * @param {string} theme - 'light' 或 'dark'。
 */
function applyTheme(theme) {
  document.body.className = theme;
}

/**
 * 渲染翻譯紀錄列表。
 * @param {Array} history - 翻譯紀錄陣列。
 */
function renderHistory(history = []) {
  const container = document.getElementById("historyContainer");
  if (!container) return;

  container.innerHTML = ""; // 清空現有內容

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
        setTimeout(() => {
          copyBtn.textContent = "複製";
        }, 1500);
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

  // 載入所有設定和紀錄
  const settings = await browser.storage.local.get([
    "GEMINI_API_KEY",
    "TRANSLATE_LANG",
    "THEME",
    "maxHistorySize",
    "translationHistory"
  ]);

  // 填入現有設定
  if (settings.GEMINI_API_KEY) apiKeyInput.value = settings.GEMINI_API_KEY;
  if (settings.TRANSLATE_LANG) langSelect.value = settings.TRANSLATE_LANG;
  if (settings.THEME) themeSelect.value = settings.THEME;
  if (settings.maxHistorySize) maxHistoryInput.value = settings.maxHistorySize;
  
  applyTheme(settings.THEME || 'light');
  renderHistory(settings.translationHistory);

  // 監聽主題變更
  themeSelect.onchange = () => applyTheme(themeSelect.value);

  // --- 全新的儲存按鈕事件 ---
  saveBtn.onclick = async () => {
    const newMaxHistorySize = parseInt(maxHistoryInput.value, 10);
    // 確保輸入值是有效的數字，否則使用預設值 20
    const validMaxHistorySize = isNaN(newMaxHistorySize) ? 20 : newMaxHistorySize;

    // 1. 從儲存空間取得目前的歷史紀錄
    const { translationHistory = [] } = await browser.storage.local.get("translationHistory");

    // 2. 如果目前的紀錄數量超過新的最大值，就進行裁剪
    if (translationHistory.length > validMaxHistorySize) {
      translationHistory.length = validMaxHistorySize; // 直接修改陣列長度，移除多餘的舊紀錄
    }

    // 3. 將所有設定，包含可能已被裁剪的歷史紀錄，一併儲存
    await browser.storage.local.set({
      GEMINI_API_KEY: apiKeyInput.value.trim(),
      TRANSLATE_LANG: langSelect.value,
      THEME: themeSelect.value,
      maxHistorySize: validMaxHistorySize,
      translationHistory: translationHistory // 儲存更新後的歷史紀錄
    });

    // 4. 立即在畫面上重新渲染歷史紀錄，讓使用者看到變化
    renderHistory(translationHistory);

    status.textContent = "✅ 設定已儲存，紀錄已更新";
    setTimeout(() => { status.textContent = ''; }, 2000);
  };

  // 清除紀錄按鈕事件
  clearHistoryBtn.onclick = async () => {
    if (confirm("確定要清除所有翻譯紀錄嗎？此操作無法復原。")) {
      await browser.storage.local.remove("translationHistory");
      renderHistory([]); // 立即更新畫面
      status.textContent = "✅ 紀錄已清除";
      setTimeout(() => { status.textContent = ''; }, 2000);
    }
  };
  
  // 監聽儲存空間變化，即時更新紀錄列表
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.translationHistory) {
      // 確保目前頁面上的列表與儲存的資料同步
      renderHistory(changes.translationHistory.newValue);
    }
  });
});
