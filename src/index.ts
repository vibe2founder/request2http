export type Brand<T, K extends string> = T & { __brand: K };

export type Url = Brand<string, 'Url'>;
export type HttpMethod = Brand<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS', 'HttpMethod'>;
export type StatusCode = Brand<number, 'StatusCode'>;
export type HeaderName = Brand<string, 'HeaderName'>;
export type HeaderValue = Brand<string, 'HeaderValue'>;

export const asUrl = (url: string): Url => url as Url;
export const asMethod = (method: string): HttpMethod => method.toUpperCase() as HttpMethod;
export const asStatusCode = (status: number): StatusCode => status as StatusCode;
export const asHeaderName = (name: string): HeaderName => name as HeaderName;
export const asHeaderValue = (value: string): HeaderValue => value as HeaderValue;

export type ReqifyHeaders = Record<HeaderName, HeaderValue> | Record<string, string>;

export interface ReqifyRequestConfig<D = any> {
  url: Url;
  method?: HttpMethod;
  headers?: ReqifyHeaders;
  data?: D;
  params?: Record<string, string | number | boolean>;
  responseType?: 'json' | 'text' | 'stream';
}

export interface ReqifyResponse<T = any, D = any> {
  data: T;
  status: StatusCode;
  statusText: string;
  headers: Headers;
  config: ReqifyRequestConfig<D>;
  request: Response;
}

export interface ReqifyInstance {
  <T = any, D = any>(config: ReqifyRequestConfig<D>): Promise<ReqifyResponse<T, D>>;
  <T = any, D = any>(url: Url, config?: Omit<ReqifyRequestConfig<D>, 'url'>): Promise<ReqifyResponse<T, D>>;

  get<T = any, D = any>(url: Url, config?: Omit<ReqifyRequestConfig<D>, 'url' | 'method'>): Promise<ReqifyResponse<T, D>>;
  delete<T = any, D = any>(url: Url, config?: Omit<ReqifyRequestConfig<D>, 'url' | 'method'>): Promise<ReqifyResponse<T, D>>;
  head<T = any, D = any>(url: Url, config?: Omit<ReqifyRequestConfig<D>, 'url' | 'method'>): Promise<ReqifyResponse<T, D>>;
  options<T = any, D = any>(url: Url, config?: Omit<ReqifyRequestConfig<D>, 'url' | 'method'>): Promise<ReqifyResponse<T, D>>;
  
  post<T = any, D = any>(url: Url, data?: D, config?: Omit<ReqifyRequestConfig<D>, 'url' | 'method' | 'data'>): Promise<ReqifyResponse<T, D>>;
  put<T = any, D = any>(url: Url, data?: D, config?: Omit<ReqifyRequestConfig<D>, 'url' | 'method' | 'data'>): Promise<ReqifyResponse<T, D>>;
  patch<T = any, D = any>(url: Url, data?: D, config?: Omit<ReqifyRequestConfig<D>, 'url' | 'method' | 'data'>): Promise<ReqifyResponse<T, D>>;
}


function createReqifyInstance(): ReqifyInstance {
  
  const reqifyCore = async <T = any, D = any>(
    urlOrConfig: Url | ReqifyRequestConfig<D>,
    config?: Omit<ReqifyRequestConfig<D>, 'url'>
  ): Promise<ReqifyResponse<T, D>> => {
    
    let finalConfig: ReqifyRequestConfig<D>;
    if (typeof urlOrConfig === 'string') {
      finalConfig = { ...config, url: urlOrConfig as Url };
    } else {
      finalConfig = urlOrConfig as ReqifyRequestConfig<D>;
    }

    const {
      url,
      method = asMethod('GET'),
      params,
      data,
      headers,
      responseType = 'json',
    } = finalConfig;

    const finalUrl = new URL(url);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        finalUrl.searchParams.append(key, String(value));
      });
    }

    const fetchOptions: RequestInit = {
      method: method,
      headers: headers as Record<string, string>,
    };

    if (data !== undefined && data !== null) {
      if (
        typeof data === 'object' && 
        !(data instanceof FormData) && 
        !(data instanceof URLSearchParams) && 
        // @ts-ignore (ReadableStream existe no ambiente Node/Web moderno)
        !(typeof ReadableStream !== 'undefined' && data instanceof ReadableStream)
      ) {
        fetchOptions.body = JSON.stringify(data);
        if (!fetchOptions.headers) fetchOptions.headers = {};
        (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
      } else {
        fetchOptions.body = data as BodyInit;
      }
    }

    const response = await fetch(finalUrl.toString(), fetchOptions);

    let responseData: T;

    if (responseType === 'stream') {
      responseData = response.body as unknown as T;
    } else if (responseType === 'text') {
      responseData = (await response.text()) as unknown as T;
    } else {
      try {
        const text = await response.text();
        responseData = text ? JSON.parse(text) : null;
      } catch (e) {
        console.warn('Falha ao parsear JSON, retornando null/texto cru');
        responseData = null as unknown as T; 
      }
    }

    return {
      data: responseData,
      status: asStatusCode(response.status),
      statusText: response.statusText,
      headers: response.headers,
      config: finalConfig,
      request: response,
    };
  };

  const instance = reqifyCore as ReqifyInstance;

  instance.get = (url, config) => instance({ ...config, url, method: asMethod('GET') });
  instance.delete = (url, config) => instance({ ...config, url, method: asMethod('DELETE') });
  instance.head = (url, config) => instance({ ...config, url, method: asMethod('HEAD') });
  instance.options = (url, config) => instance({ ...config, url, method: asMethod('OPTIONS') });

  instance.post = (url, data, config) => instance({ ...config, url, data, method: asMethod('POST') });
  instance.put = (url, data, config) => instance({ ...config, url, data, method: asMethod('PUT') });
  instance.patch = (url, data, config) => instance({ ...config, url, data, method: asMethod('PATCH') });

  return instance;
}

export const reqify = createReqifyInstance();
export default reqify;