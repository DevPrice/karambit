import ts from "typescript"
import type {SourceFile} from "./Ast"

/**
 * Loading a project and turning generated nodes back into text.
 *
 * These are the calls that differ most between compiler backends - one builds a program in-process,
 * another drives a compiler server - so nothing outside this module names them.
 */

export type Program = ts.Program
export type CompilerOptions = ts.CompilerOptions
export type PrinterOptions = ts.PrinterOptions
export type Printer = ts.Printer
export type Diagnostic = ts.Diagnostic

export interface ParsedConfig {
    readonly fileNames: readonly string[]
    readonly options: CompilerOptions
    readonly errors: readonly Diagnostic[]
}

/** Reads a tsconfig file, returning its file list, options and any diagnostics raised while parsing. */
export function parseConfigFile(configFileName: string, basePath: string): ParsedConfig | {readonly readError: string} {
    const configFile = ts.readConfigFile(configFileName, ts.sys.readFile)
    if (configFile.error) {
        return {readError: formatDiagnostic(configFile.error)}
    }
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, basePath)
    return {fileNames: parsed.fileNames, options: parsed.options, errors: parsed.errors}
}

/** Renders a diagnostic's message as a single string. */
export function formatDiagnostic(diagnostic: Diagnostic): string {
    return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
}

export function createProgram(fileNames: readonly string[], options: CompilerOptions): Program {
    return ts.createProgram(
        fileNames.slice(),
        {...options, incremental: options.incremental && !!options.tsBuildInfoFile},
    )
}

/**
 * Watches the project and calls `onProgram` with a fresh program whenever the input changes. Blocks
 * for the lifetime of the watch.
 */
export function watchProgram(
    fileNames: readonly string[],
    options: CompilerOptions,
    onProgram: (program: Program, options: CompilerOptions) => void,
): void {
    const createProgram: ts.CreateProgram<ts.SemanticDiagnosticsBuilderProgram> = (...args) => {
        const builderProgram = ts.createSemanticDiagnosticsBuilderProgram(...args)
        onProgram(builderProgram.getProgram(), builderProgram.getCompilerOptions())
        return builderProgram
    }
    ts.createWatchProgram(
        ts.createWatchCompilerHost(
            fileNames.slice(),
            options,
            ts.sys,
            createProgram,
            () => { },
            () => { },
        )
    )
}

/** Every script target the compiler accepts, keyed by its lowercased name. */
export function getScriptTargets(): ReadonlyMap<string, ts.ScriptTarget> {
    return new Map(
        Object.entries(ts.ScriptTarget)
            .filter(([key, value]) => isNaN(Number(key)) && typeof value !== "string")
            .filter(([key]) => key.toLowerCase() !== "json")
            .map(([key, value]) => [key.toLowerCase(), value as ts.ScriptTarget])
    )
}

/** Renders a source file as TypeScript text. */
export function printFile(sourceFile: SourceFile, options?: PrinterOptions): string {
    return ts.createPrinter(options).printFile(sourceFile)
}
