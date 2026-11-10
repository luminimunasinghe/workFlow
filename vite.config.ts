import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";

// Saves all app data into ONE json file (data/lumiflow-data.json) while `npm run dev` is running.
function dataFile(): Plugin {
  const file = path.resolve("data", "lumiflow-data.json");
  return {
    name: "lumiflow-data-file",
    configureServer(server) {
      server.middlewares.use("/api/data", (req, res) => {
        if (req.method === "POST") {
          let body = "";
          req.on("data", (c: Buffer) => (body += c));
          req.on("end", () => {
            try {
              JSON.parse(body);
              fs.mkdirSync(path.dirname(file), { recursive: true });
              if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== body) {
                fs.writeFileSync(file, body);
              }
              res.end("ok");
            } catch {
              res.statusCode = 400;
              res.end("bad json");
            }
          });
        } else {
          res.setHeader("Content-Type", "application/json");
          res.end(fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "null");
        }
      });
    },
  };
}
export default defineConfig({
  plugins: [react(), tailwindcss(), dataFile()],
  server: { watch: { ignored: ["**/data/lumiflow-data.json"] } },
});
