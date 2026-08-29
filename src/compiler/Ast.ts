import ts from "typescript"

/**
 * Syntax tree and type-system types, re-exported under names this package owns.
 *
 * Everything here is a pass-through today. The point of the indirection is that these names are the
 * only ones the rest of Karambit refers to, so a future compiler backend can redefine them without
 * touching call sites.
 */

export type Node = ts.Node
export type NodeArray<T extends ts.Node> = ts.NodeArray<T>
export type SourceFile = ts.SourceFile
export type Statement = ts.Statement
export type Declaration = ts.Declaration
export type Expression = ts.Expression
export type Identifier = ts.Identifier
export type PrivateIdentifier = ts.PrivateIdentifier
export type StringLiteral = ts.StringLiteral
export type EntityName = ts.EntityName
export type PropertyName = ts.PropertyName
export type PropertyAccessExpression = ts.PropertyAccessExpression
export type ModifierLike = ts.ModifierLike
export type Decorator = ts.Decorator
export type JSDocTag = ts.JSDocTag

export type ClassDeclaration = ts.ClassDeclaration
export type ClassElement = ts.ClassElement
export type ClassLikeDeclaration = ts.ClassLikeDeclaration
export type InterfaceDeclaration = ts.InterfaceDeclaration
export type TypeAliasDeclaration = ts.TypeAliasDeclaration
export type MethodDeclaration = ts.MethodDeclaration
export type MethodSignature = ts.MethodSignature
export type PropertyDeclaration = ts.PropertyDeclaration
export type PropertySignature = ts.PropertySignature
export type ParameterDeclaration = ts.ParameterDeclaration
export type VariableDeclaration = ts.VariableDeclaration
export type ImportDeclaration = ts.ImportDeclaration
export type TypeElement = ts.TypeElement
export type TypeNode = ts.TypeNode

export type Type = ts.Type
export type ObjectType = ts.ObjectType
export type TupleType = ts.TupleType
export type Symbol = ts.Symbol
export type Signature = ts.Signature

/**
 * Enums are re-exported as a value and a type under the same name, so `SyntaxKind.CallExpression`
 * and `kind: SyntaxKind` both resolve through this package.
 */

export const SyntaxKind = ts.SyntaxKind
export type SyntaxKind = ts.SyntaxKind

export const NodeFlags = ts.NodeFlags
export type NodeFlags = ts.NodeFlags

export const TypeFlags = ts.TypeFlags
export type TypeFlags = ts.TypeFlags

export const SymbolFlags = ts.SymbolFlags
export type SymbolFlags = ts.SymbolFlags

export const ObjectFlags = ts.ObjectFlags
export type ObjectFlags = ts.ObjectFlags

export const SignatureKind = ts.SignatureKind
export type SignatureKind = ts.SignatureKind

export const ScriptTarget = ts.ScriptTarget
export type ScriptTarget = ts.ScriptTarget

export const ScriptKind = ts.ScriptKind
export type ScriptKind = ts.ScriptKind

export const ModuleKind = ts.ModuleKind
export type ModuleKind = ts.ModuleKind

export const JsxEmit = ts.JsxEmit
export type JsxEmit = ts.JsxEmit
