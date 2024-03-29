import * as assert from "assert"
import {
    Inject,
    Provides,
    Scope,
    Provider,
    SubcomponentFactory,
    Module,
    Component,
    Subcomponent,
    Reusable,
    Named,
    Qualifier,
    Qualified,
    BindsInstance,
    Binds,
    IntoSet,
    ElementsIntoSet,
    IntoMap,
    MapKey,
    createComponent,
    getConstructor,
    Assisted,
    AssistedInject, ElementsIntoMap,
} from "karambit-inject"
import * as k from "karambit-inject"

describe("Injection", () => {
    describe("Scope", () => {
        it("unscoped returns new instance", () => {
            assert.notStrictEqual(scopedComponent.unscopedClass, scopedComponent.unscopedClass)
        })
        it("scoped returns same instance", () => {
            assert.strictEqual(scopedComponent.scopedClass, scopedComponent.scopedClass)
        })
        it("reusable returns same instance", () => {
            assert.strictEqual(scopedComponent.reusableClass, scopedComponent.reusableClass)
        })
        it("unscoped @Inject type returns same instance", () => {
            assert.notStrictEqual(scopedComponent.unscopedInjectClass, scopedComponent.unscopedInjectClass)
        })
        it("scoped @Inject type returns same instance", () => {
            assert.strictEqual(scopedComponent.scopedInjectClass, scopedComponent.scopedInjectClass)
        })
        it("reusable @Inject type returns same instance", () => {
            assert.strictEqual(scopedComponent.reusableInjectClass, scopedComponent.reusableInjectClass)
        })
        it("scoped nullable type returns cached instance", () => {
            assert.strictEqual(scopedComponent.nullableClass, null)
            assert.strictEqual(scopedComponent.nullableClass, null)
            assert.strictEqual(nullProvidedCount, 1)
        })
    })
    describe("Component dependencies", () => {
        it("parent provides child binding", () => {
            assert.strictEqual(parentComponent.parentClass.child, childInstance)
        })
        it("parent provides instance binding", () => {
            assert.strictEqual(parentComponent.boundString, "bound")
        })
        it("type literal properties are bound", () => {
            assert.strictEqual(parentComponent.value, Symbol.for("value"))
        })
        it("implemented properties are not overriden", () => {
            assert.ok(parentComponent.implementedProperty)
        })
    })
    describe("Providers", () => {
        it("provider type provides instance of Provider", () => {
            assert.ok(providerComponent.providedOnlyProvider())
        })
        it("provider type can be injected into downstream", () => {
            assert.strictEqual(parentComponent.providerHolder.provider(), childInstance)
        })
    })
    describe("Modules", () => {
        it("includes modules in a parent module", () => {
            assert.strictEqual(includesComponent.includedValue, 1337)
        })
    })
    describe("Bindings", () => {
        it("bound type returns concrete instance", () => {
            assert.strictEqual(parentComponent.parentClassInterface.child, childInstance)
        })
    })
    describe("Qualifiers", () => {
        it("deprecated named parameter provides named provider", () => {
            assert.strictEqual(includesComponent.deprecatedNamedValue, 4321)
        })
        it("deprecated qualified parameter provides qualified provider", () => {
            assert.strictEqual(includesComponent.deprecatedQualifiedValue, 8765)
        })
        it("named parameter provides named provider", () => {
            assert.strictEqual(includesComponent.namedValue, 1234)
        })
        it("qualified parameter provides qualified provider", () => {
            assert.strictEqual(includesComponent.qualifiedValue, 5678)
        })
        it("another qualified parameter provides another qualified provider", () => {
            assert.strictEqual(includesComponent.anotherQualifiedValue, 2222)
        })
    })
    describe("Optionals", () => {
        it("not provided optional class is not present", () => {
            assert.strictEqual(optionalComponent.missingOptional, undefined)
        })
        it("provided optional class is present", () => {
            assert.ok(optionalComponent.providedOptional)
        })
        it("provided class with optional value has required parameter", () => {
            assert.strictEqual(optionalComponent.providedOptional!.optionalValue, undefined)
            assert.strictEqual(optionalComponent.providedOptional!.initializedValue, true)
            assert.strictEqual(optionalComponent.providedOptional!.requiredString, "not optional")
        })
        it("provided class with optional value does not have optional parameter", () => {
            assert.strictEqual(optionalComponent.providedOptional!.optionalValue, undefined)
        })
    })
    describe("Subcomponents", () => {
        it("subcomponent has constructor provided bindings", () => {
            assert.strictEqual(parentComponent.subcomponentFactory([2, 2]).sum, 4)
        })
        it("subcomponent can provide parent bindings", () => {
            assert.strictEqual(parentComponent.subcomponentFactory([2, 2]).parentClass.child, childInstance)
        })
        it("subcomponent works with scoped constructor", () => {
            const subcomponent = parentComponent.scopedSubcomponentFactory()
            assert.strictEqual(subcomponent.scopedClass, subcomponent.scopedClass)
            assert.strictEqual(subcomponent.scopedClass.value, "bound")
        })
        it("subcomponent works with scoped module provides", () => {
            const subcomponent = parentComponent.scopedSubcomponentFactory()
            assert.strictEqual(subcomponent.scopedInterface, subcomponent.scopedInterface)
            assert.strictEqual(subcomponent.scopedInterface.value, "bound:scoped")
        })
        it("grandchild subcomponent can provide all bindings", () => {
            const subcomponent = parentComponent.subcomponentFactory([2])
            const grandchildComponent = subcomponent.grandChildSubcomponentFactory({})
            assert.deepStrictEqual([2], grandchildComponent.grandChildClass.values)
        })
        it("subcomponent factory is available within graph", () => {
            assert.strictEqual(parentComponent.parentClass.subcomponentFactory([2, 2]).sum, 4)
        })
        it("subcomponent factory can be aliased", () => {
            assert.strictEqual(parentComponent.aliasedSubcomponentFactory([2, 2]).sum, 4)
        })
        it("subcomponent factory helper type can be used", () => {
            assert.strictEqual(parentComponent.builtInTypeSubcomponentFactory([2, 2]).sum, 4)
        })
    })
    describe("Multibindings", () => {
        it("multibinding set provides all elements", () => {
            assert.strictEqual(multibindingComponent.numberSet.size, 6)
            assert.ok(multibindingComponent.numberSet.has(1))
            assert.ok(multibindingComponent.numberSet.has(2))
            assert.ok(multibindingComponent.numberSet.has(3))
            assert.ok(multibindingComponent.subcomponentFactory().numberSetExtension.has(10))
            assert.ok(multibindingComponent.subcomponentFactory().numberSetExtension.has(11))
            assert.ok(multibindingComponent.subcomponentFactory().numberSetExtension.has(12))
        })
        it("multibinding set via @Binds", () => {
            assert.strictEqual(multibindingComponent.boundSet.size, 2)
            const values = Array.from(multibindingComponent.boundSet.values())
            assert.ok(values.some(it => it.property === "impl"))
            assert.ok(values.some(it => it.property === "provided"))
        })
        it("multibinding set provides qualified elements", () => {
            assert.strictEqual(multibindingComponent.qualifiedSet.size, 2)
            assert.ok(multibindingComponent.qualifiedSet.has(1))
            assert.ok(multibindingComponent.qualifiedSet.has(2))
        })
        it("multibinding set provides scoped elements", () => {
            assert.strictEqual(multibindingComponent.numberSet.size, 6)
            assert.strictEqual(multibindingComponent.numberSet.size, 6)
            assert.strictEqual(multibindingScopedProvidedCount, 1)
        })
        it("subcomponent multibinding provides additional set elements", () => {
            assert.strictEqual(multibindingComponent.subcomponentFactory().numberSetExtension.size, 7)
            assert.ok(multibindingComponent.subcomponentFactory().numberSetExtension.has(1))
            assert.ok(multibindingComponent.subcomponentFactory().numberSetExtension.has(2))
            assert.ok(multibindingComponent.subcomponentFactory().numberSetExtension.has(3))
            assert.ok(multibindingComponent.subcomponentFactory().numberSetExtension.has(4))
            assert.ok(multibindingComponent.subcomponentFactory().numberSetExtension.has(10))
            assert.ok(multibindingComponent.subcomponentFactory().numberSetExtension.has(11))
            assert.ok(multibindingComponent.subcomponentFactory().numberSetExtension.has(12))
        })
        it("multibinding map provides all elements", () => {
            assert.strictEqual(multibindingComponent.numberMap.size, 6)
            assert.strictEqual(multibindingComponent.numberMap.get("one"), 1)
            assert.strictEqual(multibindingComponent.numberMap.get("two"), 2)
            assert.strictEqual(multibindingComponent.numberMap.get("three"), 3)
            assert.strictEqual(multibindingComponent.numberMap.get("ten"), 10)
            assert.strictEqual(multibindingComponent.numberMap.get("eleven"), 11)
            assert.strictEqual(multibindingComponent.numberMap.get("twelve"), 12)
        })
        it("multibinding map via @Binds", () => {
            assert.strictEqual(multibindingComponent.boundMap.size, 2)
            assert.ok(multibindingComponent.boundMap.get("impl")?.property, "impl")
            assert.ok(multibindingComponent.boundMap.get("provided")?.property, "provided")
        })
        it("multibinding map provides qualified elements", () => {
            assert.strictEqual(multibindingComponent.qualifiedMap.size, 2)
            assert.strictEqual(multibindingComponent.qualifiedMap.get("one"), 1)
            assert.strictEqual(multibindingComponent.qualifiedMap.get("two"), 2)
        })
        it("multibinding map provides scoped elements", () => {
            assert.strictEqual(multibindingComponent.numberMap.size, 6)
            assert.strictEqual(multibindingComponent.numberMap.size, 6)
            assert.strictEqual(multibindingScopedProvidedCount, 1)
        })
        it("subcomponent multibinding provides additional map elements", () => {
            assert.strictEqual(multibindingComponent.subcomponentFactory().numberMapExtension.size, 7)
            assert.strictEqual(multibindingComponent.subcomponentFactory().numberMapExtension.get("one"), 1)
            assert.strictEqual(multibindingComponent.subcomponentFactory().numberMapExtension.get("two"), 2)
            assert.strictEqual(multibindingComponent.subcomponentFactory().numberMapExtension.get("three"), 3)
            assert.strictEqual(multibindingComponent.subcomponentFactory().numberMapExtension.get("four"), 4)
            assert.strictEqual(multibindingComponent.subcomponentFactory().numberMapExtension.get("ten"), 10)
            assert.strictEqual(multibindingComponent.subcomponentFactory().numberMapExtension.get("eleven"), 11)
            assert.strictEqual(multibindingComponent.subcomponentFactory().numberMapExtension.get("twelve"), 12)
        })
    })
    describe("Configuration", () => {
        it("Component has custom name", () => {
            assert.strictEqual(parentComponent.constructor.name, "CustomComponentName")
        })
    })
    describe("Assisted factory", () => {
        it("Assisted factory can be provided", () => {
            const instance = assistedInjectComponent.assistedFactory(1337)
            assert.strictEqual(instance.string, "provided-string")
            assert.strictEqual(instance.assistedNumber, 1337)
        })
        it("Assisted factory can be provided with params in another order", () => {
            const sym = Symbol()
            const obj = {}
            const instance = assistedInjectComponent.anotherAssistedFactory(sym, obj, 1234)
            assert.strictEqual(instance.string, "provided-string")
            assert.strictEqual(instance.assistedNumber, 1234)
            assert.strictEqual(instance.assistedSymbol, sym)
            assert.strictEqual(instance.assistedObject, obj)
        })
    })
})

