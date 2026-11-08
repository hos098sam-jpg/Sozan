import "dotenv/config";
import path from "path";
import fs from "fs";
import express from "express";
import { app, initFirebaseAdmin } from "./src/server/apiApp";

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return undefined;
}

const PORT = Number(process.env.PORT || getArg("--port")) || 3000;
const HOST = process.env.HOST || getArg("--host") || "0.0.0.0";

// Prevent transient stream/socket resets from crashing the server process
process.on("uncaughtException", (err: any) => {
  console.warn("[Server UncaughtException Guard]:", err?.message || err);
});

process.on("unhandledRejection", (reason: any) => {
  console.warn("[Server UnhandledRejection Guard]:", reason?.message || reason);
});

// Ensure admin initialized on launch
initFirebaseAdmin();

async function startServer() {
  const distPath = path.join(process.cwd(), "dist");
  const isProd = process.env.NODE_ENV === "production";

  // Vite middleware for development or static serving for production
  if (!isProd) {
    // Prevent Vite's SPA fallback from capturing unhandled /api calls as index.html
    app.use("/api", (req, res) => {
      res.status(404).json({
        success: false,
        error: `المسار البرمجي غير موجود: ${req.originalUrl || req.url}`,
      });
    });

    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api")) {
        return res.status(404).json({
          success: false,
          error: `المسار البرمجي غير موجود: ${req.originalUrl || req.url}`,
        });
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.sendFile("index.html", { root: distPath });
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`🚀 منصة المتفلسفة  التعليمية Server running on http://${HOST}:${PORT}`);
  });

  server.on("error", (err: any) => {
    console.error("Server listen error:", err);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

export { app };
