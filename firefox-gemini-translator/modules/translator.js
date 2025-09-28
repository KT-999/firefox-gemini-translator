// modules/translator.js
// 這個模組封裝了呼叫外部翻譯 API 的核心邏輯。

export function containsCjk(text) {
    const cjkRegex = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf\uac00-\ud7af]/;
    return cjkRegex.test(text);
}

export function decideEngine(text) {
    let useGoogleTranslate = false;
    if (containsCjk(text)) {
        useGoogleTranslate = text.length <= 5;
    } else {
        const wordCount = text.split(/\s+/).length;
        const characterCount = text.length;
        useGoogleTranslate = wordCount <= 3 && characterCount < 30;
    }
    return useGoogleTranslate ? 'google' : 'gemini';
}

export async function translateWithGoogle(text, targetLang) {
    const langCodeMap = { "繁體中文": "zh-TW", "簡體中文": "zh-CN", "英文": "en", "日文": "ja", "韓文": "ko", "法文": "fr", "德文": "de", "西班牙文": "es", "俄文": "ru", "印地文": "hi", "阿拉伯文": "ar", "孟加拉文": "bn", "葡萄牙文": "pt", "印尼文": "id" };
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
    translatedText = Object.entries(allDefinitions).map(([pos, defSet]) => `${pos}: ${[...defSet].join(', ')}`).join('\n');
    if (!translatedText && data[0] && Array.isArray(data[0])) {
        translatedText = data[0].map(item => item[0]).join('');
    }

    if (!translatedText) throw new Error("從 Google 未收到翻譯結果");
    return translatedText;
}

/**
 * 【最終修正】使用 Gemini API 進行翻譯，將 API 金鑰放入 Header 中。
 */
export async function translateWithGemini(text, targetLang, apiKey, modelName, i18n_t) {
    // 只有穩定的 'gemini-pro' 使用 v1，其餘（包含 1.5 和 2.0 系列）都使用 v1beta
    const apiVersion = (modelName === 'gemini-pro') ? 'v1' : 'v1beta';
    // 【修正】移除 URL 中的 API Key
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent`;
    
    const prompt = i18n_t("promptSystem", [targetLang, text]);

    const response = await fetch(GEMINI_API_URL, {
        method: "POST",
        // 【修正】將 API Key 加入到 Header 中
        headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": apiKey
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1024, temperature: 0.1 }
        })
    });

    if (!response.ok) {
        if (response.status === 400) throw new Error('Invalid API Key');
        const errorBody = await response.json();
        console.error("Gemini API Error Response:", errorBody);
        throw new Error(`API 網路錯誤: ${response.status}`);
    }

    const data = await response.json();
    const translatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!translatedText) {
        throw new Error("從 Gemini 未收到翻譯結果");
    }
    return translatedText;
}