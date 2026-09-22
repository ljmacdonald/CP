import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Temporarily on while diagnosing a client-side crash in the deposit flow —
  // without this, production errors only show minified vendor-chunk names
  // (e.g. "3tqcrzf4ffm7k.js:1:79321") with no way to tell which library or
  // line actually threw. Safe to turn back off once resolved.
  productionBrowserSourceMaps: true,
};

export default nextConfig;
