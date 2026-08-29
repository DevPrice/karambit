import ts from "typescript"
import type {SourceFile} from "./Ast"
import type {CompilerOptions} from "./Program"

/**
 * Module resolution concerns: how a file is loaded, and what an import specifier naming it looks like.
 */

/**
 * File extensions the compiler resolves implicitly, longest first so that declaration extensions are
 * matched before their `.ts`/`.mts`/`.cts` suffixes.
 */
const moduleFileExtensions = [".d.ts", ".d.mts", ".d.cts", ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]

/** Extensions that only ever describe a module, and so can never appear in an import specifier. */
const declarationFileExtensions = [".d.ts", ".d.mts", ".d.cts"]

export function getModuleFileExtension(fileName: string): string | undefined {
    return moduleFileExtensions.find(it => fileName.length > it.length && fileName.endsWith(it))
}

export function removeModuleFileExtension(fileName: string): string {
    const extension = getModuleFileExtension(fileName)
    return extension ? fileName.slice(0, -extension.length) : fileName
}

/**
 * Returns the extension that the module at `fileName` is emitted with, which is the extension an import
 * specifier must use wherever TypeScript requires relative imports to name a file exactly.
 *
 * Declaration files are mapped to the extension of the JavaScript they describe, since a `.d.ts` path is
 * never a valid import specifier. When `allowImportingTsExtensions` is set the source extension is kept
 * instead, as that flag exists for projects whose modules are loaded without being emitted at all.
 */
export function getEmittedModuleFileExtension(fileName: string, options: CompilerOptions): string {
    const extension = getModuleFileExtension(fileName)
    if (extension === undefined) return ""
    if (options.allowImportingTsExtensions && !declarationFileExtensions.includes(extension)) {
        return extension
    }
    switch (extension) {
        case ".mts": case ".d.mts": case ".mjs": return ".mjs"
        case ".cts": case ".d.cts": case ".cjs": return ".cjs"
        case ".tsx": case ".jsx": return jsxIsPreserved(options) ? ".jsx" : ".js"
        default: return ".js"
    }
}

function jsxIsPreserved(options: CompilerOptions): boolean {
    return options.jsx === ts.JsxEmit.Preserve || options.jsx === ts.JsxEmit.ReactNative
}

/**
 * Whether the file at `fileName` is loaded as an ECMAScript module.
 *
 * ECMAScript imports are resolved without guessing at extensions, so relative specifiers in a file that
 * Node loads as ESM have to name the emitted file exactly. Everywhere else - CommonJS output, and the
 * bundler and node10 resolution modes - an extensionless specifier is what resolves.
 */
export function isEsmFile(fileName: string, options: CompilerOptions): boolean {
    return ts.getImpliedNodeFormatForFile(fileName as ts.Path, undefined, ts.sys, options) === ts.ModuleKind.ESNext
}

/**
 * The module name a source file declares for itself, for files that are modules and name themselves,
 * such as an ambient declaration file.
 */
export function getDeclaredModuleName(sourceFile: SourceFile): string | undefined {
    return ts.isExternalModule(sourceFile) ? sourceFile.moduleName : undefined
}
