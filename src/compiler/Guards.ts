import ts from "typescript"
import type {Declaration, Decorator, JSDocTag, Node, PropertyDeclaration} from "./Ast"

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
    isShorthandPropertyAssignment,
    isStringLiteral,
    isTypeAliasDeclaration,
    isVariableDeclaration,
    isVariableDeclarationList,
} = ts

export function isPropertyLikeDeclaration(declaration: Declaration): declaration is PropertyDeclaration {
    return ts.isPropertyDeclaration(declaration) || ts.isAutoAccessorPropertyDeclaration(declaration)
}

// needs the parent as well as the kind, so it isn't a plain syntax-kind test
export function isParameterProperty(declaration: Declaration): boolean {
    return ts.isParameterPropertyDeclaration(declaration, declaration.parent)
}

export function isExported(declaration: Declaration): boolean {
    return (ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Export) !== 0
}

export function getJSDocTags(node: Node): readonly JSDocTag[] {
    return ts.getJSDocTags(node)
}

export function getDecorators(node: Node): readonly Decorator[] | undefined {
    return ts.canHaveDecorators(node) ? ts.getDecorators(node) : undefined
}
