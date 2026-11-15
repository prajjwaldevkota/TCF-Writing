import { defineConfig, loadEnv } from "vite";
import geminiBackupHandler from "./api/gemini";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backupConfigured = Boolean(
    process.env.GEMINI_BACKUP_KEY || env.GEMINI_BACKUP_KEY,
  );
  const model =
    process.env.GEMINI_MODEL || env.GEMINI_MODEL || "gemini-3.8-flash";
  const installBackupRoute = (server: any) => {
    server.middlewares.use("/api/gemini", async (req: any, res: any) => {
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
        if (!process.env.GEMINI_BACKUP_KEY && env.GEMINI_BACKUP_KEY)
          process.env.GEMINI_BACKUP_KEY = env.GEMINI_BACKUP_KEY;
        const response = await geminiBackupHandler(
          new Request("http://localhost/api/gemini", {
            method: req.method,
            headers: req.headers,
            ...(req.method !== "GET" && req.method !== "HEAD" ? { body } : {}),
          }),
        );
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(await response.text());
      } catch {
        res.statusCode = 500;
        res.end("Gemini backup transport failed.");
      }
    });
  };
  return {
    define: {
      "import.meta.env.VITE_GEMINI_SERVER_BACKUP":
        JSON.stringify(backupConfigured),
      "import.meta.env.VITE_GEMINI_MODEL": JSON.stringify(model),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    plugins: [
      {
        name: "local-gemini-backup",
        configureServer: installBackupRoute,
        configurePreviewServer: installBackupRoute,
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
