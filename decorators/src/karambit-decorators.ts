type TC39MemberDecorator = <This, Args extends unknown[], Return>(
    target: ((this: This, ...args: Args) => Return) | undefined,
    context: ClassMemberDecoratorContext,
) => void
type MemberDecorator = PropertyDecorator & MethodDecorator & TC39MemberDecorator
type AnnotationParams = Array<unknown>

function ClassAnnotation<T extends AnnotationParams>(...info: T): ClassDecorator
function ClassAnnotation<T extends AnnotationParams>(target: Function): void
function ClassAnnotation(target?: Function) {
    if (typeof target === "function") return target
    return ClassAnnotation
}

function MemberAnnotation<T extends AnnotationParams>(...info: T): MemberDecorator
function MemberAnnotation<T extends AnnotationParams>(target: unknown, propertyKey: string | symbol): void
function MemberAnnotation<This, Args extends unknown[], Return>(
    target: ((this: This, ...args: Args) => Return) | undefined,
    context: ClassMemberDecoratorContext,
): void
function MemberAnnotation(target?: any, propertyKey?: string | symbol | ClassMemberDecoratorContext): MemberDecorator | void {
    if (propertyKey && typeof propertyKey === "object") {
        // Called as a TC39 decorator
        return
    }
    if (target && typeof target === "object" && propertyKey && (typeof propertyKey === "string" || typeof propertyKey === "symbol") && typeof target[propertyKey] !== "function") {
        // Called as a legacy decorator
        return
    }
    return MemberAnnotation
}

function ParameterAnnotation<T extends AnnotationParams>(...info: T): ParameterDecorator
function ParameterAnnotation<T extends AnnotationParams>(target: Object, propertyKey: string | symbol | undefined, parameterIndex: number): void
function ParameterAnnotation() {
    return ParameterAnnotation
}

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

type KarambitAnnotationBrand<T extends string> = {
    readonly [key in `__karambit${T}Annotation`]?: unknown;
}

export const Component: ClassAnnotation<[] | [ComponentInfo]> & KarambitAnnotationBrand<"Component"> = ClassAnnotation
export const Subcomponent: ClassAnnotation<[] | [SubcomponentInfo]> & KarambitAnnotationBrand<"Subcomponent"> = ClassAnnotation
export const Module: ClassAnnotation<[] | [ModuleInfo]> & KarambitAnnotationBrand<"Module"> = ClassAnnotation
export const Inject: ClassAnnotation & KarambitAnnotationBrand<"Inject"> = ClassAnnotation
export const AssistedInject: ClassAnnotation & KarambitAnnotationBrand<"AssistedInject"> = ClassAnnotation
export const Assisted: ParameterAnnotation & KarambitAnnotationBrand<"Assisted"> = ParameterAnnotation
export const Provides: MemberAnnotation & KarambitAnnotationBrand<"Provides"> = MemberAnnotation
export const Binds: MemberAnnotation & KarambitAnnotationBrand<"Binds"> = MemberAnnotation
export const BindsInstance: ParameterAnnotation & KarambitAnnotationBrand<"BindsInstance"> = ParameterAnnotation
export const IntoSet: MemberAnnotation<[] | [MultibindingOptions]> & KarambitAnnotationBrand<"IntoSet"> = MemberAnnotation
export const IntoMap: MemberAnnotation<[] | [MultibindingOptions]> & KarambitAnnotationBrand<"IntoMap"> = MemberAnnotation
export const ElementsIntoSet: MemberAnnotation & KarambitAnnotationBrand<"ElementsIntoSet"> = MemberAnnotation
export const ElementsIntoMap: MemberAnnotation & KarambitAnnotationBrand<"ElementsIntoMap"> = MemberAnnotation
export const MapKey: GenericMemberAnnotation & KarambitAnnotationBrand<"MapKey"> = MemberAnnotation

export interface ScopeAnnotation extends ClassAnnotation, MemberAnnotation, KarambitAnnotationBrand<"Scope"> {
    (): ClassDecorator & MemberDecorator
}

export type ReusableScopeAnnotation = ScopeAnnotation & KarambitAnnotationBrand<"ReusableScope">

function ScopeAnnotation(target?: any): ScopeAnnotation {
    if (typeof target === "function") return target
    return ScopeAnnotation
}

export function Scope(): ScopeAnnotation {
    return ScopeAnnotation
}

export const Reusable: ReusableScopeAnnotation = ScopeAnnotation

const MyScope = Scope()
@MyScope()
@MyScope
@Component
@Component()
class X {

    @Binds @Binds() field: number = 1337

    @MyScope
    @MyScope()
    @Provides
    @Provides()
    test() {
        return "Hello, world!"
    }
}

const x = new X()
console.log(x.test(), x.field)
