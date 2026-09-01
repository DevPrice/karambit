import * as is from "typescript/unstable/ast/is"
import {getJSDocTags as getTags, getTextOfJSDocComment, ModifierFlags, SyntaxKind} from "typescript/unstable/ast"
import type {Declaration, Decorator, JSDocTag, Node, PropertyDeclaration} from "./Ast.js"

export const {
    isArrayLiteralExpression,
    isCallExpression,
    isClassDeclaration,
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
    isObjectLiteralExpression,
    isPropertyAssignment,
    isPropertyDeclaration,
    isSetAccessorDeclaration,
    isShorthandPropertyAssignment,
    isStringLiteral,
    isTypeAliasDeclaration,
    isVariableDeclaration,
    isVariableDeclarationList,
} = is

export const isClassLike = is.isClassLikeDeclaration
export const isMethodSignature = is.isMethodSignatureDeclaration
export const isParameter = is.isParameterDeclaration

export function isPropertyLikeDeclaration(declaration: Declaration): declaration is PropertyDeclaration {
    return is.isPropertyDeclaration(declaration) || isAutoAccessorProperty(declaration)
}

// needs the parent as well as the kind, so it isn't a plain syntax-kind test
export function isParameterProperty(declaration: Declaration): boolean {
    if (!is.isParameterDeclaration(declaration) || !is.isConstructorDeclaration(declaration.parent)) return false
    return declaration.modifiers?.some(it => modifierFlagsOnParameterProperties.has(it.kind)) ?? false
}

const modifierFlagsOnParameterProperties: ReadonlySet<SyntaxKind> = new Set([
    SyntaxKind.PublicKeyword,
    SyntaxKind.PrivateKeyword,
    SyntaxKind.ProtectedKeyword,
    SyntaxKind.ReadonlyKeyword,
    SyntaxKind.OverrideKeyword,
])

function isAutoAccessorProperty(declaration: Declaration): boolean {
    return is.isPropertyDeclaration(declaration)
        && (declaration.modifiers?.some(it => it.kind === SyntaxKind.AccessorKeyword) ?? false)
}

export function isExported(declaration: Declaration): boolean {
    const node: Node = is.isVariableDeclaration(declaration) ? declaration.parent.parent : declaration
    if (!("modifierFlags" in node)) return false
    const modifierFlags = (node as {modifierFlags: ModifierFlags}).modifierFlags
    return (modifierFlags & ModifierFlags.Export) !== 0
}

export function getJSDocTags(node: Node): readonly JSDocTag[] {
    return getTags(node)
}

export function getJSDocCommentText(tag: JSDocTag): string | undefined {
    return getTextOfJSDocComment(tag.comment)
}

export function getDecorators(node: Node): readonly Decorator[] | undefined {
    if (!("modifiers" in node)) return undefined
    const modifiers = (node as {modifiers?: readonly Node[]}).modifiers
    return modifiers?.filter(is.isDecorator)
}

// the compiler no longer materializes a children array; this walks the same nodes
export function getChildren(node: Node): readonly Node[] {
    const children: Node[] = []
    node.forEachChild(child => { children.push(child) })
    return children
}
