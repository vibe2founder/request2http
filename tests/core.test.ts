import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { reqify, asUrl, asHeaderName, asHeaderValue } from "../src/index.js";

describe("Core API Tests", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("HTTP Methods", () => {
    it("deve executar GET corretamente", async () => {
      global.fetch = mock(async (url, options) => {
        return new Response(JSON.stringify({ method: options?.method }), {
          status: 200,
        });
      });

      const response = await reqify.get(asUrl("https://api.example.com/users"));

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ method: "GET" });
    });

    it("deve executar POST com body corretamente", async () => {
      let capturedBody: any;
      global.fetch = mock(async (url, options) => {
        capturedBody = options?.body;
        return new Response(JSON.stringify({ success: true }), { status: 201 });
      });

      const data = { name: "John Doe", age: 30 };
      await reqify.post(asUrl("https://api.example.com/users"), data);

      expect(capturedBody).toBe(JSON.stringify(data));
    });

    it("deve executar PUT corretamente", async () => {
      global.fetch = mock(async (url, options) => {
        return new Response(JSON.stringify({ method: options?.method }), {
          status: 200,
        });
      });

      const response = await reqify.put(
        asUrl("https://api.example.com/users/1"),
        { name: "Jane" }
      );
      expect(response.data.method).toBe("PUT");
    });

    it("deve executar DELETE corretamente", async () => {
      global.fetch = mock(async (url, options) => {
        return new Response(null, { status: 204 });
      });

      const response = await reqify.delete(
        asUrl("https://api.example.com/users/1")
      );
      expect(response.status).toBe(204);
    });
  });

  describe("Configuration & Features", () => {
    it("deve adicionar query parameters à URL", async () => {
      let capturedUrl: string = "";
      global.fetch = mock(async (url) => {
        capturedUrl = url.toString();
        return new Response(JSON.stringify({}), { status: 200 });
      });

      await reqify.get(asUrl("https://api.example.com/search"), {
        params: { q: "bun", limit: 10, active: true },
      });

      const url = new URL(capturedUrl);
      expect(url.searchParams.get("q")).toBe("bun");
      expect(url.searchParams.get("limit")).toBe("10");
      expect(url.searchParams.get("active")).toBe("true");
    });

    it("deve enviar headers customizados", async () => {
      let capturedHeaders: Headers | undefined;
      global.fetch = mock(async (url, options) => {
        capturedHeaders = new Headers(options?.headers);
        return new Response("{}", { status: 200 });
      });

      await reqify.get(asUrl("https://api.example.com/data"), {
        headers: {
          [asHeaderName("X-Custom-Token")]: asHeaderValue("abc-123"),
          [asHeaderName("Authorization")]: asHeaderValue("Bearer token"),
        },
      });

      expect(capturedHeaders?.get("x-custom-token")).toBe("abc-123");
      expect(capturedHeaders?.get("authorization")).toBe("Bearer token");
    });

    it('deve respeitar responseType="text"', async () => {
      global.fetch = mock(async () => {
        return new Response('{"not": "json", "raw": "text"}', { status: 200 });
      });

      const response = await reqify.get(asUrl("https://api.example.com/text"), {
        responseType: "text",
      });

      expect(typeof response.data).toBe("string");
      expect(response.data).toBe('{"not": "json", "raw": "text"}');
    });

    it("deve tratar null body corretamente (não enviar content-type)", async () => {
      let capturedHeaders: any;
      global.fetch = mock(async (url, options) => {
        capturedHeaders = options?.headers || {};
        return new Response("{}", { status: 200 });
      });

      await reqify.get(asUrl("https://api.example.com/data"));

      // GET requests usually don't have body, so no Content-Type should be set automatically for JSON
      expect(capturedHeaders["Content-Type"]).toBeUndefined();
    });
  });
});
