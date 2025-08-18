// modules/ui.js
// 這個模組專門負責所有與 options.html 頁面相關的 DOM 操作和 UI 渲染。

import { playTTS } from './tts.js'; // 我們也將 TTS 拆分出來
import { i18n } from '../options/i18n.js';

/**
 * 根據主題設定調整頁面樣式。
 */
export function applyTheme(theme) {
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
export function renderUI() {
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
export function renderHistory(history = []) {
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
    
    const listenBtn = document.createElement("button");
    listenBtn.className = "listen-btn";
    listenBtn.title = i18n.t("listenButtonTooltip");
    listenBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
    listenBtn.onclick = () => playTTS(item.translated, item.targetLang);
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
    footerDiv.appendChild(timeSpan);
    footerDiv.appendChild(buttonGroup);
    itemDiv.appendChild(originalP);
    itemDiv.appendChild(translatedP);
    itemDiv.appendChild(footerDiv);
    container.appendChild(itemDiv);
  });
}

/**
 * 顯示狀態通知 Toast
 */
export function showStatus(messageKey, statusEl) {
    statusEl.textContent = i18n.t(messageKey);
    statusEl.classList.add('show');
    setTimeout(() => { statusEl.classList.remove('show'); }, 2500);
}
