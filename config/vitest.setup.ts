/**
 * Unified Vitest setup file that loads both backend and frontend setups
 * Each setup file will only run its setup code when needed
 */

// Load both setup files - they handle their own environment checks
// Backend setup (for node environment)
await import("../backend/src/setup/setupTests.ts");

// Frontend setup (for jsdom environment)
await import("../frontend/src/setupTests.ts");

// Make this file a module to allow top-level await
export {};
