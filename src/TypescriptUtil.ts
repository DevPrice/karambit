import * as ts from "typescript"

export interface Annotated extends ts.Node {
    name?: { getText: () => string }
    modifiers?: ts.NodeArray<ts.ModifierLike>
}

export type AnnotationLike = ts.Decorator | ts.JSDocTag
export type ComponentScope = ts.Symbol | string

export function scopeToString(scope: ComponentScope): string {
    if (typeof scope === "string") {
        return scope
    }
    return scope.name
}

export function isTypeNullable(type: ts.Type): boolean {
    if (type.flags & ts.TypeFlags.Null || type.flags & ts.TypeFlags.Undefined) return true
    return type.isUnionOrIntersection() && type.types.some(it => isTypeNullable(it))
}
