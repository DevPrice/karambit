import * as ts from "typescript"
import * as Path from "node:path"
import * as fs from "fs"
import {hideBin} from "yargs/helpers"
import * as yargs from "yargs"
import {generateComponentFiles} from "./karambit"
import {KarambitError} from "./KarambitError"
import {isNotNull} from "./Util"

const scriptTargets: ReadonlyMap<string, ts.ScriptTarget> = new Map(
    Object.entries(ts.ScriptTarget)
        .filter(([key]) => key.localeCompare("json", undefined, {sensitivity: "base"}))
        .map(([key, value]) => {
            if (isNaN(Number(key)) && typeof value !== "string") {
                return [key.toLowerCase(), value] as const
            }
            return undefined
        })
        .filter(isNotNull)
)

interface GenerateCommandOptions {
    tsconfig: string
    output: string
    verbose: boolean
    dryRun: boolean
    nameMaxLength: number
    allowEmptyOutput: boolean
    experimentalTags: boolean
    scriptTarget?: string
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
                description: "Output file",
                default: "gen/karambit.ts",
            })
            .option("dry-run", {
                type: "boolean",
                description: "Run all validation and logic, but skip writing generated files",
                default: false,
            })
            .option("name-max-length", {
                type: "number",
                description: "Max length of generated identifiers",
                default: 30,
            })
            .option("allow-empty-output", {
                type: "boolean",
                description: "Succeed even if nothing is generated",
                default: false,
            })
            .option("verbose", {
                type: "boolean",
                alias: "v",
                description: "Enable verbose output",
                default: false,
            })
            .option("experimental-tags", {
                type: "boolean",
                description: "Enable experimental JS Doc tag support",
                default: false,
            })
            .option("script-target", {
                type: "string",
                alias: "t",
                description: "The script target to use for the generated output file(s)",
                choices: Array.from(scriptTargets.keys()),
            }),
        args => {
            if (!fs.existsSync(args.tsconfig)) {
                console.error("No such file or directory:", args.tsconfig)
                process.exit(1)
            }

            const tsconfigFile = fs.lstatSync(args.tsconfig).isDirectory()
                ? Path.join(args.tsconfig, "tsconfig.json")
                : args.tsconfig

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
    try {
        generateComponentFiles(program, {
            sourceRoot: Path.dirname(cliOptions.tsconfig),
            outFile: cliOptions.output,
            dryRun: cliOptions.dryRun,
            nameMaxLength: cliOptions.nameMaxLength,
            allowEmptyOutput: cliOptions.allowEmptyOutput,
            verbose: cliOptions.verbose,
            experimentalTags: cliOptions.experimentalTags,
            outputScriptTarget: cliOptions.scriptTarget ? scriptTargets.get(cliOptions.scriptTarget) : compilerOptions.target,
        })
    } catch (e) {
        if (e instanceof KarambitError && !cliOptions.verbose) {
            console.error(e.message)
        } else {
            console.error(e)
        }
        process.exit(1)
    }
    process.exit(0)
}
