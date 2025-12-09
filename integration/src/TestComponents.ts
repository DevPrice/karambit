import * as k from "karambit-decorators"
import {
    AssistedInject,
    Binds,
    BindsInstance,
    Component,
    Inject,
    Module,
    Provides,
    Reusable,
    Scope,
    Subcomponent,
} from "karambit-decorators"
import type {Named, Provider, Qualified, SubcomponentFactory} from "karambit-inject"
import {MultibindingMapModule, MultibindingSetModule, MultibindingSetSubcomponentModule} from "./MultibindingModules"

const TestScope = Scope()
const TestSubcomponentScope = Scope()

export class ScopedClass { }
export class UnscopedClass { }
export class ReusableClass { }

@Inject
export class InjectClass { x: number = 1 }

@Inject
@TestScope
export class ScopedInjectClass { }

/** @reusable */
@Inject
export class ReusableInjectClass { }

export let nullProvidedCount: number = 0

@Module
export abstract class ScopeModule {

    @Provides
    static provideUnscopedClass(): UnscopedClass {
        return new UnscopedClass()
    }

    @Provides
    @TestScope
    static provideScopedClass(): ScopedClass {
        return new ScopedClass()
    }

    @Provides
    @Reusable
    static provideReusableClass(): ReusableClass {
        return new ReusableClass()
    }

    @Provides
    @Reusable
    static provideNullableClass(): NullableClass {
        nullProvidedCount++
        return null
    }
}

export type NullableClass = InjectClass | null

export interface ScopedComponentInterface {
    readonly unscopedClass: UnscopedClass
    readonly scopedClass: ScopedClass
}

/** @scope {@link TestScope} */
@Component({modules: [ScopeModule]})
export abstract class ScopedComponent implements ScopedComponentInterface {

    abstract readonly unscopedClass: UnscopedClass

    abstract readonly scopedClass: ScopedClass

    abstract readonly unscopedInjectClass: InjectClass

    abstract readonly scopedInjectClass: ScopedInjectClass

    abstract readonly reusableInjectClass: ReusableInjectClass

    abstract readonly reusableClass: ReusableClass

    abstract readonly nullableClass: NullableClass
}

export class ChildClass { }

@Inject
export class ParentClass implements ParentClassInterface {
    constructor(readonly child: ChildClass, readonly subcomponentFactory: ChildSubcomponentFactory) { }
}

export const childInstance = new ChildClass()

const ChildScope = Scope()

@ChildScope
export class ChildComponent {

    readonly childClass: ChildClass = childInstance
}

@Inject
export class ProviderHolder {
    constructor(readonly provider: Provider<ChildClass>) { }
}

export interface ProvidedOnly { }

@Module
export class SubcomponentModule {

    @Provides
    static provideSum(values: number[]): number {
        return values.reduce((l, r) => l + r, 0)
    }
}

@Inject
@ChildScope
export class NestedWithParentProvidedArg {
    constructor(readonly parentClass: ParentClass, readonly dep: number) { }
}

export interface GrandChildDependency { }

@k.Inject
@k.Reusable
export class GrandChildClass {

    constructor(
        readonly values: number[],
        readonly parentClass: ParentClass,
        readonly parentInterface: ParentInterface,
        readonly dep: GrandChildDependency,
    ) { }
}

@k.Subcomponent
export abstract class GrandChildSubcomponent {

    constructor(@BindsInstance dep: GrandChildDependency) { }

    abstract readonly grandChildClass: GrandChildClass
    abstract readonly newClass: NestedWithParentProvidedArg
}

export interface ChildSubcomponentInterface {
    readonly sum: number
    readonly parentClass: ParentClass
    readonly grandChildSubcomponentFactory: (dep: GrandChildDependency) => GrandChildSubcomponent
}

/**
 * @subcomponent
 * @scope {@link ChildScope}
 * @includeModule {@link SubcomponentModule}
 * @includeSubcomponent {@link GrandChildSubcomponent}
 * @factory {@link ChildSubcomponentFactory}
 */
export type ChildSubcomponent = ChildSubcomponentInterface
export type ChildSubcomponentFactory = (/** @bindsInstance */ values: number[]) => ChildSubcomponent

/** @inject */
@TestSubcomponentScope
export class ScopedSubcomponentClass {
    constructor(readonly value: string) { }
}

export interface ScopedSubcomponentInterface {
    value: string
}

@k.Module
export class ScopedSubcomponentModule {

    @k.Provides
    @TestSubcomponentScope
    static provideScopedSubcomponentInterface(str: string): ScopedSubcomponentInterface {
        return {value: str + ":scoped"}
    }
}

/**
 * @subcomponent
 * @includeModule {@link ScopedSubcomponentModule}
 * @scope {@link TestSubcomponentScope}
 */
export interface ScopedSubcomponent {
    readonly scopedClass: ScopedSubcomponentClass
    readonly scopedInterface: ScopedSubcomponentInterface
}

export interface ParentInterface { }

/**
 * @includeModule {@link ParentInterfaceModule}
 */
export abstract class ParentModule {

    @Binds()
    abstract bindChildSubcomponentFactory: (factory: (values: number[]) => ChildSubcomponent) => ChildSubcomponentFactory

    /** @provides */
    static provideParentInterface(): ParentInterface {
        return {}
    }
}

