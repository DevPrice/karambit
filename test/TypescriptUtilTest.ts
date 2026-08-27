import * as assert from "assert"
import ts from "typescript"
import {getEmittedModuleFileExtension, removeModuleFileExtension} from "../src/TypescriptUtil"

describe("TypescriptUtil", () => {
    describe("Remove module file extensions", () => {
        it("removes a .ts extension", () => {
            assert.strictEqual(removeModuleFileExtension("./StockCommands.ts"), "./StockCommands")
        })
        it("removes a .tsx extension", () => {
            assert.strictEqual(removeModuleFileExtension("./StockCommands.tsx"), "./StockCommands")
        })
        it("removes .mts and .cts extensions", () => {
            assert.strictEqual(removeModuleFileExtension("../views/StockCommands.mts"), "../views/StockCommands")
            assert.strictEqual(removeModuleFileExtension("../views/StockCommands.cts"), "../views/StockCommands")
        })
        it("removes a declaration extension entirely", () => {
            assert.strictEqual(removeModuleFileExtension("./StockCommands.d.ts"), "./StockCommands")
            assert.strictEqual(removeModuleFileExtension("./StockCommands.d.mts"), "./StockCommands")
        })
        it("removes JavaScript extensions", () => {
            assert.strictEqual(removeModuleFileExtension("./StockCommands.js"), "./StockCommands")
            assert.strictEqual(removeModuleFileExtension("./StockCommands.jsx"), "./StockCommands")
        })
        it("leaves unknown extensions alone", () => {
            assert.strictEqual(removeModuleFileExtension("./StockCommands.json"), "./StockCommands.json")
            assert.strictEqual(removeModuleFileExtension("./StockCommands"), "./StockCommands")
        })
        it("keeps dots that are part of the file name", () => {
            assert.strictEqual(removeModuleFileExtension("./Stock.Commands.tsx"), "./Stock.Commands")
        })
        it("does not strip a name that is only an extension", () => {
            assert.strictEqual(removeModuleFileExtension(".ts"), ".ts")
        })
    })
    describe("Emitted module file extensions", () => {
        const options: ts.CompilerOptions = {}
        it("maps TypeScript extensions to the JavaScript they emit", () => {
            assert.strictEqual(getEmittedModuleFileExtension("./StockCommands.ts", options), ".js")
            assert.strictEqual(getEmittedModuleFileExtension("./StockCommands.tsx", options), ".js")
            assert.strictEqual(getEmittedModuleFileExtension("./StockCommands.mts", options), ".mjs")
            assert.strictEqual(getEmittedModuleFileExtension("./StockCommands.cts", options), ".cjs")
        })
        it("maps declaration extensions to the JavaScript they describe", () => {
            assert.strictEqual(getEmittedModuleFileExtension("./StockCommands.d.ts", options), ".js")
            assert.strictEqual(getEmittedModuleFileExtension("./StockCommands.d.mts", options), ".mjs")
            assert.strictEqual(getEmittedModuleFileExtension("./StockCommands.d.cts", options), ".cjs")
        })
        it("leaves JavaScript extensions alone", () => {
            assert.strictEqual(getEmittedModuleFileExtension("./StockCommands.js", options), ".js")
            assert.strictEqual(getEmittedModuleFileExtension("./StockCommands.mjs", options), ".mjs")
            assert.strictEqual(getEmittedModuleFileExtension("./StockCommands.cjs", options), ".cjs")
        })
        it("emits .jsx only when JSX is preserved", () => {
            assert.strictEqual(getEmittedModuleFileExtension("./StockCommands.tsx", {jsx: ts.JsxEmit.Preserve}), ".jsx")
            assert.strictEqual(getEmittedModuleFileExtension("./StockCommands.tsx", {jsx: ts.JsxEmit.ReactNative}), ".jsx")
            assert.strictEqual(getEmittedModuleFileExtension("./StockCommands.tsx", {jsx: ts.JsxEmit.ReactJSX}), ".js")
            assert.strictEqual(getEmittedModuleFileExtension("./StockCommands.jsx", {jsx: ts.JsxEmit.Preserve}), ".jsx")
        })
        it("keeps the source extension when TypeScript extensions may be imported", () => {
            const tsExtensions: ts.CompilerOptions = {allowImportingTsExtensions: true}
            assert.strictEqual(getEmittedModuleFileExtension("./StockCommands.ts", tsExtensions), ".ts")
            assert.strictEqual(getEmittedModuleFileExtension("./StockCommands.tsx", tsExtensions), ".tsx")
            assert.strictEqual(getEmittedModuleFileExtension("./StockCommands.mts", tsExtensions), ".mts")
        })
        it("never keeps a declaration extension, which is not importable", () => {
            const tsExtensions: ts.CompilerOptions = {allowImportingTsExtensions: true}
            assert.strictEqual(getEmittedModuleFileExtension("./StockCommands.d.ts", tsExtensions), ".js")
        })
        it("returns nothing for a path with no module extension", () => {
            assert.strictEqual(getEmittedModuleFileExtension("./StockCommands", options), "")
        })
    })
})
