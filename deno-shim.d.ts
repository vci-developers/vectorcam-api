// deno-shim.d.ts
// This file silences TypeScript errors for Deno types referenced by some dependencies.
declare namespace Deno {
  interface ServeOptions {}
  interface HttpServer {}
  interface NetAddr {}
  interface ServeHandlerInfo<T = any> {}
} 