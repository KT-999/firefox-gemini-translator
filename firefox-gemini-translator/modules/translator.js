// modules/translator.js
// 這個模組封裝了呼叫外部翻譯 API 的核心邏輯。

import { LANG_NAME_TO_CODE_MAP, containsCjk } from './languages.js';

export { containsCjk };

export function formatDuration(durationMs) {
    if (durationMs === undefined || durationMs === null || isNaN(durationMs)) return '';
    if (durationMs < 1000) {
        return `${Math.round(durationMs)}ms`;
    }
    return `${(durationMs / 1000).toFixed(2)}s`;
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
    const startTime = performance.now();
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
    const durationMs = Math.round(performance.now() - startTime);
    return {
        translatedText: String(translatedText),
        durationMs
    };
}

export async function translateWithGoogleCloud(text, targetLang, apiKey) {
    const startTime = performance.now();
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
    const durationMs = Math.round(performance.now() - startTime);
    return {
        translatedText: String(translatedText),
        durationMs
    };
}

/**
 * 將舊版、已停用或高負載逾時的 Gemini 模型名稱自動轉為最新極速可用模型。
 * @param {string} modelName
 * @returns {string}
 */
export function resolveGeminiModelName(modelName) {
    let resolved = modelName || 'gemini-3.5-flash';
    if (resolved.includes('1.5') || resolved.includes('2.0') || resolved.includes('2.5')) {
        console.warn(`舊版 Gemini 模型已停用，改用 gemini-3.5-flash: ${resolved}`);
        resolved = 'gemini-3.5-flash';
    } else if (resolved === 'gemini-3.7-flash' || resolved === 'gemini-3-flash-preview') {
        console.warn(`${resolved} 已停用/過期，改用 gemini-3.5-flash`);
        resolved = 'gemini-3.5-flash';
    } else if (resolved === 'gemini-3-pro-preview') {
        console.warn(`gemini-3-pro-preview 已停用，改用 gemini-3.8-pro`);
        resolved = 'gemini-3.8-pro';
    } else if (resolved === 'gemini-3.1-flash-lite-preview') {
        resolved = 'gemini-3.1-flash-lite';
    }
    return resolved;
}

/**
 * 【效能最佳化】使用 Gemini API 進行翻譯：
 * 針對 Gemini 3.5 系列使用 thinkingLevel: "minimal"（~0.8 秒極速回應）；
 * 針對 Gemini 4 系列使用 thinkingBudget: 0（避免 MINIMAL 拋出 400 錯誤）；
 * 遇到 503 / 429 尖峰擁塞時自動平滑切換至 gemini-3.5-flash，避免 25 秒重試空轉。
 */
export async function translateWithGemini(text, targetLang, apiKey, modelName, i18n_t) {
    const startTime = performance.now();
    let currentModel = resolveGeminiModelName(modelName);
    const systemInstructionText = `You are a professional real-time translation engine. Translate the user's input text into ${targetLang}. Rules: 1. Output ONLY the translation directly without any explanation, preamble, notes, or internal thinking steps. 2. If the input is a single vocabulary word with multiple common meanings, list them separated by '、' or ', '. 3. If the input is a sentence, phrase, or paragraph, provide the most fluent and natural single translation. 4. Do NOT wrap the output in quotes or Markdown formatting.`;
    const prompt = i18n_t ? i18n_t("promptSystem", [targetLang, text]) : text;

    const buildConfig = (model) => {
        // Gemini 4 旗艦推理系列：不支援 "minimal"，直接指定 thinkingBudget: 0 關閉思考以提速
        if (model.startsWith('gemini-4-')) {
            return { thinkingBudget: 0 };
        }
        // Gemini 3.5 / 3.1 等系列：支援 thinkingLevel: "minimal"，極速秒出（< 1秒）
        if (model.includes('3.5') || model.includes('3.1') || model.includes('flash-lite')) {
            return { thinkingLevel: 'minimal' };
        }
        return { thinkingBudget: 0 };
    };

    const maxAttempts = 3;
    let data = null;
    let fallbackLevel = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const apiVersion = (currentModel === 'gemini-pro') ? 'v1' : 'v1beta';
        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${currentModel}:generateContent`;

        const requestBody = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: 8192,
                temperature: 0.1,
                thinkingConfig: buildConfig(currentModel)
            }
        };
        if (apiVersion === 'v1beta') {
            requestBody.systemInstruction = { parts: [{ text: systemInstructionText }] };
        }

        let response;
        try {
            response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-goog-api-key": apiKey
                },
                body: JSON.stringify(requestBody)
            });
        } catch (fetchErr) {
            console.warn(`Gemini 請求連線失敗:`, fetchErr);
            if (currentModel !== 'gemini-3.5-flash' && attempt < maxAttempts - 1) {
                console.warn(`切換至極速穩定模型 gemini-3.5-flash 重試...`);
                currentModel = 'gemini-3.5-flash';
                continue;
            }
            throw new Error(`網路連線錯誤: ${fetchErr.message}`);
        }

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

        const errorMsg = (errorBody?.error?.message || '').toLowerCase();
        const errorStatus = errorBody?.error?.status || '';

        // 精準判斷是否為無效的 API Key
        const isInvalidKey =
            response.status === 403 ||
            (response.status === 400 && (
                errorMsg.includes('api key') ||
                errorMsg.includes('api_key') ||
                errorStatus === 'INVALID_ARGUMENT' && JSON.stringify(errorBody).includes('API_KEY_INVALID')
            ));

        if (isInvalidKey) {
            throw new Error('Invalid API Key');
        }

        // 若模型對 thinkingConfig 拋出 400，平滑動態降級相容
        if (response.status === 400 && (errorMsg.includes('thinking') || errorMsg.includes('budget') || errorMsg.includes('level'))) {
            if (fallbackLevel === 0) {
                requestBody.generationConfig.thinkingConfig = { thinkingBudget: 0 };
                fallbackLevel = 1;
                attempt -= 1;
                continue;
            } else if (fallbackLevel === 1) {
                delete requestBody.generationConfig.thinkingConfig;
                fallbackLevel = 2;
                attempt -= 1;
                continue;
            }
        }

        // 遇高負載 503 或限流 429 時，直接平滑切換至超低負載極速的 gemini-3.5-flash，避免等待 20 幾秒
        if ((response.status === 503 || response.status === 429) && currentModel !== 'gemini-3.5-flash') {
            console.warn(`模型 ${currentModel} 回應 ${response.status}（負載過高），立即平滑切換至 gemini-3.5-flash...`);
            currentModel = 'gemini-3.5-flash';
            continue;
        }

        if ([429, 500, 503].includes(response.status) && attempt < maxAttempts - 1) {
            const delayMs = 300 * (2 ** attempt);
            console.warn(`Gemini API ${response.status}，${delayMs}ms 後重試...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
        }

        console.error("Gemini API Error Response:", {
            status: response.status,
            modelName: currentModel,
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

    const durationMs = Math.round(performance.now() - startTime);
    return {
        translatedText: String(translatedText),
        durationMs
    };
}
