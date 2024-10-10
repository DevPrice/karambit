import globals from "globals"
import baseConfig from "@devprice/eslint-config"

export default [
    {
        ignores: ["**/build/", "**/lib/", "**/karambit-generated/"],
    },
    ...baseConfig, {
        languageOptions: {
            globals: {
                ...globals.node,
            },
            ecmaVersion: 2023,
        },
    }
]
