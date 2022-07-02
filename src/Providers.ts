import * as ts from "typescript"
import {QualifiedType} from "./QualifiedType"

export type InstanceProvider = PropertyProvider | ProvidesMethod | InjectableConstructor | SubcomponentFactory
export type ProviderParameter = ProvidesMethodParameter | ConstructorParameter

export interface PropertyProvider {
    readonly name: ts.Identifier | ts.PrivateIdentifier
    readonly propertyName?: string
    readonly type: QualifiedType
}

export interface ProvidesMethod {
    readonly module: ts.ClassDeclaration
    readonly method: ts.MethodDeclaration
    readonly returnType: QualifiedType
    readonly parameters: ProvidesMethodParameter[]
    readonly scope?: ts.Symbol
}

export interface ProvidesMethodParameter {
    readonly type: QualifiedType
    readonly optional: boolean
}

export interface InjectableConstructor {
    readonly type: ts.Type
    readonly parameters: ConstructorParameter[]
}

export interface ConstructorParameter {
    readonly type: QualifiedType
    readonly name: string
    readonly declaration: ts.ParameterDeclaration
    readonly decorators: ts.Decorator[]
    readonly optional: boolean
}

export interface SubcomponentFactory {
    readonly declaration: ts.ClassDeclaration
    readonly decorator: ts.Decorator
    readonly type: QualifiedType
    readonly subcomponentType: QualifiedType
    readonly constructorParams: ConstructorParameter[]
}
