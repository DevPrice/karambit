import * as ts from "typescript"

export interface Annotated extends ts.Node {
    name?: { getText: () => string }
    modifiers?: ts.NodeArray<ts.ModifierLike>
}

export const reusableScope: unique symbol = Symbol()

export type AnnotationLike = ts.Decorator | ts.JSDocTag
export type ComponentScope = ts.Symbol | typeof reusableScope | string

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
    return type.isUnionOrIntersection() && type.types.some(it => isTypeNullable(it))
}

export function isValidIdentifier(identifier: string): boolean {
    return identifier.match(/^[a-zA-Z_$][a-zA-Z_$0-9]*$/) !== null
}
