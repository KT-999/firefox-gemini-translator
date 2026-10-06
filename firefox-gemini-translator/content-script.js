let currentHost = null;
let lastCardPosition = null;

document.addEventListener('mousemove', (e) => {
  window.lastMouseX = e.clientX;
  window.lastMouseY = e.clientY;
});

function closeCard() {
  if (currentHost) {
    currentHost.remove();
    currentHost = null;
  }
  lastCardPosition = null;
  document.removeEventListener('mousedown', handleClickOutside);
  document.removeEventListener('keydown', handleKeyDown);
}

function handleClickOutside(event) {
  if (!currentHost) return;
  const path = event.composedPath ? event.composedPath() : [];
  if (!path.includes(currentHost) && !currentHost.contains(event.target)) {
    closeCard();
  }
}

function handleKeyDown(event) {
  if (event.key === 'Escape') {
    closeCard();
  }
}

function getCardStyles() {
  return `
    :host {
      all: initial;
      --gt-primary: #007bff;
      --gt-text-light: #333;
      --gt-text-dark: #e8eaed;
      --gt-bg-light: #fff;
      --gt-bg-dark: #2d2e30;
      --gt-border-light: #e0e0e0;
      --gt-border-dark: #555;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    #gemini-translate-card {
      position: fixed;
      z-index: 2147483647;
      width: 380px;
      max-width: 90vw;
      border-radius: 8px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 14px;
    }
    .gt-card-theme-light {
      background: var(--gt-bg-light);
      color: var(--gt-text-light);
      border: 1px solid var(--gt-border-light);
    }
    .gt-card-theme-dark {
      background: var(--gt-bg-dark);
      color: var(--gt-text-dark);
      border: 1px solid var(--gt-border-dark);
    }

    /* --- Header: Tags & Close Button --- */
    .gt-tag-container {
      position: absolute;
      top: 0;
      right: 0;
      display: flex;
      border-radius: 0 8px 0 8px;
      overflow: hidden;
    }
    .gt-engine-tag {
      padding: 4px 10px;
      font-size: 11px;
      font-weight: bold;
      color: #fff;
      text-transform: capitalize;
    }
    .gt-engine-tag.engine-google { background-color: #888; }
    .gt-engine-tag.engine-google-cloud { background-color: #5e35b1; }
    .gt-engine-tag.engine-gemini { background-color: var(--gt-primary); }
    .gt-engine-tag.model-flash { background-color: #00897b; }
    .gt-engine-tag.model-pro { background-color: #3949ab; }

    .gt-close-btn {
      position: absolute;
      top: 2px;
      left: 8px;
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      opacity: 0.5;
      padding: 0;
      line-height: 1;
    }
    .gt-card-theme-light .gt-close-btn { color: #000; }
    .gt-card-theme-dark .gt-close-btn { color: #fff; }
    .gt-close-btn:hover { opacity: 1; }

    /* --- Content & Spacing --- */
    .gt-content {
      padding: 40px 16px 16px 16px;
      line-height: 1.6;
      max-height: 60vh;
      overflow-y: auto;
    }
    .gt-content p { margin: 0; }
    .gt-original-text {
      font-weight: 600;
      color: var(--gt-primary);
      margin-bottom: 8px;
      word-wrap: break-word;
    }
    .gt-translated-text {
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .gt-error-text {
      color: #dc3545;
      font-weight: 500;
    }

    /* --- Loading Spinner --- */
    .gt-loading-spinner {
      border: 3px solid rgba(128, 128, 128, 0.25);
      border-top: 3px solid var(--gt-primary);
      border-radius: 50%;
      width: 22px;
      height: 22px;
      animation: gt-spin 0.9s linear infinite;
      margin: 12px auto 4px auto;
    }
    @keyframes gt-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* --- Footer --- */
    .gt-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      border-top: 1px solid;
    }
    .gt-card-theme-light .gt-footer { border-top-color: var(--gt-border-light); }
    .gt-card-theme-dark .gt-footer { border-top-color: var(--gt-border-dark); }
    .gt-footer-info { font-size: 12px; opacity: 0.7; }
    .gt-footer-buttons { display: flex; align-items: center; gap: 8px; }
    .gt-icon-btn, .gt-text-btn {
      background: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.2s;
      font-family: inherit;
    }
    .gt-icon-btn { border: none; padding: 4px; opacity: 0.7; }
    .gt-icon-btn:hover { opacity: 1; background-color: rgba(128,128,128,0.2); }
    .gt-icon-btn svg {
      width: 16px;
      height: 16px;
      display: block;
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .gt-card-theme-light .gt-icon-btn svg { stroke: #333; }
    .gt-card-theme-dark .gt-icon-btn svg { stroke: #eee; }
    .gt-text-btn { font-size: 12px; padding: 4px 8px; border: 1px solid; }
    .gt-card-theme-light .gt-text-btn { color: #555; border-color: #ccc; }
    .gt-card-theme-light .gt-text-btn:hover { background-color: #f0f0f0; }
    .gt-card-theme-dark .gt-text-btn { color: #ccc; border-color: #666; }
    .gt-card-theme-dark .gt-text-btn:hover { background-color: #444; }
  `;
}

