import * as assert from "assert"
import * as ts from "../src/compiler/index.js"

describe("TypescriptUtil", () => {
    describe("Remove module file extensions", () => {
        it("removes a .ts extension", () => {
            assert.strictEqual(ts.removeModuleFileExtension("./StockCommands.ts"), "./StockCommands")
        })
        it("removes a .tsx extension", () => {
            assert.strictEqual(ts.removeModuleFileExtension("./StockCommands.tsx"), "./StockCommands")
        })
        it("removes .mts and .cts extensions", () => {
            assert.strictEqual(ts.removeModuleFileExtension("../views/StockCommands.mts"), "../views/StockCommands")
            assert.strictEqual(ts.removeModuleFileExtension("../views/StockCommands.cts"), "../views/StockCommands")
        })
        it("removes a declaration extension entirely", () => {
            assert.strictEqual(ts.removeModuleFileExtension("./StockCommands.d.ts"), "./StockCommands")
            assert.strictEqual(ts.removeModuleFileExtension("./StockCommands.d.mts"), "./StockCommands")
        })
        it("removes JavaScript extensions", () => {
            assert.strictEqual(ts.removeModuleFileExtension("./StockCommands.js"), "./StockCommands")
            assert.strictEqual(ts.removeModuleFileExtension("./StockCommands.jsx"), "./StockCommands")
        })
        it("leaves unknown extensions alone", () => {
            assert.strictEqual(ts.removeModuleFileExtension("./StockCommands.json"), "./StockCommands.json")
            assert.strictEqual(ts.removeModuleFileExtension("./StockCommands"), "./StockCommands")
        })
        it("keeps dots that are part of the file name", () => {
            assert.strictEqual(ts.removeModuleFileExtension("./Stock.Commands.tsx"), "./Stock.Commands")
        })
        it("does not strip a name that is only an extension", () => {
            assert.strictEqual(ts.removeModuleFileExtension(".ts"), ".ts")
        })
    })
    describe("Emitted module file extensions", () => {
        const options: ts.CompilerOptions = {}
        it("maps TypeScript extensions to the JavaScript they emit", () => {
            assert.strictEqual(ts.getEmittedModuleFileExtension("./StockCommands.ts", options), ".js")
            assert.strictEqual(ts.getEmittedModuleFileExtension("./StockCommands.tsx", options), ".js")
            assert.strictEqual(ts.getEmittedModuleFileExtension("./StockCommands.mts", options), ".mjs")
            assert.strictEqual(ts.getEmittedModuleFileExtension("./StockCommands.cts", options), ".cjs")
        })
        it("maps declaration extensions to the JavaScript they describe", () => {
            assert.strictEqual(ts.getEmittedModuleFileExtension("./StockCommands.d.ts", options), ".js")
            assert.strictEqual(ts.getEmittedModuleFileExtension("./StockCommands.d.mts", options), ".mjs")
            assert.strictEqual(ts.getEmittedModuleFileExtension("./StockCommands.d.cts", options), ".cjs")
        })
        it("leaves JavaScript extensions alone", () => {
            assert.strictEqual(ts.getEmittedModuleFileExtension("./StockCommands.js", options), ".js")
            assert.strictEqual(ts.getEmittedModuleFileExtension("./StockCommands.mjs", options), ".mjs")
            assert.strictEqual(ts.getEmittedModuleFileExtension("./StockCommands.cjs", options), ".cjs")
        })
        it("emits .jsx only when JSX is preserved", () => {
            assert.strictEqual(ts.getEmittedModuleFileExtension("./StockCommands.tsx", {jsx: ts.JsxEmit.Preserve}), ".jsx")
            assert.strictEqual(ts.getEmittedModuleFileExtension("./StockCommands.tsx", {jsx: ts.JsxEmit.ReactNative}), ".jsx")
            assert.strictEqual(ts.getEmittedModuleFileExtension("./StockCommands.tsx", {jsx: ts.JsxEmit.ReactJSX}), ".js")
            assert.strictEqual(ts.getEmittedModuleFileExtension("./StockCommands.jsx", {jsx: ts.JsxEmit.Preserve}), ".jsx")
        })
        it("keeps the source extension when TypeScript extensions may be imported", () => {
            const tsExtensions: ts.CompilerOptions = {allowImportingTsExtensions: true}
            assert.strictEqual(ts.getEmittedModuleFileExtension("./StockCommands.ts", tsExtensions), ".ts")
            assert.strictEqual(ts.getEmittedModuleFileExtension("./StockCommands.tsx", tsExtensions), ".tsx")
            assert.strictEqual(ts.getEmittedModuleFileExtension("./StockCommands.mts", tsExtensions), ".mts")
        })
        it("never keeps a declaration extension, which is not importable", () => {
            const tsExtensions: ts.CompilerOptions = {allowImportingTsExtensions: true}
            assert.strictEqual(ts.getEmittedModuleFileExtension("./StockCommands.d.ts", tsExtensions), ".js")
        })
        it("returns nothing for a path with no module extension", () => {
            assert.strictEqual(ts.getEmittedModuleFileExtension("./StockCommands", options), "")
        })
    })
})
