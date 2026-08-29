import ts from "typescript"
import type {SourceFile} from "./Ast"

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

export function parseConfigFile(configFileName: string, basePath: string): ParsedConfig | {readonly readError: string} {
    const configFile = ts.readConfigFile(configFileName, ts.sys.readFile)
    if (configFile.error) {
        return {readError: formatDiagnostic(configFile.error)}
    }
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, basePath)
    return {fileNames: parsed.fileNames, options: parsed.options, errors: parsed.errors}
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
    return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
}

export function createProgram(fileNames: readonly string[], options: CompilerOptions): Program {
    return ts.createProgram(
        fileNames.slice(),
        {...options, incremental: options.incremental && !!options.tsBuildInfoFile},
    )
}

// calls onProgram with a fresh program whenever the input changes; blocks for the life of the watch
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

export function getScriptTargets(): ReadonlyMap<string, ts.ScriptTarget> {
    return new Map(
        Object.entries(ts.ScriptTarget)
            .filter(([key, value]) => isNaN(Number(key)) && typeof value !== "string")
            .filter(([key]) => key.toLowerCase() !== "json")
            .map(([key, value]) => [key.toLowerCase(), value as ts.ScriptTarget])
    )
}

export function printFile(sourceFile: SourceFile, options?: PrinterOptions): string {
    return ts.createPrinter(options).printFile(sourceFile)
}