async function resolveTheme() {
  const { THEME } = await browser.storage.local.get("THEME");
  return (THEME === 'auto')
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : (THEME || 'light');
}

function buildTagContainer(engine, modelName, modelLabel, uiStrings) {
  const tagContainer = document.createElement('div');
  tagContainer.className = 'gt-tag-container';

  if (engine === 'gemini' && modelName) {
    const geminiTag = document.createElement('span');
    geminiTag.className = 'gt-engine-tag engine-gemini';
    geminiTag.textContent = uiStrings.engineTagGemini;
    tagContainer.appendChild(geminiTag);

    const modelTag = document.createElement('span');
    modelTag.className = 'gt-engine-tag model-tag';
    if (modelName.includes('flash')) {
      modelTag.classList.add('model-flash');
      modelTag.textContent = modelLabel || uiStrings.modelTagFlash;
    } else if (modelName.includes('pro')) {
      modelTag.classList.add('model-pro');
      modelTag.textContent = modelLabel || uiStrings.modelTagPro;
    } else {
      modelTag.classList.add('model-flash');
      modelTag.textContent = modelLabel || modelName;
    }
    tagContainer.appendChild(modelTag);
  } else {
    const googleTag = document.createElement('span');
    if (engine === 'google-cloud') {
      googleTag.className = 'gt-engine-tag engine-google-cloud';
      googleTag.textContent = uiStrings.engineOptionGoogleCloud;
    } else {
      googleTag.className = 'gt-engine-tag engine-google';
      googleTag.textContent = uiStrings.engineOptionGoogle;
    }
    tagContainer.appendChild(googleTag);
  }
  return tagContainer;
}

function mountCardInShadowDom(card, preservePosition = false) {
  const initialLeft = (preservePosition && lastCardPosition) ? lastCardPosition.left : (window.lastMouseX || 100);
  const initialTop = (preservePosition && lastCardPosition) ? lastCardPosition.top : (window.lastMouseY || 100);

  if (currentHost) {
    currentHost.remove();
    currentHost = null;
  }

  const host = document.createElement('div');
  host.id = 'gemini-translate-host';
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = getCardStyles();
  shadow.appendChild(style);
  shadow.appendChild(card);

  card.style.left = `${initialLeft}px`;
  card.style.top = `${initialTop}px`;

  document.body.appendChild(host);
  currentHost = host;

  const rect = card.getBoundingClientRect();
  let finalLeft = initialLeft;
  let finalTop = initialTop;
  if (rect.right > window.innerWidth) {
    finalLeft = Math.max(10, window.innerWidth - rect.width - 20);
    card.style.left = `${finalLeft}px`;
  }
  if (rect.bottom > window.innerHeight) {
    finalTop = Math.max(10, window.innerHeight - rect.height - 20);
    card.style.top = `${finalTop}px`;
  }
  lastCardPosition = { left: finalLeft, top: finalTop };

  setTimeout(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
  }, 0);
}

async function createLoadingCard(data) {
  const { originalText, engine, modelName, modelLabel, uiStrings } = data;
  const theme = await resolveTheme();

  const card = document.createElement('div');
  card.id = 'gemini-translate-card';
  card.className = `gt-card-theme-${theme}`;

  card.appendChild(buildTagContainer(engine, modelName, modelLabel, uiStrings));

  const closeBtn = document.createElement('button');
  closeBtn.id = 'gt-close-btn';
  closeBtn.className = 'gt-close-btn';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', closeCard);
  card.appendChild(closeBtn);

  const contentDiv = document.createElement('div');
  contentDiv.className = 'gt-content';
  const originalP = document.createElement('p');
  originalP.className = 'gt-original-text';
  originalP.textContent = originalText;
  const spinner = document.createElement('div');
  spinner.className = 'gt-loading-spinner';

  contentDiv.appendChild(originalP);
  contentDiv.appendChild(spinner);
  card.appendChild(contentDiv);

  mountCardInShadowDom(card, false);
}

