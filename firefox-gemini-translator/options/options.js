/**
 * 儲存一筆翻譯紀錄。
 * @param {string} original - 原始文字。
 * @param {string} translated - 翻譯後的文字。
 * @param {string} engine - 使用的翻譯引擎 ('google' 或 'gemini')。
 */
async function saveToHistory(original, translated, engine) {
  try {
    const { translationHistory = [], maxHistorySize = 20 } = await browser.storage.local.get(["translationHistory", "maxHistorySize"]);
    if (!original || !translated) return; // 確保有內容才儲存

    const newEntry = {
      original,
      translated,
      engine,
      timestamp: new Date().toISOString()
    };

    const updatedHistory = [newEntry, ...translationHistory];
    if (updatedHistory.length > maxHistorySize) {
      updatedHistory.length = maxHistorySize;
    }
    await browser.storage.local.set({ translationHistory: updatedHistory });
  } catch (err) {
    console.error("儲存翻譯紀錄失敗：", err);
  }
}

/**
 * 【新增】檢查文字是否包含中日韓 (CJK) 字元。
 */
function containsCjk(text) {
  const cjkRegex = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf\uac00-\ud7af]/;
  return cjkRegex.test(text);
}


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
  const nativeLangNames = {
    'langUiEn': 'English', 'langUiZhTw': '繁體中文', 'langUiZhCn': '简体中文',
    'langUiJa': '日本語', 'langUiKo': '한국어', 'langUiFr': 'Français',
    'langUiDe': 'Deutsch', 'langUiEs': 'Español', 'langUiRu': 'Русский'
  };

  document.querySelectorAll('[data-i18n]').forEach(elem => {
    const key = elem.getAttribute('data-i18n');
    elem.textContent = i18n.t(key);
  });
  
  document.querySelectorAll('#uiLang option').forEach(option => {
    const key = option.getAttribute('data-i18n');
    if (nativeLangNames[key]) {
      option.textContent = nativeLangNames[key];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(elem => {
    const key = elem.getAttribute('data-i18n-placeholder');
    elem.placeholder = i18n.t(key);
  });

  document.querySelectorAll('[data-i18n-title]').forEach(elem => {
    const key = elem.getAttribute('data-i18n-title');
    elem.title = i18n.t(key);
  });

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

// --- Popup 翻譯邏輯 ---

/**
 * 【新增】使用 Google Translate API 進行翻譯。
 */
async function handleGooglePopupTranslate(text, targetLang, resultEl) {
    resultEl.innerHTML = '<div class="loading-spinner"></div>';
    try {
        const langCodeMap = { "繁體中文": "zh-TW", "簡體中文": "zh-CN", "英文": "en", "日文": "ja", "韓文": "ko", "法文": "fr", "德文": "de", "西班牙文": "es", "俄文": "ru" };
        const tl = langCodeMap[targetLang] || "zh-TW";
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&dt=bd&dt=ss&dt=ex&q=${encodeURIComponent(text)}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Google API 錯誤: ${response.status}`);
        
        const data = await response.json();
        let translatedText = '';
        
        const allDefinitions = {};
        if (data[1] || data[5] || (data[12] && data[12].length > 0)) {
            const synonymBlocks = [data[1], data[5]].filter(Boolean);
            synonymBlocks.forEach(block => {
                if (Array.isArray(block)) {
                    block.forEach(part => {
                        if (!Array.isArray(part) || part.length < 2) return;
                        const partOfSpeech = part[0];
                        const words = part[1];
                        if (typeof partOfSpeech === 'string' && Array.isArray(words)) {
                            if (!allDefinitions[partOfSpeech]) allDefinitions[partOfSpeech] = new Set();
                            words.forEach(word => allDefinitions[partOfSpeech].add(word));
                        }
                    });
                }
            });

            if (data[12] && Array.isArray(data[12])) {
                 data[12].forEach(part => {
                    if (!Array.isArray(part) || part.length < 2) return;
                    const partOfSpeech = part[0];
                    const definitions = part[1];
                     if (typeof partOfSpeech === 'string' && Array.isArray(definitions)) {
                        if (!allDefinitions[partOfSpeech]) allDefinitions[partOfSpeech] = new Set();
                        definitions.forEach(def => {
                            if (def && typeof def[0] === 'string') allDefinitions[partOfSpeech].add(def[0]);
                        });
                    }
                });
            }
        }
        
        translatedText = Object.entries(allDefinitions)
          .map(([pos, defSet]) => `${pos}: ${[...defSet].join(', ')}`)
          .join('\n');

        if (!translatedText && data[0] && Array.isArray(data[0])) {
          translatedText = data[0].map(item => item[0]).join('');
        }

        if (!translatedText) throw new Error("從 Google 未收到翻譯結果");
        
        resultEl.textContent = translatedText;
        await saveToHistory(text, translatedText, 'google');

    } catch (err) {
        console.error("Popup Google 翻譯發生錯誤", err);
        resultEl.textContent = i18n.t("errorGoogle");
    }
}


/**
 * 【修改】原 handlePopupTranslate 更名為 handleGeminiPopupTranslate
 */
async function handleGeminiPopupTranslate(text, apiKey, targetLang, resultEl) {
    resultEl.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const prompt = i18n.t("promptSystem", [targetLang, text]);

        const response = await fetch(GEMINI_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: 1024, temperature: 0.1 }
            })
        });

        if (!response.ok) {
            throw new Error(`API 錯誤: ${response.status}`);
        }

        const data = await response.json();
        const translatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!translatedText) {
            throw new Error("從 Gemini 未收到翻譯結果");
        }
        
        resultEl.textContent = translatedText;
        await saveToHistory(text, translatedText, 'gemini');

    } catch (error) {
        console.error("Popup Gemini 翻譯失敗:", error);
        resultEl.textContent = i18n.t("errorGemini");
    }
}


/**
 * 頁面載入完成後執行的主要函式。
 */
async function main() {
  await i18n.init();
  renderUI();

  // --- DOM 元素 ---
  const tabs = {
    translate: { btn: document.getElementById('tab-translate'), view: document.getElementById('view-translate') },
    settings: { btn: document.getElementById('tab-settings'), view: document.getElementById('view-settings') },
    history: { btn: document.getElementById('tab-history'), view: document.getElementById('view-history') },
  };
  const apiKeyInput = document.getElementById("apiKey");
  const toggleApiKeyBtn = document.getElementById("toggleApiKey");
  const langSelect = document.getElementById("lang");
  const uiLangSelect = document.getElementById("uiLang");
  const themeSelect = document.getElementById("theme");
  const maxHistoryInput = document.getElementById("maxHistorySize");
  const saveBtn = document.getElementById("saveBtn");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const status = document.getElementById("status");
  const translateInput = document.getElementById('translateInput');
  const translateBtn = document.getElementById('translateBtn');
  const translateResult = document.getElementById('translateResult');
  const popupTargetLang = document.getElementById('popupTargetLang');

  // --- 頁籤切換邏輯 ---
  function switchTab(activeKey) {
    Object.keys(tabs).forEach(key => {
        const isActive = key === activeKey;
        tabs[key].btn.classList.toggle('active', isActive);
        tabs[key].view.classList.toggle('active', isActive);
    });
  }
  Object.keys(tabs).forEach(key => {
    tabs[key].btn.addEventListener('click', () => switchTab(key));
  });

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

  const defaultTargetLang = i18n.t("langZhTw");
  apiKeyInput.value = settings.GEMINI_API_KEY || '';
  langSelect.value = settings.TRANSLATE_LANG || defaultTargetLang;
  popupTargetLang.value = settings.TRANSLATE_LANG || defaultTargetLang;
  
  let initialUiLang = settings.UI_LANG;
  if (!initialUiLang) {
    const browserLang = browser.i18n.getUILanguage();
    const baseLang = browserLang.split('-')[0];
    if (browserLang === 'zh-CN') initialUiLang = 'zh_CN';
    else if (baseLang === 'zh') initialUiLang = 'zh_TW';
    else {
      const availableOptions = Array.from(uiLangSelect.options).map(o => o.value);
      if (availableOptions.includes(baseLang)) initialUiLang = baseLang;
      else initialUiLang = 'en';
    }
  }
  uiLangSelect.value = initialUiLang;
  themeSelect.value = settings.THEME || 'auto';
  maxHistoryInput.value = settings.maxHistorySize || 20;

  applyTheme(themeSelect.value);
  renderHistory(settings.translationHistory);
  displayApiKeyStatus(settings.GEMINI_API_KEY, settings.geminiKeyValid);

  // --- 事件監聽 ---
  // 翻譯按鈕
  translateBtn.addEventListener('click', async () => {
    const text = translateInput.value.trim();
    if (!text) return;
    
    const { GEMINI_API_KEY } = await browser.storage.local.get("GEMINI_API_KEY");
    
    // 【修改處】加入智慧判斷邏輯
    let useGoogleTranslate = false;
    if (containsCjk(text)) {
        useGoogleTranslate = text.length <= 5;
    } else {
        const wordCount = text.split(/\s+/).length;
        const characterCount = text.length;
        useGoogleTranslate = wordCount <= 3 && characterCount < 30;
    }
    
    const targetLang = popupTargetLang.value;

    if (useGoogleTranslate) {
        await handleGooglePopupTranslate(text, targetLang, translateResult);
    } else {
        if (!GEMINI_API_KEY) {
            alert(i18n.t("apiKeyStatusUnset"));
            switchTab('settings');
            apiKeyInput.focus();
            return;
        }
        await handleGeminiPopupTranslate(text, GEMINI_API_KEY, targetLang, translateResult);
    }
  });

  // UI 語言切換
  uiLangSelect.addEventListener('change', async (e) => {
      const newLang = e.target.value;
      await i18n.loadMessages(newLang);
      renderUI();
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
  
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.translationHistory) {
      renderHistory(changes.translationHistory.newValue);
    }
  });
}

document.addEventListener("DOMContentLoaded", main);
