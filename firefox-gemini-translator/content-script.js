let currentCard = null;

document.addEventListener('mousemove', (e) => {
  window.lastMouseX = e.clientX;
  window.lastMouseY = e.clientY;
});

function closeCard() {
  if (currentCard) {
    currentCard.remove();
    currentCard = null;
  }
  document.removeEventListener('mousedown', handleClickOutside);
}

function handleClickOutside(event) {
  if (currentCard && !currentCard.contains(event.target)) {
    closeCard();
  }
}

async function createTranslationCard(data) {
  closeCard(); // 確保先關閉舊的卡片

  const {
    originalText, translatedText, engine, modelName,
    sourceLangCode, sourceLangName, targetLangCode, uiStrings
  } = data;

  const { THEME } = await browser.storage.local.get("THEME");
  const theme = (THEME === 'auto')
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : (THEME || 'light');

  const card = document.createElement('div');
  card.id = 'gemini-translate-card';
  card.className = `gt-card-theme-${theme}`;

  // --- 建立卡片內部結構 ---
  let tags = '';
  if (engine === 'gemini' && modelName) {
    let modelTagClass = 'model-tag ';
    let modelTagText = '';
    if (modelName.includes('flash')) {
      modelTagClass += 'model-flash';
      modelTagText = uiStrings.modelTagFlash;
    } else if (modelName.includes('pro')) {
      modelTagClass += 'model-pro';
      modelTagText = uiStrings.modelTagPro;
    }
    tags = `
            <span class="gt-engine-tag engine-gemini">${uiStrings.engineTagGemini}</span>
            <span class="gt-engine-tag ${modelTagClass}">${modelTagText}</span>
        `;
  } else { // Google
    tags = `<span class="gt-engine-tag engine-google">${uiStrings.engineOptionGoogle}</span>`;
  }
  const tagHTML = `<div class="gt-tag-container">${tags}</div>`;

  const sourceLangHTML = sourceLangName ? `<span class="gt-source-lang">${uiStrings.sourceLanguageLabel}${sourceLangName}</span>` : '';

  card.innerHTML = `
        ${tagHTML}
        <button id="gt-close-btn" class="gt-close-btn">&times;</button>
        <div class="gt-content">
            <p class="gt-original-text">${originalText}</p>
            <p class="gt-translated-text">${translatedText.replace(/__NEWLINE__/g, '<br>')}</p>
        </div>
        <div class="gt-footer">
            <div class="gt-footer-info">${sourceLangHTML}</div>
            <div class="gt-footer-buttons">
                <button class="gt-icon-btn" id="gt-listen-original-btn" title="${uiStrings.listenOriginalButtonTooltip}">
                    <svg viewBox="0 0 24 24"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="gt-icon-btn" id="gt-listen-translated-btn" title="${uiStrings.listenButtonTooltip}">
                    <svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                </button>
                <button class="gt-text-btn" id="gt-copy-original-btn">${uiStrings.copyOriginal}</button>
                <button class="gt-text-btn" id="gt-copy-translated-btn">${uiStrings.copyTranslated}</button>
            </div>
        </div>
    `;

  // --- 設定卡片位置 ---
  card.style.left = `${window.lastMouseX || 100}px`;
  card.style.top = `${window.lastMouseY || 100}px`;

  document.body.appendChild(card);
  currentCard = card;

  // --- 調整位置避免超出視窗 ---
  const rect = card.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    card.style.left = `${window.innerWidth - rect.width - 20}px`;
  }
  if (rect.bottom > window.innerHeight) {
    card.style.top = `${window.innerHeight - rect.height - 20}px`;
  }

  // --- 綁定事件 ---
  card.querySelector('#gt-close-btn').addEventListener('click', closeCard);

  const listenOriginalBtn = card.querySelector('#gt-listen-original-btn');
  if (!sourceLangCode || sourceLangCode === 'und') {
    listenOriginalBtn.style.display = 'none';
  } else {
    listenOriginalBtn.addEventListener('click', () => {
      browser.runtime.sendMessage({ type: 'playTTS', text: originalText, langCode: sourceLangCode });
    });
  }

  card.querySelector('#gt-listen-translated-btn').addEventListener('click', () => {
    browser.runtime.sendMessage({ type: 'playTTS', text: translatedText.replace(/__NEWLINE__/g, ' '), langCode: targetLangCode });
  });

  const copyOriginalBtn = card.querySelector('#gt-copy-original-btn');
  copyOriginalBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(originalText).then(() => {
      copyOriginalBtn.textContent = uiStrings.copied;
      setTimeout(() => { copyOriginalBtn.textContent = uiStrings.copyOriginal; }, 1500);
    });
  });

  const copyTranslatedBtn = card.querySelector('#gt-copy-translated-btn');
  copyTranslatedBtn.addEventListener('click', () => {
    const textToCopy = translatedText.replace(/__NEWLINE__/g, '\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      copyTranslatedBtn.textContent = uiStrings.copied;
      setTimeout(() => { copyTranslatedBtn.textContent = uiStrings.copyTranslated; }, 1500);
    });
  });

  setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
}

