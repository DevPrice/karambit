import * as ts from "typescript"
import * as Path from "node:path"
import {hideBin} from "yargs/helpers"
import * as yargs from "yargs"
import {generateComponentFiles} from "./karambit"
import {KarambitError} from "./ErrorReporter"

interface GenerateCommandOptions {
    tsconfig: string
    output: string
    verbose: boolean
}

yargs(hideBin(process.argv))
    .version()
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
            .option("verbose", {
                type: "boolean",
                alias: "v",
                description: "Print the duration for each component",
                default: false,
            }),
        args => {
            const tsconfigFile = Path.basename(args.tsconfig) === "tsconfig.json" ? args.tsconfig : Path.join(args.tsconfig, "tsconfig.json")

            const configFile = ts.readConfigFile(tsconfigFile, ts.sys.readFile)
            if (configFile.error) {
                console.error("Failed to read config file!")
                console.error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"))
                process.exit(1)
            }

            const basePath = Path.dirname(args.tsconfig)
            const parsedCommandLine = ts.parseJsonConfigFileContent(configFile.config, ts.sys, basePath)
            if (parsedCommandLine.errors.length > 0) {
                for (const error of parsedCommandLine.errors) {
                    console.error(ts.flattenDiagnosticMessageText(error.messageText, "\n"))
                }
                process.exit(1)
            }
            generateComponents(parsedCommandLine.fileNames, parsedCommandLine.options, args)
        },
    )
    .parseSync()

function generateComponents(fileNames: string[], compilerOptions: ts.CompilerOptions, cliOptions: GenerateCommandOptions): void {
    const program = ts.createProgram(fileNames, {...compilerOptions, incremental: false})
    generateComponentFiles(program, {
        sourceRoot: Path.dirname(cliOptions.tsconfig),
        outDir: cliOptions.output,
    })
    process.exit(0)
}
