import {time} from "./Util"
import * as ts from "typescript"
import * as Path from "path"
import * as fs from "fs"
import {Importer} from "./Importer"
import {KarambitProgramComponent} from "./karambit-generated/src/Component"

interface ComponentLikeInfo {
    readonly modules?: unknown[]
    readonly subcomponents?: unknown[]
}

interface ComponentInfo extends ComponentLikeInfo {
    generatedClassName?: string
}

export function Component(info: ComponentInfo): ClassDecorator
export function Component(target: unknown): void
export function Component(): ClassDecorator
export function Component(target?: unknown) {
    return classAnnotation(target)
}

interface SubcomponentInfo extends ComponentLikeInfo { }

export function Subcomponent(info: SubcomponentInfo): ClassDecorator
export function Subcomponent(target: unknown): void
export function Subcomponent(): ClassDecorator
export function Subcomponent(target?: unknown) {
    return classAnnotation(target)
}

interface ModuleInfo {
    includes: unknown[]
}

interface MultibindingOptions {
    /**
     * When true, Karambit will skip binding this element if it is unable to resolve its dependencies,
     * rather than failing compilation.
     */
    optional: boolean
}

export function Module(info: ModuleInfo): ClassDecorator
export function Module(target: unknown): void
export function Module(): ClassDecorator
export function Module(target?: unknown) {
    return classAnnotation(target)
}

export function Inject(): ClassDecorator
export function Inject(target: unknown): void
export function Inject(target?: unknown) {
    return classAnnotation(target)
}

export function AssistedInject(): ClassDecorator
export function AssistedInject(target: unknown): void
export function AssistedInject(target?: unknown) {
    return classAnnotation(target)
}

export function Assisted(): ParameterDecorator
export function Assisted(target: Object, propertyKey: string | symbol, parameterIndex: number): void
export function Assisted() {
    return function () { }
}

export function Provides(): MethodDecorator
export function Provides(target?: unknown, propertyKey?: unknown): void
export function Provides(target?: {[key: string | symbol]: unknown}, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor): MethodDecorator | void {
    if (!target || typeof target !== "object" || !propertyKey || typeof target[propertyKey] !== "function") {
        return function () { }
    }
}

export function Binds(): MethodDecorator & PropertyDecorator
export function Binds(target?: unknown, propertyKey?: unknown): void
export function Binds(target?: {[key: string | symbol]: unknown}, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor): MethodDecorator | void {
    if (!target || typeof target !== "object" || !propertyKey || typeof target[propertyKey] !== "function") {
        return function () { }
    }
}

export function BindsInstance(): ParameterDecorator
export function BindsInstance(target: Object, propertyKey: string | symbol, parameterIndex: number): void
export function BindsInstance() {
    return function () { }
}

export function IntoSet(options: Partial<MultibindingOptions>): MethodDecorator & PropertyDecorator
export function IntoSet(target: unknown, propertyKey: string | symbol): void
export function IntoSet(): PropertyDecorator
export function IntoSet(target?: {[key: string | symbol]: unknown}, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor): MethodDecorator | void {
    if (!target || typeof target !== "object" || !propertyKey || typeof target[propertyKey] !== "function") {
        return function () { }
    }
}

export function IntoMap(options: Partial<MultibindingOptions>): MethodDecorator & PropertyDecorator
export function IntoMap(target: unknown, propertyKey: string | symbol): void
export function IntoMap(): PropertyDecorator
export function IntoMap(target?: {[key: string | symbol]: unknown}, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor): MethodDecorator | void {
    if (!target || typeof target !== "object" || !propertyKey || typeof target[propertyKey] !== "function") {
        return function () { }
    }
}

export function ElementsIntoSet(): MethodDecorator & PropertyDecorator
export function ElementsIntoSet(target: unknown, propertyKey: unknown): void
export function ElementsIntoSet(target?: {[key: string | symbol]: unknown}, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor): MethodDecorator | void {
    if (!target || typeof target !== "object" || !propertyKey || typeof target[propertyKey] !== "function") {
        return function () { }
    }
}

