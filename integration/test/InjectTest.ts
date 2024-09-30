import * as assert from "assert"
import {
    CustomComponentName,
    KarambitAssistedInjectComponent,
    KarambitIncludesComponent,
    KarambitMultibindingsComponent,
    KarambitOptionalComponent,
    KarambitProviderComponent,
    KarambitScopedComponent,
} from "../src/karambit-generated/src/TestComponents"
import {ChildComponent, childInstance, multibindingScopedProvidedCount, nullProvidedCount} from "../src/TestComponents"

describe("Injection", () => {
    describe("Scope", () => {
        const scopedComponent = new KarambitScopedComponent()
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
        const providerComponent = new KarambitProviderComponent()
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
        it("another qualified parameter provides another qualified provider", () => {
            assert.strictEqual(includesComponent.anotherQualifiedValue, 2222)
        })
    })
    describe("Optionals", () => {
        const optionalComponent = new KarambitOptionalComponent()
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
        const multibindingComponent = new KarambitMultibindingsComponent()
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
        const assistedInjectComponent = new KarambitAssistedInjectComponent()
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

const parentComponent = new CustomComponentName(new ChildComponent(), {value: Symbol.for("value")}, "bound")
const includesComponent = new KarambitIncludesComponent()
