// Lets `node --test` load the game's own modules.
//
// The source imports its siblings without an extension ("./motion"), which
// Vite and tsc's bundler resolution accept but Node's ESM loader does not.
// This retries a failed relative import with ".ts" appended, so tests can
// import real modules instead of only the import-free ones.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      const relative = specifier.startsWith("./") || specifier.startsWith("../");
      if (relative && error?.code === "ERR_MODULE_NOT_FOUND" && !/\.[cm]?[jt]s$/.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});
