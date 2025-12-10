---
title: Feature guide
---

# Karambit feature guide

## Components

[Components](https://en.wikipedia.org/wiki/Component_(graph_theory)) are the most fundamental part of Karambit. Each Component hosts a single graph of dependencies, and they expose the contract which Karambit implements during compilation.

A component is an abstract class marked with the `@component` tag. It's defined by its installed [Modules](#modules), installed [Subcomponents](#subcomponents), [scope](#scope), [constructor arguments](#component-dependencies), and [declared properties](#exposing-types).

### Exposing types

A component with no properties is not useful. A component ultimately exists to expose some properties, which represent instances of types in the Component's graph. Component properties must be abstract (if the Component declaration is a class) and read-only. In the most distilled sense, Karambit's only purpose is to generate an implementation of properties declared in a Component.

From the Hello World sample:
```typescript
/** @component */
export interface HelloWorldComponent {
    readonly greeter: Greeter
}
```

A component declaration may be an abstract class or an interface.

This Component exposes the `Greeter` type through its `greeter` property. Karambit will generate a graph of dependencies internally to satisfy `Greeter`'s dependencies, and then implement a getter that provides an instance of `Greeter`.

### Component dependencies

There are some cases where you may want to provide dependencies into a graph at runtime in a configurable way at construction time. This is possible by declaring an `abstract class` Component and adding arguments to the Component's constructor, or by declaring a factory type and mapping it using the `@factory` tag.

For each argument of the Component's constructor, Karambit will retrieve instances from the declared properties of those arguments.

For example:

```typescript
interface MyComponentDependency {
    value: number
    text: string
}

/** @component */
export abstract class MyComponent {
    constructor(dep: MyComponentDependency) { }
    // ...
}

/**
 * Equivalent to the above declaration
 * @component
 * @factory {@link MyComponentFactory}
 */
export interface MyComponent {
    // ...
}
export type MyComponentFactory = (dep: MyComponentDependency) => MyComponent
```

Here, `MyComponent` will have the `number` and `string` types bound to its graph, and they will be available as dependencies of other types within the graph. Whenever a `number` or `string` instance is needed, then they will be provided by accessing these respective properties.

> **Note**
> The types bound to the graph are determined by the **declared** properties of the parameter, not those of the instance that is passed in at runtime.

> **Note**
> You can easily compose Components from other Components using this technique.

#### Binds instance

Sometimes, you want to bind a single type into your graph rather than all of its properties. To do this, mark the parameter with `@bindsInstance`.

```typescript
/** @component */
export abstract class MyComponent {
    constructor(/** @bindsInstance */ value: number, /** @bindsInstance */ text: string) { }
}
```

This is functionally equivalent to the previous example.

### Instantiating a graph

Karambit generates a new class that extends the class tagged with `@component`. You can specify the name of the generated class via the (optional) `@generatedClassName` tag. By default, karambit will prefix the component name with `Karambit`.

To instantiate your graph, simply create an instance of this generated class.

```typescript
const componentInstance = new KarambitHelloWorldComponent()
```

Once you have an instance, you can access your graph via the properties you defined:
```typescript
console.log(componentInstance.greeter.greet()) // "Hello, World!"
```

## Inject

The `@inject` tag is the simplest way to provide a type. A class marked with this tag will have its constructor available to Karambit for creating instances. Marking a class as `@inject` is functionally equivalent to creating a `@provides` Module method with the same arguments and return type as the class constructor.

```typescript
/** @inject */
export class MyClass {
    // this constructor will be called automatically with its required argument(s)
    constructor(someDependency: InterfaceType) { }
}
```

> **Note** `@inject` classes may also be marked with a single [Scope](#scope), but not a [Qualifier](#qualifiers) (use a [`@provides`](#provides) method for that).

## Modules

Modules are where you define the implementation details of your Component. That is, how each type in the graph should be provided.

### Provides

Provides methods are a basic way to provide types. There are several situations where `@Inject` can't be used, namely:
* The type you want to provide is an interface or primitive, or otherwise has no constructor
* You don't own the type you want to provide, or otherwise cannot tag it
* You need to mutate or configure an object after constructing it

When Karambit needs an instance of a type, it will look for an installed Module with a `@provides` method with that return type, and call that method to create an instance.

In the Hello World sample, the `string` type is provided via a `@provides` method:
```typescript
export const HelloWorldModule = {
    /** @provides */
    provideGreeting(): string {
        return "Hello"
    },
}
```

Modules can alternatively be defined as abstract classes, which allows mixing `@provides` and `@binds` within a single module.

```typescript
export abstract class HelloWorldModule {
    /** @provides */
    static provideGreeting(): string {
        return "Hello"
    }
}
```

> **Note**
> Provides methods defined in a class must be static.

Modules are installed using the `@includeModule` tag. Modules can be installed to Components, Subcomponents, and even other Modules.

```typescript
/**
 * @component
 * @includeModule {@link HelloWorldModule}
 */
```

### Binds

Often, you want to bind an interface to a specific concrete instance. You might normally do so like this:
```typescript
/** @provides */
export const AnimalModule = {
    /** @provides */
    provideAnimal(dog: Dog): Animal {
        return dog
    },
}
```

`@binds` can simplify this type of binding and will result in simpler generated code. The above provider could be replaced with:
```typescript
export interface AnimalModule {
    /** @binds */
    bindAnimal(dog: Dog): Animal
}
```

`@binds` methods must be abstract and have a callable type with exactly one argument. The argument type must be assignable to the return type.

`@binds` can also be used with property declarations with the same restrictions:
```typescript
export interface AnimalModule {
    /** @binds */
    bindAnimal: (dog: Dog) => Animal
}
```

### Includes

A Module may also include other modules via the `@includeModule` tag. For example:
```typescript
/**
 * @includeModule {@link MyOtherModule} {@link OneMoreModule}
 */
export abstract class MyModule { }
```

Installing `MyModule` to a Component or including it within another module will also install or include `MyOtherModule` and `OneMoreModule` transitively.

## Optional bindings

If the parameter to a provider (`@inject` constructor or `@provides` method) is optional or has an initializer, or if a Component property is optional, then compilation will not fail if the binding is missing. Instead, `undefined` will be provided for that type within the Component graph.

```typescript
/** @inject */
export class Car {
    // if there is no Engine provided in the component where this class is bound, then compilation will fail
    // however, Color and SeatWarmer are bound optionally, and compilation will succeed even if they are not provided
    constructor(engine: Engine, color: Color = Color.RED, warmer?: SeatWarmer) { }
}
```

## Qualifiers

In some cases, you may need to differentiate between two bindings of the same type within your graph. Unlike Dagger, the preferred way of doing this in Karambit is by creating a new type with similar structure ("branding" or "flavoring" the type). Karambit offers two helper types to assist with this.

Karambit has a built-in `Named` type available:

```typescript
// make sure to import *type* if you have a dev dependency on karambit-inject
import type {Named} from "karambit-inject"

export abstract class MyModule {
    /** @provides */
    static provideUserName(): string & Named<"username"> { /* ... */ }

    /** @provides */
    static provideAboutMe(): string & Named<"about-me"> { /* ... */ }

    /** @provides */
    static provideUser(username: string & Named<"username">, aboutMe: string & Named<"about-me">): User { /* ... */ }
}
```

You can create a truly *unique* Qualifier by using Karambit's `Qualified` helper type and using it in a similar way:

```typescript
import type {Qualified} from "karambit-inject"

// in this example, we simply *declare* the symbols since they are not used at runtime.
// if you access your symbol(s) at runtime, make sure to actually instantiate them!
declare const usernameQualifier: unique symbol
type UsernameQualifier = Qualified<typeof usernameQualifier>
declare const aboutMeQualifier: unique symbol
type AboutMeQualifier = Qualified<typeof aboutMeQualifier>

export abstract class MyModule {
    /** @provides */
    static provideUserName(): string & UsernameQualifier { /* ... */ }

    /** @provides */
    static provideAboutMe(): string & AboutMeQualifier { /* ... */ }

    /** @provides */
    static provideUser(username: string & UsernameQualifier, aboutMe: string & AboutMeQualifier): User { /* ... */ }
}
```

## Scope

Frequently, some types will have state, and it doesn't suffice to create a new instance each time the type is required (e.g., the Singleton pattern). Karambit supports caching instances via a Scope.

A Component may optionally be associated with one Scope. Bindings within the Component can be bound to that same Scope, and those scoped bindings will be instantiated no more than once within a Component.

To declare a scope, declare or initialize a unique symbol:

```typescript
// note: try to use a name that reflects the lifecycle of your component
// note:
// in this example, we simply *declare* the symbols since they are not used at runtime.
// if you access your symbol(s) at runtime, make sure to actually instantiate them!
declare const ApplicationScope: unique symbol

export abstract class MyModule {
    /**
     * this will only be created once in ApplicationComponent; the instance will be shared across all types that depend on MyService
     * @provides
     * @scope {@link ApplicationScope}
     */
    static provideGlobalService(): MyService { /* ... */ }
}

/**
 * @component
 * @scope {@link ApplicationScope}
 */
export interface ApplicationComponent { /* ... */ }
```

Alternatively, you can use a named scope:

```typescript
/**
 * @provides
 * @scope MyScopeName
 */
```

### Reusable scope

Sometimes, we have stateless types that can be cached, but they are not associated with any particular scope. For these types, there is a special tag called `@reusable`. Providers marked with `@reusable` *may* be cached in any Component, and Karambit will do its best to avoid creating unnecessary instances of these types. However, there are no guarantees about when caching will occur, if at all.

> **Warning**
> Do not depend on `@reusable` to scope types with mutable state or for singletons where providing a new instance could result in a bug! If you need to reuse an instance, always create your own scope!

## Provider

Sometimes a class doesn't need a dependency immediately during construction, it needs *many* of some dependent type, or it needs finer control over when the dependent type is created. In these situations, you can use a `Provider<T>` to provide these instances.

You can inject `Provider<T>` anywhere that you can inject `T`. The difference is that a `Provider<T>` is a function that will return an instance of `T` by calling its provider method in the dependency graph.

```typescript
import type {Provider} from "karambit-inject"

/** @inject */
export class OrigamiMaker {
    constructor(private readonly paperProvider: Provider<Paper>) { }
    makeCrane(): OrigamiCrane {
        return this.paperProvider().fold() // get a new sheet of paper each time
    }
}
```

> **Note**
> If `T` is scoped, then each call to its `Provider<T>` will return the same instance.

## Subcomponents

Subcomponents function just like components, except they are installed as a child of another Component or Subcomponent, and they have access to all the types bound in their parent.

The main use-case of a Subcomponent is to break up the scope of some Component.

### Declaring a Subcomponent

The declaration of a Subcomponent is almost identical to any other Component, except that it may not share the scope of any ancestor Component or Subcomponent.

A Subcomponent can itself have its own Subcomponents, as well as its own [component dependencies](#component-dependencies).

```typescript
/**
 * @subcomponent
 * @includeModule {@link ...} {@link ...}
 */
export interface MySubcomponent { /* ... */ }
```

However, a subcomponent must be installed in a parent to be used. To install it, simply add it to the array of Subcomponents in another Component or Subcomponent:
```typescript
/**
 * @component
 * @includeSubcomponent {@link MySubcomponent}
 */
export interface ParentComponent {
    readonly subcomponentFactory: SubcomponentFactory<typeof MySubcomponent> // equivalent to () => MySubcomponent
}
```

Installing a subcomponent adds a factory binding to your graph. The factory binding is function type with the same argument types as the Subcomponent constructor which returns an instance of the Subcomponent. Karambit includes a helper type, `SubcomponentFactory<T>` which has represents the factory type for a Subcomponent of type `T`.

This type can be injected anywhere within the parent graph, and can be called to return a new instance of the Subcomponent.

## Multibindings

Multibindings are a convenience tool that allows you to bind the elements of a Set or Map across separate `@provides` or `@binds` methods, and even across different Modules.

You can use multibindings to, for example, implement a "plugin" architecture.

### Set multibindings

To contribute an object into a `ReadonlySet`, use the `@intoSet` tag on the Module method:

```typescript
export abstract class FoodModule {
    /**
     * @provides
     * @intoSet
     */
    static provideApple(): string {
        return "Apple"
    }

    /**
     * @provides
     * @intoSet
     */
    static provideBurger(): string {
        return "Burger"
    }
}
```

This will contribute a binding into the graph for `ReadonlySet<string>`. The above code is effectively equivalent to:

```typescript
export abstract class FoodModule {
    /** @provides */
    static provideFood(): ReadonlySet<string> {
        return new Set(["Apple", "Burger"])
    }
}
```

### Map multibindings

Map multibindings are similar to set multibindings, only you must also specify the map key for each element. This can be done using the `@intoMap` tag:

```typescript
export abstract class NumberModule {
    /**
     * @provides
     * @intoMap
     */
    static provideOne(): [string, number] {
        return ["one", 1]
    }

    /**
     * @provides
     * @intoMap
     */
    static provideTwo(): [string, number] {
        return ["two", 2]
    }
}
```

Alternatively, if you're using [karambit-decorators](../decorators/README.md), you can return the value directly using the `@MapKey` decorator:

```typescript
export abstract class NumberModule {
    @Provides
    @MapKey("one")
    @IntoMap
    static provideOne(): number {
        return 1
    }

    @Provides
    @MapKey("two")
    @IntoMap
    static provideTwo(): number {
        return 2
    }
}
```

The above examples would bind the `ReadonlyMap<string, number>` type into the graph and are effectively equivalent to:

```typescript
export abstract class NumberModule {
    /** @provides */
    static provideNumbers(): ReadonlyMap<string, number> {
        return new Map([["one", 1], ["two", 2]])
    }
}
```

In both cases, the type of map is inferred based on the key and value types used. When using `@MapKey`, you can use its generic type argument to override the inferred type:

```typescript
@MapKey<"enum1" | "enum2">("enum1")
```

You can also bind several elements in a single provider with `@elementsIntoSet` or `@elementsIntoMap`. These work basically the same as the non-elements equivalent, except they return an iterable of the element type instead of a single element. For maps, this means returning an iterable of `[KeyType, ValueType]` tuples (you cannot use `@MapKey` in conjunction with `@ElementsIntoMap`).

```typescript
export abstract class MoreNumbersModule {
    /**
     * @provides
     * @elementsIntoSet
     */
    static provideVegetables(): string[] {
        return ["brocolli", "carrot", "lettuce"]
    }

    /**
     * @provides
     * @elementsIntoMap
     */
    static provideSpecialNumbers(): Set<[string, number]> { // note that these can return any iterable type
        return new Set([["NaN", NaN], ["Infinity", Infinity]])
    }
}
```

### Multibindings in subcomponents

Multibindings are unique in that they are the only opportunity a subcomponent has to modify the bindings of its parent. Any `@intoSet` or `@intoMap` bindings in a subcomponent will be provided *in addition* to those provided by its parent.

Therefore, the injected set or map may have different elements based on which component or subcomponent it is injected from.

> **Note**
> A subcomponent can only *add* bindings to a set or map, it cannot remove bindings provided by its parent.

## Assisted injection

Sometimes it's necessary for some values to be injected via the Karambit framework, while others are passed in via the caller at runtime. Subcomponents make this possible for collections of dependencies, but are typically overkill to inject a single class. Often, we would use the Factory pattern to inject these types.

Karambit provides a utility for this pattern via assisted injection, where some constructor parameters can be marked as `@assisted` and provided by the caller at runtime:

```typescript
/** @assistedInject */
export class MyRepository {
    constructor(
        private readonly localDatabase: Database,
        /** @assisted */ private readonly remoteUrl: string,
    ) { }
}
```

This will bind a factory type into the graph that will automatically inject the non-assisted parameters. Specifically, in this case, you can now bind the following factory type anywhere in your graph:

```typescript
myRepositoryFactory: (remoteUrl: string) => MyRepository
```

However, note that unlike `@inject`, you cannot bind `MyRepository` directly, you can only bind its factory type.

There are a few other limitations when using assisted injection, namely:
1. `@assistedInject` classes must have at least one `@assisted` constructor parameter.
2. Each parameter marked `@assisted` must have a unique type within the constructor parameters. You can use [qualifiers](#qualifiers) to distinguish otherwise identical types.
