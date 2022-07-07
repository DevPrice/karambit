import * as ts from "typescript"

export const internalQualifier = Symbol("internal-qualifier")

export type TypeQualifier = ts.Symbol | symbol | string
export interface QualifiedType {
    readonly type: ts.Type
    readonly qualifier?: TypeQualifier
}

const typesWeakMap = new WeakMap<ts.Type, QualifiedType[]>()

export function createQualifiedType(args: QualifiedType): QualifiedType {
    const existing = typesWeakMap.get(args.type) ?? []
    for (const item of existing) {
        if (item.type === args.type && item.qualifier === args.qualifier) {
            return item
        }
    }
    existing.push(args)
    typesWeakMap.set(args.type, existing)
    return args
}

export function qualifiedTypeToString(qualifiedType: QualifiedType): string {
    const checker = (qualifiedType.type as any).checker as ts.TypeChecker | undefined
    const qualifierString = typeof qualifiedType.qualifier === "string" ?
        `named "${qualifiedType.qualifier}"` :
        typeof qualifiedType.qualifier === "object" ? qualifiedType.qualifier?.getName() : undefined
    const qualifierInfo = qualifierString ? ` with qualifier ${qualifierString}` : ""
    return (checker?.typeToString(qualifiedType.type) ?? "unknown type") + qualifierInfo
}
