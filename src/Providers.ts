import {ConstructorParameter} from "./ConstructorHelper"
import {QualifiedType} from "./QualifiedType"
import * as ts from "typescript"

export type InstanceProvider = PropertyProvider | ProvidesMethod
export type ProviderParameter = ProvidesMethodParameter | ConstructorParameter

export interface PropertyProvider {
    readonly name: ts.Identifier | ts.PrivateIdentifier
    readonly propertyName?: string
    readonly type: QualifiedType
}

export interface InjectableConstructor {
    readonly type: QualifiedType
    readonly parameters: ConstructorParameter[]
}

export interface ProvidesMethod {
    module: ts.ClassDeclaration
    method: ts.MethodDeclaration
    returnType: QualifiedType
    parameters: ProvidesMethodParameter[]
    scope?: ts.Symbol
}

export interface ProvidesMethodParameter {
    type: QualifiedType
    optional: boolean
}
