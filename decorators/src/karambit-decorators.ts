type AnnotationParams = Array<unknown>

function identity<T>(x: T): T {
    return x
}

function ClassAnnotation<T extends AnnotationParams>(...info: T): ClassDecorator
function ClassAnnotation<T extends AnnotationParams>(target: Function): void
function ClassAnnotation(target?: Function) {
    if (typeof target === "function") return target
    return ClassAnnotation
}

function MemberAnnotation<T extends AnnotationParams>(...info: T): PropertyDecorator
function MemberAnnotation<T extends AnnotationParams>(target: unknown, propertyKey: string | symbol): void
function MemberAnnotation<This, Args extends unknown[], Return>(
    target: ((this: This, ...args: Args) => Return) | undefined,
    context: ClassMemberDecoratorContext,
): void
function MemberAnnotation(_?: unknown, propertyKey?: string | symbol | ClassMemberDecoratorContext): MethodDecorator | void {
    if (propertyKey && typeof propertyKey === "object" && propertyKey.kind === "field") {
        return identity
    }
}

function ParameterAnnotation<T extends AnnotationParams>(...info: T): ParameterDecorator
function ParameterAnnotation<T extends AnnotationParams>(target: Object, propertyKey: string | symbol | undefined, parameterIndex: number): void
function ParameterAnnotation() {
    return ParameterAnnotation
}

type MemberDecorator = PropertyDecorator & MethodDecorator

interface KarambitAnnotation {
    __karambitAnnotation?: unknown
}

interface ClassAnnotation<T extends AnnotationParams = []> extends KarambitAnnotation {
    (...info: T): ClassDecorator
    (target?: [] extends T ? unknown : never): void
}

interface MemberAnnotation<T extends AnnotationParams = []> extends KarambitAnnotation {
    (...info: T): MemberDecorator
    <U>(target: Object, propertyKey: string | symbol, descriptor?: TypedPropertyDescriptor<U>): void
    <This, Args extends unknown[], Return>(
        target: ((this: This, ...args: Args) => Return) | undefined,
        context: ClassMemberDecoratorContext,
    ): void
}

interface ParameterAnnotation<T extends AnnotationParams = []> extends KarambitAnnotation {
    (...info: T): ParameterDecorator
    (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number): void
}

interface GenericMemberAnnotation extends KarambitAnnotation {
    <T>(key: T): MemberDecorator
}

export interface ComponentLikeInfo {
    readonly modules?: unknown[]
    readonly subcomponents?: unknown[]
}

export interface ComponentInfo extends ComponentLikeInfo {
    generatedClassName?: string
}

export interface SubcomponentInfo extends ComponentLikeInfo { }

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

export const Component: ClassAnnotation<[] | [ComponentInfo]> = ClassAnnotation
export const Subcomponent: ClassAnnotation<[] | [SubcomponentInfo]> = ClassAnnotation
export const Module: ClassAnnotation<[] | [ModuleInfo]> = ClassAnnotation
export const Inject: ClassAnnotation = ClassAnnotation
export const AssistedInject: ClassAnnotation = ClassAnnotation
export const Assisted: ParameterAnnotation = ParameterAnnotation
export const Provides: MemberAnnotation = MemberAnnotation
export const Binds: MemberAnnotation = MemberAnnotation
export const BindsInstance: ParameterAnnotation = ParameterAnnotation
export const IntoSet: MemberAnnotation<[] | [MultibindingOptions]> = MemberAnnotation
export const IntoMap: MemberAnnotation<[] | [MultibindingOptions]> = MemberAnnotation
export const ElementsIntoSet: MemberAnnotation = MemberAnnotation
export const ElementsIntoMap: MemberAnnotation = MemberAnnotation
export const MapKey: GenericMemberAnnotation = MemberAnnotation

export interface ScopeAnnotation extends ClassAnnotation, MemberAnnotation {
    (): ClassDecorator & MemberDecorator
    __karambitScopeAnnotation?: unknown
}

export interface ReusableScopeAnnotation extends ScopeAnnotation {
    __karambitReusableScopeAnnotation?: unknown
}

function ScopeAnnotation(target?: any): ScopeAnnotation {
    if (typeof target === "function") return target
    return ScopeAnnotation
}

export function Scope(): ScopeAnnotation {
    return ScopeAnnotation
}

export const Reusable: ReusableScopeAnnotation = ScopeAnnotation
