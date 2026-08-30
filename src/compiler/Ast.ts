import * as ast from "typescript/unstable/ast"
import {ModuleKind, ObjectFlags, SignatureKind, SymbolFlags, TypeFlags} from "typescript/unstable/sync"
import type * as api from "typescript/unstable/sync"

export type Node = ast.Node
export type NodeArray<T extends ast.Node> = ast.NodeArray<T>
export type SourceFile = ast.SourceFile
export type Statement = ast.Statement
export type Declaration = ast.Declaration
export type Expression = ast.Expression
export type Identifier = ast.Identifier
export type PrivateIdentifier = ast.PrivateIdentifier
export type StringLiteral = ast.StringLiteral
export type EntityName = ast.EntityName
export type PropertyName = ast.PropertyName
export type PropertyAccessExpression = ast.PropertyAccessExpression
export type ModifierLike = ast.ModifierLike
export type Decorator = ast.Decorator
export type JSDocTag = ast.JSDocTag

export type ClassDeclaration = ast.ClassDeclaration
export type ClassElement = ast.ClassElement
export type ClassLikeDeclaration = ast.ClassLikeDeclaration
export type InterfaceDeclaration = ast.InterfaceDeclaration
export type TypeAliasDeclaration = ast.TypeAliasDeclaration
export type MethodDeclaration = ast.MethodDeclaration
export type MethodSignature = ast.MethodSignatureDeclaration
export type PropertyDeclaration = ast.PropertyDeclaration
export type PropertySignature = ast.PropertySignatureDeclaration
export type ParameterDeclaration = ast.ParameterDeclaration
export type VariableDeclaration = ast.VariableDeclaration
export type ImportDeclaration = ast.ImportDeclaration
export type TypeElement = ast.TypeElement
export type TypeNode = ast.TypeNode

export type Type = api.Type
export type ObjectType = api.ObjectType
export type TupleType = api.TupleType
export type Symbol = api.Symbol
export type Signature = api.Signature

// exported as both a value and a type, so `SyntaxKind.CallExpression` and `kind: SyntaxKind` both work
export const SyntaxKind = ast.SyntaxKind
export type SyntaxKind = ast.SyntaxKind

export const NodeFlags = ast.NodeFlags
export type NodeFlags = ast.NodeFlags

export {ModuleKind, ObjectFlags, SignatureKind, SymbolFlags, TypeFlags}
