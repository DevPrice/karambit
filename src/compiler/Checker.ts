import ts from "typescript"
import type {Declaration, Node, ObjectType, Symbol, TupleType, Type} from "./Ast"

/**
 * Type-system queries.
 *
 * `TypeChecker` is an alias today, but Karambit only ever calls the dozen methods listed below, and
 * only reaches type and symbol members through the accessors in this module. That discipline is what
 * lets the alias become an interface with more than one implementation behind it later.
 */
export type TypeChecker = ts.TypeChecker

/**
 * Members of `Symbol` and `Type` are read through functions rather than directly, because a compiler
 * backend is free to represent them differently - a declaration may be a handle that has to be
 * resolved rather than a node sitting in a array. Call sites should not know the difference.
 */

/** The declarations a symbol was declared by. */
export function getDeclarations(symbol: Symbol): readonly Declaration[] {
    return symbol.getDeclarations() ?? []
}

/** The declaration that gives a symbol its value, if it has one. */
export function getValueDeclaration(symbol: Symbol): Declaration | undefined {
    return symbol.valueDeclaration
}

/** The name a symbol was declared with. */
export function getSymbolName(symbol: Symbol): string {
    return symbol.getName()
}

/** The symbol a type was declared by, preferring the alias it was referenced through. */
export function getTypeSymbol(type: Type): Symbol | undefined {
    return type.aliasSymbol ?? type.symbol
}

/** The constituents of a union or intersection, or undefined for any other type. */
export function getUnionOrIntersectionTypes(type: Type): readonly Type[] | undefined {
    return type.isUnionOrIntersection() ? type.types : undefined
}

export function isObjectType(type: Type): type is ObjectType {
    return !!(type.flags & ts.TypeFlags.Object)
}

export function isTupleType(checker: TypeChecker, type: Type): type is TupleType {
    return checker.isTupleType(type)
}

/**
 * Whether the type is the placeholder the checker produces when a type cannot be determined, such as
 * an unresolved reference.
 */
export function isErrorType(type: Type): boolean {
    return intrinsicName(type) === "error"
}

/** The type arguments a generic type reference was instantiated with. */
export function getResolvedTypeArguments(type: Type): readonly Type[] | undefined {
    return (type as unknown as {resolvedTypeArguments?: Type[]}).resolvedTypeArguments
}

/** The generic type a reference was instantiated from, as the `Array` in `Array<string>`. */
export function getTypeTarget(type: Type): Type | undefined {
    return (type as unknown as {target?: Type}).target
}

/**
 * The checker that produced a type.
 *
 * Reaching back to the checker from a type has no equivalent on a compiler backend that hands out
 * types as detached handles. Only error reporting depends on it; that call should take a checker
 * explicitly before a second backend exists.
 */
export function getTypeChecker(type: Type): TypeChecker | undefined {
    return (type as unknown as {checker?: TypeChecker}).checker
}

function intrinsicName(type: Type): string | undefined {
    return (type as unknown as {intrinsicName?: string}).intrinsicName
}

/** Renders a type the way the compiler would display it in a diagnostic. */
export function typeToString(checker: TypeChecker, type: Type): string {
    return checker.typeToString(type)
}

/** Whether the node is one the checker can resolve a type for. */
export function getTypeAtLocation(checker: TypeChecker, node: Node): Type {
    return checker.getTypeAtLocation(node)
}
