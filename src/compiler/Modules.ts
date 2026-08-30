import * as fs from "node:fs"
import * as Path from "node:path"
import {ModuleKind} from "typescript/unstable/sync"
import type {SourceFile} from "./Ast.js"
import type {CompilerOptions} from "./Program.js"

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

type JsxEmitValue = NonNullable<CompilerOptions["jsx"]>

// the enum isn't reachable from the compiler's public entry points, so its values are restated here
export const JsxEmit = {
    None: 0,
    Preserve: 1,
    ReactNative: 2,
    React: 3,
    ReactJSX: 4,
    ReactJSXDev: 5,
} as unknown as Record<"None" | "Preserve" | "ReactNative" | "React" | "ReactJSX" | "ReactJSXDev", JsxEmitValue>

function jsxIsPreserved(options: CompilerOptions): boolean {
    return options.jsx === JsxEmit.Preserve || options.jsx === JsxEmit.ReactNative
}

/**
 * Whether Node loads the module at `fileName` as an ECMAScript module, which is what the compiler used
 * to answer with `getImpliedNodeFormatForFile`. Only the node module modes imply a format at all; under
 * the others an extensionless specifier is what resolves, so nothing here needs an extension.
 */
export function isEsmFile(fileName: string, options: CompilerOptions): boolean {
    if (!impliesNodeFormat(options.module)) return false
    const extension = getModuleFileExtension(fileName)
    if (extension && esmExtensions.includes(extension)) return true
    if (extension && cjsExtensions.includes(extension)) return false
    return nearestPackageJsonType(Path.dirname(Path.resolve(fileName))) === "module"
}

const esmExtensions = [".mts", ".d.mts", ".mjs"]
const cjsExtensions = [".cts", ".d.cts", ".cjs"]

function impliesNodeFormat(module: ModuleKind | undefined): boolean {
    return module === ModuleKind.Node16
        || module === ModuleKind.Node18
        || module === ModuleKind.Node20
        || module === ModuleKind.NodeNext
        || module === ModuleKind.Preserve
}

function nearestPackageJsonType(directory: string): string | undefined {
    let current = directory
    for (;;) {
        const manifest = Path.join(current, "package.json")
        if (fs.existsSync(manifest)) {
            try {
                return JSON.parse(fs.readFileSync(manifest, "utf8")).type
            } catch {
                return undefined
            }
        }
        const parent = Path.dirname(current)
        if (parent === current) return undefined
        current = parent
    }
}

// the compiler no longer surfaces a module name declared by the file itself
export function getDeclaredModuleName(_: SourceFile): string | undefined {
    return undefined
}
