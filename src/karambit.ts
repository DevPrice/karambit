import "./Util"
import * as ts from "typescript"
import {ProgramComponent} from "./Component"
import {ErrorReporter} from "./ErrorReporter"

interface ComponentLikeInfo {
    readonly modules?: unknown[]
    readonly subcomponents?: unknown[]
}

interface ComponentInfo extends ComponentLikeInfo { }

export function Component(info: ComponentInfo): ClassDecorator
export function Component(target: unknown): void
export function Component(): ClassDecorator
export function Component(): never {
    ErrorReporter.reportCodeNotTransformed()
}

interface SubcomponentInfo extends ComponentLikeInfo { }

export function Subcomponent(info: SubcomponentInfo): ClassDecorator
export function Subcomponent(target: unknown): void
export function Subcomponent(): ClassDecorator
export function Subcomponent(): never {
    ErrorReporter.reportCodeNotTransformed()
}

interface ModuleInfo {
    includes: unknown[]
}

export function Module(info: ModuleInfo): ClassDecorator
export function Module(target: unknown): void
export function Module(): ClassDecorator
export function Module(): never {
    ErrorReporter.reportCodeNotTransformed()
}

export function Inject(): ClassDecorator
export function Inject(target: unknown): void
export function Inject(): never {
    ErrorReporter.reportCodeNotTransformed()
}

export function Provides(): MethodDecorator
export function Provides(target: unknown, propertyKey: string | symbol): void
export function Provides(): never {
    ErrorReporter.reportCodeNotTransformed()
}

export function Binds(): MethodDecorator
export function Binds(target: unknown, propertyKey: string | symbol): void
export function Binds(): never {
    ErrorReporter.reportCodeNotTransformed()
}

export function BindsInstance(): ParameterDecorator
export function BindsInstance(target: Object, propertyKey: string | symbol, parameterIndex: number): void
export function BindsInstance(): never {
    ErrorReporter.reportCodeNotTransformed()
}

export function Scope(): ScopeDecorator {
    ErrorReporter.reportCodeNotTransformed()
}

export const Reusable: ReusableScopeDecorator = () => {
    ErrorReporter.reportCodeNotTransformed()
}

export function Qualifier(): QualifierDecorator {
    ErrorReporter.reportCodeNotTransformed()
}

export function Named(name: string): NamedQualifierDecorator {
    ErrorReporter.reportCodeNotTransformed()
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

export interface KarambitTransformOptions {
    stripImports: boolean
}

export default function(program: ts.Program, options?: Partial<KarambitTransformOptions>) {
    const programComponent = new ProgramComponent(program, {...defaultOptions, ...options})
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

const defaultOptions: KarambitTransformOptions = {
    stripImports: true,
}
