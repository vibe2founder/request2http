# Guia de Migração para Auto-Healing

Este guia ajuda você a migrar seu código existente para aproveitar o sistema de auto-healing do Reqify.

## Migração Básica

### Antes (sem auto-healing)

```typescript
import reqify from '@purecore/reqify';

try {
  const response = await reqify.get('https://api.example.com/data');
  console.log(response.data);
} catch (error) {
  // Tratamento manual de erros
  if (error.response?.status === 429) {
    // Esperar e tentar novamente manualmente
    await new Promise(resolve => setTimeout(resolve, 1000));
    const retry = await reqify.get('https://api.example.com/data');
    console.log(retry.data);
  } else if (error.code === 'ETIMEDOUT') {
    // Aumentar timeout manualmente
    const retry = await reqify.get('https://api.example.com/data', {
      timeout: 10000
    });
    console.log(retry.data);
  } else {
    throw error;
  }
}
```

### Depois (com auto-healing)

```typescript
import reqify from '@purecore/reqify';

// Auto-healing cuida de tudo automaticamente!
const response = await reqify.get('https://api.example.com/data', {
  maxRetries: 3,
  timeout: 5000
});

if (response.healed) {
  console.log('✅ Requisição curada:', response.healMessage);
}

console.log(response.data);
```

## Cenários Comuns

### 1. Rate Limiting

#### Antes
```typescript
async function fetchWithRateLimit(url: string) {
  let retries = 0;
  const maxRetries = 3;
  
  while (retries < maxRetries) {
    try {
      return await reqify.get(url);
    } catch (error) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers.get('retry-after');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}
```

#### Depois
```typescript
// Simplesmente use o auto-healing!
const response = await reqify.get(url, {
  maxRetries: 3
});
```

### 2. Timeout Progressivo

#### Antes
```typescript
async function fetchWithProgressiveTimeout(url: string) {
  const timeouts = [5000, 10000, 20000];
  
  for (const timeout of timeouts) {
    try {
      return await reqify.get(url, { timeout });
    } catch (error) {
      if (error.code !== 'ETIMEDOUT') throw error;
    }
  }
  throw new Error('All timeouts exceeded');
}
```

#### Depois
```typescript
const response = await reqify.get(url, {
  timeout: 5000,
  maxRetries: 3
});
```

### 3. Validação de Dados

#### Antes
```typescript
async function createUser(userData: any) {
  try {
    return await reqify.post('/api/users', userData);
  } catch (error) {
    if (error.response?.status === 422) {
      // Analisar erro e criar valores padrão manualmente
      const errors = error.response.data.errors;
      const fixedData = { ...userData };
      
      for (const err of errors) {
        if (err.field === 'email' && err.type === 'string') {
          fixedData.email = 'default@example.com';
        }
        // ... mais campos
      }
      
      return await reqify.post('/api/users', fixedData);
    }
    throw error;
  }
}
```

#### Depois
```typescript
// Auto-healing cria valores automaticamente!
const response = await reqify.post('/api/users', userData, {
  maxRetries: 2
});
```

### 4. Múltiplas Requisições com Retry

#### Antes
```typescript
async function fetchMultiple(urls: string[]) {
  const results = [];
  
  for (const url of urls) {
    let success = false;
    let retries = 0;
    
    while (!success && retries < 3) {
      try {
        const response = await reqify.get(url);
        results.push(response.data);
        success = true;
      } catch (error) {
        retries++;
        if (retries >= 3) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
  }
  
  return results;
}
```

#### Depois
```typescript
async function fetchMultiple(urls: string[]) {
  return Promise.all(
    urls.map(url => 
      reqify.get(url, { maxRetries: 3 })
        .then(r => r.data)
    )
  );
}
```

## Configuração Avançada

### Monitoramento de Healings

```typescript
// Criar um wrapper para monitorar healings
async function monitoredRequest<T>(
  url: string,
  config?: any
): Promise<T> {
  const response = await reqify.get(url, config);
  
  if (response.healed) {
    // Log para sistema de monitoramento
    logger.info('Auto-healing aplicado', {
      url,
      message: response.healMessage,
      status: response.status,
      timestamp: new Date().toISOString()
    });
    
    // Métricas
    metrics.increment('reqify.healed', {
      type: extractHealType(response.healMessage)
    });
  }
  
  return response.data;
}

function extractHealType(message: string): string {
  if (message.includes('Rate limited')) return 'rate_limit';
  if (message.includes('Timeout')) return 'timeout';
  if (message.includes('Unauthorized')) return 'unauthorized';
  if (message.includes('Network')) return 'network';
  return 'other';
}
```

### Configuração Global

```typescript
// Criar uma instância configurada
import { createReqifyInstance } from '@purecore/reqify';

const api = createReqifyInstance();

// Wrapper com configuração padrão
export async function apiRequest<T>(
  url: string,
  config?: any
): Promise<T> {
  const response = await api.get(url, {
    maxRetries: 3,
    timeout: 5000,
    autoHeal: true,
    ...config
  });
  
  return response.data;
}
```

### Desabilitar para Operações Críticas

```typescript
// Para operações críticas onde você quer controle total
async function criticalOperation(data: any) {
  return reqify.post('/api/payment', data, {
    autoHeal: false,  // Sem healing automático
    maxRetries: 0     // Sem retries
  });
}
```