function injectStyles() {
  const styleId = 'gemini-translate-card-styles';
  if (document.getElementById(styleId)) return;

  const css = `
        :root { --gt-primary: #007bff; --gt-text-light: #333; --gt-text-dark: #e8eaed; --gt-bg-light: #fff; --gt-bg-dark: #2d2e30; --gt-border-light: #e0e0e0; --gt-border-dark: #555; }
        #gemini-translate-card { position: fixed; z-index: 2147483647; width: 380px; max-width: 90vw; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 14px; }
        .gt-card-theme-light { background: var(--gt-bg-light); color: var(--gt-text-light); border: 1px solid var(--gt-border-light); }
        .gt-card-theme-dark { background: var(--gt-bg-dark); color: var(--gt-text-dark); border: 1px solid var(--gt-border-dark); }
        
        /* --- Header: Tags & Close Button --- */
        .gt-tag-container { position: absolute; top: 0; right: 0; display: flex; border-radius: 0 8px 0 8px; overflow: hidden; }
        .gt-engine-tag { padding: 4px 10px; font-size: 11px; font-weight: bold; color: #fff; text-transform: capitalize; }
        .gt-engine-tag.engine-google { background-color: #888; }
        .gt-engine-tag.engine-gemini { background-color: var(--gt-primary); }
        .gt-engine-tag.model-flash { background-color: #00897b; }
        .gt-engine-tag.model-pro { background-color: #3949ab; }
        
        .gt-close-btn { position: absolute; top: 2px; left: 8px; background: none; border: none; font-size: 24px; cursor: pointer; opacity: 0.5; padding: 0; line-height: 1; }
        .gt-card-theme-light .gt-close-btn { color: #000; }
        .gt-card-theme-dark .gt-close-btn { color: #fff; }
        .gt-close-btn:hover { opacity: 1; }
        
        /* --- Content & Spacing --- */
        .gt-content { padding: 40px 16px 16px 16px; line-height: 1.6; }
        .gt-content p { margin: 0; }
        .gt-original-text { font-weight: 600; color: var(--gt-primary); margin-bottom: 8px; }
        .gt-translated-text { white-space: pre-wrap; word-wrap: break-word; }

        /* --- Footer --- */
        .gt-footer { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-top: 1px solid; }
        .gt-card-theme-light .gt-footer { border-top-color: var(--gt-border-light); }
        .gt-card-theme-dark .gt-footer { border-top-color: var(--gt-border-dark); }
        .gt-footer-info { font-size: 12px; opacity: 0.7; }
        .gt-footer-buttons { display: flex; align-items: center; gap: 8px; }
        .gt-icon-btn, .gt-text-btn { background: none; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; }
        .gt-icon-btn { border: none; padding: 4px; opacity: 0.7; }
        .gt-icon-btn:hover { opacity: 1; background-color: rgba(128,128,128,0.2); }
        .gt-icon-btn svg { width: 16px; height: 16px; display: block; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .gt-card-theme-light .gt-icon-btn svg { stroke: #333; }
        .gt-card-theme-dark .gt-icon-btn svg { stroke: #eee; }
        .gt-text-btn { font-size: 12px; padding: 4px 8px; border: 1px solid; }
        .gt-card-theme-light .gt-text-btn { color: #555; border-color: #ccc; }
        .gt-card-theme-light .gt-text-btn:hover { background-color: #f0f0f0; }
        .gt-card-theme-dark .gt-text-btn { color: #ccc; border-color: #666; }
        .gt-card-theme-dark .gt-text-btn:hover { background-color: #444; }
    `;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);
}

browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'showTranslationCard') {
    injectStyles();
    createTranslationCard(message.data);
  } else if (message.type === 'showError') {
    alert(message.text);
  }
});

