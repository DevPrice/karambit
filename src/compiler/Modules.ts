import ts from "typescript"
import type {SourceFile} from "./Ast"
import type {CompilerOptions} from "./Program"

/**
 * File extensions that TypeScript resolves implicitly, longest first so that
 * declaration extensions are matched before their `.ts`/`.mts`/`.cts` suffixes.
 */
const moduleFileExtensions = [".d.ts", ".d.mts", ".d.cts", ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]

/**
 * Extensions that only ever describe a module, and so can never appear in an import specifier.
 */
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

export function isEsmFile(fileName: string, options: CompilerOptions): boolean {
    return ts.getImpliedNodeFormatForFile(fileName as ts.Path, undefined, ts.sys, options) === ts.ModuleKind.ESNext
}

export function getDeclaredModuleName(sourceFile: SourceFile): string | undefined {
    return ts.isExternalModule(sourceFile) ? sourceFile.moduleName : undefined
}
