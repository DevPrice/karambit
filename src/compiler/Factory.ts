import ts from "typescript"

/**
 * Node construction.
 *
 * Exposed as free functions rather than methods on a factory object. That shape is not arbitrary:
 * it is the shape the compiler's own node factory takes once Karambit moves off the classic API,
 * so call sites written against this package do not move again.
 */

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

/**
 * Creates an identifier the emitter will rename if it collides with anything else in the output file.
 *
 * The current compiler resolves these names during emit; a node factory without an emitter behind it
 * cannot, so this is the one construction call that has no equivalent on a newer backend. It stays
 * isolated here so the replacement lands in one place.
 */
export const createUniqueName = ts.factory.createUniqueName

/** Creates an empty source file to hold generated statements. */
export function createSourceFile(fileName: string, scriptTarget: ScriptTarget): ts.SourceFile {
    return ts.createSourceFile(fileName, "", scriptTarget, undefined, ts.ScriptKind.TS)
}

type ScriptTarget = ts.ScriptTarget

/** Deep-clones a node and its subtree, detaching it from the tree it was parsed into. */
export function cloneNode<T extends ts.Node>(node: T): T {
    // Not part of the compiler's public API surface, but stable across every version Karambit supports.
    return (ts.factory as unknown as {cloneNode: <U extends ts.Node>(node: U) => U}).cloneNode(node)
}