## Checklist de Migração

- [ ] Identificar código com retry manual
- [ ] Identificar código com tratamento de rate limiting
- [ ] Identificar código com timeout progressivo
- [ ] Identificar código com validação de dados
- [ ] Substituir por chamadas simples com auto-healing
- [ ] Adicionar monitoramento de `response.healed`
- [ ] Configurar `maxRetries` e `timeout` apropriados
- [ ] Testar em ambiente de desenvolvimento
- [ ] Monitorar healings em produção
- [ ] Ajustar configurações baseado em métricas

## Boas Práticas

### 1. Sempre Monitore Healings

```typescript
const response = await reqify.get(url);

if (response.healed) {
  // Log para análise posterior
  console.warn('Healing aplicado:', {
    url,
    message: response.healMessage,
    status: response.status
  });
}
```

### 2. Configure Timeouts Apropriados

```typescript
// APIs rápidas
const fast = await reqify.get('/api/fast', {
  timeout: 2000,
  maxRetries: 2
});

// APIs lentas
const slow = await reqify.get('/api/slow', {
  timeout: 10000,
  maxRetries: 3
});
```

### 3. Use Auto-Heal Seletivamente

```typescript
// Operações de leitura: auto-heal ativo
const data = await reqify.get('/api/data', {
  autoHeal: true
});

// Operações críticas: auto-heal desabilitado
const payment = await reqify.post('/api/payment', paymentData, {
  autoHeal: false
});
```

### 4. Combine com Try-Catch

```typescript
try {
  const response = await reqify.get(url, {
    maxRetries: 3
  });
  
  if (response.healed) {
    // Healing foi aplicado, pode querer notificar
    notifyTeam('Auto-healing aplicado', response.healMessage);
  }
  
  return response.data;
} catch (error) {
  // Erro não recuperável mesmo com healing
  logger.error('Falha após healing', { url, error });
  throw error;
}
```

## Métricas Recomendadas

```typescript
interface HealingMetrics {
  total_requests: number;
  healed_requests: number;
  healing_rate: number;
  healing_types: {
    rate_limit: number;
    timeout: number;
    unauthorized: number;
    network: number;
    validation: number;
    other: number;
  };
  avg_retries: number;
  max_retries_exceeded: number;
}

// Implementação de coleta de métricas
class ReqifyMetrics {
  private metrics: HealingMetrics = {
    total_requests: 0,
    healed_requests: 0,
    healing_rate: 0,
    healing_types: {
      rate_limit: 0,
      timeout: 0,
      unauthorized: 0,
      network: 0,
      validation: 0,
      other: 0
    },
    avg_retries: 0,
    max_retries_exceeded: 0
  };

  async track<T>(
    request: () => Promise<ReqifyResponse<T>>
  ): Promise<T> {
    this.metrics.total_requests++;
    
    try {
      const response = await request();
      
      if (response.healed) {
        this.metrics.healed_requests++;
        this.trackHealingType(response.healMessage);
      }
      
      this.updateHealingRate();
      return response.data;
    } catch (error) {
      this.metrics.max_retries_exceeded++;
      throw error;
    }
  }

  private trackHealingType(message: string) {
    if (message.includes('Rate limited')) {
      this.metrics.healing_types.rate_limit++;
    } else if (message.includes('Timeout')) {
      this.metrics.healing_types.timeout++;
    } else if (message.includes('Unauthorized')) {
      this.metrics.healing_types.unauthorized++;
    } else if (message.includes('Network')) {
      this.metrics.healing_types.network++;
    } else if (message.includes('Validation')) {
      this.metrics.healing_types.validation++;
    } else {
      this.metrics.healing_types.other++;
    }
  }

  private updateHealingRate() {
    this.metrics.healing_rate = 
      this.metrics.healed_requests / this.metrics.total_requests;
  }

  getMetrics(): HealingMetrics {
    return { ...this.metrics };
  }
}

// Uso
const metrics = new ReqifyMetrics();

const data = await metrics.track(() => 
  reqify.get(url, { maxRetries: 3 })
);

console.log(metrics.getMetrics());
```

## Troubleshooting

### Problema: Muitos healings de rate limit

**Solução**: Ajuste o `maxRetries` ou implemente um sistema de fila

```typescript
// Antes
const response = await reqify.get(url, { maxRetries: 5 });

// Depois
import PQueue from 'p-queue';
const queue = new PQueue({ concurrency: 2 });

const response = await queue.add(() => 
  reqify.get(url, { maxRetries: 2 })
);
```

### Problema: Timeouts frequentes

**Solução**: Aumente o timeout inicial

```typescript
// Antes
const response = await reqify.get(url, { timeout: 5000 });

// Depois
const response = await reqify.get(url, { timeout: 10000 });
```

### Problema: Healings não estão funcionando

**Verificações**:
1. `autoHeal` está habilitado?
2. `maxRetries` > 0?
3. Erro é recuperável?

```typescript
const response = await reqify.get(url, {
  autoHeal: true,    // ✅ Habilitado
  maxRetries: 3      // ✅ Permite retries
});
```

## Suporte

Para mais informações:
- [Documentação completa de Auto-Healing](AUTO_HEALING.md)
- [Exemplos práticos](../examples/auto-healing-demo.ts)
- [Issues no GitHub](https://github.com/suissa/purecore-reqify/issues)
