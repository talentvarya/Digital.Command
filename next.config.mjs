/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Creative Studio renders post graphics on the server. satori loads a
    // harfbuzz .wasm file from disk (for text shaping, incl. Hindi) and sharp is
    // a native binary — neither survives being bundled by webpack, so Node loads
    // them straight from node_modules instead.
    serverComponentsExternalPackages: ["satori", "harfbuzzjs", "sharp"],
    // harfbuzzjs finds hb.wasm by a runtime path, which Next's file tracing can't
    // see, so it would be missing from the deployed function. Ship it explicitly
    // with each route that draws with satori: the planner's graphics (server
    // actions) and the report PDF download (brackets are escaped because the
    // key is a glob).
    outputFileTracingIncludes: {
      "/app/planner": ["./node_modules/harfbuzzjs/hb.wasm"],
      "/app/reports/\\[id\\]/pdf": ["./node_modules/harfbuzzjs/hb.wasm"],
    },
  },
};

export default nextConfig;
