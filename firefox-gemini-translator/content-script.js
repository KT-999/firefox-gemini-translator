let currentPopup = null;

document.addEventListener('mousemove', (e) => {
  window.lastMouseX = e.clientX;
  window.lastMouseY = e.clientY;
});

function getBrightness(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

browser.runtime.onMessage.addListener(async (message) => {
  if (message.type === 'showTranslation') {
    if (currentPopup) {
      currentPopup.remove();
      currentPopup = null;
    }

    const { THEME, CUSTOM_BG, CUSTOM_TEXT } = await browser.storage.local.get([
      "THEME", "CUSTOM_BG", "CUSTOM_TEXT"
    ]);

    const theme = THEME || 'light';
    let bgColor = '#fff';
    let textColor = '#000';

    if (theme === 'dark') {
      bgColor = '#222';
      textColor = '#eee';
    } else if (theme === 'custom') {
      bgColor = CUSTOM_BG || '#fff';
      textColor = CUSTOM_TEXT || (getBrightness(bgColor) > 0.7 ? '#000' : '#fff');
    }

    const popupDiv = document.createElement('div');
    popupDiv.textContent = message.text.trim();
    popupDiv.style.position = 'fixed';
    popupDiv.style.left = (window.lastMouseX || 100) + 'px';
    popupDiv.style.top = (window.lastMouseY || 100) + 'px';
    popupDiv.style.zIndex = 9999;
    popupDiv.style.background = bgColor;
    popupDiv.style.color = textColor;
    popupDiv.style.padding = '8px 12px';
    popupDiv.style.border = '1px solid #ccc';
    popupDiv.style.borderRadius = '4px';
    popupDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    popupDiv.style.maxWidth = '300px';
    popupDiv.style.wordBreak = 'break-word';

    document.body.appendChild(popupDiv);
    currentPopup = popupDiv;

    const closeOnClick = () => {
      if (currentPopup) {
        currentPopup.remove();
        currentPopup = null;
      }
      document.removeEventListener('mousedown', closeOnClick);
    };
    setTimeout(() => {
      document.addEventListener('mousedown', closeOnClick);
    }, 0);
  }
});
