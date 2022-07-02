import * as ts from "typescript"
import {ProgramComponent} from "./Component"

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
    includes: unknown[]
}

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
    const programComponent = new ProgramComponent(program)
    return (ctx: ts.TransformationContext) => {
        const transformationContextComponent = programComponent.transformationContextSubcomponentFactory(ctx)
        return (sourceFile: ts.SourceFile) => {
            const sourceFileComponent = transformationContextComponent.sourceFileSubcomponentFactory(sourceFile)
            return runTransformers(sourceFile, ...sourceFileComponent.transformers)
        }
    }
}

function runTransformers<T extends ts.Node>(
    node: T,
    ...transformers: ts.Transformer<T>[]
): T {
    return transformers.reduce((n, transformer) => transformer(n), node)
}
