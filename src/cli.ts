import ts from "typescript"
import * as Path from "node:path"
import * as fs from "fs"
import {hideBin} from "yargs/helpers"
import yargs from "yargs"
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
    include?: string[]
    exclude?: string[]
    verbose: boolean
    dryRun: boolean
    nameMaxLength: number
    allowEmptyModules: boolean
    allowEmptyOutput: boolean
    disableTags: boolean
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
            .option("include", {
                type: "array",
                string: true,
                alias: "i",
                description: "Specify source files to include. Includes all source files by default",
            })
            .option("exclude", {
                type: "array",
                string: true,
                alias: "e",
                description: "Specify source files to exclude",
            })
            .option("watch", {
                type: "boolean",
                alias: "w",
                description: "Watch input for changes and automatically regenerate output",
                default: false,
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
            .option("allow-empty-modules", {
                type: "boolean",
                description: "Succeed even if empty modules are included",
                default: false,
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
            .option("disable-tags", {
                type: "boolean",
                description: "Disable JS Doc tag support",
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

            const tsconfigFile = getFile(args.tsconfig, "tsconfig.json")

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

            if (args.watch) {
                watchComponents(parsedCommandLine.fileNames, parsedCommandLine.options, args)
            } else {
                generateComponents(parsedCommandLine.fileNames, parsedCommandLine.options, args)
            }
        },
    )
    .parseSync()

function getFile(input: string, defaultFilename: string) {
    return fs.lstatSync(input).isDirectory()
        ? Path.join(input, defaultFilename)
        : input
}

function generateComponents(fileNames: string[], compilerOptions: ts.CompilerOptions, cliOptions: GenerateCommandOptions): void {
    const program = ts.createProgram(fileNames, {...compilerOptions, incremental: compilerOptions.incremental && !!compilerOptions.tsBuildInfoFile})
    process.exit(generateFromProgram(program, compilerOptions, cliOptions))
}

function watchComponents(fileNames: string[], compilerOptions: ts.CompilerOptions, cliOptions: GenerateCommandOptions): void {
    // TODO: When Karambit generates its output, it causes TS to recreate the program, causing Karambit to regenerate again if it changed...
    const createProgram: ts.CreateProgram<ts.SemanticDiagnosticsBuilderProgram> = (...args) => {
        const program = ts.createSemanticDiagnosticsBuilderProgram(...args)
        process.stdout.write("Regenerating Karambit output...")
        const result = generateFromProgram(program.getProgram(), program.getCompilerOptions(), cliOptions)
        if (result === 0) {
            process.stdout.write(" done.\n")
        } else {
            process.stdout.write("\n")
        }
        return program
    }
    ts.createWatchProgram(
        ts.createWatchCompilerHost(
            fileNames,
            compilerOptions,
            ts.sys,
            createProgram,
            () => {},
            () => {},
        )
    )
}

function generateFromProgram(program: ts.Program, compilerOptions: ts.CompilerOptions, cliOptions: GenerateCommandOptions): number {
    try {
        generateComponentFiles(program, {
            outFile: cliOptions.output,
            include: cliOptions.include,
            exclude: cliOptions.exclude,
            dryRun: cliOptions.dryRun,
            nameMaxLength: cliOptions.nameMaxLength,
            allowEmptyModules: cliOptions.allowEmptyModules,
            allowEmptyOutput: cliOptions.allowEmptyOutput,
            verbose: cliOptions.verbose,
            enableDocTags: !cliOptions.disableTags,
            outputScriptTarget: cliOptions.scriptTarget ? scriptTargets.get(cliOptions.scriptTarget) : compilerOptions.target,
        })
    } catch (e) {
        if (e instanceof KarambitError && !cliOptions.verbose) {
            console.error(e.message)
        } else {
            console.error(e)
        }
        return 1
    }
    return 0
}