async function createTranslationCard(data) {
  const {
    originalText, translatedText, engine, modelName, modelLabel,
    sourceLangCode, sourceLangName, targetLangCode, uiStrings
  } = data;

  const theme = await resolveTheme();

  const card = document.createElement('div');
  card.id = 'gemini-translate-card';
  card.className = `gt-card-theme-${theme}`;

  card.appendChild(buildTagContainer(engine, modelName, modelLabel, uiStrings));

  // Close Button
  const closeBtn = document.createElement('button');
  closeBtn.id = 'gt-close-btn';
  closeBtn.className = 'gt-close-btn';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', closeCard);
  card.appendChild(closeBtn);

  // Content Area
  const contentDiv = document.createElement('div');
  contentDiv.className = 'gt-content';
  const originalP = document.createElement('p');
  originalP.className = 'gt-original-text';
  originalP.textContent = originalText;
  const translatedP = document.createElement('p');
  translatedP.className = 'gt-translated-text';

  translatedText.split('__NEWLINE__').forEach((part, index, arr) => {
    translatedP.appendChild(document.createTextNode(part));
    if (index < arr.length - 1) {
      translatedP.appendChild(document.createElement('br'));
    }
  });
  contentDiv.appendChild(originalP);
  contentDiv.appendChild(translatedP);
  card.appendChild(contentDiv);

  // Footer Area
  const footerDiv = document.createElement('div');
  footerDiv.className = 'gt-footer';
  const footerInfo = document.createElement('div');
  footerInfo.className = 'gt-footer-info';
  if (sourceLangName) {
    const sourceLangSpan = document.createElement('span');
    sourceLangSpan.className = 'gt-source-lang';
    sourceLangSpan.textContent = `${uiStrings.sourceLanguageLabel}${sourceLangName}`;
    footerInfo.appendChild(sourceLangSpan);
  }
  const footerButtons = document.createElement('div');
  footerButtons.className = 'gt-footer-buttons';

  const listenOriginalBtn = document.createElement('button');
  listenOriginalBtn.className = 'gt-icon-btn';
  listenOriginalBtn.id = 'gt-listen-original-btn';
  listenOriginalBtn.title = uiStrings.listenOriginalButtonTooltip;
  listenOriginalBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;

  const listenTranslatedBtn = document.createElement('button');
  listenTranslatedBtn.className = 'gt-icon-btn';
  listenTranslatedBtn.id = 'gt-listen-translated-btn';
  listenTranslatedBtn.title = uiStrings.listenButtonTooltip;
  listenTranslatedBtn.innerHTML = `<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;

  const copyOriginalBtn = document.createElement('button');
  copyOriginalBtn.className = 'gt-text-btn';
  copyOriginalBtn.id = 'gt-copy-original-btn';
  copyOriginalBtn.textContent = uiStrings.copyOriginal;

  const copyTranslatedBtn = document.createElement('button');
  copyTranslatedBtn.className = 'gt-text-btn';
  copyTranslatedBtn.id = 'gt-copy-translated-btn';
  copyTranslatedBtn.textContent = uiStrings.copyTranslated;

  footerButtons.appendChild(listenOriginalBtn);
  footerButtons.appendChild(listenTranslatedBtn);
  footerButtons.appendChild(copyOriginalBtn);
  footerButtons.appendChild(copyTranslatedBtn);
  footerDiv.appendChild(footerInfo);
  footerDiv.appendChild(footerButtons);
  card.appendChild(footerDiv);

  if (!sourceLangCode || sourceLangCode === 'und') {
    listenOriginalBtn.style.display = 'none';
  } else {
    listenOriginalBtn.addEventListener('click', () => {
      browser.runtime.sendMessage({ type: 'playTTS', text: originalText, langCode: sourceLangCode });
    });
  }

  listenTranslatedBtn.addEventListener('click', () => {
    browser.runtime.sendMessage({ type: 'playTTS', text: translatedText.replace(/__NEWLINE__/g, ' '), langCode: targetLangCode });
  });

  copyOriginalBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(originalText).then(() => {
      copyOriginalBtn.textContent = uiStrings.copied;
      setTimeout(() => { copyOriginalBtn.textContent = uiStrings.copyOriginal; }, 1500);
    });
  });

  copyTranslatedBtn.addEventListener('click', () => {
    const textToCopy = translatedText.replace(/__NEWLINE__/g, '\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      copyTranslatedBtn.textContent = uiStrings.copied;
      setTimeout(() => { copyTranslatedBtn.textContent = uiStrings.copyTranslated; }, 1500);
    });
  });

  mountCardInShadowDom(card, Boolean(currentHost));
}

async function showErrorCard(errorText) {
  if (currentHost && currentHost.shadowRoot) {
    const contentDiv = currentHost.shadowRoot.querySelector('.gt-content');
    const spinner = currentHost.shadowRoot.querySelector('.gt-loading-spinner');
    if (contentDiv && spinner) {
      spinner.remove();
      const errP = document.createElement('p');
      errP.className = 'gt-error-text';
      errP.textContent = errorText;
      contentDiv.appendChild(errP);
      return;
    }
  }
  alert(errorText);
}

browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'showLoadingCard') {
    createLoadingCard(message.data);
  } else if (message.type === 'showTranslationCard') {
    createTranslationCard(message.data);
  } else if (message.type === 'showError') {
    showErrorCard(message.text);
  } else if (message.type === 'getSelectedText') {
    return Promise.resolve({ selectedText: window.getSelection()?.toString() || '' });
  }
});
