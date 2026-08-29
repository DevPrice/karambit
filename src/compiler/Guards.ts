import ts from "typescript"
import type {Declaration, Decorator, JSDocTag, Node, PropertyDeclaration} from "./Ast"

/**
 * Node predicates and the accessors for modifier-adjacent syntax.
 *
 * Most are direct pass-throughs. The ones that are not - the two that need more than a syntax-kind
 * check, and the JSDoc and decorator accessors - are the reason this module exists rather than
 * every call site reaching for the compiler.
 */

export const {
    isArrayLiteralExpression,
    isCallExpression,
    isClassDeclaration,
    isClassLike,
    isConstructorDeclaration,
    isDecorator,
    isFunctionTypeNode,
    isGetAccessorDeclaration,
    isIdentifier,
    isImportDeclaration,
    isInterfaceDeclaration,
    isJSDoc,
    isJSDocLink,
    isJSDocSignature,
    isMethodDeclaration,
    isMethodSignature,
    isObjectLiteralExpression,
    isParameter,
    isPropertyAssignment,
    isPropertyDeclaration,
    isSetAccessorDeclaration,
    isStringLiteral,
    isTypeAliasDeclaration,
    isVariableDeclaration,
    isVariableDeclarationList,
} = ts

/** Whether the declaration is a `readonly x: T` style member declared on the class body. */
export function isPropertyLikeDeclaration(declaration: Declaration): declaration is PropertyDeclaration {
    return ts.isPropertyDeclaration(declaration) || ts.isAutoAccessorPropertyDeclaration(declaration)
}

/**
 * Whether the declaration is a constructor parameter that also declares a property, as in
 * `constructor(private readonly x: T)`.
 *
 * Needs the declaration's parent as well as its kind, so it is not a plain syntax-kind test.
 */
export function isParameterProperty(declaration: Declaration): boolean {
    return ts.isParameterPropertyDeclaration(declaration, declaration.parent)
}

/** All JSDoc tags attached to a node, including those inherited from enclosing nodes. */
export function getJSDocTags(node: Node): readonly JSDocTag[] {
    return ts.getJSDocTags(node)
}

/** The decorators applied to a node, or undefined where a node cannot carry any. */
export function getDecorators(node: Node): readonly Decorator[] | undefined {
    return ts.canHaveDecorators(node) ? ts.getDecorators(node) : undefined
}
