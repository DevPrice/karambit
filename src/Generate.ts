import * as ts from "typescript"
import * as Path from "node:path"
import karambit, {KarambitTransformOptions} from "./karambit"
import {hideBin} from "yargs/helpers"
import * as yargs from "yargs"

const packageJson: {version: any} = require("../package.json")

yargs(hideBin(process.argv))
    .version(packageJson.version ?? false)
    .help()
    .command(
        ["$0 [tsconfig]"], "Generate components",
        yargs => yargs
            .positional("tsconfig", {
                type: "string",
                description: "tsconfig.json location",
                default: ".",
            })
            .option("output", {
                type: "string",
                alias: "o",
                description: "Output directory",
                default: "karambit-generated",
            })
            .option("duration", {
                type: "boolean",
                alias: "d",
                description: "Print the duration for each component",
                default: false,
            }),
        args => {
            const tsconfigFile = Path.basename(args.tsconfig) === "tsconfig.json" ? args.tsconfig : Path.join(args.tsconfig, "tsconfig.json")

            const configFile = ts.readConfigFile(tsconfigFile, ts.sys.readFile)
            if (configFile.error) {
                console.error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"))
                process.exit(1)
            }

            const basePath = Path.dirname(args.tsconfig)
            const parsedCommandLine = ts.parseJsonConfigFileContent(configFile.config, ts.sys, basePath)
            generateComponents(parsedCommandLine.fileNames, parsedCommandLine.options, {outDir: args.output, printTransformDuration: args.duration})
        },
    )
    .parseSync()

function generateComponents(fileNames: string[], options: ts.CompilerOptions, karambitOptions?: Partial<KarambitTransformOptions>): void {
    const program = ts.createProgram(fileNames, {...options, incremental: false})
    const factory = karambit(program, karambitOptions)
    const emitResult = program.emit(undefined, undefined, undefined, undefined, {before: [factory]})

    const allDiagnostics = ts
        .getPreEmitDiagnostics(program)
        .concat(emitResult.diagnostics)

    if (emitResult.emitSkipped) {
        allDiagnostics.forEach(diagnostic => {
            if (diagnostic.file) {
                const {line, character} = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!)
                const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
                console.error(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`)
            } else {
                console.error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
            }
        })
    }

    const exitCode = emitResult.emitSkipped ? 1 : 0
    process.exit(exitCode)
}
