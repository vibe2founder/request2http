#!/usr/bin/env node

/**
 * JS-cURL: Uma ferramenta CLI para fazer requisições HTTP usando sintaxe JavaScript.
 * Uso: node jscurl.js "await req.get('https://api.github.com/users/octocat')"
 */

import util from "node:util";

// Configuração de cores para o terminal
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

/**
 * Formata a saída para ser legível e colorida
 */
function logResult(data) {
  console.log(`${colors.cyan}--- Resultado ---${colors.reset}`);
  console.log(
    util.inspect(data, {
      showHidden: false,
      depth: null,
      colors: true,
      compact: false,
    })
  );
}

/**
 * Objeto de requisição simplificado
 */
const req = {
  async _handle(method, url, options = {}) {
    try {
      const { body, headers, ...rest } = options;

      const config = {
        method,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "JS-cURL-Tool",
          ...headers,
        },
        ...rest,
      };

      if (body) {
        config.body = typeof body === "object" ? JSON.stringify(body) : body;
      }

      console.log(
        `${colors.yellow}Enviando ${method} para ${url}...${colors.reset}`
      );

      const response = await fetch(url, config);
      const contentType = response.headers.get("content-type");

      let data;
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
      };
    } catch (error) {
      return { error: error.message };
    }
  },

  get(url, opts) {
    return this._handle("GET", url, opts);
  },
  post(url, body, opts) {
    return this._handle("POST", url, { body, ...opts });
  },
  put(url, body, opts) {
    return this._handle("PUT", url, { body, ...opts });
  },
  delete(url, opts) {
    return this._handle("DELETE", url, opts);
  },
  patch(url, body, opts) {
    return this._handle("PATCH", url, { body, ...opts });
  },
};

async function run() {
  const code = process.argv[2];

  if (!code || code === "--help" || code === "-h") {
    console.log(`${colors.bright}JS-cURL CLI${colors.reset}`);
    console.log(`Uso: jscurl "await req.post('url', { dado: 1 })"`);
    process.exit(0);
  }

  try {
    // Criamos uma função assíncrona para permitir o uso de 'await' no código do usuário
    const AsyncFunction = Object.getPrototypeOf(
      async function () {}
    ).constructor;
    const execute = new AsyncFunction(
      "req",
      `
      try {
        const result = ${code.startsWith("await") ? code : "await " + code};
        return result;
      } catch (e) {
        return { error: e.message };
      }
    `
    );

    const result = await execute(req);
    logResult(result);
  } catch (err) {
    console.error(`${colors.red}Erro de Sintaxe:${colors.reset}`, err.message);
  }
}

run();
