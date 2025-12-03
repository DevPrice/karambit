import * as ts from "typescript"
import {QualifiedType} from "./QualifiedType"
import {ComponentDeclaration, ComponentLikeDeclaration, ComponentScope} from "./TypescriptUtil"

export type InstanceProvider = PropertyProvider | ProvidesMethod | InjectableConstructor | SubcomponentFactory | AssistedFactory | UndefinedProvider | ParentProvider | SetMultibinding | MapMultibinding
export type MultibindingProvider = SetMultibinding | MapMultibinding
export type ProviderParameter = ProvidesMethodParameter | ConstructorParameter

export interface MultibindingElementProvider {
    type: QualifiedType
    optional: boolean
    isIterableProvider: boolean
}

export interface MapEntryProvider extends MultibindingElementProvider {
    key?: ts.Expression
}

export interface MapEntryBinding {
    key?: ts.Expression
    valueType: QualifiedType
}

export interface PropertyProvider {
    readonly providerType: ProviderType.PROPERTY
    readonly name: ts.Identifier | ts.PrivateIdentifier
    readonly propertyName?: string
    readonly type: QualifiedType
    readonly declaration: ts.ParameterDeclaration
    readonly optional: boolean
    readonly scope?: undefined
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
    readonly scope: ComponentScope | undefined
    readonly isIterableProvider: boolean
}

export function isProvidesMethod(provider: InstanceProvider): provider is ProvidesMethod {
    return provider.providerType === ProviderType.PROVIDES_METHOD
}

export interface ProvidesMethodParameter {
    readonly type: QualifiedType
    readonly optional: boolean
}

export interface FactoryParameter {
    readonly name: string
    readonly constructorParamIndex: number
    readonly type: QualifiedType
}

export interface InjectableConstructor {
    readonly providerType: ProviderType.INJECTABLE_CONSTRUCTOR
    readonly type: ts.Type
    readonly scope: ComponentScope | undefined
    readonly declaration: ts.ClassDeclaration
    readonly parameters: ConstructorParameter[]
}

export function isInjectableConstructor(provider: InstanceProvider): provider is InjectableConstructor {
    return provider.providerType === ProviderType.INJECTABLE_CONSTRUCTOR
}

export interface ConstructorParameter {
    readonly type: QualifiedType
    readonly index: number
    readonly name: string
    readonly declaration: ts.ParameterDeclaration
    readonly decorators: ts.Decorator[]
    readonly optional: boolean
}

export interface SubcomponentFactory {
    readonly providerType: ProviderType.SUBCOMPONENT_FACTORY
    readonly declaration: ComponentDeclaration
    readonly decorator?: ts.Decorator
    readonly type: QualifiedType
    readonly subcomponentType: QualifiedType
    readonly constructorParams: ConstructorParameter[]
    readonly scope?: undefined
}

export function isSubcomponentFactory(provider: InstanceProvider): provider is SubcomponentFactory {
    return provider.providerType === ProviderType.SUBCOMPONENT_FACTORY
}

export interface AssistedFactory {
    readonly providerType: ProviderType.ASSISTED_FACTORY
    readonly declaration: ts.ClassDeclaration
    readonly type: QualifiedType
    readonly resultType: QualifiedType
    readonly factoryParams: FactoryParameter[]
    readonly constructorParams: ConstructorParameter[]
    readonly scope?: undefined
}

export interface ParentProvider {
    readonly providerType: ProviderType.PARENT
    readonly type: QualifiedType
    readonly optional: boolean
    readonly declaration?: undefined
    readonly scope?: undefined
}

export interface UndefinedProvider {
    readonly providerType: ProviderType.UNDEFINED
    readonly type: QualifiedType
    readonly declaration?: undefined
    readonly scope?: undefined
}

export interface SetMultibinding {
    readonly providerType: ProviderType.SET_MULTIBINDING
    readonly type: QualifiedType
    readonly elementProviders: MultibindingElementProvider[]
    readonly parentBinding?: boolean
    readonly declaration?: undefined
    readonly scope?: undefined
}

export interface MapMultibinding {
    readonly providerType: ProviderType.MAP_MULTIBINDING
    readonly type: QualifiedType
    readonly entryProviders: MapEntryProvider[]
    readonly parentBinding?: boolean
    readonly declaration?: undefined
    readonly scope?: undefined
}

export enum ProviderType {
    PROPERTY,
    PROVIDES_METHOD,
    INJECTABLE_CONSTRUCTOR,
    SUBCOMPONENT_FACTORY,
    ASSISTED_FACTORY,
    UNDEFINED,
    PARENT,
    SET_MULTIBINDING,
    MAP_MULTIBINDING,
}
