// modules/ui.js
import { playTTS } from './tts.js';
import { i18n } from '../options/i18n.js';

/**
 * 將 ISO 日期字串格式化為 'YYYY/MM/DD HH:mm:ss' 的 24 小時制格式。
 * @param {string} isoString - ISO 格式的日期時間字串。
 * @returns {string} 格式化後的日期時間字串。
 */
function formatTimestamp(isoString) {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

export function formatGeminiModelLabel(modelName) {
  if (!modelName) return '';
  const cleaned = modelName.replace(/^gemini-/, '').replace(/-latest$/, '');
  return cleaned
    .split('-')
    .map(part => {
      if (!part) return part;
      if (/^\d/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

export function applyTheme(theme) {
  let finalTheme = theme;
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    finalTheme = prefersDark ? 'dark' : 'light';
  }
  document.body.className = finalTheme;
}

export function renderUI() {
  const nativeLangNames = {
    'langUiEn': 'English', 'langUiZhTw': '繁體中文', 'langUiZhCn': '简体中文',
    'langUiJa': '日本語', 'langUiKo': '한국어', 'langUiFr': 'Français',
    'langUiDe': 'Deutsch', 'langUiEs': 'Español', 'langUiRu': 'Русский',
    'langUiHi': 'हिन्दी', 'langUiAr': 'العربية', 'langUiBn': 'বাংলা',
    'langUiPt': 'Português', 'langUiId': 'Bahasa Indonesia'
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

export function displayApiKeyStatus(apiKey, isValid) {
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
export async function renderHistory(history = []) {
  const container = document.getElementById("historyContainer");
  if (!container) return;
  container.innerHTML = "";
  if (history.length === 0) {
    container.textContent = i18n.t("noHistory");
    return;
  }
  
  const { UI_LANG } = await browser.storage.local.get('UI_LANG');
  const uiLang = (UI_LANG || 'zh_TW').replace('_', '-');
  const displayLang = new Intl.DisplayNames([uiLang], { type: 'language' });
  const langNameToCodeMap = { "繁體中文": "zh-TW", "簡體中文": "zh-CN", "英文": "en", "日文": "ja", "韓文": "ko", "法文": "fr", "德文": "de", "西班牙文": "es", "俄文": "ru", "印地文": "hi", "阿拉伯文": "ar", "孟加拉文": "bn", "葡萄牙文": "pt", "印尼文": "id" };

  history.forEach(item => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "history-item";
    
    const tagContainer = document.createElement("div");
    tagContainer.className = "tag-container";
    itemDiv.appendChild(tagContainer);

    if (item.engine) {
      const engineTag = document.createElement("span");
      engineTag.className = `engine-tag engine-${item.engine}`;
      engineTag.textContent = item.engine;
      tagContainer.appendChild(engineTag);

      if (item.engine === 'gemini' && item.modelName) {
        const modelTag = document.createElement("span");
        modelTag.className = 'engine-tag model-tag';
        
        if (item.modelName.includes('flash')) {
            modelTag.classList.add('model-flash');
        } else if (item.modelName.includes('pro')) {
            modelTag.classList.add('model-pro');
        }

        modelTag.textContent = formatGeminiModelLabel(item.modelName);
        tagContainer.appendChild(modelTag);
      }
    }

    const originalP = document.createElement("p");
    originalP.className = "original-text";
    originalP.textContent = item.original;
    const translatedP = document.createElement("p");
    translatedP.className = "translated-text";
    translatedP.textContent = item.translated;
    const footerDiv = document.createElement("div");
    footerDiv.className = "history-item-footer";

    const infoContainer = document.createElement("div");
    infoContainer.className = "history-item-info";

    const timeSpan = document.createElement("span");
    timeSpan.textContent = formatTimestamp(item.timestamp);
    infoContainer.appendChild(timeSpan);

    if (item.sourceLang && item.sourceLang !== 'und') {
        const sourceLangSpan = document.createElement("span");
        sourceLangSpan.className = "history-source-lang";
        try {
            const sourceLangName = displayLang.of(item.sourceLang);
            sourceLangSpan.textContent = `${i18n.t('sourceLanguageLabel')}${sourceLangName}`;
        } catch (e) {
            sourceLangSpan.textContent = `${i18n.t('sourceLanguageLabel')}${item.sourceLang}`;
        }
        infoContainer.appendChild(sourceLangSpan);
    }
    
    const buttonGroup = document.createElement("div");
    buttonGroup.className = "history-item-buttons";
    
    const listenOriginalBtn = document.createElement("button");
    listenOriginalBtn.className = "listen-btn";
    listenOriginalBtn.title = i18n.t("listenOriginalButtonTooltip");
    listenOriginalBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    listenOriginalBtn.onclick = () => playTTS(item.original, item.sourceLang);
    if (!item.sourceLang || item.sourceLang === 'und') {
        listenOriginalBtn.classList.add('hidden');
    }
    buttonGroup.appendChild(listenOriginalBtn);

    const listenBtn = document.createElement("button");
    listenBtn.className = "listen-btn";
    listenBtn.title = i18n.t("listenButtonTooltip");
    listenBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
    const targetLangCode = langNameToCodeMap[item.targetLang];
    listenBtn.onclick = () => playTTS(item.translated, targetLangCode);
    buttonGroup.appendChild(listenBtn);

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
    
    footerDiv.appendChild(infoContainer);
    footerDiv.appendChild(buttonGroup);
    
    itemDiv.appendChild(originalP);
    itemDiv.appendChild(translatedP);
    itemDiv.appendChild(footerDiv);
    container.appendChild(itemDiv);
  });
}

export function showStatus(messageKey, statusEl) {
    statusEl.textContent = i18n.t(messageKey);
    statusEl.classList.add('show');
    setTimeout(() => { statusEl.classList.remove('show'); }, 2500);
}
