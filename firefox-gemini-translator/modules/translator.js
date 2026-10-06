// modules/translator.js
// 這個模組封裝了呼叫外部翻譯 API 的核心邏輯。

import { LANG_NAME_TO_CODE_MAP, containsCjk } from './languages.js';

export { containsCjk };

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
    const tl = LANG_NAME_TO_CODE_MAP[targetLang] || "zh-TW";
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

export async function translateWithGoogleCloud(text, targetLang, apiKey) {
    const target = LANG_NAME_TO_CODE_MAP[targetLang] || "zh-TW";
    const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            q: text,
            target,
            format: "text"
        })
    });

    if (!response.ok) {
        if (response.status === 400 || response.status === 403) {
            throw new Error("Invalid Google Cloud API Key");
        }
        throw new Error(`Google Cloud API 錯誤: ${response.status}`);
    }

    const data = await response.json();
    const translatedText = data?.data?.translations?.[0]?.translatedText?.trim();
    if (!translatedText) {
        throw new Error("從 Google Cloud 未收到翻譯結果");
    }
    return translatedText;
}

/**
 * 將舊版或已停用的 Gemini 模型名稱自動轉為最新可用模型。
 * @param {string} modelName
 * @returns {string}
 */
export function resolveGeminiModelName(modelName) {
    let resolved = modelName || 'gemini-3.8-flash';
    if (resolved.includes('1.5') || resolved.includes('2.0')) {
        console.warn(`舊版 Gemini 模型已停用，改用 gemini-3.8-flash: ${resolved}`);
        resolved = 'gemini-3.8-flash';
    } else if (resolved === 'gemini-3-pro-preview') {
        console.warn(`gemini-3-pro-preview 已停用，改用 gemini-3.1-pro-preview`);
        resolved = 'gemini-3.1-pro-preview';
    } else if (resolved === 'gemini-3.1-flash-lite-preview') {
        resolved = 'gemini-3.1-flash-lite';
    }
    return resolved;
}

/**
 * 【最終修正】使用 Gemini API 進行翻譯，將 API 金鑰放入 Header 中，並使用 systemInstruction 隔離系統提示詞與原文。
 */
export async function translateWithGemini(text, targetLang, apiKey, modelName, i18n_t) {
    const resolvedModelName = resolveGeminiModelName(modelName);
    const apiVersion = (resolvedModelName === 'gemini-pro') ? 'v1' : 'v1beta';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/${apiVersion}/models/${resolvedModelName}:generateContent`;

    // 使用 i18n 產生完整提示詞作為 fallback，同時透過 systemInstruction 強化指令遵循與防止 Prompt Injection
    const prompt = i18n_t ? i18n_t("promptSystem", [targetLang, text]) : text;
    const systemInstructionText = `You are a professional translation engine. Translate the user's input text into ${targetLang}. Rules: 1. Output ONLY the translation without any explanation, preamble, or notes. 2. If the input is a single vocabulary word with multiple common meanings, list them separated by '、' or ', '. 3. If the input is a sentence, phrase, or paragraph, provide the most fluent and natural single translation. 4. Do NOT wrap the output in quotes or Markdown formatting.`;

    const shouldRetry = (status) => [429, 500, 503].includes(status);
    const maxAttempts = 3;
    let data;

    const requestBody = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.1 }
    };
    if (apiVersion === 'v1beta') {
        requestBody.systemInstruction = { parts: [{ text: systemInstructionText }] };
    }

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const response = await fetch(GEMINI_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-goog-api-key": apiKey
            },
            body: JSON.stringify(requestBody)
        });

        if (response.ok) {
            data = await response.json();
            break;
        }

        let errorBody = null;
        try {
            errorBody = await response.json();
        } catch (e) {
            errorBody = null;
        }

        // 精準判斷是否為無效的 API Key (HTTP 403 或 Google API_KEY_INVALID 錯誤原因)
        const errorMessage = errorBody?.error?.message || '';
        const errorStatus = errorBody?.error?.status || '';
        const isInvalidKey =
            response.status === 403 ||
            (response.status === 400 && (
                errorMessage.toLowerCase().includes('api key') ||
                errorMessage.toLowerCase().includes('api_key') ||
                errorStatus === 'INVALID_ARGUMENT' && JSON.stringify(errorBody).includes('API_KEY_INVALID')
            ));

        if (isInvalidKey) {
            throw new Error('Invalid API Key');
        }

        if (shouldRetry(response.status) && attempt < maxAttempts - 1) {
            const delayMs = 500 * (2 ** attempt);
            console.warn(`Gemini API ${response.status}，${delayMs}ms 後重試...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
        }

        console.error("Gemini API Error Response:", {
            status: response.status,
            apiVersion,
            modelName: resolvedModelName,
            errorBody
        });
        throw new Error(`API 網路錯誤: ${response.status}`);
    }

    if (!data) {
        throw new Error("從 Gemini 未收到翻譯結果");
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const translatedText = parts
        .filter(part => !part.thought && typeof part.text === 'string')
        .map(part => part.text)
        .join('')
        .trim();

    if (!translatedText) {
        throw new Error("從 Gemini 未收到翻譯結果");
    }
    return translatedText;
}
