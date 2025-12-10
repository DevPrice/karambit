import ts from "typescript"
import {KarambitProgramComponent} from "./karambit-generated/karambit"
import type {Logger} from "./Util"

export {Logger}
export {KarambitError, KarambitErrorScope} from "./KarambitError"
export {ComponentDeclaration} from "./TypescriptUtil"

/** @internal */
export type ConstructorType<T extends abstract new (...args: ConstructorParameters<T>) => InstanceType<T>> = abstract new (...args: ConstructorParameters<T>) => InstanceType<T>

/**
 * Utility type for branding other types.
 * @see [Qualifiers](../documents/FEATURES.md#qualifiers)
 * @see {@link Named}
 */
export type Qualified<T extends keyof any & symbol> = {
    readonly [key in T]?: unknown
}

/** @internal */
export type IsStringLiteral<T> = T extends string
    ? string extends T
        ? false
        : true
    : false

/**
 * Utility type for branding other types.
 * @see [Qualifiers](../documents/FEATURES.md#qualifiers)
 * @see {@link Qualified}
 */
export type Named<T extends string> = IsStringLiteral<T> extends false ? never : {
    readonly [key in `__karambitNamed_${T}`]?: unknown;
}

/**
 * Utility type for lazy injection.
 * If `T` is available for injection within the component, then requesting `Provider<T>` will inject a function
 * that constructs `T`, respecting its scope.
 * @see [Provider](../documents/FEATURES.md#provider)
 */
export interface Provider<T> {
    (): T
    __karambitProvider?: unknown
}

/**
 * Utility type for extracting the factory type from a constructor-based subcomponent declaration.
 *
 * For example, for a subcomponent declared:
 * ```typescript
 * /** @subcomponent *\/
 * export class MySubcomponent {
 *     constructor(example: number) { }
 *     // ...
 * }
 * ```
 *
 * You can inject the subcomponent factory within your graph as: `SubcomponentFactory<typeof MySubcomponent>`.
 */
export interface SubcomponentFactory<T extends ConstructorType<T>> {
    (...args: ConstructorParameters<T>): InstanceType<T>
    __karambitSubcomponentFactory?: unknown
}

/**
 * Configuration for component implementation generation.
 *
 * @property outFile the destination file to write
 * @property dryRun if true, no output files will be written
 * @property verbose enable verbose logging
 * @property nameMaxLength the max length of generated identifiers in output files
 * @property allowEmptyModules if true, generation will succeed even if there are empty modules
 * @property allowEmptyOutput if true, generation will succeed even if no component declarations were found in the input program
 * @property enableDocTags if true, enable support for doc tag annotation in addition to decorators
 * @property outputScriptTarget script target of the generated output TypeScript
 * @property include if specified, only files matching this glob pattern will be examined
 * @property exclude if specified, files matching this glob pattern will *not* be examined (even if specified by {@link include})
 * @property logger allows replacing the default logging with a custom logger; defaults to {@link console}
 * @property printerOptions configuration for how the output TypeScript should be printed
 */
export interface KarambitOptions {
    outFile: string
    dryRun: boolean
    verbose: boolean
    nameMaxLength: number
    allowEmptyModules: boolean
    allowEmptyOutput: boolean
    enableDocTags: boolean
    outputScriptTarget: ts.ScriptTarget
    include?: string[]
    exclude?: string[]
    logger?: Logger
    printerOptions?: ts.PrinterOptions
}

/**
 * Generate component implementations for declared components.
 *
 * @param program the TypeScript program to scan for components, see {@link ts.createProgram}
 * @param options configuration for this generation request
 * @throws {@link KarambitError} if generation fails for an expected reason
 */
export function generateComponentFiles(program: ts.Program, options?: Partial<KarambitOptions>) {
    const karambitOptions = {...defaultOptions, ...options}
    const programComponent = new KarambitProgramComponent(program, karambitOptions)
    programComponent.generateComponentFile()
}

const defaultOptions: KarambitOptions = {
    outFile: "gen/karambit.ts",
    dryRun: false,
    verbose: false,
    nameMaxLength: 30,
    allowEmptyModules: false,
    allowEmptyOutput: false,
    enableDocTags: false,
    outputScriptTarget: ts.ScriptTarget.Latest,
}
