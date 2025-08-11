// 儲存目前的 popup 參考
let currentPopup = null;

// 監聽滑鼠移動，以便知道在哪裡顯示 popup
document.addEventListener('mousemove', (e) => {
  window.lastMouseX = e.clientX;
  window.lastMouseY = e.clientY;
});

/**
 * 根據十六進位色碼計算其亮度。
 * @param {string} hex - 十六進位色碼 (e.g., '#fff', '#222222')
 * @returns {number} - 亮度值 (0 到 1 之間)。
 */
function getBrightness(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// 監聽從 background script 傳來的訊息
browser.runtime.onMessage.addListener(async (message) => {
  if (message.type === 'showTranslation') {
    if (currentPopup) {
      currentPopup.remove();
      currentPopup = null;
    }

    const { text, engine, ui } = message;

    const { THEME, CUSTOM_BG, CUSTOM_TEXT } = await browser.storage.local.get([
      "THEME", "CUSTOM_BG", "CUSTOM_TEXT"
    ]);

    const theme = THEME || 'light';
    let bgColor = '#ffffff';
    let textColor = '#000000';
    let shadowColor = 'rgba(0,0,0,0.2)';
    let borderColor = '#cccccc';
    let buttonBgColor = '#f1f1f1';
    let buttonTextColor = '#333333';

    if (theme === 'dark') {
      bgColor = '#2d2d2d';
      textColor = '#eeeeee';
      shadowColor = 'rgba(0,0,0,0.5)';
      borderColor = '#555555';
      buttonBgColor = '#444444';
      buttonTextColor = '#eeeeee';
    } else if (theme === 'custom') {
      bgColor = CUSTOM_BG || '#ffffff';
      textColor = CUSTOM_TEXT || (getBrightness(bgColor) > 0.6 ? '#000000' : '#ffffff');
      buttonBgColor = getBrightness(bgColor) > 0.6 ? '#f1f1f1' : '#444444';
      buttonTextColor = textColor;
      borderColor = getBrightness(bgColor) > 0.6 ? '#cccccc' : '#555555';
    }

    if (engine === 'gemini') {
        borderColor = '#4285F4';
    }

    const popupContainer = document.createElement('div');
    popupContainer.style.position = 'fixed';
    popupContainer.style.left = (window.lastMouseX || 100) + 'px';
    popupContainer.style.top = (window.lastMouseY || 100) + 'px';
    popupContainer.style.zIndex = '2147483647';
    popupContainer.style.background = bgColor;
    popupContainer.style.color = textColor;
    popupContainer.style.border = `${engine === 'gemini' ? '2px' : '1px'} solid ${borderColor}`;
    popupContainer.style.borderRadius = '8px';
    popupContainer.style.boxShadow = `0 4px 12px ${shadowColor}`;
    popupContainer.style.maxWidth = '350px';
    popupContainer.style.fontFamily = 'Arial, sans-serif';
    popupContainer.style.fontSize = '14px';
    popupContainer.style.display = 'flex';
    popupContainer.style.flexDirection = 'column';

    const contentDiv = document.createElement('div');
    contentDiv.style.padding = '12px 16px';
    contentDiv.style.wordBreak = 'break-word';
    contentDiv.style.lineHeight = '1.6';

    const parts = text.trim().split('__NEWLINE__');
    contentDiv.innerHTML = '';
    parts.forEach((part, index) => {
        contentDiv.appendChild(document.createTextNode(part));
        if (index < parts.length - 1) {
            contentDiv.appendChild(document.createElement('br'));
        }
    });

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.padding = '4px 8px';
    footer.style.borderTop = `1px solid ${borderColor}`;
    footer.style.gap = '8px';

    const copyButton = document.createElement('button');
    copyButton.textContent = ui.copy || 'Copy'; // 使用從 background 傳來的字串
    const buttonStyles = {
        background: buttonBgColor,
        color: buttonTextColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '4px',
        padding: '4px 8px',
        cursor: 'pointer',
        fontSize: '12px'
    };
    Object.assign(copyButton.style, buttonStyles);

    copyButton.onclick = (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(contentDiv.innerText).then(() => {
        copyButton.textContent = ui.copied || 'Copied!'; // 使用從 background 傳來的字串
        setTimeout(() => { copyButton.textContent = ui.copy || 'Copy'; }, 1500);
      });
    };

    const closeButton = document.createElement('button');
    closeButton.textContent = ui.close || 'Close'; // 使用從 background 傳來的字串
    Object.assign(closeButton.style, buttonStyles);

    footer.appendChild(copyButton);
    footer.appendChild(closeButton);
    popupContainer.appendChild(contentDiv);
    popupContainer.appendChild(footer);

    document.body.appendChild(popupContainer);
    currentPopup = popupContainer;

    const closePopup = () => {
        if (currentPopup) {
            currentPopup.remove();
            currentPopup = null;
        }
        document.removeEventListener('mousedown', handleClickOutside);
    };

    const handleClickOutside = (event) => {
        if (currentPopup && !currentPopup.contains(event.target)) {
            closePopup();
        }
    };

    closeButton.onclick = (e) => {
        e.stopPropagation();
        closePopup();
    };

    setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
    }, 0);
  }
});
