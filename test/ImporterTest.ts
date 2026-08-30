import * as ts from "../src/compiler/index.js"
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

// written into a tsconfig for each fixture, so these are the JSON spellings rather than enum values
const baseCompilerOptions = {
    target: "es2022",
    jsx: "react-jsx",
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
    compilerOptions: Record<string, unknown>,
) {
    const projectDir = fs.realpathSync(fs.mkdtempSync(Path.join(os.tmpdir(), "karambit-importer-")))
    try {
        fs.writeFileSync(Path.join(projectDir, "package.json"), JSON.stringify({name: "fixture", type: packageType}))
        for (const [fileName, contents] of sources) {
            const filePath = Path.join(projectDir, fileName)
            fs.mkdirSync(Path.dirname(filePath), {recursive: true})
            fs.writeFileSync(filePath, contents)
        }

        const tsconfigPath = Path.join(projectDir, "tsconfig.json")
        fs.writeFileSync(tsconfigPath, JSON.stringify({
            compilerOptions: {...baseCompilerOptions, ...compilerOptions},
            include: ["**/*"],
        }))

        const outFile = Path.join(projectDir, "src/gen/karambit.ts")
        ts.withProject(tsconfigPath, project => {
            generateComponentFiles(ts.createProgram(project), {outFile, enableDocTags: true})
        })

        // reload so the generated file is part of the project and can be type checked with it
        return ts.withProject(tsconfigPath, project => {
            const program = ts.createProgram(project)
            const generated = program.getSourceFiles().find(it => samePath(it.fileName, outFile))
            assert.ok(generated, `Generated file was not part of the project: ${outFile}`)
            const specifiers = generated.statements
                .filter(ts.isImportDeclaration)
                .map(it => (it.moduleSpecifier as ts.StringLiteral).text)
                .sort()
            const errors = project.program.getSemanticDiagnostics().map(it => it.text)
            return {specifiers, errors}
        })
    } finally {
        fs.rmSync(projectDir, {recursive: true, force: true})
    }
}

function samePath(left: string, right: string): boolean {
    return Path.resolve(left).toLowerCase() === Path.resolve(right).toLowerCase()
}

describe("Importer", () => {
    describe("Import specifiers", () => {
        it("names the emitted file when the output is an ES module", () => {
            const {specifiers, errors} = generateInProject(esmSources, "module", {
                module: "nodenext",
                moduleResolution: "nodenext",
            })
            assert.deepStrictEqual(errors, [])
            assert.deepStrictEqual(specifiers, ["../App.js", "../Clock.mjs", "../views/StockCommands.js"])
        })
        it("keeps TypeScript extensions when they may be imported", () => {
            const {specifiers, errors} = generateInProject(esmSources, "module", {
                module: "nodenext",
                moduleResolution: "nodenext",
                allowImportingTsExtensions: true,
            })
            assert.deepStrictEqual(errors, [])
            assert.deepStrictEqual(specifiers, ["../App.ts", "../Clock.mts", "../views/StockCommands.tsx"])
        })
        it("omits extensions when the output is CommonJS", () => {
            const {specifiers, errors} = generateInProject(tsxSources, "commonjs", {
                module: "node16",
                moduleResolution: "node16",
            })
            assert.deepStrictEqual(errors, [])
            assert.deepStrictEqual(specifiers, ["../App", "../views/StockCommands"])
        })
        it("omits extensions when resolution is left to a bundler", () => {
            const {specifiers, errors} = generateInProject(tsxSources, "module", {
                module: "esnext",
                moduleResolution: "bundler",
            })
            assert.deepStrictEqual(errors, [])
            assert.deepStrictEqual(specifiers, ["../App", "../views/StockCommands"])
        })
    })
})
