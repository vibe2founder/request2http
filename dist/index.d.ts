export type Brand<T, K extends string> = T & {
    __brand: K;
};
export type Url = Brand<string, "Url">;
export type HttpMethod = Brand<"GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS", "HttpMethod">;
export type StatusCode = Brand<number, "StatusCode">;
export type HeaderName = Brand<string, "HeaderName">;
export type HeaderValue = Brand<string, "HeaderValue">;
export declare const asUrl: (url: string) => Url;
export declare const asMethod: (method: string) => HttpMethod;
export declare const asStatusCode: (status: number) => StatusCode;
export declare const asHeaderName: (name: string) => HeaderName;
export declare const asHeaderValue: (value: string) => HeaderValue;
export type ReqifyHeaders = Record<HeaderName, HeaderValue> | Record<string, string>;
export interface reqify<D = any> {
    url: Url;
    method?: HttpMethod;
    headers?: ReqifyHeaders;
    data?: D;
    params?: Record<string, string | number | boolean>;
    responseType?: "json" | "text" | "stream";
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
    autoHeal?: boolean;
}
export interface ReqifyResponse<T = any, D = any> {
    data: T;
    status: StatusCode;
    statusText: string;
    headers: Headers;
    config: reqify<D>;
    request: Response;
    healed?: boolean;
    healMessage?: string;
}
export interface ReqifyInstance {
    <T = any, D = any>(config: reqify<D>): Promise<ReqifyResponse<T, D>>;
    <T = any, D = any>(url: Url, config?: Omit<reqify<D>, "url">): Promise<ReqifyResponse<T, D>>;
    get<T = any, D = any>(url: Url, config?: Omit<reqify<D>, "url" | "method">): Promise<ReqifyResponse<T, D>>;
    delete<T = any, D = any>(url: Url, config?: Omit<reqify<D>, "url" | "method">): Promise<ReqifyResponse<T, D>>;
    head<T = any, D = any>(url: Url, config?: Omit<reqify<D>, "url" | "method">): Promise<ReqifyResponse<T, D>>;
    options<T = any, D = any>(url: Url, config?: Omit<reqify<D>, "url" | "method">): Promise<ReqifyResponse<T, D>>;
    post<T = any, D = any>(url: Url, data?: D, config?: Omit<reqify<D>, "url" | "method" | "data">): Promise<ReqifyResponse<T, D>>;
    put<T = any, D = any>(url: Url, data?: D, config?: Omit<reqify<D>, "url" | "method" | "data">): Promise<ReqifyResponse<T, D>>;
    patch<T = any, D = any>(url: Url, data?: D, config?: Omit<reqify<D>, "url" | "method" | "data">): Promise<ReqifyResponse<T, D>>;
}
export interface HealContext {
    error: any;
    config: reqify;
    response?: Response;
    attempt: number;
}
export interface HealResult {
    shouldRetry: boolean;
    config?: reqify;
    message?: string;
    data?: any;
}
/**
 * Cria um valor baseado no tipo esperado quando a validação falha
 * Heurística: analisa a mensagem de erro e o tipo esperado para gerar um valor válido
 */
export declare function createValueFromType(errorMessage: string, expectedType?: string): any;
/**
 * Auto-healer nativo do one-request-4-all
 * Detecta e corrige automaticamente erros comuns
 */
export declare function autoHeal(context: HealContext): Promise<HealResult>;
export declare const reqify: ReqifyInstance;
export default reqify;
//# sourceMappingURL=index.d.ts.map