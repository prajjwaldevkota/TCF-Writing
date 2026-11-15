import { defineConfig, loadEnv } from "vite";
import geminiHandler from "./api/gemini";
import errorLogHandler from "./api/error-logs";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const model =
    process.env.GEMINI_MODEL || env.GEMINI_MODEL || "gemini-3.8-flash";
  const installGeminiRoute = (server: any) => {
    for (const [route, handler] of [
      ["/api/gemini", geminiHandler],
      ["/api/error-logs", errorLogHandler],
    ] as const) {
      server.middlewares.use(route, async (req: any, res: any) => {
        try {
          let body = "";
          for await (const chunk of req) {
            body += chunk;
            if (body.length > 1_000_000) {
              res.statusCode = 413;
              res.end();
              return;
            }
          }
          // Match the server-only variable contract locally without exposing its value.
          for (const name of [
            "GEMINI_API_KEY",
            "GEMINI_BACKUP_KEY",
            "GEMINI_BACKUP_API_KEY",
            "VITE_GEMINI_API_KEY",
            "SUPABASE_SERVICE_ROLE_KEY",
            "SUPABASE_URL",
            "VITE_SUPABASE_URL",
          ]) {
            if (!process.env[name] && env[name]) process.env[name] = env[name];
          }
          const response = await handler(
            new Request(`http://${req.headers.host}${route}`, {
              method: req.method,
              headers: req.headers,
              ...(req.method !== "GET" && req.method !== "HEAD"
                ? { body }
                : {}),
            }),
          );
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(await response.text());
        } catch {
          res.statusCode = 500;
          res.end("Gemini server transport failed.");
        }
      });
    }
  };
  return {
    // Only public Supabase settings may be read from VITE-prefixed environment
    // variables. Even the legacy VITE_GEMINI_API_KEY stays out of browser builds.
    envPrefix: ["VITE_SUPABASE_"],
    define: {
      "import.meta.env.VITE_GEMINI_MODEL": JSON.stringify(model),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    plugins: [
      {
        name: "local-gemini-server",
        configureServer: installGeminiRoute,
        configurePreviewServer: installGeminiRoute,
      },
      react(),
      legacy({
        targets: ["defaults", "Chrome >= 60", "Android >= 7", "Safari >= 12"],
        modernTargets: [
          "chrome >= 70",
          "edge >= 79",
          "firefox >= 68",
          "safari >= 12",
        ],
        additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
      }),
    ],
    base: "./",
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: {
            "questions-data": ["./src/data/questions.json"],
            "supabase-vendor": ["@supabase/supabase-js"],
          },
        },
      },
    },
    server: {
      host: true,
      port: 3000,
    },
    preview: {
      host: true,
      port: 3000,
    },
  };
});
