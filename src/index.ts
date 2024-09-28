import * as ts from "typescript"
import {ModuleKind, ScriptTarget} from "typescript"
import karambit from "./karambit"

function generateComponents(fileNames: string[], options: ts.CompilerOptions): void {
    const program = ts.createProgram(fileNames, {...options, target: ScriptTarget.ES2021, module: ModuleKind.CommonJS, outDir: "build-test"})
    const factory = karambit(program, {printTransformDuration: true})
    const emitResult = program.emit(undefined, undefined, undefined, undefined, {before: [factory]})

    const allDiagnostics = ts
        .getPreEmitDiagnostics(program)
        .concat(emitResult.diagnostics)

    allDiagnostics.forEach(diagnostic => {
        if (diagnostic.file) {
            const {line, character} = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!)
            const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
            console.warn(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`)
        } else {
            console.warn(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
        }
    })

    const exitCode = emitResult.emitSkipped ? 1 : 0
    console.log(`Process exiting with code '${exitCode}'.`)
    process.exit(exitCode)
}

const tsconfig = require("../tsconfig.json")

generateComponents(process.argv.slice(2), tsconfig.compilerOptions)
