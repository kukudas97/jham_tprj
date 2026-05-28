import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

const certsDir = path.resolve(__dirname, "certs");
const keyPath = path.join(certsDir, "localhost+2-key.pem");
const certPath = path.join(certsDir, "localhost+2.pem");
const hasLocalCerts = fs.existsSync(keyPath) && fs.existsSync(certPath);

export default defineConfig({
  plugins: [pluginReact()],
  html: {
    favicon: "src/assets/favicon.ico",
    title: "JHAM 자산관리",
  },
  server: {
    ...(hasLocalCerts && {
      https: {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      },
    }),
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5150",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
