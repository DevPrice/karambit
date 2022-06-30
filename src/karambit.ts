import * as ts from "typescript"
import {NameGenerator} from "./NameGenerator"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {ComponentGenerator} from "./ComponentGenerator"
import {Importer} from "./Importer"
import {InjectConstructorExporter} from "./InjectConstructorExporter"
import {ModuleLocator} from "./ModuleLocator"
import {ConstructorHelper} from "./ConstructorHelper"
import {PropertyExtractor} from "./PropertyExtractor"

interface ComponentLikeInfo {
    readonly modules?: unknown[]
    readonly subcomponents?: unknown[]
}

interface ComponentInfo extends ComponentLikeInfo { }

export function Component(info: ComponentInfo): ClassDecorator
export function Component(target: unknown): void
export function Component(): ClassDecorator
export function Component(): never {
    throw new Error("Decorated code was not processed by transformer!")
}

interface SubcomponentInfo extends ComponentLikeInfo { }

export function Subcomponent(info: SubcomponentInfo): ClassDecorator
export function Subcomponent(target: unknown): void
export function Subcomponent(): ClassDecorator
export function Subcomponent(): never {
    throw new Error("Decorated code was not processed by transformer!")
}

interface ModuleInfo {
    includes: Constructor<any>[]
}

type Constructor<T> = abstract new (...args: any[]) => T
export type Factory<T extends Constructor<any>> = (...args: ConstructorParameters<T>) => InstanceType<T>

export function Module(info: ModuleInfo): ClassDecorator
export function Module(target: unknown): void
export function Module(): ClassDecorator
export function Module(): never {
    throw new Error("Decorated code was not processed by transformer!")
}

export function Inject(): ClassDecorator
export function Inject(target: unknown): void
export function Inject(): never {
    throw new Error("Decorated code was not processed by transformer!")
}

export function Provides(): MethodDecorator
export function Provides(target: unknown, propertyKey: string | symbol): void
export function Provides(): never {
    throw new Error("Decorated code was not processed by transformer!")
}

export function Binds(): MethodDecorator
export function Binds(target: unknown, propertyKey: string | symbol): void
export function Binds(): never {
    throw new Error("Decorated code was not processed by transformer!")
}

export function BindsInstance(): ParameterDecorator
export function BindsInstance(target: Object, propertyKey: string | symbol, parameterIndex: number): void
export function BindsInstance(): never {
    throw new Error("Decorated code was not processed by transformer!")
}

export function Scope(): ScopeDecorator {
    return (): never => {
        throw new Error("Decorated code was not processed by transformer!")
    }
}

export const Reusable: ReusableScopeDecorator = Scope()

export function Qualifier(): QualifierDecorator {
    return (): never => {
        throw new Error("Decorated code was not processed by transformer!")
    }
}

export function Named(name: string): NamedQualifierDecorator {
    return (): never => {
        throw new Error("Decorated code was not processed by transformer!")
    }
}

export interface ScopeDecorator {
    <T>(target: any, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<T>): any | void
}

interface ReusableScopeDecorator extends ScopeDecorator { }

export interface QualifierDecorator {
    (target: any, propertyKey?: string | symbol, parameterIndex?: any | number): any | void
}

interface NamedQualifierDecorator extends QualifierDecorator { }

export interface Provider<T> {
    (): T
}

export default function(program: ts.Program) {
    const typeChecker = program.getTypeChecker()
    const nodeDetector = new InjectNodeDetector(typeChecker)
    const constructorHelper = new ConstructorHelper(typeChecker, nodeDetector)
    const propertyExtractor = new PropertyExtractor(typeChecker, nodeDetector)
    return (ctx: ts.TransformationContext) => {
        const injectConstructorExporter = new InjectConstructorExporter(ctx, nodeDetector)
        const moduleLocator = new ModuleLocator(typeChecker, ctx, nodeDetector)
        return (sourceFile: ts.SourceFile) => {
            const nameGenerator = new NameGenerator(typeChecker)
            const importer = new Importer(sourceFile)
            const componentGenerator = new ComponentGenerator(
                typeChecker,
                ctx,
                sourceFile,
                nodeDetector,
                nameGenerator,
                importer,
                moduleLocator,
                constructorHelper,
                propertyExtractor,
            )
            return runTransformers(
                sourceFile,
                injectConstructorExporter.exportProviders,
                componentGenerator.generateComponents,
                node => nodeDetector.eraseInjectRuntime(node, ctx),
                importer.addImportsToSourceFile,
            )
        }
    }
}

function runTransformers<T extends ts.Node>(
    node: T,
    ...transformers: ts.Transformer<T>[]
): T {
    return transformers.reduce((n, transformer) => transformer(n), node)
}
