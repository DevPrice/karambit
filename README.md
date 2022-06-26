# Karambit

[![NPM version](https://badge.fury.io/js/karambit-inject.svg)](https://www.npmjs.com/package/karambit-inject)
[![NPM License](https://img.shields.io/npm/l/karambit-inject)](LICENSE.txt)

A compile-time and type-safe dependency injector for Typescript.

Karambit is different from other Typescript dependency injection libraries in several key ways:
* It is a fully **compile-time** framework. Code is generated during the compile process, and there is **no additional runtime dependency**.
* There is no need to mark or annotate most parameters, including interfaces, with "tokens". Karambit supports binding interfaces to concrete types directly.
* Karambit is **fully type-safe**. It is not possible to register a provider with the wrong type.[^1]
* The dependency graph is **fully validated during compilation**, so if your project builds then you can be certain the graph is valid. This includes detecting missing bindings, dependency cycles, and other common error sources.
* Creating a graph is fully **declarative**; you never need to imperatively register a dependency to a container. Instead, providers are declared idiomatically as constructors and static methods.

Karambit is heavily inspired by [Dagger](https://github.com/google/dagger/), and if you're familiar with that then you'll be right at home using Karambit.

[^1]: Of course, you can still use Typescript features like `any` or `as` to break anything you want :)

## Installation

This project is available as a package in [NPM](https://www.npmjs.com/package/karambit-inject).

```
$ npm install --save-dev karambit-inject
```

Karambit is a decorator-based framework; you'll currently need to enable the [`experimentalDecorators`](https://www.typescriptlang.org/tsconfig#experimentalDecorators) flag in your Typescript compiler options to use the Karambit API. However, please note that these decorators are stripped away during compilation and will not exist in the transpiled JavaScript source code. By extension, run-time reflection metadata is not needed, and you **do not** need to enable the `emitDecoratorMetadata` flag to use Karambit. 

Because Karambit needs to run during the compilation process, you will also have to configure it to run as a transformer.

There are many ways to set this up, but [ttypescript](https://github.com/cevek/ttypescript) or [ts-patch](https://github.com/nonara/ts-patch) are among the simplest.

For a minimal example project, check out the [Hello World sample](samples/hello_world).

> **Note**
> This guide assumes you're using the official Typescript compiler (`tsc`) to build your code. If you're using another method of transpilation to JavaScript, your configuration will differ.

> **Warning**
> Because Karambit decorated source files do not output deterministically based on their own content (i.e., other files can affect the output), these files do not play nicely with the incremental compiler. A clean build may be required when modifying code marked with a Karambit decorator.

### ttypescript

```
$ npm install --save-dev ttypescript
```

Update your build scripts to use `ttsc` instead of `tsc`. For example, in your `package.json`:

```json
{
  "scripts": {
    "build": "ttsc"
  }
}
```

Finally, add the Karambit transformer as a plugin inside your `.tsconfig`:

```json
{
  "compilerOptions": {
    "plugins": [
      { "transform": "karambit-inject" }
    ]
  }
}
```

## Getting started

### Components

Fundamentally, Karambit works by generating an implementation of each class marked `@Component`.

The Component is what ultimately hosts a dependency graph, and how you expose that graph to other parts of your application. You can think of the Component as the entry-point into your graph. In the [Hello World sample](samples/hello_world), the Component looks like this:

```typescript
@Component({modules: [HelloWorldModule]})
class HelloWorldComponent {

    readonly greeter: Greeter
}
```

This Component exposes a single type, the `Greeter`, which during compile will be implemented by Karambit.

### Providers

#### @Inject

The next step is to satisfy the dependency graph of the Component. Karambit isn't magic; you need to specify how to get an instance of each type in the graph.

There are several ways to do this, but the simplest is to mark a class with `@Inject`. This makes the constructor of that class available to Karambit, and Karambit will call the constructor to provide an instance of that type.

In this sample, the `Greeter` class is marked `@Inject`, and this type is available in the graph.

```typescript
@Inject
class Greeter {

    constructor(private readonly target: string) { }
    /// the rest of the class body...
}
```

#### @Provides

The constructor of `Greeter` depends on one other type: `string`. However, this type doesn't have a constructor and, even if it did, we don't control the source code to mark it with `@Inject`.  This is where Modules come in to play.

A module is a collection of static methods marked with `@Provides` and each Component can install many Modules. These provider methods work just like `@Inject` constructors; they can have arguments and will be used by Karambit to provide an instance of their return type.

In our example, the `string` type is provided in the `HelloWorldModule`:

```typescript
@Module
abstract class HelloWorldModule {

    @Provides
    static provideGreetingTarget(): string {
        return "World"
    }
}
```

You can think of Modules as the private implementation of a Component, which itself is sort of a public interface.

Modules are installed in Components via the `modules` parameter of the `@Component` decorator.

```typescript
@Component({modules: [HelloWorldModule]})
```

### Putting it all together

By providing the `string` type into our graph, all the required types are now satisfied with providers and Karambit can generate our Component implementation.

You can use a Component by constructing it and accessing its properties just like any other class:

```typescript
const component = new HelloWorldComponent()
console.log(component.greeter.greet()) // "Hello, World!"
```

Under the hood, Karambit has generated this implementation in the output JavaScript source:

```javascript
class HelloWorldComponent {
    get greeter() { return this.getGreeter_1(); }
    getGreeter_1() { return new Greeter(this.getString_1()); }
    getString_1() { return HelloWorldModule.provideGreetingTarget(); }
}
```

While this example is clearly a bit contrived, you should be able to see how simple it can be to add new types to a graph and build much more complex dependency structures.

This is only scratching the surface of what Karambit is capable of, so check out the [feature guide](FEATURES.md) for a more in-depth look at everything it has to offer.
