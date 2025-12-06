/**
 * Demonstração do Auto-Healing do Reqify
 * 
 * Este exemplo mostra como o sistema de auto-healing funciona
 * em diferentes cenários de erro.
 */

import { reqify, asUrl, createValueFromType } from '../src/index.js';

// Exemplo 1: Rate Limiting com Retry-After
async function exemploRateLimit() {
  console.log('\n=== Exemplo 1: Rate Limiting ===');
  
  try {
    const response = await reqify.get(
      asUrl('https://api.github.com/users/octocat'),
      {
        maxRetries: 3,
        timeout: 5000
      }
    );

    if (response.healed) {
      console.log('✅ Requisição curada automaticamente!');
      console.log('Mensagem:', response.healMessage);
    }

    console.log('Status:', response.status);
    console.log('Dados:', response.data);
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

// Exemplo 2: Timeout Progressivo
async function exemploTimeout() {
  console.log('\n=== Exemplo 2: Timeout Progressivo ===');
  
  try {
    const response = await reqify.get(
      asUrl('https://httpbin.org/delay/3'),
      {
        timeout: 1000,  // Timeout inicial muito curto
        maxRetries: 3
      }
    );

    if (response.healed) {
      console.log('✅ Timeout ajustado automaticamente!');
      console.log('Mensagem:', response.healMessage);
    }

    console.log('Status:', response.status);
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

// Exemplo 3: Criação de Valores por Tipo
function exemploCreateValueFromType() {
  console.log('\n=== Exemplo 3: Criação de Valores por Tipo ===');
  
  const casos = [
    'expected string',
    'must be number',
    'expected boolean',
    'must be email',
    'expected url',
    'must be phone',
    'expected uuid',
    'must be date'
  ];

  casos.forEach(mensagem => {
    const valor = createValueFromType(mensagem);
    console.log(`"${mensagem}" → ${JSON.stringify(valor)}`);
  });
}

// Exemplo 4: Monitoramento de Healings
async function exemploMonitoramento() {
  console.log('\n=== Exemplo 4: Monitoramento de Healings ===');
  
  const urls = [
    'https://api.github.com/users/octocat',
    'https://httpbin.org/status/401',
    'https://httpbin.org/status/429',
  ];

  for (const url of urls) {
    try {
      const response = await reqify.get(asUrl(url), {
        maxRetries: 2,
        timeout: 3000
      });

      console.log(`\nURL: ${url}`);
      console.log(`Status: ${response.status}`);
      console.log(`Healed: ${response.healed ? '✅' : '❌'}`);
      
      if (response.healed) {
        console.log(`Mensagem: ${response.healMessage}`);
      }
    } catch (error: any) {
      console.log(`\nURL: ${url}`);
      console.log(`❌ Erro não recuperável: ${error.message}`);
    }
  }
}

// Exemplo 5: Comparação com e sem Auto-Healing
async function exemploComparacao() {
  console.log('\n=== Exemplo 5: Com vs Sem Auto-Healing ===');
  
  const url = asUrl('https://httpbin.org/status/401');
  
  // Sem auto-healing
  console.log('\n--- Sem Auto-Healing ---');
  try {
    const response = await reqify.get(url, {
      autoHeal: false,
      maxRetries: 2
    });
    console.log('Status:', response.status);
  } catch (error: any) {
    console.log('❌ Falhou imediatamente:', error.message);
  }
  
  // Com auto-healing
  console.log('\n--- Com Auto-Healing ---');
  try {
    const response = await reqify.get(url, {
      autoHeal: true,
      maxRetries: 2
    });
    console.log('Status:', response.status);
    console.log('Healed:', response.healed);
    console.log('Mensagem:', response.healMessage);
  } catch (error: any) {
    console.log('❌ Falhou após tentativas:', error.message);
  }
}

// Exemplo 6: POST com Validação
async function exemploValidacao() {
  console.log('\n=== Exemplo 6: POST com Validação ===');
  
  try {
    const response = await reqify.post(
      asUrl('https://httpbin.org/post'),
      {
        name: 'João Silva',
        email: 'joao@example.com',
        age: 30
      },
      {
        maxRetries: 2,
        timeout: 5000
      }
    );

    console.log('Status:', response.status);
    console.log('Healed:', response.healed);
    
    if (response.healed) {
      console.log('Mensagem:', response.healMessage);
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

// Executar todos os exemplos
async function main() {
  console.log('🚀 Demonstração do Auto-Healing do Reqify\n');
  console.log('=' .repeat(50));
  
  // Exemplo 3 não precisa de rede
  exemploCreateValueFromType();
  
  // Exemplos que fazem requisições reais
  await exemploRateLimit();
  await exemploTimeout();
  await exemploMonitoramento();
  await exemploComparacao();
  await exemploValidacao();
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Demonstração concluída!');
}

// Executar se for o arquivo principal
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  exemploRateLimit,
  exemploTimeout,
  exemploCreateValueFromType,
  exemploMonitoramento,
  exemploComparacao,
  exemploValidacao
};
