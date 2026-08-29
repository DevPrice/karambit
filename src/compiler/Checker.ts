import ts from "typescript"
import type {Declaration, Node, ObjectType, Symbol, TupleType, Type} from "./Ast"

export type TypeChecker = ts.TypeChecker

// symbol and type members are read through functions: another backend may represent them differently
export function getDeclarations(symbol: Symbol): readonly Declaration[] {
    return symbol.getDeclarations() ?? []
}

export function getValueDeclaration(symbol: Symbol): Declaration | undefined {
    return symbol.valueDeclaration
}

export function getSymbolName(symbol: Symbol): string {
    return symbol.getName()
}

export function getTypeSymbol(type: Type): Symbol | undefined {
    return type.aliasSymbol ?? type.symbol
}

export function getUnionOrIntersectionTypes(type: Type): readonly Type[] | undefined {
    return type.isUnionOrIntersection() ? type.types : undefined
}

export function isObjectType(type: Type): type is ObjectType {
    return !!(type.flags & ts.TypeFlags.Object)
}

export function isTupleType(checker: TypeChecker, type: Type): type is TupleType {
    return checker.isTupleType(type)
}

export function isErrorType(type: Type): boolean {
    return intrinsicName(type) === "error"
}

export function getResolvedTypeArguments(type: Type): readonly Type[] | undefined {
    return (type as unknown as {resolvedTypeArguments?: Type[]}).resolvedTypeArguments
}

export function getTypeTarget(type: Type): Type | undefined {
    return (type as unknown as {target?: Type}).target
}

function intrinsicName(type: Type): string | undefined {
    return (type as unknown as {intrinsicName?: string}).intrinsicName
}

