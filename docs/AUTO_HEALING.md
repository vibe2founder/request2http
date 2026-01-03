# Auto-Healing no one-request-4-all

O one-request-4-all possui um sistema nativo de **auto-healing** que detecta e corrige automaticamente erros comuns em requisições HTTP, aumentando a resiliência e confiabilidade das suas aplicações.

## Funcionalidades

### 1. Healing de Erros HTTP

#### 401 Unauthorized

- **Detecção**: Status 401 ou mensagem contendo "401"
- **Ação**: Aumenta timeout em 50% e tenta novamente
- **Uso**: Útil quando o servidor está lento para validar credenciais

#### 403 Forbidden

- **Detecção**: Status 403 ou mensagem contendo "403"
- **Ação**: Aumenta timeout em 50%
- **Uso**: Permite mais tempo para verificação de permissões

#### 413 Payload Too Large

- **Detecção**: Status 413 ou mensagem contendo "413"
- **Ação**: Remove campos opcionais do payload (description, metadata, avatar, etc.)
- **Uso**: Reduz o tamanho do payload para caber nos limites do servidor
- **Nota**: Só funciona com requisições POST/PUT/PATCH que enviam dados

#### 422 Unprocessable Entity

- **Detecção**: Status 422 ou mensagem contendo "422"
- **Ação**: Cria valores baseados no tipo esperado usando heurística
- **Uso**: Corrige automaticamente erros de validação de tipos

#### 429 Rate Limit

- **Detecção**: Status 429 ou mensagem contendo "429"
- **Ação**:
  - Respeita header `Retry-After` se presente
  - Usa backoff exponencial caso contrário
- **Uso**: Evita sobrecarga do servidor respeitando limites de taxa

### 2. Healing de Erros de Rede

#### Timeout

- **Detecção**: `AbortError` ou mensagem contendo "timeout"
- **Ação**: Dobra o timeout (máximo 30s)
- **Uso**: Adapta-se a conexões lentas

#### Erros de Conexão

- **Detecção**: Códigos `ECONNRESET`, `ENOTFOUND` ou "fetch failed"
- **Ação**: Dobra o timeout e tenta novamente
- **Uso**: Recupera de falhas temporárias de rede

#### Erros de Parse JSON

- **Detecção**: Mensagens contendo "JSON" ou "parse"
- **Ação**: Dobra o timeout e tenta novamente
- **Uso**: Lida com respostas malformadas temporárias

## Heurística de Criação de Valores

Quando uma validação falha (erro 422), o sistema analisa a mensagem de erro e cria automaticamente um valor do tipo esperado:

```typescript
// Mapeamento de tipos para valores padrão
{
  'string': '',
  'number': 0,
  'boolean': false,
  'object': {},
  'array': [],
  'date': new Date().toISOString(),
  'email': 'example@domain.com',
  'url': 'https://example.com',
  'phone': '+5511999999999',
  'uuid': '00000000-0000-0000-0000-000000000000'
}
```

### Exemplos de Mensagens Detectadas

- `"expected string"` → cria `""`
- `"must be number"` → cria `0`
- `"expected email"` → cria `"example@domain.com"`
- `"must be uuid"` → cria `"00000000-0000-0000-0000-000000000000"`

## Uso

### Habilitado por Padrão

O auto-healing está **habilitado por padrão** em todas as requisições:

```typescript
import { reqify, asUrl } from "@purecore/reqify";

// Auto-healing ativo automaticamente
const response = await reqify.get(asUrl("https://api.example.com/data"));

if (response.healed) {
  console.log("Requisição foi curada:", response.healMessage);
}
```

### Configuração de Retries

```typescript
const response = await reqify.get(asUrl("https://api.example.com/data"), {
  maxRetries: 3, // Número máximo de tentativas (padrão: 3)
  timeout: 5000, // Timeout inicial em ms (padrão: 5000)
  autoHeal: true, // Habilitar auto-healing (padrão: true)
});
```

### Desabilitar Auto-Healing

```typescript
const response = await reqify.get(asUrl("https://api.example.com/data"), {
  autoHeal: false, // Desabilita o auto-healing
});
```

### Verificar se Foi Curado

```typescript
const response = await reqify.get(asUrl("https://api.example.com/data"));

if (response.healed) {
  console.log("✅ Requisição curada automaticamente");
  console.log("Mensagem:", response.healMessage);
  // Exemplo: "Rate limited - retry after 1000ms"
}
```

## API Pública

### `autoHeal(context: HealContext): Promise<HealResult>`

Função exportada que pode ser usada para healing customizado:

