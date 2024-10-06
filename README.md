# Karambit

[![NPM version](https://badge.fury.io/js/karambit-inject.svg)](https://www.npmjs.com/package/karambit-inject)
[![NPM License](https://img.shields.io/npm/l/karambit-inject)](LICENSE.txt)
[![Build](https://github.com/DevPrice/karambit/actions/workflows/build.yml/badge.svg)](https://github.com/DevPrice/karambit/actions/workflows/build.yml)

A compile-time and type-safe dependency injector for Typescript.

Karambit is different from other Typescript dependency injection libraries in several key ways:
* It is a fully **compile-time**, code generation framework. Karambit generates plain old Typescript code, and there's no additional runtime logic for injection.
* There is no need to mark or annotate most parameters, including interfaces, with "tokens". Karambit supports binding interfaces to concrete types directly.
* Karambit is **fully type-safe**. It is not possible to register a provider with the wrong type.[^1]
* The dependency graph is **fully validated during compilation**, so if your project builds then you can be certain the graph is valid. This includes detecting missing bindings, dependency cycles, and other common error sources.
* Creating a graph is fully **declarative**; you never need to imperatively register a dependency to a container. Instead, providers are declared idiomatically as constructors and static methods.
* Karambit is fully **transparent to your application code**. Because of this, it plays nicely with other libraries and frameworks. If you wanted to stop using Karambit later, you could simply commit the generated code to your repository and remove Karambit entirely. 

Karambit is heavily inspired by [Dagger](https://github.com/google/dagger/), and if you're familiar with that then you'll be right at home using Karambit.

[^1]: Of course, you can still use Typescript features like `any` or `as` to break anything you want :)

## Installation

This project is available as a package in [NPM](https://www.npmjs.com/package/karambit-inject).

```
$ npm install --save-dev karambit-inject
$ npm install karambit-decorators
```

Karambit is a decorator-based framework. The decorators exist just to annotate code, they have no effect at runtime. Karambit will work regardless of what value is set for the Typescript [`experimentalDecorators`](https://www.typescriptlang.org/tsconfig#experimentalDecorators) compiler flag. 

Karambit works using a simple CLI-based tool for generating code. Once the code is generated, you import it just like any other Typescript code.

For a minimal example project, check out the [Hello World sample](samples/hello_world).

### Using the CLI

The CLI has a simple command to run code generation.

```
$ karambit path/to/your/tsconfig.json -o output-dir
```

A simple build script would look like:

```json
{
  "scripts": {
    "prebuild": "karambit",
    "build": "tsc"
  }
}
```

## Getting started

### Components

Fundamentally, Karambit works by generating an implementation of each class marked `@Component`.

The Component is what ultimately hosts a dependency graph, and how you expose that graph to other parts of your application. You can think of the Component as the entry-point into your graph. In the [Hello World sample](samples/hello_world), the Component looks like this:

```typescript
@Component({modules: [HelloWorldModule]})
export abstract class HelloWorldComponent {
    abstract readonly greeter: Greeter
}
```

This Component exposes a single type, the `Greeter`, which during compile will be implemented by Karambit. Classes marked with `@Component` must be exported.

### Providers

#### @Inject

The next step is to satisfy the dependency graph of the Component. Karambit isn't magic; you need to specify how to get an instance of each type in the graph.

There are several ways to do this, but the simplest is to mark a class with `@Inject`. This makes the constructor of that class available to Karambit, and Karambit will call the constructor to provide an instance of that type. Classes marked with `@Inject` must be exported.

In this sample, the `Greeter` class is marked `@Inject`, and this type is available in the graph.

```typescript
@Inject
export class Greeter {
    constructor(private readonly greeting: string) { }
    greet(): string {
        return `${this.greeting}, World!`
    }
}
```

#### @Provides

The constructor of `Greeter` depends on one other type: `string`. However, this type doesn't have a constructor and, even if it did, we don't control the source code to mark it with `@Inject`.  This is where Modules come in to play.

A module is a collection of static methods marked with `@Provides` and each Component can install many Modules. These provider methods work just like `@Inject` constructors; they can have arguments and will be used by Karambit to provide an instance of their return type. Classes marked with `@Module` must be exported.

In our example, the `string` type is provided in the `HelloWorldModule`:

```typescript
@Module
export abstract class HelloWorldModule {

    @Provides
    static provideGreeting(): string {
        return "Hello"
    }
}
```

You can think of Modules as the private implementation of a Component, which itself is sort of a public interface. The component defines *what* Karambit should construct, and the modules define *how* to construct them.

Modules are installed in Components via the `modules` parameter of the `@Component` decorator.

```typescript
@Component({modules: [HelloWorldModule]})
```

### Putting it all together

By providing the `string` type into our graph, all the required types are now satisfied with providers and Karambit can generate our Component implementation.

You can instantiate a Component by instantiating the generated class:

```typescript
import {KarambitHelloWorldComponent} from "./karambit-generated/component"
const component = new KarambitHelloWorldComponent()
console.log(component.greeter.greet()) // "Hello, World!"
```

When running Karambit, it will generate this implementation:

```javascript
import * as component_1 from "../component";
export class KarambitHelloWorldComponent extends component_1.HelloWorldComponent {
    constructor() {
        super();
    }
    get greeter(): component_1.HelloWorldComponent["greeter"] { return this.getGreeter_1(); }
    private getGreeter_1() { return new component_1.Greeter(this.getString_1()); }
    private getString_1() { return component_1.HelloWorldModule.provideGreeting(); }
}
```

While this example is clearly a bit contrived, you should be able to see how simple it can be to add new types to a graph and build much more complex dependency structures.

This is only scratching the surface of what Karambit is capable of, so check out the [feature guide](FEATURES.md) for a more in-depth look at everything it has to offer. For a small, real-world migration example, check out [this PR](https://github.com/DevPrice/karambit/pull/1) that bootstrapped Karambit to use itself for dependency injection.

## License

```text
Copyright 2022-2024 Devin Price

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
