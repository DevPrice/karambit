import * as ts from "typescript"
import {QualifiedType} from "./QualifiedType"

export type InstanceProvider = PropertyProvider | ProvidesMethod | InjectableConstructor | SubcomponentFactory | UndefinedProvider | ParentProvider
export type ProviderParameter = ProvidesMethodParameter | ConstructorParameter

export interface PropertyProvider {
    readonly providerType: ProviderType.PROPERTY
    readonly name: ts.Identifier | ts.PrivateIdentifier
    readonly propertyName?: string
    readonly type: QualifiedType
    readonly declaration: ts.ParameterDeclaration
    readonly optional: boolean
}

export function isPropertyProvider(provider: InstanceProvider): provider is PropertyProvider {
    return provider.providerType === ProviderType.PROPERTY
}

export interface ProvidesMethod {
    readonly providerType: ProviderType.PROVIDES_METHOD
    readonly module: ts.ClassDeclaration
    readonly declaration: ts.MethodDeclaration
    readonly type: QualifiedType
    readonly parameters: ProvidesMethodParameter[]
    readonly scope: ts.Symbol | undefined
}

export function isProvidesMethod(provider: InstanceProvider): provider is ProvidesMethod {
    return provider.providerType === ProviderType.PROVIDES_METHOD
}

export interface ProvidesMethodParameter {
    readonly type: QualifiedType
    readonly optional: boolean
}

export interface InjectableConstructor {
    readonly providerType: ProviderType.INJECTABLE_CONSTRUCTOR
    readonly type: ts.Type
    readonly scope: ts.Symbol | undefined
    readonly declaration: ts.ClassDeclaration
    readonly parameters: ConstructorParameter[]
}

export function isInjectableConstructor(provider: InstanceProvider): provider is InjectableConstructor {
    return provider.providerType === ProviderType.INJECTABLE_CONSTRUCTOR
}

export interface ConstructorParameter {
    readonly type: QualifiedType
    readonly name: string
    readonly declaration: ts.ParameterDeclaration
    readonly decorators: ts.Decorator[]
    readonly optional: boolean
}

export interface SubcomponentFactory {
    readonly providerType: ProviderType.SUBCOMPONENT_FACTORY
    readonly declaration: ts.ClassDeclaration
    readonly decorator: ts.Decorator
    readonly type: QualifiedType
    readonly subcomponentType: QualifiedType
    readonly constructorParams: ConstructorParameter[]
}

export function isSubcomponentFactory(provider: InstanceProvider): provider is SubcomponentFactory {
    return provider.providerType === ProviderType.SUBCOMPONENT_FACTORY
}

export interface ParentProvider {
    readonly providerType: ProviderType.PARENT
    readonly type: QualifiedType
    readonly declaration?: undefined
}

export function isParentProvider(provider: InstanceProvider): provider is ParentProvider {
    return provider.providerType === ProviderType.PARENT
}

export interface UndefinedProvider {
    readonly providerType: ProviderType.UNDEFINED
    readonly type: QualifiedType
    readonly declaration?: undefined
}

export function isUndefinedProvider(provider: InstanceProvider): provider is UndefinedProvider {
    return provider.providerType === ProviderType.UNDEFINED
}

export enum ProviderType {
    PROPERTY,
    PROVIDES_METHOD,
    INJECTABLE_CONSTRUCTOR,
    SUBCOMPONENT_FACTORY,
    UNDEFINED,
    PARENT,
}
