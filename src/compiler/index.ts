/**
 * Karambit's view of the TypeScript compiler. Nothing outside this directory imports `typescript`;
 * the lint config enforces it.
 *
 * The exported types are aliases for now, but they're placeholders for interfaces - giving them their
 * own definition costs no call site changes. Anything a different compiler backend might represent
 * differently is a function here rather than a member access.
 */

export * from "./Ast.js"
export * from "./Checker.js"
export * from "./Factory.js"
export * from "./Guards.js"
export * from "./Modules.js"
export * from "./Names.js"
export * from "./Program.js"
