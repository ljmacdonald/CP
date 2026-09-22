// Vitest runs service files directly in Node, outside Next.js's bundler,
// where the real `server-only` package unconditionally throws (it relies on
// Next's webpack alias to swap in a no-op for server compilation targets).
// This stub replaces it for the test environment only — see vitest.config.ts.
export {};
