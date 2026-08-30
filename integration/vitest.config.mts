import {defineConfig} from "vitest/config"

export default defineConfig({
    test: {
        globals: true,
        include: ["test/**/*.ts"],
        environment: "node",
        // the failure fixtures are compiled by the tests themselves, not collected as tests
        exclude: ["failures/**", "node_modules/**"],
        testTimeout: 30_000,
    },
})