export function ElementsIntoMap(): MethodDecorator & PropertyDecorator
export function ElementsIntoMap(target: unknown, propertyKey: unknown): void
export function ElementsIntoMap(target?: {[key: string | symbol]: unknown}, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor): MethodDecorator | void {
    if (!target || typeof target !== "object" || !propertyKey || typeof target[propertyKey] !== "function") {
        return function () { }
    }
}

export function MapKey<T>(key: T): MethodDecorator & PropertyDecorator {
    return function () { }
}

export function Scope(): ScopeDecorator {
    return function () { }
}

export const Reusable: ReusableScopeDecorator = classAnnotation

function classAnnotation(target?: unknown) {
    if (typeof target === "function") return target
    return classAnnotation
}

type ConstructorType<T extends abstract new (...args: ConstructorParameters<T>) => InstanceType<T>> = abstract new (...args: ConstructorParameters<T>) => InstanceType<T>

export interface ScopeDecorator {
    <T>(target: any, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<T>): any | void
}

interface ReusableScopeDecorator extends ScopeDecorator { }

export interface QualifierDecorator {
    (target: any, propertyKey?: string | symbol, parameterIndex?: any | number): any | void
}

interface NamedQualifierDecorator extends QualifierDecorator { }

export type Qualified<T extends keyof any & symbol> = {
    readonly [key in T]?: unknown
}
export type Named<T extends (string extends T ? never : string)> = {
    readonly [key in `_karambitNamed${T}`]?: unknown
}

export interface Provider<T> {
    (): T
}

export interface SubcomponentFactory<T extends ConstructorType<T>> {
    (...args: ConstructorParameters<T>): InstanceType<T>
}

export interface KarambitTransformOptions {
    stripImports: boolean
    printTransformDuration: boolean
    outDir: string
}

export default function(program: ts.Program, options?: Partial<KarambitTransformOptions>) {
    const transformOptions = {...defaultOptions, ...options}
    // TODO: fix injection and remove this hack
    Importer.outDir = transformOptions.outDir
    const programComponent = new KarambitProgramComponent(program, transformOptions)
    return (ctx: ts.TransformationContext) => {
        const emitHost = (ctx as any).getEmitHost()
        emitHost.writeFile = () => { }

        const transformationContextComponent = programComponent.transformationContextSubcomponentFactory(ctx)
        return (sourceFile: ts.SourceFile) => {
            const {result, durationMs} = time(() => {
                const sourceFileComponent = transformationContextComponent.sourceFileSubcomponentFactory(sourceFile)
                return runTransformers(sourceFile, ...sourceFileComponent.transformers)
            })
            if (transformOptions.printTransformDuration) {
                const durationString = durationMs < 1 ? "<1" : durationMs.toString()
                const relativePath = Path.relative(".", Path.join(Path.dirname(sourceFile.fileName), "Karambit" + Path.basename(sourceFile.fileName)))
                console.info(`Transformed ${relativePath} in ${durationString}ms.`)
            }

            const resultText = ts.createPrinter().printNode(ts.EmitHint.Unspecified, result, result)
            if (resultText) {
                const p = `${transformOptions.outDir}/${Path.relative(".", sourceFile.fileName)}`
                if (!fs.existsSync(Path.dirname(p))) fs.mkdirSync(Path.dirname(p), {recursive: true})
                fs.writeFileSync(p, ts.createPrinter().printNode(ts.EmitHint.Unspecified, result, sourceFile))
            }
            return result
        }
    }
}

function runTransformers<T extends ts.Node>(
    node: T,
    ...transformers: ts.Transformer<T>[]
): T {
    return transformers.reduce((n, transformer) => transformer(n), node)
}

const defaultOptions: KarambitTransformOptions = {
    stripImports: true,
    printTransformDuration: false,
    outDir: "src/karambit-generated",
}
