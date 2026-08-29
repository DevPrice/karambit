import ts from "typescript"

export const {
    createArrayLiteralExpression,
    createArrowFunction,
    createAsExpression,
    createBinaryExpression,
    createBlock,
    createCallExpression,
    createClassDeclaration,
    createClassExpression,
    createConditionalExpression,
    createConstructorDeclaration,
    createConstructSignature,
    createExpressionStatement,
    createExpressionWithTypeArguments,
    createGetAccessorDeclaration,
    createHeritageClause,
    createIdentifier,
    createImportClause,
    createImportDeclaration,
    createIndexedAccessTypeNode,
    createIntersectionTypeNode,
    createKeywordTypeNode,
    createLiteralTypeNode,
    createMethodDeclaration,
    createModifier,
    createNamespaceImport,
    createNewExpression,
    createNumericLiteral,
    createParameterDeclaration,
    createParenthesizedExpression,
    createPropertyAccessExpression,
    createPropertyDeclaration,
    createQualifiedName,
    createReturnStatement,
    createSpreadElement,
    createStringLiteral,
    createSuper,
    createThis,
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
    updateSourceFile,
} = ts.factory

export function createSourceFile(fileName: string, scriptTarget: ScriptTarget): ts.SourceFile {
    return ts.createSourceFile(fileName, "", scriptTarget, undefined, ts.ScriptKind.TS)
}

type ScriptTarget = ts.ScriptTarget

export function cloneNode<T extends ts.Node>(node: T): T {
    // not public API, but stable across every version Karambit supports
    return (ts.factory as unknown as {cloneNode: <U extends ts.Node>(node: U) => U}).cloneNode(node)
}