const TestScope = Scope()
const TestSubcomponentScope = Scope()

class ScopedClass { }
class UnscopedClass { }
class ReusableClass { }

@Inject
class InjectClass { }

@Inject
@TestScope
class ScopedInjectClass { }

@Inject
@Reusable
class ReusableInjectClass { }

let nullProvidedCount: number = 0

@Module
abstract class ScopeModule {

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

type NullableClass = InjectClass | null

@Component({modules: [ScopeModule]})
@TestScope
abstract class ScopedComponent {

    abstract readonly unscopedClass: UnscopedClass

    abstract readonly scopedClass: ScopedClass

    abstract readonly unscopedInjectClass: InjectClass

    abstract readonly scopedInjectClass: ScopedInjectClass

    abstract readonly reusableInjectClass: ReusableInjectClass

    abstract readonly reusableClass: ReusableClass

    abstract readonly nullableClass: NullableClass
}

const scopedComponent = createComponent<typeof ScopedComponent>()

class ChildClass { }

@Inject
class ParentClass implements ParentClassInterface {
    constructor(readonly child: ChildClass, readonly subcomponentFactory: SubcomponentFactory<typeof ChildSubcomponent>) { }
}

const childInstance = new ChildClass()

class ChildComponent {

    readonly childClass: ChildClass = childInstance
}

@Inject
class ProviderHolder {
    constructor(readonly provider: Provider<ChildClass>) { }
}

interface ProvidedOnly { }

@Module
class SubcomponentModule {

