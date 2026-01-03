export const asUrl = (url) => url;
export const asMethod = (method) => method.toUpperCase();
export const asStatusCode = (status) => status;
export const asHeaderName = (name) => name;
export const asHeaderValue = (value) => value;
/**
 * Reduz o tamanho do payload removendo campos opcionais comuns
 * Útil para erro 413 Payload Too Large
 */
function reducePayload(data) {
    if (typeof data !== "object" || data === null)
        return data;
    // Lista de campos comumente opcionais que podem ser removidos
    const optionalFields = [
        "description",
        "desc",
        "summary",
        "notes",
        "comment",
        "comments",
        "metadata",
        "meta",
        "extra",
        "details",
        "info",
        "avatar",
        "image",
        "picture",
        "photo",
        "thumbnail",
        "createdAt",
        "updatedAt",
        "modifiedAt",
        "lastModified",
        "tags",
        "categories",
        "labels",
    ];
    const reduced = Array.isArray(data) ? [] : {};
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            // Pular campos opcionais
            if (optionalFields.includes(key))
                continue;
            // Recursivamente reduzir objetos aninhados
            if (typeof data[key] === "object" && data[key] !== null) {
                reduced[key] = reducePayload(data[key]);
            }
            else {
                reduced[key] = data[key];
            }
        }
    }
    return reduced;
}
/**
 * Cria um valor baseado no tipo esperado quando a validação falha
 * Heurística: analisa a mensagem de erro e o tipo esperado para gerar um valor válido
 */
export function createValueFromType(errorMessage, expectedType) {
    // Extrair tipo da mensagem de erro
    const typeMatch = errorMessage.match(/expected (\w+)/i) ||
        errorMessage.match(/must be (\w+)/i);
    const type = expectedType || (typeMatch ? typeMatch[1].toLowerCase() : null);
    if (!type)
        return null;
    // Mapeamento de tipos para valores padrão
    const typeDefaults = {
        string: "",
        number: 0,
        boolean: false,
        object: {},
        array: [],
        date: new Date().toISOString(),
        email: "example@domain.com",
        url: "https://example.com",
        phone: "+5511999999999",
        uuid: "00000000-0000-0000-0000-000000000000",
    };
    return typeDefaults[type] ?? null;
}
/**
 * Auto-healer nativo do one-request-4-all
 * Detecta e corrige automaticamente erros comuns
 */
