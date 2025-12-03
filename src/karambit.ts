import * as ts from "typescript"
import {KarambitProgramComponent} from "./karambit-generated/src/Component"

export {KarambitError, KarambitErrorScope} from "./KarambitError"

type ConstructorType<T extends abstract new (...args: ConstructorParameters<T>) => InstanceType<T>> = abstract new (...args: ConstructorParameters<T>) => InstanceType<T>

export type Qualified<T extends keyof any & symbol> = {
    readonly [key in T]?: unknown
}

type IsStringLiteral<T> = T extends string
    ? string extends T
        ? false
        : true
    : false

export type Named<T extends string> = IsStringLiteral<T> extends false ? never : {
    readonly [key in `__karambitNamed_${T}`]?: unknown;
}

export interface Provider<T> {
    (): T
    __karambitProvider?: unknown
}

export interface SubcomponentFactory<T extends ConstructorType<T>> {
    (...args: ConstructorParameters<T>): InstanceType<T>
    __karambitSubcomponentFactory?: unknown
}

export interface KarambitOptions {
    sourceRoot: string
    outFile: string
    dryRun: boolean
    verbose: boolean
    nameMaxLength: number
    allowEmptyModules: boolean
    allowEmptyOutput: boolean
    experimentalTags: boolean
    outputScriptTarget: ts.ScriptTarget
    printerOptions?: ts.PrinterOptions
}

export function generateComponentFiles(program: ts.Program, options?: Partial<KarambitOptions>) {
    const karambitOptions = {...defaultOptions, ...options}
    const programComponent = new KarambitProgramComponent(program, karambitOptions)
    programComponent.generateComponentFile()
}

const defaultOptions: KarambitOptions = {
    sourceRoot: ".",
    outFile: "gen/karambit.ts",
    dryRun: false,
    verbose: false,
    nameMaxLength: 30,
    allowEmptyModules: false,
    allowEmptyOutput: false,
    experimentalTags: false,
    outputScriptTarget: ts.ScriptTarget.Latest,
}
