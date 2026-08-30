import * as fs from "node:fs"
import * as Path from "node:path"
import {API} from "typescript/unstable/sync"
import type {CompilerOptions, Diagnostic, Project} from "typescript/unstable/sync"
import type {SourceFile} from "./Ast.js"
import {createTypeChecker, type TypeChecker} from "./Checker.js"

export type {CompilerOptions, Diagnostic, Project}

export interface PrinterOptions {
    preserveSourceNewlines?: boolean
    neverAsciiEscape?: boolean
}

/** The slice of a loaded project that Karambit reads. */
export interface Program {
    getTypeChecker(): TypeChecker
    getCompilerOptions(): CompilerOptions
    getSourceFiles(): readonly SourceFile[]
    isSourceFileFromExternalLibrary(sourceFile: SourceFile): boolean
    isSourceFileDefaultLibrary(sourceFile: SourceFile): boolean
    printFile(sourceFile: SourceFile, options?: PrinterOptions): string
}

export function createProgram(project: Project): Program {
    const checker = createTypeChecker(project.checker)
    return {
        getTypeChecker: () => checker,
        getCompilerOptions: () => project.compilerOptions,
        getSourceFiles: () => project.program.getSourceFileNames()
            .map(it => project.program.getSourceFile(it))
            .filter(it => it !== undefined),
        isSourceFileFromExternalLibrary: sourceFile => project.program.isSourceFileFromExternalLibrary(sourceFile),
        isSourceFileDefaultLibrary: sourceFile => project.program.isSourceFileDefaultLibrary(sourceFile),
        printFile: (sourceFile, options) => project.emitter.printNode(sourceFile, options),
    }
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
    return diagnostic.text
}

/**
 * Loads the project at `configFileName` and hands it to `use`. The compiler runs as a separate
 * process, so the session has to be closed rather than left to the garbage collector.
 */
export function withProject<T>(configFileName: string, use: (project: Project) => T): T {
    const configPath = Path.resolve(configFileName)
    const api = new API({cwd: Path.dirname(configPath)})
    try {
        const project = api.updateSnapshot({openProjects: [configPath]}).getProjects()[0]
        if (!project) throw new Error(`No project was loaded from ${configFileName}!`)
        return use(project)
    } finally {
        api.close()
    }
}

/**
 * Reloads the project whenever anything under the config file's directory changes, calling `onProject`
 * with each reload. Blocks for the life of the watch.
 *
 * The compiler's API is driven by its caller rather than watching on its own, so the watching is here.
 */
export function watchProject(configFileName: string, onProject: (project: Project) => void): void {
    const configPath = Path.resolve(configFileName)
    const root = Path.dirname(configPath)
    const api = new API({cwd: root})

    const reload = () => {
        const project = api.updateSnapshot({openProjects: [configPath], fileChanges: {invalidateAll: true}})
            .getProjects()[0]
        if (project) onProject(project)
    }

    reload()

    let pending: NodeJS.Timeout | undefined
    fs.watch(root, {recursive: true}, (_, fileName) => {
        if (!fileName || !watchedExtensions.some(it => fileName.toString().endsWith(it))) return
        if (pending) clearTimeout(pending)
        pending = setTimeout(reload, watchDebounceMs)
    })
}

const watchedExtensions = [".ts", ".tsx", ".mts", ".cts", ".json"]
const watchDebounceMs = 100
