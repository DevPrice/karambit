import * as k from "karambit-decorators"
import {
    Assisted,
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

@Inject
@Reusable
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

@Component({modules: [ScopeModule]})
@TestScope
export abstract class ScopedComponent {

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
    constructor(readonly child: ChildClass, readonly subcomponentFactory: SubcomponentFactory<typeof ChildSubcomponent>) { }
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

@ChildScope
@Subcomponent({modules: [SubcomponentModule], subcomponents: [GrandChildSubcomponent]})
export abstract class ChildSubcomponent implements ChildSubcomponentInterface {

    constructor(@k.BindsInstance values: number[]) { }

    abstract readonly sum: number
    abstract readonly parentClass: ParentClass
    abstract readonly grandChildSubcomponentFactory: (dep: GrandChildDependency) => GrandChildSubcomponent
}
export type ChildSubcomponentFactory = (values: number[]) => ChildSubcomponentInterface


/** @inject */
@TestSubcomponentScope
export abstract class ScopedSubcomponentClass {
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

@Subcomponent({modules: [ScopedSubcomponentModule]})
@TestSubcomponentScope
export abstract class ScopedSubcomponent {

    abstract readonly scopedClass: ScopedSubcomponentClass
    abstract readonly scopedInterface: ScopedSubcomponentInterface
}

export interface ParentInterface { }

@Module()
export abstract class ParentModule {

    /** @binds */
    abstract bindParentClassInterface(concrete: ParentClass): ParentClassInterface

    @Binds()
    abstract bindChildSubcomponentFactory: (factory: (values: number[]) => ChildSubcomponent) => ChildSubcomponentFactory

    /** @provides */
    static provideParentInterface(): ParentInterface {
        return {}
    }
}

export interface ParentClassInterface {
    readonly child: ChildClass
}

export abstract class InheritedClass {
    abstract readonly value: symbol
    abstract readonly implementedProperty: boolean
}

@Component({generatedClassName: "CustomComponentName", modules: [ParentModule], subcomponents: [ChildSubcomponent, ScopedSubcomponent]})
export abstract class ParentComponent extends InheritedClass {

    constructor(child: ChildComponent, typeLiteralChild: {value: symbol}, @BindsInstance public boundString: string) {
        super()
    }

    abstract readonly parentClass: ParentClass
    abstract readonly parentClassInterface: ParentClassInterface
    abstract readonly providerHolder: ProviderHolder

    abstract readonly subcomponentFactory: (values: number[]) => ChildSubcomponent
    abstract readonly scopedSubcomponentFactory: () => ScopedSubcomponent
    abstract readonly aliasedSubcomponentFactory: ChildSubcomponentFactory
    abstract readonly builtInTypeSubcomponentFactory: SubcomponentFactory<typeof ChildSubcomponent>

    override readonly implementedProperty = true
}

@Module
export abstract class ProviderModule {

    @Provides
    static provideProvider(): ProvidedOnly {
        return { }
    }
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

@Module({includes: [AnotherIncludedModule]})
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

    abstract readonly anotherQualifiedValue: number & AnotherQualifier
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

@AssistedInject
export class AssistedInjectClass {

    constructor(
        readonly string: string,
        @Assisted readonly assistedNumber: number,
    ) { }
}

@AssistedInject
export class AnotherAssistedInjectClass {

    constructor(
        @Assisted readonly assistedNumber: number,
        readonly string: string,
        @Assisted readonly assistedSymbol: symbol,
        @Assisted readonly assistedObject: object,
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
