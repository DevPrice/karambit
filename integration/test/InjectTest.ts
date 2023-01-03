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
    BindsInstance,
    Binds,
    IntoSet,
} from "karambit-inject"
import {IntoMap, MapKey} from "../../src/karambit"

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
        it("named parameter provides named provider", () => {
            assert.strictEqual(includesComponent.namedValue, 1234)
        })
        it("qualified parameter provides qualified provider", () => {
            assert.strictEqual(includesComponent.qualifiedValue, 5678)
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
            assert.strictEqual(multibindingComponent.numberSet.size, 3)
            assert.ok(multibindingComponent.numberSet.has(1))
            assert.ok(multibindingComponent.numberSet.has(2))
            assert.ok(multibindingComponent.numberSet.has(3))
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
            assert.strictEqual(multibindingComponent.numberSet.size, 3)
            assert.strictEqual(multibindingComponent.numberSet.size, 3)
            assert.strictEqual(multibindingScopedProvidedCount, 1)
        })
        it("subcomponent multibinding provides additional set elements", () => {
            assert.strictEqual(multibindingComponent.subcomponentFactory().numberSetExtension.size, 4)
            assert.ok(multibindingComponent.subcomponentFactory().numberSetExtension.has(1))
            assert.ok(multibindingComponent.subcomponentFactory().numberSetExtension.has(2))
            assert.ok(multibindingComponent.subcomponentFactory().numberSetExtension.has(3))
            assert.ok(multibindingComponent.subcomponentFactory().numberSetExtension.has(4))
        })
        it("multibinding map provides all elements", () => {
            assert.strictEqual(multibindingComponent.numberMap.size, 3)
            assert.strictEqual(multibindingComponent.numberMap.get("1"), 1)
            assert.strictEqual(multibindingComponent.numberMap.get("2"), 2)
            assert.strictEqual(multibindingComponent.numberMap.get("3"), 3)
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
class ScopedComponent {

    readonly unscopedClass: UnscopedClass

    readonly scopedClass: ScopedClass

    readonly unscopedInjectClass: InjectClass

    readonly scopedInjectClass: ScopedInjectClass

    readonly reusableInjectClass: ReusableInjectClass

    readonly reusableClass: ReusableClass

    readonly nullableClass: NullableClass
}

const scopedComponent = new ScopedComponent()

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

@Inject
@Reusable
class GrandChildClass {

    constructor(
        readonly values: number[],
        readonly parentClass: ParentClass,
        readonly parentInterface: ParentInterface,
        readonly dep: GrandChildDependency,
    ) { }
}

@Subcomponent
abstract class GrandChildSubcomponent {

    protected constructor(@BindsInstance dep: GrandChildDependency) { }

    readonly grandChildClass: GrandChildClass
}

interface ChildSubcomponentInterface {
    readonly sum: number
    readonly parentClass: ParentClass
    readonly grandChildSubcomponentFactory: (dep: GrandChildDependency) => GrandChildSubcomponent
}

@Subcomponent({modules: [SubcomponentModule], subcomponents: [GrandChildSubcomponent]})
abstract class ChildSubcomponent implements ChildSubcomponentInterface {

    constructor(@BindsInstance values: number[]) { }

    readonly sum: number
    readonly parentClass: ParentClass
    readonly grandChildSubcomponentFactory: (dep: GrandChildDependency) => GrandChildSubcomponent
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

@Module
class ScopedSubcomponentModule {

    @Provides
    @TestSubcomponentScope
    static provideScopedSubcomponentInterface(str: string): ScopedSubcomponentInterface {
        return {value: str + ":scoped"}
    }
}

@Subcomponent({modules: [ScopedSubcomponentModule]})
@TestSubcomponentScope
abstract class ScopedSubcomponent {

    readonly scopedClass: ScopedSubcomponentClass
    readonly scopedInterface: ScopedSubcomponentInterface
}

interface ParentInterface { }

@Module
abstract class ParentModule {

    @Provides
    static provideParentInterface(): ParentInterface {
        return {}
    }

    // @ts-ignore
    @Binds
    abstract bindParentClassInterface(concrete: ParentClass): ParentClassInterface

    // @ts-ignore
    @Binds
    abstract bindChildSubcomponentFactory(factory: (values: number[]) => ChildSubcomponent): ChildSubcomponentFactory
}

interface ParentClassInterface {
    readonly child: ChildClass
}

@Component({modules: [ParentModule], subcomponents: [ChildSubcomponent, ScopedSubcomponent]})
class ParentComponent {

    constructor(child: ChildComponent, typeLiteralChild: {value: symbol}, @BindsInstance public boundString: string) { }

    readonly value: symbol
    readonly parentClass: ParentClass
    readonly parentClassInterface: ParentClassInterface
    readonly providerHolder: ProviderHolder

    readonly subcomponentFactory: (values: number[]) => ChildSubcomponent
    readonly scopedSubcomponentFactory: () => ScopedSubcomponent
    readonly aliasedSubcomponentFactory: ChildSubcomponentFactory
    readonly builtInTypeSubcomponentFactory: SubcomponentFactory<typeof ChildSubcomponent>
}

const parentComponent = new ParentComponent(new ChildComponent(), {value: Symbol.for("value")}, "bound")

@Module
abstract class ProviderModule {

    @Provides
    static provideProvider(): ProvidedOnly {
        return { }
    }
}

@Component({modules: [ProviderModule]})
class ProviderComponent {

    readonly providedOnlyProvider: Provider<ProvidedOnly>
}

const providerComponent = new ProviderComponent()

const MyQualifier = Qualifier()

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
    static provideNamedNumber(): number {
        return 1234
    }

    @Provides
    @MyQualifier
    static provideQualifiedNumber(): number {
        return 5678
    }
}

@Component({modules: [IncludesModule]})
class IncludesComponent {

    readonly includedValue: number

    @Named("my name") readonly namedValue: number

    @MyQualifier readonly qualifiedValue: number
}

const includesComponent = new IncludesComponent()

@Inject
class ProvidedOptional {
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
class OptionalComponent {

    readonly providedOptional?: ProvidedOptional
    readonly missingOptional?: MissingOptional
}

const optionalComponent = new OptionalComponent()

@Module
abstract class MultibindingSetSubcomponentModule {

    @Provides
    @IntoSet
    static provideFour(): number {
        return 4
    }
}

@Subcomponent({modules: [MultibindingSetSubcomponentModule]})
abstract class MultibindingSetSubcomponent {

    readonly numberSetExtension: ReadonlySet<number>
}

interface ThreeHolder {
    three: number
}

let multibindingScopedProvidedCount = 0

@Module
class MultibindingSetModule {

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

    // @ts-ignore
    @Binds
    @IntoSet
    abstract bindMultibindingType(impl: MultibindingTypeImpl): MultibindingType
}

@Module
abstract class MultibindingMapModule {

    @Provides
    @MapKey("1")
    @IntoMap
    static provideOne(): number {
        return 1
    }

    @Provides
    @MapKey("2")
    @IntoMap
    static provideTwo(): number {
        return 2
    }

    @Provides
    @MapKey("3")
    @IntoSet
    static provideThree(holder: ThreeHolder): number {
        return holder.three
    }
}

interface MultibindingType {
    property: string
}

@Inject
class MultibindingTypeImpl {
    property = "impl"
}

@Component({modules: [MultibindingSetModule, MultibindingMapModule], subcomponents: [MultibindingSetSubcomponent]})
class MultibindingsComponent {

    readonly numberSet: ReadonlySet<number>
    readonly boundSet: ReadonlySet<MultibindingType>
    @MyQualifier readonly qualifiedSet: ReadonlySet<number>

    readonly numberMap: ReadonlyMap<string, number>

    readonly subcomponentFactory: SubcomponentFactory<typeof MultibindingSetSubcomponent>
}

const multibindingComponent = new MultibindingsComponent()
