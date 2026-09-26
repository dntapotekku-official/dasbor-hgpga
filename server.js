const { createServer } = require("node:http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.APP_HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3001);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function start_server() {
  await app.prepare();

  const http_server = createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (error) {
      console.error("Request gagal diproses:", error);

      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    }
  });

  const io = new Server(http_server);

  globalThis.io = io;

  io.on("connection", (socket) => {
    if (dev) console.log("Socket connected:", socket.id);

    socket.on("disconnect", () => {
      if (dev) console.log("Socket disconnected:", socket.id);
    });
  });

  let is_shutting_down = false;
  const shutdown = (signal) => {
    if (is_shutting_down) return;
    is_shutting_down = true;
    console.log(`${signal} diterima, menghentikan server...`);

    http_server.close(() => {
      io.close();
      process.exit(0);
    });

    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));

  http_server.on("error", (error) => {
    console.error("Server HTTP gagal:", error);
    process.exit(1);
  });

  http_server.listen(port, hostname, () => {
    console.log(`Ready on http://${hostname}:${port}`);
  });
}

start_server().catch((error) => {
  console.error("Server gagal dijalankan:", error);
  process.exit(1);
});
