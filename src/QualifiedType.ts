import * as ts from "./compiler/index.js"

export const internalQualifier = Symbol("internal-qualifier")

export type TypeQualifier = ts.Symbol | symbol | string
export interface QualifiedType {
    readonly type: ts.Type
    readonly qualifier?: TypeQualifier
    readonly discriminator?: unknown
}

const typesWeakMap = new WeakMap<ts.Type, QualifiedType[]>()

export function createQualifiedType(args: QualifiedType): QualifiedType {
    const existing = typesWeakMap.get(args.type) ?? []
    for (const item of existing) {
        if (item.type === args.type && item.qualifier === args.qualifier && item.discriminator === args.discriminator) {
            return item
        }
    }
    existing.push(args)
    typesWeakMap.set(args.type, existing)
    return args
}

export function qualifiedTypeToString(typeChecker: ts.TypeChecker, qualifiedType: QualifiedType): string {
    const qualifierString = typeof qualifiedType.qualifier === "string" ?
        `named "${qualifiedType.qualifier}"` :
        typeof qualifiedType.qualifier === "object" ? ts.getSymbolName(qualifiedType.qualifier) : undefined
    const qualifierInfo = qualifierString ? ` with qualifier ${qualifierString}` : ""
    return typeChecker.typeToString(qualifiedType.type) + qualifierInfo
}
