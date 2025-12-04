# Karambit decorators

[![NPM version](https://badge.fury.io/js/karambit-decorators.svg)](https://www.npmjs.com/package/karambit-decorators)
[![NPM License](https://img.shields.io/npm/l/karambit-inject)](../LICENSE.txt)

## Usage

This is a utility library for use with [karambit-inject](https://www.npmjs.com/package/karambit-inject), as an alternative to JSDoc tags for annotating code.
These decorators have no logic, it's safe to strip them from runtime code.

Karambit decorators will work regardless of what value is set for the TypeScript [`experimentalDecorators`](https://www.TypeScriptlang.org/tsconfig#experimentalDecorators) compiler flag.

For example, with JSDocs you might write:

```typescript
/**
 * @component
 * @includesModule {@link HelloWorldModule}
 */
export interface HelloWorldComponent {
    readonly greeter: Greeter
}
```

With `karambit-decorators`, you could instead write:

```typescript
@Component({modules: [HelloWorldModule]})
export abstract class HelloWorldComponent {
    abstract readonly greeter: Greeter
}
```

## License

```text
Copyright 2022-2025 Devin Price

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
