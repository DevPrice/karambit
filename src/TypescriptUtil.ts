import ts from "typescript"

export interface Annotated extends ts.Node {
    name?: { getText: () => string }
    modifiers?: ts.NodeArray<ts.ModifierLike>
}

export const reusableScope: unique symbol = Symbol()

export type AnnotationLike = ts.Decorator | ts.JSDocTag
export type ComponentScope = ts.Symbol | typeof reusableScope | string

/** @internal */
export type ComponentDeclaration = ts.ClassDeclaration | ts.InterfaceDeclaration | ts.TypeAliasDeclaration

export type ComponentLikeDeclaration = ComponentDeclaration | ts.ClassLikeDeclaration

export function scopeToString(scope: ComponentScope): string {
    if (scope === reusableScope) {
        return "<Reusable>"
    }
    if (typeof scope === "string") {
        return `named(${scope})`
    }
    return scope.name
}

export function isTypeNullable(type: ts.Type): boolean {
    if (type.flags & ts.TypeFlags.Null || type.flags & ts.TypeFlags.Undefined) return true
    return type.isUnionOrIntersection() && type.types.some(isTypeNullable)
}

export function isValidIdentifier(identifier: string): boolean {
    return identifier.match(/^[a-zA-Z_$][a-zA-Z_$0-9]*$/) !== null
}

export function isComponentDeclaration(node: ts.Node): node is ComponentDeclaration {
    return ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
}

export function isComponentLikeDeclaration(node: ts.Node): node is ComponentLikeDeclaration {
    return ts.isClassLike(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
}

export function isJSDocTag(node: ts.Node): node is ts.JSDocTag {
    return node.kind >= ts.SyntaxKind.JSDocTag && node.kind <= ts.SyntaxKind.JSDocImportTag
}

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
export function getEmittedModuleFileExtension(fileName: string, options: ts.CompilerOptions): string {
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

function jsxIsPreserved(options: ts.CompilerOptions): boolean {
    return options.jsx === ts.JsxEmit.Preserve || options.jsx === ts.JsxEmit.ReactNative
}
