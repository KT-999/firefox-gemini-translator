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
  // 使用 W3C 建議的亮度計算公式
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// 監聽從 background script 傳來的訊息
browser.runtime.onMessage.addListener(async (message) => {
  if (message.type === 'showTranslation') {
    // 如果已有 popup，先移除
    if (currentPopup) {
      currentPopup.remove();
      currentPopup = null;
    }

    // 從儲存空間取得主題設定
    const { THEME, CUSTOM_BG, CUSTOM_TEXT } = await browser.storage.local.get([
      "THEME", "CUSTOM_BG", "CUSTOM_TEXT"
    ]);

    // 根據主題設定顏色
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
      // 自動判斷文字顏色以確保對比度
      textColor = CUSTOM_TEXT || (getBrightness(bgColor) > 0.6 ? '#000000' : '#ffffff');
      buttonBgColor = getBrightness(bgColor) > 0.6 ? '#f1f1f1' : '#444444';
      buttonTextColor = textColor;
    }

    // --- 建立新的 Popup 結構 ---

    // 1. 建立最外層的容器
    const popupContainer = document.createElement('div');
    popupContainer.style.position = 'fixed';
    popupContainer.style.left = (window.lastMouseX || 100) + 'px';
    popupContainer.style.top = (window.lastMouseY || 100) + 'px';
    popupContainer.style.zIndex = '2147483647'; // 盡可能設高一點
    popupContainer.style.background = bgColor;
    popupContainer.style.color = textColor;
    popupContainer.style.border = `1px solid ${borderColor}`;
    popupContainer.style.borderRadius = '8px';
    popupContainer.style.boxShadow = `0 4px 12px ${shadowColor}`;
    popupContainer.style.maxWidth = '350px';
    popupContainer.style.fontFamily = 'Arial, sans-serif';
    popupContainer.style.fontSize = '14px';
    popupContainer.style.display = 'flex';
    popupContainer.style.flexDirection = 'column';

    // 2. 建立內容區域
    const contentDiv = document.createElement('div');
    contentDiv.textContent = message.text.trim();
    contentDiv.style.padding = '12px 16px';
    contentDiv.style.wordBreak = 'break-word';
    contentDiv.style.lineHeight = '1.5';

    // 3. 建立頁腳 (包含按鈕)
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.padding = '4px 8px';
    footer.style.borderTop = `1px solid ${borderColor}`;
    footer.style.gap = '8px';

    // 4. 建立複製按鈕
    const copyButton = document.createElement('button');
    copyButton.textContent = '複製';
    // 按鈕通用樣式
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
      e.stopPropagation(); // 防止事件冒泡
      navigator.clipboard.writeText(contentDiv.textContent).then(() => {
        copyButton.textContent = '已複製!';
        setTimeout(() => {
          copyButton.textContent = '複製';
        }, 1500);
      }).catch(err => {
        console.error('複製失敗: ', err);
        copyButton.textContent = '複製失敗';
      });
    };

    // 5. 建立關閉按鈕
    const closeButton = document.createElement('button');
    closeButton.textContent = '關閉';
    Object.assign(closeButton.style, buttonStyles);

    // --- 組合 Popup ---
    footer.appendChild(copyButton);
    footer.appendChild(closeButton);
    popupContainer.appendChild(contentDiv);
    popupContainer.appendChild(footer);

    // 將 Popup 加入頁面並儲存參考
    document.body.appendChild(popupContainer);
    currentPopup = popupContainer;

    // --- 新增：處理關閉邏輯 ---

    // 負責移除 popup 和事件監聽器
    const closePopup = () => {
        if (currentPopup) {
            currentPopup.remove();
            currentPopup = null;
        }
        document.removeEventListener('mousedown', handleClickOutside);
    };

    // 處理點擊 popup 外部的事件
    const handleClickOutside = (event) => {
        // 如果點擊的目標不在 popup 內部，則關閉
        if (currentPopup && !currentPopup.contains(event.target)) {
            closePopup();
        }
    };

    // 關閉按鈕的點擊事件
    closeButton.onclick = (e) => {
        e.stopPropagation(); // 防止觸發 handleClickOutside
        closePopup();
    };

    // 使用 setTimeout 來確保當前的點擊事件（觸發翻譯的事件）不會馬上被捕捉到
    setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
    }, 0);
  }
});
