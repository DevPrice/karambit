import * as Path from "node:path"
import * as factory from "typescript/unstable/ast/factory"
import {getSynthesizedDeepClone} from "typescript/unstable/ast/clone"
import {NodeFlags, SyntaxKind, TokenFlags} from "typescript/unstable/ast"
import type {
    BinaryExpression,
    BinaryOperatorToken,
    CallExpression,
    ConstructSignatureDeclaration,
    Expression,
    KeywordExpression,
    MemberName,
    ModifierSyntaxKind,
    Node,
    NumericLiteral,
    ConstructorDeclaration,
    FunctionBody,
    GetAccessorDeclaration,
    ModifierLike,
    ParameterDeclaration,
    Path as CompilerPath,
    PropertyName,
    PropertyAccessExpression,
    SourceFile,
    Statement,
    StringLiteral,
    Token,
    TypeNode,
    TypeParameterDeclaration,
} from "typescript/unstable/ast"

export const {
    createArrayLiteralExpression,
    createArrowFunction,
    createAsExpression,
    createBlock,
    createClassDeclaration,
    createClassExpression,
    createConditionalExpression,
    createExpressionStatement,
    createExpressionWithTypeArguments,
    createHeritageClause,
    createIdentifier,
    createImportClause,
    createImportDeclaration,
    createIndexedAccessTypeNode,
    createIntersectionTypeNode,
    createKeywordTypeNode,
    createLiteralTypeNode,
    createMethodDeclaration,
    createNamespaceImport,
    createNewExpression,
    createParameterDeclaration,
    createParenthesizedExpression,
    createPropertyDeclaration,
    createQualifiedName,
    createReturnStatement,
    createSpreadElement,
    createToken,
    createTypeLiteralNode,
    createTypeOperatorNode,
    createTypeQueryNode,
    createTypeReferenceNode,
    createUnionTypeNode,
    createVariableDeclaration,
    createVariableDeclarationList,
    createVariableStatement,
    createVoidExpression,
} = factory

// the rest take flags or wrapper tokens the classic factory defaulted, so they're adapted here rather
// than at every call site

export function createStringLiteral(text: string): StringLiteral {
    return factory.createStringLiteral(text, TokenFlags.None)
}

export function createNumericLiteral(value: string | number): NumericLiteral {
    return factory.createNumericLiteral(String(value), TokenFlags.None)
}

export function createCallExpression(
    expression: Expression,
    typeArguments: readonly TypeNode[] | undefined,
    args: readonly Expression[],
): CallExpression {
    return factory.createCallExpression(expression, undefined, typeArguments, args, NodeFlags.None)
}

export function createPropertyAccessExpression(expression: Expression, name: MemberName): PropertyAccessExpression {
    return factory.createPropertyAccessExpression(expression, undefined, name, NodeFlags.None)
}

export function createBinaryExpression(left: Expression, operator: BinaryOperatorToken, right: Expression): BinaryExpression {
    return factory.createBinaryExpression(undefined, left, undefined, operator, right)
}

export function createConstructSignature(
    typeParameters: readonly TypeParameterDeclaration[] | undefined,
    parameters: readonly ParameterDeclaration[],
    type?: TypeNode,
): ConstructSignatureDeclaration {
    return factory.createConstructSignatureDeclaration(typeParameters, parameters, type)
}

export function createConstructorDeclaration(
    modifiers: readonly ModifierLike[] | undefined,
    parameters: readonly ParameterDeclaration[],
    body?: FunctionBody,
): ConstructorDeclaration {
    return factory.createConstructorDeclaration(modifiers, undefined, parameters, undefined, body)
}

export function createGetAccessorDeclaration(
    modifiers: readonly ModifierLike[] | undefined,
    name: PropertyName,
    parameters: readonly ParameterDeclaration[],
    type?: TypeNode,
    body?: FunctionBody,
): GetAccessorDeclaration {
    return factory.createGetAccessorDeclaration(modifiers, name, undefined, parameters, type, body)
}

export function createModifier<T extends ModifierSyntaxKind>(kind: T): Token<T> {
    return factory.createToken(kind)
}

export function createSuper(): KeywordExpression<SyntaxKind.SuperKeyword> {
    return factory.createKeywordExpression(SyntaxKind.SuperKeyword)
}

export function createThis(): KeywordExpression<SyntaxKind.ThisKeyword> {
    return factory.createKeywordExpression(SyntaxKind.ThisKeyword)
}

// the compiler aborts the process, uncatchably, if a synthesized file name isn't absolute and normalized
export function createSourceFile(fileName: string): SourceFile {
    const path = Path.resolve(fileName).replaceAll(Path.sep, Path.posix.sep)
    return factory.createSourceFile([], factory.createToken(SyntaxKind.EndOfFile), "", path, path as CompilerPath)
}

export function updateSourceFile(node: SourceFile, statements: readonly Statement[]): SourceFile {
    return factory.updateSourceFile(node, statements, node.endOfFileToken)
}

export function cloneNode<T extends Node>(node: T): T {
    return getSynthesizedDeepClone(node)
}
