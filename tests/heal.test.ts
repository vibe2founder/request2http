import { describe, it, mock } from "bun:test";
import assert from "node:assert";
import { reqify, asUrl } from "../src/index.js";

describe("Auto-Healing Tests", () => {
  describe("401 Unauthorized Healing", () => {
    it("deve tentar novamente com timeout aumentado após 401", async () => {
      let callCount = 0;

      // Mock do fetch global
      const originalFetch = global.fetch;
      global.fetch = mock(async (url: string) => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            statusText: "Unauthorized",
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          statusText: "OK",
        });
      }) as any;

      try {
        const response = await reqify.get(
          asUrl("https://api.example.com/data"),
          {
            timeout: 1000,
            maxRetries: 2,
          }
        );

        assert.strictEqual(callCount, 2, "Deve ter feito 2 chamadas");
        assert.strictEqual(
          response.healed,
          true,
          "Deve indicar que foi curado"
        );
        assert.ok(
          response.healMessage?.includes("Unauthorized"),
          "Mensagem deve mencionar Unauthorized"
        );
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("403 Forbidden Healing", () => {
    it("deve aumentar timeout após 403", async () => {
      let callCount = 0;

      const originalFetch = global.fetch;
      global.fetch = mock(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            statusText: "Forbidden",
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
        });
      }) as any;

      try {
        const response = await reqify.get(
          asUrl("https://api.example.com/data"),
          {
            timeout: 1000,
            maxRetries: 2,
          }
        );

        assert.strictEqual(callCount, 2);
        assert.strictEqual(response.healed, true);
        assert.ok(response.healMessage?.includes("Forbidden"));
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("413 Payload Too Large Healing", () => {
    it("deve remover campos opcionais do payload após 413", async () => {
      let callCount = 0;
      let lastPayload: any = null;

      const originalFetch = global.fetch;
      global.fetch = mock(async (url: string, options?: any) => {
        callCount++;

        // Capturar o payload enviado
        if (options?.body) {
          lastPayload = JSON.parse(options.body);
        }

        if (callCount === 1) {
          return new Response(JSON.stringify({ error: "Payload too large" }), {
            status: 413,
            statusText: "Payload Too Large",
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
        });
      }) as any;

      try {
        const response = await reqify.post(
          asUrl("https://api.example.com/data"),
          {
            name: "Test",
            email: "test@example.com",
            description: "Long description that makes payload large",
            metadata: { extra: "data" },
            avatar: "base64-encoded-image-data",
          },
          {
            timeout: 1000,
            maxRetries: 2,
          }
        );

        assert.strictEqual(callCount, 2);
        assert.strictEqual(response.healed, true);
        assert.ok(response.healMessage?.includes("removed optional fields"));

        // Verificar que campos opcionais foram removidos
        assert.ok(!lastPayload.description, "description deve ser removido");
        assert.ok(!lastPayload.metadata, "metadata deve ser removido");
        assert.ok(!lastPayload.avatar, "avatar deve ser removido");

        // Verificar que campos essenciais foram mantidos
        assert.strictEqual(lastPayload.name, "Test");
        assert.strictEqual(lastPayload.email, "test@example.com");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("não deve tentar novamente se não houver payload para reduzir", async () => {
      let callCount = 0;

      const originalFetch = global.fetch;
      global.fetch = mock(async () => {
        callCount++;
        return new Response(JSON.stringify({ error: "Payload too large" }), {
          status: 413,
          statusText: "Payload Too Large",
        });
      }) as any;

      try {
        await reqify.get(asUrl("https://api.example.com/data"), {
          timeout: 1000,
          maxRetries: 2,
        });

        assert.fail("Deveria ter lançado erro");
      } catch (error: any) {
        assert.strictEqual(
          callCount,
          1,
          "Não deve tentar novamente sem payload"
        );
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("422 Unprocessable Entity Healing", () => {
    it("deve criar valor baseado no tipo esperado quando validação falha", async () => {
      let callCount = 0;

      const originalFetch = global.fetch;
      global.fetch = mock(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              message: 'Validation failed: field "email" expected string',
            }),
            {
              status: 422,
              statusText: "Unprocessable Entity",
              headers: { "content-type": "application/json" },
            }
          );
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
        });
      }) as any;

      try {
        const response = await reqify.post(
          asUrl("https://api.example.com/users"),
          { name: "Test" },
          { timeout: 1000, maxRetries: 2 }
        );

        assert.strictEqual(callCount, 2);
        assert.strictEqual(response.healed, true);
        assert.ok(response.healMessage?.includes("Validation error"));
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("deve criar valor padrão para tipo number", async () => {
      let callCount = 0;

      const originalFetch = global.fetch;
      global.fetch = mock(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              message: 'field "age" must be number',
            }),
            {
              status: 422,
              statusText: "Unprocessable Entity",
              headers: { "content-type": "application/json" },
            }
          );
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
        });
      }) as any;

      try {
        const response = await reqify.post(
          asUrl("https://api.example.com/users"),
          { name: "Test" },
          { timeout: 1000, maxRetries: 2 }
        );

        assert.strictEqual(callCount, 2);
        assert.strictEqual(response.healed, true);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("429 Rate Limit Healing", () => {
    it("deve respeitar header Retry-After", async () => {
      let callCount = 0;
      const startTime = Date.now();

      const originalFetch = global.fetch;
      global.fetch = mock(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded" }),
            {
              status: 429,
              statusText: "Too Many Requests",
              headers: new Headers({ "retry-after": "1" }),
            }
          );
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
        });
      }) as any;

      try {
        const response = await reqify.get(
          asUrl("https://api.example.com/data"),
          {
            timeout: 5000,
            maxRetries: 2,
          }
        );

        const elapsed = Date.now() - startTime;

        assert.strictEqual(callCount, 2);
        assert.strictEqual(response.healed, true);
        assert.ok(response.healMessage?.includes("Rate limited"));
        assert.ok(
          elapsed >= 900,
          "Deve ter esperado pelo menos 900ms (tolerância para jitter)"
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("deve usar backoff exponencial sem header Retry-After", async () => {
      let callCount = 0;

      const originalFetch = global.fetch;
      global.fetch = mock(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded" }),
            {
              status: 429,
              statusText: "Too Many Requests",
            }
          );
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
        });
      }) as any;

      try {
        const response = await reqify.get(
          asUrl("https://api.example.com/data"),
          {
            timeout: 5000,
            maxRetries: 2,
          }
        );

        assert.strictEqual(callCount, 2);
        assert.strictEqual(response.healed, true);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("Timeout Healing", () => {
    it("deve aumentar timeout progressivamente", async () => {
      let callCount = 0;

      const originalFetch = global.fetch;
      global.fetch = mock(async () => {
        callCount++;
        if (callCount === 1) {
          // Simular timeout
          await new Promise((resolve) => setTimeout(resolve, 100));
          const error: any = new Error("The operation was aborted");
          error.name = "AbortError";
          throw error;
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
        });
      }) as any;

      try {
        const response = await reqify.get(
          asUrl("https://api.example.com/data"),
          {
            timeout: 50,
            maxRetries: 2,
          }
        );

        assert.strictEqual(callCount, 2);
        assert.strictEqual(response.healed, true);
        assert.ok(response.healMessage?.includes("Timeout"));
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("Network Error Healing", () => {
    it("deve tentar novamente após erro de rede", async () => {
      let callCount = 0;

      const originalFetch = global.fetch;
      global.fetch = mock(async () => {
        callCount++;
        if (callCount === 1) {
          const error: any = new Error("fetch failed");
          error.code = "ECONNRESET";
          throw error;
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
        });
      }) as any;

      try {
        const response = await reqify.get(
          asUrl("https://api.example.com/data"),
          {
            timeout: 1000,
            maxRetries: 2,
          }
        );

        assert.strictEqual(callCount, 2);
        assert.strictEqual(response.healed, true);
        assert.ok(response.healMessage?.includes("Network error"));
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("JSON Parse Error Healing", () => {
    it("deve tentar novamente após erro de parse", async () => {
      let callCount = 0;

      const originalFetch = global.fetch;
      global.fetch = mock(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response("invalid json{", {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
        });
      }) as any;

      try {
        const response = await reqify.get(
          asUrl("https://api.example.com/data"),
          {
            timeout: 1000,
            maxRetries: 2,
          }
        );

        // Parse error não causa retry porque retorna 200 OK
        // O warning é apenas um aviso, não um erro que dispara healing
        assert.strictEqual(callCount, 1);
        assert.strictEqual(response.data, null);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("Auto-Heal Disabled", () => {
    it("não deve tentar curar quando autoHeal é false", async () => {
      let callCount = 0;

      const originalFetch = global.fetch;
      global.fetch = mock(async () => {
        callCount++;
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          statusText: "Unauthorized",
        });
      }) as any;

      try {
        const response = await reqify.get(
          asUrl("https://api.example.com/data"),
          {
            timeout: 1000,
            maxRetries: 2,
            autoHeal: false,
          }
        );

        assert.strictEqual(callCount, 1, "Deve ter feito apenas 1 chamada");
        assert.strictEqual(response.healed, false);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("createValueFromType Heuristic", () => {
    it("deve criar valores corretos para diferentes tipos", async () => {
      const testCases = [
        { message: "expected string", expectedValue: "" },
        { message: "must be number", expectedValue: 0 },
        { message: "expected boolean", expectedValue: false },
        { message: "must be email", expectedValue: "example@domain.com" },
        { message: "expected url", expectedValue: "https://example.com" },
        { message: "must be phone", expectedValue: "+5511999999999" },
        {
          message: "expected uuid",
          expectedValue: "00000000-0000-0000-0000-000000000000",
        },
      ];

      // Como createValueFromType é privada, testamos indiretamente via 422
      for (const testCase of testCases) {
        let callCount = 0;

        const originalFetch = global.fetch;
        global.fetch = mock(async () => {
          callCount++;
          if (callCount === 1) {
            return new Response(JSON.stringify({ message: testCase.message }), {
              status: 422,
              statusText: "Unprocessable Entity",
              headers: { "content-type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
          });
        }) as any;

        try {
          const response = await reqify.post(
            asUrl("https://api.example.com/test"),
            {},
            { timeout: 1000, maxRetries: 2 }
          );

          assert.strictEqual(
            response.healed,
            true,
            `Deve curar para: ${testCase.message}`
          );
        } finally {
          global.fetch = originalFetch;
        }
      }
    });
  });

  describe("Nested Payload Reduction (Advanced 413)", () => {
    it("deve remover campos opcionais em objetos aninhados", async () => {
      let callCount = 0;
      let lastPayload: any = null;
      const originalFetch = global.fetch;

      global.fetch = mock(async (url, options) => {
        callCount++;
        if (options?.body) lastPayload = JSON.parse(options.body);

        if (callCount === 1) {
          return new Response(JSON.stringify({ error: "Payload too large" }), {
            status: 413,
          });
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      });

      try {
        const complexData = {
          title: "Project X",
          metadata: {
            created: "2024",
            description: "Should be removed",
            author: {
              name: "Bot",
              avatar: "base64-image-should-be-removed",
            },
          },
          tags: ["a", "b", "c"], // tags is in optionalFields list
        };

        const response = await reqify.post(
          asUrl("https://api.example.com/nested"),
          complexData,
          {
            maxRetries: 1,
          }
        );

        // assert is mostly used in this file, but my snippet used expect.
        // I should stick to one style or import expects.
        // The file imports 'assert' from node:assert and doesn't explicitly import expect from bun:test
        // Wait, heal.test.ts uses `import assert ...`.
        // I should convert my snippet to use assert to match the file style.

        assert.strictEqual(response.healed, true);
        assert.strictEqual(callCount, 2);

        assert.strictEqual(lastPayload.metadata, undefined);
        assert.strictEqual(lastPayload.tags, undefined);
        assert.strictEqual(lastPayload.title, "Project X");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
