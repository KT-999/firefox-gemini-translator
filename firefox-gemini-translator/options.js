function applyTheme(theme) {
  document.body.classList.remove('light', 'dark');
  document.body.classList.add(theme);
  if (theme === 'dark') {
    document.body.style.setProperty('--card-bg', '#333');
  } else {
    document.body.style.setProperty('--card-bg', '#fff');
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const apiKeyInput = document.getElementById("apiKey");
  const langSelect = document.getElementById("lang");
  const themeSelect = document.getElementById("theme");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");

  const { GEMINI_API_KEY, TRANSLATE_LANG, THEME } =
    await browser.storage.local.get([
      "GEMINI_API_KEY", "TRANSLATE_LANG", "THEME"
    ]);

  if (GEMINI_API_KEY) apiKeyInput.value = GEMINI_API_KEY;
  if (TRANSLATE_LANG) langSelect.value = TRANSLATE_LANG;
  if (THEME) themeSelect.value = THEME;

  const updateTheme = () => {
    applyTheme(themeSelect.value);
  };

  themeSelect.onchange = updateTheme;

  saveBtn.onclick = async () => {
    await browser.storage.local.set({
      GEMINI_API_KEY: apiKeyInput.value.trim(),
      TRANSLATE_LANG: langSelect.value,
      THEME: themeSelect.value
    });
    status.textContent = "✅ 設定已儲存";
    setTimeout(() => { status.textContent = ''; }, 2000);
  };

  updateTheme();
});