    @Provides
    static provideSum(values: number[]): number {
        return values.reduce((l, r) => l + r, 0)
    }
}

interface GrandChildDependency { }

@k.Inject
@k.Reusable
class GrandChildClass {

    constructor(
        readonly values: number[],
        readonly parentClass: ParentClass,
        readonly parentInterface: ParentInterface,
        readonly dep: GrandChildDependency,
    ) { }
}

@k.Subcomponent
abstract class GrandChildSubcomponent {

    protected constructor(@BindsInstance dep: GrandChildDependency) { }

    abstract readonly grandChildClass: GrandChildClass
}

interface ChildSubcomponentInterface {
    readonly sum: number
    readonly parentClass: ParentClass
    readonly grandChildSubcomponentFactory: (dep: GrandChildDependency) => GrandChildSubcomponent
}

@Subcomponent({modules: [SubcomponentModule], subcomponents: [GrandChildSubcomponent]})
abstract class ChildSubcomponent implements ChildSubcomponentInterface {

    constructor(@k.BindsInstance values: number[]) { }

    abstract readonly sum: number
    abstract readonly parentClass: ParentClass
    abstract readonly grandChildSubcomponentFactory: (dep: GrandChildDependency) => GrandChildSubcomponent
}
type ChildSubcomponentFactory = (values: number[]) => ChildSubcomponentInterface

@Inject
@TestSubcomponentScope
class ScopedSubcomponentClass {
    constructor(readonly value: string) { }
}

interface ScopedSubcomponentInterface {
    value: string
}

@k.Module
class ScopedSubcomponentModule {

