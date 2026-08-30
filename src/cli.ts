import * as ts from "./compiler/index.js"
import * as Path from "node:path"
import * as fs from "node:fs"
import {hideBin} from "yargs/helpers"
import yargs from "yargs"
import {generateComponentFiles} from "./karambit.js"
import {KarambitError} from "./KarambitError.js"

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
            }),
        args => {
            if (!fs.existsSync(args.tsconfig)) {
                console.error("No such file or directory:", args.tsconfig)
                process.exit(1)
            }

            const tsconfigFile = getFile(args.tsconfig, "tsconfig.json")

            if (args.watch) {
                ts.watchProject(tsconfigFile, project => {
                    process.stdout.write("Regenerating Karambit output...")
                    if (generateFromProject(project, args) === 0) {
                        process.stdout.write(" done.\n")
                    } else {
                        process.stdout.write("\n")
                    }
                })
            } else {
                process.exit(ts.withProject(tsconfigFile, project => generateFromProject(project, args)))
            }
        },
    )
    .parseSync()

function getFile(input: string, defaultFilename: string) {
    return fs.lstatSync(input).isDirectory()
        ? Path.join(input, defaultFilename)
        : input
}

function generateFromProject(project: ts.Project, cliOptions: GenerateCommandOptions): number {
    try {
        generateComponentFiles(ts.createProgram(project), {
            outFile: cliOptions.output,
            include: cliOptions.include,
            exclude: cliOptions.exclude,
            dryRun: cliOptions.dryRun,
            nameMaxLength: cliOptions.nameMaxLength,
            allowEmptyModules: cliOptions.allowEmptyModules,
            allowEmptyOutput: cliOptions.allowEmptyOutput,
            verbose: cliOptions.verbose,
            enableDocTags: !cliOptions.disableTags,
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
