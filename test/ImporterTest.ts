import ts from "typescript"
import * as assert from "assert"
import * as fs from "fs"
import * as os from "os"
import * as Path from "path"
import {generateComponentFiles} from "../src/karambit.js"

const stockCommands = `
    /** @inject */
    export class StockCommands {
        readonly label = "stock"
    }
`

const clock = `
    /** @inject */
    export class Clock {
        now(): number { return 0 }
    }
`

/** A project of a single `.tsx` module, which is what the generated file has to import. */
const tsxSources: ReadonlyMap<string, string> = new Map([
    ["src/views/StockCommands.tsx", stockCommands],
    ["src/App.ts", `
        import {StockCommands} from "./views/StockCommands.js"

        /** @component */
        export abstract class AppComponent {
            abstract readonly commands: StockCommands
        }
    `],
])

/** Adds an `.mts` module, which only an ES module output can import. */
const esmSources: ReadonlyMap<string, string> = new Map([
    ["src/views/StockCommands.tsx", stockCommands],
    ["src/Clock.mts", clock],
    ["src/App.ts", `
        import {Clock} from "./Clock.mjs"
        import {StockCommands} from "./views/StockCommands.js"

        /** @component */
        export abstract class AppComponent {
            abstract readonly commands: StockCommands
            abstract readonly clock: Clock
        }
    `],
])

const baseCompilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
}

/**
 * Generates a component for `sources` in a throwaway project, and returns the import specifiers of the
 * generated file along with any errors TypeScript reports once that file is part of the project.
 */
function generateInProject(
    sources: ReadonlyMap<string, string>,
    packageType: "module" | "commonjs",
    compilerOptions: ts.CompilerOptions,
) {
    const projectDir = fs.realpathSync(fs.mkdtempSync(Path.join(os.tmpdir(), "karambit-importer-")))
    try {
        fs.writeFileSync(Path.join(projectDir, "package.json"), JSON.stringify({name: "fixture", type: packageType}))
        for (const [fileName, contents] of sources) {
            const filePath = Path.join(projectDir, fileName)
            fs.mkdirSync(Path.dirname(filePath), {recursive: true})
            fs.writeFileSync(filePath, contents)
        }

        const options = {...baseCompilerOptions, ...compilerOptions}
        const rootNames = Array.from(sources.keys(), it => Path.join(projectDir, it))
        const outFile = Path.join(projectDir, "src/gen/karambit.ts")
        generateComponentFiles(ts.createProgram(rootNames, options), {outFile, enableDocTags: true})

        const generated = ts.createSourceFile(outFile, fs.readFileSync(outFile, "utf8"), ts.ScriptTarget.Latest)
        const specifiers = generated.statements
            .filter(ts.isImportDeclaration)
            .map(it => (it.moduleSpecifier as ts.StringLiteral).text)
            .sort()

        const errors = ts.getPreEmitDiagnostics(ts.createProgram([...rootNames, outFile], options))
            .map(it => ts.flattenDiagnosticMessageText(it.messageText, " "))

        return {specifiers, errors}
    } finally {
        fs.rmSync(projectDir, {recursive: true, force: true})
    }
}

describe("Importer", () => {
    describe("Import specifiers", () => {
        it("names the emitted file when the output is an ES module", () => {
            const {specifiers, errors} = generateInProject(esmSources, "module", {
                module: ts.ModuleKind.NodeNext,
                moduleResolution: ts.ModuleResolutionKind.NodeNext,
            })
            assert.deepStrictEqual(errors, [])
            assert.deepStrictEqual(specifiers, ["../App.js", "../Clock.mjs", "../views/StockCommands.js"])
        })
        it("keeps TypeScript extensions when they may be imported", () => {
            const {specifiers, errors} = generateInProject(esmSources, "module", {
                module: ts.ModuleKind.NodeNext,
                moduleResolution: ts.ModuleResolutionKind.NodeNext,
                allowImportingTsExtensions: true,
            })
            assert.deepStrictEqual(errors, [])
            assert.deepStrictEqual(specifiers, ["../App.ts", "../Clock.mts", "../views/StockCommands.tsx"])
        })
        it("omits extensions when the output is CommonJS", () => {
            const {specifiers, errors} = generateInProject(tsxSources, "commonjs", {
                module: ts.ModuleKind.Node16,
                moduleResolution: ts.ModuleResolutionKind.Node16,
            })
            assert.deepStrictEqual(errors, [])
            assert.deepStrictEqual(specifiers, ["../App", "../views/StockCommands"])
        })
        it("omits extensions when resolution is left to a bundler", () => {
            const {specifiers, errors} = generateInProject(tsxSources, "module", {
                module: ts.ModuleKind.ESNext,
                moduleResolution: ts.ModuleResolutionKind.Bundler,
            })
            assert.deepStrictEqual(errors, [])
            assert.deepStrictEqual(specifiers, ["../App", "../views/StockCommands"])
        })
    })
})
