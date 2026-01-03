# Changelog

## [0.3.3] - 2026-01-03

### ✅ Tests

- Added `tests/core.test.ts` covering standard HTTP methods and configuration
- Added advanced healing scenarios (nested payload reduction) to `tests/heal.test.ts`

## [0.3.2] - 2026-01-02

### 🔧 Chore

- Migrated tests from `node:test` to `bun:test` for compatibility
- Updated `package.json` test script to use `bun test`

## [0.3.1] - 2026-01-02

### 🐛 Fixed

- Duplicate identifier 'reqify' by renaming type alias to `ReqifyHeaders`
- Broken identifiers `one-request-4-all` corrected to `Reqify` naming convention
- Syntax errors in `src/index.ts`

## [0.3.0] - 2024-12-06

### ✨ Added

- **Auto-Healing System**: Sistema nativo de auto-correção de erros HTTP

  - Healing para 401 Unauthorized (refresh de token)
  - Healing para 403 Forbidden (ajuste de timeout)
  - Healing para 413 Payload Too Large (remoção de campos opcionais do payload)
  - Healing para 422 Unprocessable Entity (criação de valores por tipo)
  - Healing para 429 Rate Limit (respeita Retry-After ou backoff exponencial)
  - Healing para Timeout (aumento progressivo até 30s)
  - Healing para Network Errors (retry com timeout aumentado)
  - Healing para JSON Parse Errors (retry com timeout aumentado)

- **Heurística de Criação de Valores**: Função `createValueFromType()` que cria valores baseados no tipo esperado

  - Suporta: string, number, boolean, object, array, date, email, url, phone, uuid
  - Analisa mensagens de erro para detectar tipo esperado
  - Exportada para uso externo

- **Configuração de Auto-Healing**:

  - `autoHeal`: habilita/desabilita auto-healing (padrão: true)
  - `maxRetries`: número máximo de tentativas (padrão: 3)
  - `timeout`: timeout inicial em ms (padrão: 5000)
  - `retryDelay`: delay customizado entre tentativas

- **Response Metadata**:
  - `response.healed`: indica se a requisição foi curada
  - `response.healMessage`: mensagem descritiva do healing aplicado

### 📝 Documentation

- Documentação completa em `docs/AUTO_HEALING.md`
- Exemplos práticos em `examples/auto-healing-demo.ts`
- Atualização do README.md com seção de auto-healing

### ✅ Tests

- 13 testes automatizados cobrindo todos os tipos de healing
- 100% de cobertura das funcionalidades de auto-healing
- Testes para heurística de criação de valores
- Testes para configuração de auto-healing
- Testes para redução de payload (413)

### 🔧 Technical Details

- Retry inteligente com backoff exponencial
- Timeout progressivo (dobra a cada tentativa, máximo 30s)
- Respeita headers HTTP (Retry-After)
- Análise semântica de mensagens de erro
- Redução automática de payload (remove campos opcionais recursivamente)
- Zero dependências externas

### 🐛 Fixed

- Estratégia de healing do 413 agora remove campos opcionais do payload ao invés de aumentar timeout

## [0.2.0] - 2024-12-05

### ✨ Added

- Initial release with axios-compatible interface
- Native Node.js fetch implementation
- TypeScript support
- Brand types for type safety

### 🚀 Features

- GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS methods
- Query parameters support
- Custom headers
- Multiple response types (json, text, stream)
- Error handling

## [0.1.0] - 2024-12-04

### 🎉 Initial Release

- Basic HTTP client implementation
- Axios-like interface
