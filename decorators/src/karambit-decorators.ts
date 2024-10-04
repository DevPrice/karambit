export interface ComponentLikeInfo {
    readonly modules?: unknown[]
    readonly subcomponents?: unknown[]
}

export interface ComponentInfo extends ComponentLikeInfo {
    generatedClassName?: string
}

export function Component(info: ComponentInfo): ClassDecorator
export function Component(target: unknown): void
export function Component(): ClassDecorator
export function Component(target?: unknown) {
    return classAnnotation(target)
}

export interface SubcomponentInfo extends ComponentLikeInfo { }

export function Subcomponent(info: SubcomponentInfo): ClassDecorator
export function Subcomponent(target: unknown): void
export function Subcomponent(): ClassDecorator
export function Subcomponent(target?: unknown) {
    return classAnnotation(target)
}

export interface ModuleInfo {
    includes: unknown[]
}

export interface MultibindingOptions {
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
export function Assisted(target: Object, propertyKey: string | symbol | undefined, parameterIndex: number): void
export function Assisted() {
    return function () { }
}

export function Provides(): MethodDecorator
export function Provides(target?: unknown, propertyKey?: string | symbol): void
export function Provides(target?: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor): MethodDecorator | void {
    if (!target || typeof target !== "object" || !propertyKey || typeof target[propertyKey] !== "function") {
        return function () { }
    }
}

export function Binds(): PropertyDecorator
export function Binds(target: unknown, propertyKey: string | symbol): void
export function Binds(target?: any, propertyKey?: string | symbol): MethodDecorator | void {
    if (!target || typeof target !== "object" || !propertyKey || typeof target[propertyKey] !== "function") {
        return function () { }
    }
}

export function BindsInstance(): ParameterDecorator
export function BindsInstance(target: Object, propertyKey: string | symbol | undefined, parameterIndex: number): void
export function BindsInstance() {
    return function () { }
}

export function IntoSet(options: Partial<MultibindingOptions>): MethodDecorator & PropertyDecorator
export function IntoSet(target: unknown, propertyKey: string | symbol): void
export function IntoSet(): PropertyDecorator
export function IntoSet(target?: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor): MethodDecorator | void {
    if (!target || typeof target !== "object" || !propertyKey || typeof target[propertyKey] !== "function") {
        return function () { }
    }
}

export function IntoMap(options: Partial<MultibindingOptions>): MethodDecorator & PropertyDecorator
export function IntoMap(target: unknown, propertyKey: string | symbol): void
export function IntoMap(): PropertyDecorator
export function IntoMap(target?: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor): MethodDecorator | void {
    if (!target || typeof target !== "object" || !propertyKey || typeof target[propertyKey] !== "function") {
        return function () { }
    }
}

export function ElementsIntoSet(): MethodDecorator & PropertyDecorator
export function ElementsIntoSet(target: unknown, propertyKey: string | symbol): void
export function ElementsIntoSet(target?: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor): MethodDecorator | void {
    if (!target || typeof target !== "object" || !propertyKey || typeof target[propertyKey] !== "function") {
        return function () { }
    }
}

export function ElementsIntoMap(): MethodDecorator & PropertyDecorator
export function ElementsIntoMap(target: unknown, propertyKey: string | symbol): void
export function ElementsIntoMap(target?: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor): MethodDecorator | void {
    if (!target || typeof target !== "object" || !propertyKey || typeof target[propertyKey] !== "function") {
        return function () { }
    }
}

export function MapKey<T>(key: T): MethodDecorator & PropertyDecorator {
    return function () { }
}

export interface ScopeDecorator {
    <T>(target: any, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<T>): any | void
}

export interface ReusableScopeDecorator extends ScopeDecorator { }

export function Scope(): ScopeDecorator {
    return classAnnotation
}

export const Reusable: ReusableScopeDecorator = classAnnotation

function classAnnotation(target?: unknown) {
    if (typeof target === "function") return target
    return classAnnotation
}