/**
 * Karambit's entire view of the TypeScript compiler.
 *
 * Nothing outside this directory imports `typescript` - the lint config enforces it. Every syntax
 * tree type, every node the generator builds, and every type-system question Karambit asks passes
 * through here.
 *
 * Two rules keep it useful:
 *
 * - Call sites use the names this package exports, never the compiler's own. The type aliases are
 *   placeholders for interfaces; they can be given a definition of their own without a single call
 *   site changing, which is what makes a second backend possible.
 * - Anything a backend might represent differently is a function here, not a member access. A
 *   declaration list, the constituents of a union, the target of a generic reference - all of them
 *   are things another compiler hands over in a different shape.
 *
 * This directory has no imports from the rest of Karambit, so it can be lifted out into its own
 * package when there is a reason to.
 */

export * from "./Ast"
export * from "./Checker"
export * from "./Factory"
export * from "./Guards"
export * from "./Modules"
export * from "./Program"
