import globals from "globals"
import baseConfig from "@devprice/eslint-config"

export default [
    {
        ignores: ["**/build/", "**/lib/", "**/karambit-generated/", "**/docs/"],
    },
    ...baseConfig, {
        languageOptions: {
            globals: {
                ...globals.node,
            },
            ecmaVersion: 2023,
        },
    },
    {
        // The compiler package is the only thing that talks to TypeScript directly. Keeping every other
        // module behind it is what lets the compiler backend be replaced without touching call sites,
        // and what lets src/compiler be lifted out into its own package.
        // Scoped to Karambit's own sources: the integration project is a consumer of Karambit and
        // uses the TypeScript API on its own account.
        files: ["src/**/*.ts"],
        ignores: ["src/compiler/**"],
        rules: {
            "no-restricted-imports": ["error", {
                paths: [{
                    name: "typescript",
                    message: "Import from src/compiler instead. Only src/compiler may depend on the TypeScript API directly.",
                }],
            }],
        },
    },
]