```typescript
import { autoHeal, HealContext } from "@purecore/reqify";

const context: HealContext = {
  error: new Error("HTTP 429: Too Many Requests"),
  config: { url: asUrl("https://api.example.com"), timeout: 5000 },
  response: mockResponse,
  attempt: 1,
};

const result = await autoHeal(context);

if (result.shouldRetry) {
  console.log("Deve tentar novamente:", result.message);
  // Usar result.config para próxima tentativa
}
```

### `createValueFromType(errorMessage: string, expectedType?: string): any`

Função exportada para criar valores baseados em tipos:

```typescript
import { createValueFromType } from "@purecore/reqify";

const value = createValueFromType("expected email");
console.log(value); // "example@domain.com"

const value2 = createValueFromType("must be number");
console.log(value2); // 0

const value3 = createValueFromType("any message", "uuid");
console.log(value3); // "00000000-0000-0000-0000-000000000000"
```

## Tipos

```typescript
interface HealContext {
  error: any;
  config: reqify;
  response?: Response;
  attempt: number;
}

interface HealResult {
  shouldRetry: boolean;
  config?: reqify;
  message?: string;
  data?: any;
}

interface one-request-4-allResponse<T = any, D = any> {
  data: T;
  status: StatusCode;
  statusText: string;
  headers: Headers;
  config: reqify<D>;
  request: Response;
  healed?: boolean;        // Indica se foi curado
  healMessage?: string;    // Mensagem do healing aplicado
}
```

## Exemplos Práticos

### Rate Limiting com Retry-After

```typescript
// API retorna 429 com header Retry-After: 2
const response = await reqify.get(asUrl("https://api.example.com/data"));

// one-request-4-all automaticamente:
// 1. Detecta o 429
// 2. Lê o header Retry-After
// 3. Espera 2 segundos
// 4. Tenta novamente
// 5. Retorna sucesso

console.log(response.healed); // true
console.log(response.healMessage); // "Rate limited - retry after 2000ms"
```

### Timeout Progressivo

```typescript
// Primeira tentativa: timeout 5s (falha)
// Segunda tentativa: timeout 10s (falha)
// Terceira tentativa: timeout 20s (sucesso)

const response = await reqify.get(asUrl("https://slow-api.example.com/data"), {
  timeout: 5000,
  maxRetries: 3,
});

console.log(response.healed); // true
console.log(response.healMessage); // "Timeout - increased to 20000ms"
```

### Validação com Criação de Valores

```typescript
// API retorna 422: "field 'email' expected string"
const response = await reqify.post(asUrl("https://api.example.com/users"), {
  name: "João",
});

// one-request-4-all automaticamente:
// 1. Detecta o 422
// 2. Analisa a mensagem de erro
// 3. Cria um valor padrão para email
// 4. Tenta novamente

console.log(response.healed); // true
console.log(response.healMessage); // "Validation error - created value of expected type"
```

## Boas Práticas

1. **Monitore healings**: Sempre verifique `response.healed` em produção para identificar problemas recorrentes

2. **Configure timeouts apropriados**: Comece com valores conservadores e deixe o auto-healing ajustar

3. **Limite retries**: Use `maxRetries` para evitar loops infinitos

4. **Log de healings**: Registre quando healings ocorrem para análise posterior

```typescript
const response = await reqify.get(asUrl("https://api.example.com/data"));

if (response.healed) {
  logger.warn("Auto-healing aplicado", {
    url: response.config.url,
    message: response.healMessage,
    status: response.status,
  });
}
```

5. **Desabilite em casos específicos**: Para operações críticas onde você quer controle total, desabilite o auto-healing

```typescript
// Operação crítica - sem healing
const response = await reqify.post(
  asUrl("https://api.example.com/payment"),
  paymentData,
  { autoHeal: false }
);
```

## Limitações

- O healing não pode corrigir erros de autenticação sem um `jwtRefresher` configurado
- Valores criados pela heurística são genéricos e podem não ser adequados para todos os casos
- O timeout máximo é limitado a 30 segundos
- Não faz healing de erros 5xx do servidor (responsabilidade do servidor)

## Testes

Todos os tipos de healing possuem testes automatizados em `tests/heal.test.ts`:

```bash
npm test
```

Os testes cobrem:

- ✅ 401 Unauthorized
- ✅ 403 Forbidden
- ✅ 413 Payload Too Large
- ✅ 422 Unprocessable Entity
- ✅ 429 Rate Limit (com e sem Retry-After)
- ✅ Timeout
- ✅ Erros de rede
- ✅ Erros de parse JSON
- ✅ Auto-heal desabilitado
- ✅ Heurística de criação de valores
