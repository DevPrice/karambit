# Karambit

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

This project is available as a package in [NPM](https://npmjs.com).

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
