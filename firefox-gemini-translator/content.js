// 儲存目前的 popup
let currentPopup = null;

browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'showTranslation') {
    const { text, x, y } = message;

    // 如果已有顯示，先刪除
    if (currentPopup) {
      currentPopup.remove();
      currentPopup = null;
    }

    // 建立 popup
    const popupDiv = document.createElement('div');
    popupDiv.textContent = text.trim();
    popupDiv.style.position = 'fixed';
    popupDiv.style.left = x + 'px';
    popupDiv.style.top = y + 'px';
    popupDiv.style.zIndex = 9999;
    popupDiv.style.background = '#fff';
    popupDiv.style.color = '#000';
    popupDiv.style.padding = '8px 12px';
    popupDiv.style.border = '1px solid #ccc';
    popupDiv.style.borderRadius = '4px';
    popupDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    popupDiv.style.maxWidth = '300px';
    popupDiv.style.wordBreak = 'break-word';

    document.body.appendChild(popupDiv);
    currentPopup = popupDiv;

    // 點擊任意位置關閉
    const closeOnClick = (e) => {
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