    @k.Provides
    @TestSubcomponentScope
    static provideScopedSubcomponentInterface(str: string): ScopedSubcomponentInterface {
        return {value: str + ":scoped"}
    }
}

@Subcomponent({modules: [ScopedSubcomponentModule]})
@TestSubcomponentScope
abstract class ScopedSubcomponent {

    abstract readonly scopedClass: ScopedSubcomponentClass
    abstract readonly scopedInterface: ScopedSubcomponentInterface
}

interface ParentInterface { }

@Module
abstract class ParentModule {

    @Binds
    abstract bindParentClassInterface: (concrete: ParentClass) => ParentClassInterface

    @Binds
    abstract bindChildSubcomponentFactory: (factory: (values: number[]) => ChildSubcomponent) => ChildSubcomponentFactory

    @Provides
    static provideParentInterface(): ParentInterface {
        return {}
    }
}

interface ParentClassInterface {
    readonly child: ChildClass
}

abstract class InheritedClass {
    abstract readonly value: symbol
    abstract readonly implementedProperty: boolean
}

@Component({generatedClassName: "CustomComponentName", modules: [ParentModule], subcomponents: [ChildSubcomponent, ScopedSubcomponent]})
abstract class ParentComponent extends InheritedClass {

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

const ParentComponentConstructor = getConstructor(ParentComponent)
const parentComponent = new ParentComponentConstructor(new ChildComponent(), {value: Symbol.for("value")}, "bound")

@Module
abstract class ProviderModule {