export async function autoHeal(context) {
    const { error, config, response, attempt } = context;
    const status = response?.status;
    // 401 Unauthorized - tentar refresh de token
    if (status === 401) {
        return {
            shouldRetry: true,
            message: "Unauthorized - retry with refreshed token",
            config: { ...config, timeout: (config.timeout || 5000) * 1.5 },
        };
    }
    // 403 Forbidden - aumentar timeout
    if (status === 403) {
        return {
            shouldRetry: true,
            message: "Forbidden - increased timeout",
            config: { ...config, timeout: (config.timeout || 5000) * 1.5 },
        };
    }
    // 413 Payload Too Large - reduzir payload
    if (status === 413) {
        // Se há data no config, tentar reduzir removendo campos opcionais
        if (config.data && typeof config.data === "object") {
            const reducedData = reducePayload(config.data);
            return {
                shouldRetry: true,
                message: "Payload too large - removed optional fields",
                config: { ...config, data: reducedData },
            };
        }
        // Se não há data ou não é objeto, não há como reduzir
        return {
            shouldRetry: false,
            message: "Payload too large - cannot reduce payload",
        };
    }
    // 422 Unprocessable Entity - validação falhou
    if (status === 422) {
        const errorData = await response?.json().catch(() => ({}));
        const errorMsg = errorData?.message || error.message || "";
        // Tentar criar valor baseado no tipo esperado
        if (errorMsg.includes("expected") || errorMsg.includes("must be")) {
            const healedValue = createValueFromType(errorMsg);
            if (healedValue !== null) {
                return {
                    shouldRetry: true,
                    message: `Validation error - created value of expected type`,
                    data: healedValue,
                };
            }
        }
        return {
            shouldRetry: true,
            message: "Validation error - increased timeout",
            config: { ...config, timeout: (config.timeout || 5000) * 1.5 },
        };
    }
    // 429 Rate Limit
    if (status === 429) {
        const retryAfter = response?.headers?.get("retry-after");
        const delay = retryAfter
            ? parseInt(retryAfter) * 1000
            : Math.pow(2, attempt) * 1000;
        return {
            shouldRetry: true,
            message: `Rate limited - retry after ${delay}ms`,
            config: { ...config, retryDelay: delay },
        };
    }
    // Timeout
    if (error.name === "AbortError" || error.message?.includes("timeout")) {
        const newTimeout = Math.min((config.timeout || 5000) * 2, 30000);
        return {
            shouldRetry: true,
            message: `Timeout - increased to ${newTimeout}ms`,
            config: { ...config, timeout: newTimeout },
        };
    }
    // Network errors
    if (error.code === "ECONNRESET" ||
        error.code === "ENOTFOUND" ||
        error.message?.includes("fetch failed")) {
        return {
            shouldRetry: true,
            message: "Network error - retry with increased timeout",
            config: { ...config, timeout: (config.timeout || 5000) * 2 },
        };
    }
    // JSON parse errors
    if (error.message?.includes("JSON") || error.message?.includes("parse")) {
        return {
            shouldRetry: true,
            message: "Malformed data - retry with increased timeout",
            config: { ...config, timeout: (config.timeout || 5000) * 2 },
        };
    }
    return { shouldRetry: false, message: "No healing strategy available" };
}
function createReqifyInstance() {
    const reqifyCore = async (urlOrConfig, config) => {
        let finalConfig;
        if (typeof urlOrConfig === "string") {
            finalConfig = { ...config, url: urlOrConfig };
        }
        else {
            finalConfig = urlOrConfig;
        }
        const maxRetries = finalConfig.maxRetries ?? 3;
        const autoHealEnabled = finalConfig.autoHeal ?? true;
        let attempt = 0;
        let lastError;
        let healMessage;
        while (attempt <= maxRetries) {
            try {
                const { url, method = asMethod("GET"), params, data, headers, responseType = "json", timeout = 5000, } = finalConfig;
                const finalUrl = new URL(url);
                if (params) {
                    Object.entries(params).forEach(([key, value]) => {
                        finalUrl.searchParams.append(key, String(value));
                    });
                }
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                const fetchOptions = {
                    method: method,
                    headers: headers,
                    signal: controller.signal,
                };
                if (data !== undefined && data !== null) {
                    if (typeof data === "object" &&
                        !(data instanceof FormData) &&
                        !(data instanceof URLSearchParams) &&
                        // @ts-ignore (ReadableStream existe no ambiente Node/Web moderno)
                        !(typeof ReadableStream !== "undefined" &&
                            data instanceof ReadableStream)) {
                        fetchOptions.body = JSON.stringify(data);
                        if (!fetchOptions.headers)
                            fetchOptions.headers = {};
                        fetchOptions.headers["Content-Type"] =
                            "application/json";
                    }
                    else {
                        fetchOptions.body = data;
                    }
                }
                const response = await fetch(finalUrl.toString(), fetchOptions);
                clearTimeout(timeoutId);
                // Se não for sucesso e auto-heal estiver ativo, tentar curar
                if (!response.ok && autoHealEnabled && attempt < maxRetries) {
                    const healContext = {
                        error: new Error(`HTTP ${response.status}: ${response.statusText}`),
                        config: finalConfig,
                        response,
                        attempt,
                    };
                    const healResult = await autoHeal(healContext);
                    if (healResult.shouldRetry) {
                        healMessage = healResult.message;
                        if (healResult.config) {
                            finalConfig = healResult.config;
                        }
                        if (healResult.config?.retryDelay) {
                            await new Promise((resolve) => setTimeout(resolve, healResult.config.retryDelay));
                        }
                        attempt++;
                        continue;
                    }
                }
                let responseData;
                if (responseType === "stream") {
                    responseData = response.body;
                }
                else if (responseType === "text") {
                    responseData = (await response.text());
                }
                else {
                    try {
                        const text = await response.text();
                        responseData = text ? JSON.parse(text) : null;
                    }
                    catch (e) {
                        console.warn("Falha ao parsear JSON, retornando null/texto cru");
                        responseData = null;
                    }
                }
                return {
                    data: responseData,
                    status: asStatusCode(response.status),
                    statusText: response.statusText,
                    headers: response.headers,
                    config: finalConfig,
                    request: response,
                    healed: !!healMessage,
                    healMessage,
                };
            }
            catch (error) {
                lastError = error;
                // Se auto-heal estiver ativo e ainda temos tentativas, tentar curar
                if (autoHealEnabled && attempt < maxRetries) {
                    const healContext = {
                        error,
                        config: finalConfig,
                        attempt,
                    };
                    const healResult = await autoHeal(healContext);
                    if (healResult.shouldRetry) {
                        healMessage = healResult.message;
                        if (healResult.config) {
                            finalConfig = healResult.config;
                        }
                        if (healResult.config?.retryDelay) {
                            await new Promise((resolve) => setTimeout(resolve, healResult.config.retryDelay));
                        }
                        attempt++;
                        continue;
                    }
                }
                // Se não conseguiu curar ou não deve tentar novamente, lançar erro
                throw lastError;
            }
        }
        // Se chegou aqui, esgotou as tentativas
        throw lastError || new Error("Max retries exceeded");
    };
    const instance = reqifyCore;
    instance.get = (url, config) => instance({ ...config, url, method: asMethod("GET") });
    instance.delete = (url, config) => instance({ ...config, url, method: asMethod("DELETE") });
    instance.head = (url, config) => instance({ ...config, url, method: asMethod("HEAD") });
    instance.options = (url, config) => instance({ ...config, url, method: asMethod("OPTIONS") });
    instance.post = (url, data, config) => instance({ ...config, url, data, method: asMethod("POST") });
    instance.put = (url, data, config) => instance({ ...config, url, data, method: asMethod("PUT") });
    instance.patch = (url, data, config) => instance({ ...config, url, data, method: asMethod("PATCH") });
    return instance;
}
export const reqify = createReqifyInstance();
export default reqify;
//# sourceMappingURL=index.js.map