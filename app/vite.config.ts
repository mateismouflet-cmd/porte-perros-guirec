import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'plugin-inspect-react-code'

// L'API SHOM (services.data.shom.fr) refuse les appels dont le Referer n'est
// pas maree.shom.fr — un navigateur ne peut pas falsifier cet en-tête, d'où
// ce proxy. La clé fait partie de l'URL publique embarquée dans maree.shom.fr ;
// si le SHOM la change, la récupérer dans le HTML de maree.shom.fr
// (champ "hdmServiceUrl") et la mettre à jour ici.
const SHOM_HDM = '/b2q8lrcdl4s04cbabsj4nhcb/hdm';

const shomProxy = {
  '/api/shom': {
    target: 'https://services.data.shom.fr',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/api\/shom/, SHOM_HDM),
    headers: {
      Referer: 'https://maree.shom.fr/',
    },
  },
};

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  server: {
    port: 3000,
    proxy: shomProxy,
  },
  preview: {
    proxy: shomProxy,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
