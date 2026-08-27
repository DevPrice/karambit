import * as assert from "assert"
import {removeModuleFileExtension} from "../src/TypescriptUtil"

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
})
