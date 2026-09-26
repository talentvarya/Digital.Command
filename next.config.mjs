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
    // with the route whose server actions draw the graphics.
    outputFileTracingIncludes: {
      "/app/planner": ["./node_modules/harfbuzzjs/hb.wasm"],
    },
  },
};

export default nextConfig;