export interface ParentInterfaceModule {
    /** @binds */
    bindParentClassInterface(concrete: ParentClass): ParentClassInterface
}

export interface ParentClassInterface {
    readonly child: ChildClass
}

export abstract class InheritedClass {
    abstract readonly value: symbol
    abstract readonly implementedProperty: boolean
}

/**
 * @component
 * @includeModule {@link ParentModule}
 * @includeSubcomponent {@link ChildSubcomponent} {@link ScopedSubcomponent}
 * @factory {@link ParentComponentInterface}
 * @generatedName CustomComponentName
 */
export abstract class ParentComponent extends InheritedClass {

    protected constructor(public boundString: string) {
        super()
    }

    abstract readonly parentClass: ParentClass
    abstract readonly parentClassInterface: ParentClassInterface
    abstract readonly providerHolder: ProviderHolder

    abstract readonly subcomponentFactory: (values: number[]) => ChildSubcomponent
    abstract readonly scopedSubcomponentFactory: () => ScopedSubcomponent
    abstract readonly aliasedSubcomponentFactory: ChildSubcomponentFactory
    abstract readonly builtInTypeSubcomponentFactory: ChildSubcomponentFactory

    override readonly implementedProperty = true
}
export type ParentComponentInterface = (child: ChildComponent, typeLiteralChild: {value: symbol}, /** @bindsInstance */ boundString: string) => ParentComponent

export const ProviderModule = {
    /** @provides */
    provideProvider(): ProvidedOnly {
        return { }
    },
}

@Component({modules: [ProviderModule]})
export abstract class ProviderComponent {

    abstract readonly providedOnlyProvider: Provider<ProvidedOnly>
}

declare const testQualifier: unique symbol
export type TestQualifier = Qualified<typeof testQualifier>
declare const anotherQualifier: unique symbol
export type AnotherQualifier = Qualified<typeof anotherQualifier>

@Module
export class AnotherIncludedModule {

    @Provides
    static provideNumber(): number {
        return 1337
    }
}

/** @includeModule {@link AnotherIncludedModule} */
export class IncludedModule { }

@Module({includes: [IncludedModule]})
export class IncludesModule {

    @Provides
    static provideNamedNumber(): number & Named<"my name"> {
        return 1234
    }

    @Provides
    static provideQualifiedNumber(): number & TestQualifier {
        return 5678
    }

    @Provides
    static provideAnotherQualifiedNumber(): number & AnotherQualifier {
        return 2222
    }
}

@Component({modules: [IncludesModule]})
export abstract class IncludesComponent {

    abstract readonly includedValue: number

    abstract readonly namedValue: number & Named<"my name">

    abstract readonly qualifiedValue: number & TestQualifier

    abstract getAnotherQualifiedValue(): number & AnotherQualifier
}

@Subcomponent({modules: [MultibindingSetSubcomponentModule]})
export abstract class MultibindingSetSubcomponent {

    abstract readonly numberSetExtension: ReadonlySet<number>
    abstract readonly numberMapExtension: ReadonlyMap<string, number>
}

export interface ThreeHolder {
    three: number
}

export interface MultibindingType {
    property: string
}

@Inject
export class MultibindingTypeImpl {
    property = "impl"
}

@k.Component({modules: [MultibindingSetModule, MultibindingMapModule], subcomponents: [MultibindingSetSubcomponent]})
export abstract class MultibindingsComponent {

    abstract readonly numberSet: ReadonlySet<number>
    abstract readonly boundSet: ReadonlySet<MultibindingType>

    abstract readonly numberMap: ReadonlyMap<string, number>
    abstract readonly boundMap: ReadonlyMap<string, MultibindingType>

    abstract readonly subcomponentFactory: SubcomponentFactory<typeof MultibindingSetSubcomponent>
}

export interface NotExposedMultibindingsInterface {
    readonly subcomponentFactory: SubcomponentFactory<typeof MultibindingSetSubcomponent>
}

/**
 * @component
 * @includeModule {@link MultibindingSetModule} {@link MultibindingMapModule}
 * @includeSubcomponent {@link MultibindingSetSubcomponent}
 */
export type NotExposedMultibindingsComponent = NotExposedMultibindingsInterface

@k.Component({modules: [], subcomponents: [MultibindingSetSubcomponent]})
export abstract class EmptyRootMultibindingsComponent {

    abstract readonly subcomponentFactory: SubcomponentFactory<typeof MultibindingSetSubcomponent>
}

@AssistedInject
export class AssistedInjectClass {

    constructor(
        readonly string: string,
        /** @assisted */ readonly assistedNumber: number,
    ) { }
}

/** @assistedInject */
export class AnotherAssistedInjectClass {

    constructor(
        /** @assisted */ readonly assistedNumber: number,
        readonly string: string,
        /** @assisted */ readonly assistedSymbol: symbol,
        /** @assisted */ readonly assistedObject: object,
    ) { }
}

@Module
export abstract class AssistedInjectModule {

    @Provides
    static provideString(): string {
        return "provided-string"
    }
}

export type AnotherAssistedInjectClassFactory = (symbol: symbol, object: object, number: number) => AnotherAssistedInjectClass

@Component({modules: [AssistedInjectModule]})
export abstract class AssistedInjectComponent {
    abstract readonly assistedFactory: (number: number) => AssistedInjectClass
    abstract readonly anotherAssistedFactory: AnotherAssistedInjectClassFactory
}
