# Karambit feature guide

## Components

[Components](https://en.wikipedia.org/wiki/Component_(graph_theory)) are the most fundamental part of Karambit. Each Component hosts a single graph of dependencies, and they expose the contract which Karambit implements during compilation.

A component is a class marked with the `@Component` annotation. It's defined by its installed [Modules](#Modules), installed [Subcomponents](#Subcomponents), [scope](#Scope), [constructor arguments](#Component-dependencies), and [declared properties](#Exposing-types).

### Exposing types

A component with no properties has no use. A component ultimately exists to expose some properties, which represent instances of types in the Component's graph. Component properties should be read-only, and not initialized. In the most distilled sense, Karambit's only purpose is to generate an implementation of properties declared in a Component.

From the Hello World sample:
```typescript
@Component(/* ... */)
class HelloWorldComponent {
    readonly greeter: Greeter
}
```

This component exposes the `Greeter` type through its `greeter` property. Karambit will generate a graph of dependencies internally to satisfy `Greeter`'s dependencies, and then implement a getter that provides an instance of `Greeter`.

### Component dependencies

There are some cases where you may want to provide dependencies into a graph at runtime in a configurable way at construction time. This is possible by adding arguments to the Component's constructor.

For each argument of the Component's constructor, Karambit will retrieve instances from the declared properties of those arguments.

For example:

```typescript
interface MyComponentDependency {
    value: number
    text: string
}

@Component
class MyComponent {
    constructor(dep: MyComponentDependency) { }
}
```

Here, `MyComponent` will have the `number` and `string` types bound to its graph, and they will be available as dependencies of other types within the graph. Whenever a `number` or `string` instance is needed, then they will be provided by accessing these respective properties.

> **Note**
> The types bound to the graph are determined by the **declared** properties of the parameter, not those of the instance that is passed in at runtime.

> **Note**
> You can easily compose Components from other Components using this technique.

#### Binds instance

Sometimes, you want to bind a single type into your graph rather than all of its properties. To do this, mark the parameter with `@BindsInstance`.

```typescript
@Component
class MyComponent {
    constructor(@BindsInstance value: number, @BindsInstance text: string) { }
}
```

This is functionally equivalent to the previous example.

### Instantiating a graph

Creating an instance of your dependency graph is simple, just call the constructor of your Component. You can access all of its properties just like any other class, and they will provide instances from the graph.

From the Hello World sample:
```typescript
const component = new HelloWorldComponent()
console.log(component.greeter.greet()) // "Hello, World!"
```

## Inject

The `@Inject` decorator is the simplest way to provide a type. A class marked with this decorator will have its constructor available to Karambit for creating instances. Marking a class as `@Inject` is functionally equivalent to creating a `@Provides` Module method with the same arguments and return type as the class constructor.

```typescript
@Inject
class MyClass {
    constructor(someDependency: InterfaceType) { } // this constructor will be called automatically with its required arguments
}
```

> **Note** `@Inject` classes may also be marked with a single [Scope](#Scope), but not a [Qualifier](#Qualifiers) (use a [`@Provides`](#Provides) method for that).

## Modules

Modules are where you define the implementation details of your Component. That is, how each type in the graph should be provided. A module must be decorated with the `@Module` decorator.

### Provides

Provides methods are a basic way to provide types. There are several situations where `@Inject` can't be used, namely:
* The type you want to provide is an interface or primitive, or otherwise has no constructor
* You don't own the type you want to provide, or otherwise cannot decorate it
* You need to mutate or configure an object after constructing it

When Karambit needs an instance of a type, it will look for an installed Module with a `@Provides` method with that return type, and call that method to create an instance.

In the Hello World sample, the `string` type is provided via a `@Provides` method:
```typescript
@Module
abstract class HelloWorldModule {
    @Provides
    static provideGreetingTarget(): string {
        return "World"
    }
}
```

> **Note**
> Provides methods must be static.

### Binds

Often, you want to bind an interface to a specific concrete instance. You might normally do so like this:
```typescript
@Provides
static provideAnimal(dog: Dog): Animal {
    return dog
}
```

`@Binds` can simplify this type of binding and will result in simpler generated code. The above provider could be replaced with:
```typescript
@Binds
abstract bindAnimal(dog: Dog): Animal
```

> **Note**
> TypeScript does not allow abstract methods to be decorated, so your IDE will likely complain about this syntax. Since this decorator is stripped away by Karambit during compile, it will not actually cause an error. You can hide the IDE error with @ts-ignore, or use a `@Provides` method instead if preferred.

`@Binds` methods must be abstract and have exactly one argument. The argument type must be assignable to the return type.

### Includes

A Module may also include other modules via the `modules` property of its configuration. For example:
```typescript
@Module({includes: [MyOtherModule, OneMoreModule]})
abstract class MyModule { }
```

Installing `MyModule` to a Component or including it within another module will also install or include `MyOtherModule` and `OneMoreModule` transitively.

## Optional bindings

If the parameter to a provider (`@Inject` constructor or `@Provides` method) is optional or has an initializer, or if a Component property is optional, then compilation will not fail if the binding is missing. Instead, `undefined` will be provided for that type within the Component graph.

```typescript
@Inject
class Car {
    // if there is no Engine provided in the component where this class is bound, then compilation will fail
    // however, Color and SeatWarmer are bound optionally, and compilation will succeed even if they are not provided
    constructor(engine: Engine, color: Color = Color.RED, warmer?: SeatWarmer) { }
}
```

## Qualifiers

In some cases, you may need to differentiate between two bindings of the same type within your graph. This is possible using Qualifiers. To qualify a type, simply mark its provider (`@Provides` or `@Binds`) and injection site (Provider parameter, `@Inject` constructor parameter, or Component property) with a Qualifier decorator.

Karambit has a built in `@Named` qualifier available:

```typescript
@Module
abstract class MyModule {
    @Provides
    @Named("username")
    static provideUserName(): string { /* ... */ }

    @Provides
    @Named("about-me")
    static provideAboutMe(): string { /* ... */ }

    @Provides
    static provideUser(@Named("username") username: string, @Named("about-me") aboutMe: string): User { /* ... */ }
}
```

You can create a custom Qualifier by calling Karambit's `Qualifier()` method and use it in a similar way:

```typescript
const Username = Qualifier()
const AboutMe = Qualifier()

@Module
abstract class MyModule {
    @Provides
    @Username
    static provideUserName(): string { /* ... */ }

    @Provides
    @AboutMe
    static provideAboutMe(): string { /* ... */ }

    @Provides
    static provideUser(@Username username: string, @AboutMe aboutMe: string): User { /* ... */ }
}
```

## Scope

Frequently, some types will have state, and it doesn't suffice to create a new instance each time the type is required (e.g., the Singleton pattern). Karambit supports caching instances via a Scope.

A Component may optionally be associated with one Scope. Bindings within the Component can be bound to that same Scope, and those scoped bindings will be instantiated no more than once within a Component.

To create a scope, call the `Scope()` method. This method returns a decorator you can use to annotate your scoped Components and bindings.

```typescript
// note: try to use a name that reflects the lifecycle of your component
const ApplicationScope = Scope()

@Module
abstract class MyModule {
    @Provides
    @ApplicationScope // this will only be created once in ApplicationComponent; the instance will be shared across all types that depend on MyService
    static provideGlobalService(): MyService { /* ... */ }
}

@Component({modules: [MyModule]})
@ApplicationScope
class ApplicationComponent { /* ... */ }
```

### Reusable scope

Sometimes, we have stateless types that can be cached, but they are not associated with any particular scope. For these types, there is a special scope called `@Reusable`. Providers marked with `@Reusable` *may* be cached in any Component, and Karambit will do its best to avoid creating unnecessary instances of these types. However, there are no guarantees about when caching will occur, if at all.

> **Warning**
> Do not depend on `@Reusable` to scope types with mutable state or for singletons where providing a new instance could result in a bug! If you need to reuse an instance, always create your own scope!

## Provider

Sometimes a class doesn't need a dependency immediately during construction, it needs *many* of some dependent type, or it needs finer control over when the dependent type is created. In these situations, you can use a `Provider<T>` to provide these instances.

You can inject `Provider<T>` anywhere that you can inject `T`. The difference is that a `Provider<T>` is a function that will return an instance of `T` by calling its provider method in the dependency graph.

```typescript
@Inject
class OrigamiMaker {
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

The declaration of a Subcomponent is almost identical to any other Component, except:
* It must be abstract (it can only be constructed within a parent Component or Subcomponent)
* It may not share the scope of any ancestor Component or Subcomponent

A Subcomponent can itself have its own Subcomponents, as well as its own [component dependencies](#Component-dependencies).

```typescript
@Subcomponent({modules: [/* ... */]})
abstract class MySubcomponent { /* ... */ }
```

However, a subcomponent must be installed in a parent to be used. To install it, simply add it to the array of Subcomponents in another Component or Subcomponent:
```typescript
@Component({subcomponents: [MySubcomponent]})
class ParentComponent {
    readonly subcomponentFactory: SubcomponentFactory<typeof MySubcomponent> // equivalent to () => MySubcomponent
}
```

Installing a subcomponent adds a factory binding to your graph. The factory binding is function type with the same argument types as the Subcomponent constructor which returns an instance of the Subcomponent. Karambit includes a helper type, `SubcomponentFactory<T>` which has represents the factory type for a Subcomponent of type `T`.

This type can be injected anywhere within the parent graph, and can be called to return a new instance of the Subcomponent.

## Multibindings

Multibindings are a convenience tool that allows you to bind the elements of a Set or Map across separate `@Provides` or `@Binds` methods, and even across different Modules.

You can use multibindings to, for example, implement a "plugin" architecture.

### Set multibindings

To contribute an object into a `ReadOnlySet`, use the `@IntoSet` decorator on the Module method:

```typescript
@Module
abstract class FoodModule {
    @Provides
    @IntoSet
    static provideApple(): string {
        return "Apple"
    }

    @Provides
    @IntoSet
    static provideBurger(): string {
        return "Burger"
    }
}
```

This will contribute a binding into the graph for `ReadonlySet<string>`. The above code is effectively equivalent to:

```typescript
@Module
abstract class FoodModule {
    @Provides
    static provideFood(): ReadonlySet<string> {
        return new Set(["Apple", "Burger"])
    }
}
```

### Map multibindings

Map multibindings are similar to set multibindings, only you must also specify the map key for each element. This can be done using the `@MapKey` decorator:

```typescript
@Module
abstract class NumberModule {
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

Alternatively, you can bind an entry tuple directly into the map, and skip the `@MapKey` decorator:

```typescript
@Module
abstract class NumberModule {
    @Provides
    @IntoMap
    static provideOne(): [string, number] {
        return ["one", 1]
    }

    @Provides
    @IntoMap
    static provideTwo(): [string, number] {
        return ["two", 2]
    }
}
```

The above examples would bind the `ReadonlyMap<string, number>` type into the graph and are effectively equivalent to:

```typescript
@Module
abstract class NumberModule {
    @Provides
    static provideNumbers(): ReadonlyMap<string, number> {
        return new Map([["one", 1], ["two", 2]])
    }
}
```

In both cases, the type of map is inferred based on the key and value types used. When using `@MapKey`, you can use its generic type argument to override the inferred type:

```typescript
@MapKey<"enum1" | "enum2">("enum1")
```
