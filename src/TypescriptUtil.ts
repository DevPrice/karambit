import * as ts from "typescript"

export function isTypeNullable(type: ts.Type): boolean {
    if (type.flags & ts.TypeFlags.Null || type.flags & ts.TypeFlags.Undefined) return true
    return type.isUnionOrIntersection() && type.types.some(it => isTypeNullable(it))
}
