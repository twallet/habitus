import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Vite configuration for frontend.
 * In development, Vite is used as middleware in Express server, so no proxy is needed.
 * @public
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Habitus - Habit Tracker",
        short_name: "Habitus",
        description: "Modern full-stack habit tracking application.",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        orientation: "portrait",
        categories: ["productivity", "lifestyle"],
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        screenshots: [
          {
            src: "screenshot-desktop.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "Desktop Dashboard"
          },
          {
            src: "screenshot-mobile.png",
            sizes: "750x1334",
            type: "image/png",
            form_factor: "narrow",
            label: "Mobile Tracking"
          }
        ]
      },
    }),
  ],
  logLevel: "warn",
  clearScreen: false,
  // Load .env from config folder to unify environment variables
  envDir: path.resolve(__dirname, "../config"),
  build: {
    cssMinify: false,
    minify: "esbuild",
    cssCodeSplit: true,
  },
});
