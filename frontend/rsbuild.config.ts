import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

const certsDir = path.resolve(__dirname, "certs");

// https://rsbuild.dev/guide/basic/configure-rsbuild
export default defineConfig({
  plugins: [pluginReact()],
  html: {
    favicon: "src/assets/favicon.ico",
    title: "JHAM 자산관리",
  },
  server: {
    https: {
      key: fs.readFileSync(path.join(certsDir, "localhost+2-key.pem")),
      cert: fs.readFileSync(path.join(certsDir, "localhost+2.pem")),
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5150",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
