import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const execPromise = promisify(exec);

// No ESM, precisamos reconstruir o __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho para o ficheiro binário da sua CLI
// Ajuste para garantir que o caminho está correto em relação ao local do teste
const cliPath = path.resolve(__dirname, "../bin/jscurl.js");

/**
 * Helper para executar o comando jscurl via node
 * Combinamos stdout e stderr para capturar erros de inicialização da lib
 */
async function runCli(args) {
  // Debug: Verifica se o arquivo existe antes de tentar rodar
  if (!fs.existsSync(cliPath)) {
    return {
      output: `ERRO: Arquivo não encontrado em ${cliPath}`,
      error: true,
    };
  }

  // Escapar aspas duplas dentro dos argumentos para evitar quebra no shell
  const escapedArgs = args.replace(/"/g, '\\"');
  const command = `node "${cliPath}" "${escapedArgs}"`;

  try {
    const { stdout, stderr } = await execPromise(command);
    const stripAnsi = (str: string) =>
      str.replace(
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
        ""
      );
    const rawOutput = stdout + stderr;
    return { output: stripAnsi(rawOutput), error: null, command };
  } catch (error) {
    return {
      output:
        (error.stdout || "") + (error.stderr || "") + (error.message || ""),
      error: error,
      command,
    };
  }
}

describe("Reqify CLI (jscurl) - Native Tests", () => {
  it("deve exibir o menu de ajuda quando executado com --help", async () => {
    const { output, command } = await runCli("--help");

    assert.ok(
      output.includes("JS-cURL CLI"),
      `O output deveria conter o título.\nComando: ${command}\nRecebido: ${output}`
    );
    assert.ok(
      output.includes("Uso:"),
      `Deveria conter 'Uso:'. Recebido: ${output}`
    );
  });

  it("deve executar um GET simples com sucesso", async () => {
    const { output, command } = await runCli(
      "req.get('https://jsonplaceholder.typicode.com/todos/1')"
    );

    assert.ok(
      output.includes("Enviando GET para") || output.includes("200"),
      `Deveria logar o envio ou status 200.\nComando: ${command}\nRecebido: ${output}`
    );
    assert.ok(
      output.includes("status: 200"),
      `O status deve ser 200. Recebido: ${output}`
    );
    assert.ok(
      output.includes("userId: 1"),
      `O corpo da resposta deve conter 'userId: 1'. Recebido: ${output}`
    );
  });

  it("deve permitir manipular o resultado com JavaScript puro", async () => {
    const { output, command } = await runCli(
      "(await req.get('https://jsonplaceholder.typicode.com/todos/1')).data.title"
    );

    assert.ok(
      output.includes("--- Resposta Reqify ---") || output.includes("delectus"),
      `Deve mostrar o cabeçalho ou o dado esperado.\nComando: ${command}\nRecebido: ${output}`
    );
    assert.ok(
      output.includes("delectus aut autem"),
      `Deve conter o valor da propriedade filtrada. Recebido: ${output}`
    );
  });

  it("deve lidar com erros de sintaxe JavaScript de forma elegante", async () => {
    const { output, command } = await runCli(
      "req.get(variavel_inexistente_sem_aspas)"
    );

    assert.ok(
      output.includes("Erro de Execução:") ||
        output.includes("error:") ||
        output.includes("is not defined"),
      `Deve capturar o erro e exibir mensagem amigável.\nComando: ${command}\nRecebido: ${output}`
    );
  });

  it("deve mostrar o status correto mesmo em rotas inválidas", async () => {
    const { output, command } = await runCli(
      "req.get('https://jsonplaceholder.typicode.com/invalid-route-404')"
    );

    assert.ok(
      output.includes("status: 404") || output.includes("404"),
      `Deve reportar o status 404 corretamente.\nComando: ${command}\nRecebido: ${output}`
    );
  });
});
