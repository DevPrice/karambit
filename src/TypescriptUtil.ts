import ts from "typescript"

export interface Annotated extends ts.Node {
    name?: { getText: () => string }
    modifiers?: ts.NodeArray<ts.ModifierLike>
}

export const reusableScope: unique symbol = Symbol()

export type AnnotationLike = ts.Decorator | ts.JSDocTag
export type ComponentScope = ts.Symbol | typeof reusableScope | string
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
