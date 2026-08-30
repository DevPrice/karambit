import type {Checker, SignatureKind} from "typescript/unstable/sync"
import type {Declaration, Node, ObjectType, Signature, SignatureDeclaration, Symbol, TupleType, Type} from "./Ast.js"

/**
 * The type-system questions Karambit asks. The compiler's own checker answers most of these with
 * `Type | undefined`, reserving undefined for nodes that have no type at all; Karambit only ever asks
 * about nodes that do, so the adapter below asserts rather than pushing the check to every call site.
 */
export interface TypeChecker {
    getTypeAtLocation(node: Node): Type
    getSymbolAtLocation(node: Node): Symbol | undefined
    getTypeOfSymbol(symbol: Symbol): Type
    getTypeOfSymbolAtLocation(symbol: Symbol, location: Node): Type
    getSignaturesOfType(type: Type, kind: SignatureKind): readonly Signature[]
    getSignatureFromDeclaration(node: Node): Signature | undefined
    getReturnTypeOfSignature(signature: Signature): Type
    getBaseTypeOfLiteralType(type: Type): Type
    getAliasedSymbol(symbol: Symbol): Symbol
    getPropertiesOfType(type: Type): readonly Symbol[]
    getApparentProperties(type: Type): readonly Symbol[]
    getTypeArguments(type: Type): readonly Type[]
    getSignatureParameters(signature: Signature): readonly Symbol[]
    isTypeAssignableTo(source: Type, target: Type): boolean
    isTupleType(type: Type): boolean
    typeToString(type: Type): string
}

export function createTypeChecker(checker: Checker): TypeChecker {
    return {
        getTypeAtLocation: node => checker.getTypeAtLocation(node)!,
        getSymbolAtLocation: node => checker.getSymbolAtLocation(node),
        getTypeOfSymbol: symbol => checker.getTypeOfSymbol(symbol)!,
        getTypeOfSymbolAtLocation: (symbol, location) => checker.getTypeOfSymbolAtLocation(symbol, location),
        getSignaturesOfType: (type, kind) => checker.getSignaturesOfType(type, kind),
        getSignatureFromDeclaration: node => checker.getSignatureFromDeclaration(node),
        getReturnTypeOfSignature: signature => checker.getReturnTypeOfSignature(signature)!,
        getBaseTypeOfLiteralType: type => checker.getBaseTypeOfLiteralType(type)!,
        getAliasedSymbol: symbol => checker.getAliasedSymbol(symbol),
        getPropertiesOfType: type => checker.getPropertiesOfType(type),
        getApparentProperties: type => checker.getPropertiesOfType(checker.getApparentType(type) ?? type),
        getTypeArguments: type => type.isTypeReference() ? checker.getTypeArguments(type) : [],
        getSignatureParameters: signature => signature.getParameters(),
        isTypeAssignableTo: (source, target) => checker.isTypeAssignableTo(source, target),
        isTupleType: type => checker.isTupleType(type),
        typeToString: type => checker.typeToString(type),
    }
}

// symbol and type members are read through functions: the compiler hands them over as handles and
// accessors rather than as plain properties
export function getDeclarations(symbol: Symbol): readonly Declaration[] {
    return resolveAll(symbol.declarations)
}

export function getValueDeclaration(symbol: Symbol): Declaration | undefined {
    return symbol.valueDeclaration?.resolve() as Declaration | undefined
}

export function getSignatureDeclaration(signature: Signature): SignatureDeclaration | undefined {
    return signature.declaration?.resolve() as SignatureDeclaration | undefined
}

export function getSymbolName(symbol: Symbol): string {
    return symbol.name
}

export function getTypeSymbol(type: Type): Symbol {
    return (type.getAliasSymbol() ?? type.getSymbol())!
}

export function getUnionOrIntersectionTypes(type: Type): readonly Type[] | undefined {
    return type.isUnionType() || type.isIntersectionType() ? type.getTypes() : undefined
}

export function isObjectType(type: Type): type is ObjectType {
    return type.isObjectType()
}

export function isTupleType(checker: TypeChecker, type: Type): type is TupleType {
    return checker.isTupleType(type)
}

export function isErrorType(type: Type): boolean {
    return type.isErrorType()
}

export function getResolvedTypeArguments(checker: TypeChecker, type: Type): readonly Type[] | undefined {
    const typeArguments = checker.getTypeArguments(type)
    return typeArguments.length > 0 ? typeArguments : undefined
}

export function getTypeTarget(_: TypeChecker, type: Type): Type | undefined {
    return type.isTypeReference() ? type.getTarget() : undefined
}

export function getAliasTypeArguments(type: Type): readonly Type[] {
    return type.getAliasTypeArguments()
}

function resolveAll(handles: readonly {resolve(): Node | undefined}[]): readonly Declaration[] {
    const resolved: Declaration[] = []
    for (const handle of handles) {
        const node = handle.resolve()
        if (node) resolved.push(node as Declaration)
    }
    return resolved
}