    @Provides
    static provideProvider(): ProvidedOnly {
        return { }
    }
}

@Component({modules: [ProviderModule]})
abstract class ProviderComponent {

    abstract readonly providedOnlyProvider: Provider<ProvidedOnly>
}

const providerComponent = createComponent<typeof ProviderComponent>()

const MyQualifier = Qualifier()
declare const testQualifier: unique symbol
export type TestQualifier = Qualified<typeof testQualifier>
declare const anotherQualifier: unique symbol
export type AnotherQualifier = Qualified<typeof anotherQualifier>

@Module
class AnotherIncludedModule {

    @Provides
    static provideNumber(): number {
        return 1337
    }
}

@Module({includes: [AnotherIncludedModule]})
class IncludedModule { }

@Module({includes: [IncludedModule]})
class IncludesModule {

    @Provides
    @Named("my name")
    static provideDeprecatedNamedNumber(): number {
        return 4321
    }

    @Provides
    static provideNamedNumber(): number & Named<"my name"> {
        return 1234
    }

    @Provides
    @MyQualifier
    static provideDeprecatedQualifiedNumber(): number {
        return 8765
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
abstract class IncludesComponent {

    abstract readonly includedValue: number

    @Named("my name") abstract readonly deprecatedNamedValue: number

    @MyQualifier abstract readonly deprecatedQualifiedValue: number

    abstract readonly namedValue: number & Named<"my name">

    abstract readonly qualifiedValue: number & TestQualifier

    abstract readonly anotherQualifiedValue: number & AnotherQualifier
}

const includesComponent = createComponent<typeof IncludesComponent>()

@Inject
class ProvidedOptional {
    constructor(requiredString: "overload")
    constructor(readonly requiredString?: string, readonly initializedValue: boolean = true, readonly optionalValue?: number) { }
}

class MissingOptional {
    constructor(readonly requiredValue: number) { }
}

@Module
class OptionalModule {

    @Provides
    static provideRequiredString(): string {
        return "not optional"
    }
}

@Component({modules: [OptionalModule]})
abstract class OptionalComponent {

    abstract readonly providedOptional?: ProvidedOptional
    abstract readonly missingOptional?: MissingOptional
}

const optionalComponent = createComponent<typeof OptionalComponent>()

@Module
abstract class MultibindingSetSubcomponentModule {

    @Provides
    @IntoSet
    static provideFour(): number {
        return 4
    }

    @Provides
    @MapKey("four")
    @IntoMap({optional: false})
    static provideFourIntoMap(): number {
        return 4
    }
}

@Subcomponent({modules: [MultibindingSetSubcomponentModule]})
abstract class MultibindingSetSubcomponent {

    abstract readonly numberSetExtension: ReadonlySet<number>
    abstract readonly numberMapExtension: ReadonlyMap<string, number>
}

interface ThreeHolder {
    three: number
}

let multibindingScopedProvidedCount = 0

@Module
abstract class MultibindingSetModule {

    @k.Binds
    @k.IntoSet
    abstract bindMultibindingType: (impl: MultibindingTypeImpl) => MultibindingType

    @Provides
    @IntoSet
    static provideOne(): number {
        return 1
    }

    @Provides
    static provideTwo(): number {
        return 2
    }

    @Provides
    @IntoSet
    static provideTwoIntoSet(two: number): number {
        return two
    }

    @Provides
    @ElementsIntoSet
    static provideIterableIntoSet(): number[] {
        return [10, 11, 12]
    }

    @Provides
    @Reusable
    @IntoSet
    static provideThree(holder: ThreeHolder): number {
        multibindingScopedProvidedCount++
        return holder.three
    }

    @Provides
    static provideThreeHolder(): ThreeHolder {
        return {three: 3}
    }

    @Provides
    @IntoSet
    static provideMultibindingType(): MultibindingType {
        return {property: "provided"}
    }

    @Provides
    @IntoSet
    @MyQualifier
    static provideQualifiedOne(): number {
        return 1
    }

    @Provides
    @IntoSet
    @MyQualifier
    static provideQualifiedTwo(): number {
        return 2
    }
}

@Module
abstract class MultibindingMapModule {

    @Binds
    @MapKey("impl")
    @IntoMap
    abstract bindMultibindingType: (impl: MultibindingTypeImpl) => MultibindingType

    @Provides
    @MapKey("one")
    @IntoMap
    static provideOne(): number {
        return 1
    }

    @Provides
    @IntoMap
    static provideTwo(): [string, number] {
        return ["two", 2]
    }

    @Provides
    @MapKey("three")
    @IntoMap
    static provideThree(holder: ThreeHolder): number {
        return holder.three
    }

    @Provides
    @ElementsIntoMap
    static provideIterableIntoSet(): [string, number][] {
        return [["ten", 10], ["eleven", 11], ["twelve", 12]]
    }

    @Provides
    @MapKey("one")
    @IntoMap
    @MyQualifier
    static provideQualifiedOne(): number {
        return 1
    }

    @Provides
    @IntoMap
    @MyQualifier
    static provideQualifiedTwo(): [string, number] {
        return ["two", 2]
    }

    @Provides
    @k.MapKey("provided")
    @k.IntoMap
    static provideMultibindingType(): MultibindingType {
        return {property: "provided"}
    }
}

interface MultibindingType {
    property: string
}

@Inject
class MultibindingTypeImpl {
    property = "impl"
}

@k.Component({modules: [MultibindingSetModule, MultibindingMapModule], subcomponents: [MultibindingSetSubcomponent]})
abstract class MultibindingsComponent {

    abstract readonly numberSet: ReadonlySet<number>
    abstract readonly boundSet: ReadonlySet<MultibindingType>
    @MyQualifier abstract readonly qualifiedSet: ReadonlySet<number>
    @MyQualifier abstract readonly qualifiedMap: ReadonlyMap<string, number>

    abstract readonly numberMap: ReadonlyMap<string, number>
    abstract readonly boundMap: ReadonlyMap<string, MultibindingType>

    abstract readonly subcomponentFactory: SubcomponentFactory<typeof MultibindingSetSubcomponent>
}

const multibindingComponent = k.createComponent<typeof MultibindingsComponent>()

@AssistedInject
class AssistedInjectClass {

    constructor(
        readonly string: string,
        @Assisted readonly assistedNumber: number,
    ) { }
}

@AssistedInject
class AnotherAssistedInjectClass {

    constructor(
        @Assisted readonly assistedNumber: number,
        readonly string: string,
        @Assisted readonly assistedSymbol: symbol,
        @Assisted readonly assistedObject: object,
    ) { }
}

@Module
abstract class AssistedInjectModule {

    @Provides
    static provideString(): string {
        return "provided-string"
    }
}

type AnotherAssistedInjectClassFactory = (symbol: symbol, object: object, number: number) => AnotherAssistedInjectClass

@Component({modules: [AssistedInjectModule]})
abstract class AssistedInjectComponent {
    abstract readonly assistedFactory: (number: number) => AssistedInjectClass
    abstract readonly anotherAssistedFactory: AnotherAssistedInjectClassFactory
}

const assistedInjectComponent = createComponent<typeof AssistedInjectComponent>()
