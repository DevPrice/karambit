import * as ts from "typescript"
import * as Path from "node:path"
import karambit from "./karambit"

function generateComponents(fileNames: string[], options: ts.CompilerOptions): void {
    const program = ts.createProgram(fileNames, {...options})
    const factory = karambit(program)
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

const tsConfigPath = "./tsconfig.json"

const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile)
if (configFile.error) {
    console.error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"))
    process.exit(1)
}

const basePath = Path.dirname(tsConfigPath)
const parsedCommandLine = ts.parseJsonConfigFileContent(configFile.config, ts.sys, basePath)
generateComponents(parsedCommandLine.fileNames, parsedCommandLine.options)
