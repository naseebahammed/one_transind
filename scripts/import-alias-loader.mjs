// Lets plain Node load the app's own modules: "@/lib/db" becomes the script's connection (import-db-stub.mjs), any other "@/x" becomes ../x.ts.
const stub = new URL("./import-db-stub.mjs", import.meta.url).href;
const root = new URL("../", import.meta.url);

export async function resolve(specifier, context, next) {
  if (specifier === "@/lib/db") return { url: stub, shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const path = specifier.slice(2);
    return { url: new URL(/\.\w+$/.test(path) ? path : `${path}.ts`, root).href, shortCircuit: true };
  }
  return next(specifier, context);
}
