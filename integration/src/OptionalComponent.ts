import {Component, Inject, Module, Provides, Reusable, Subcomponent} from "karambit-decorators"
import {SubcomponentFactory} from "karambit-inject"

@Inject
export class ProvidedOptional {
    constructor(readonly requiredString?: string, readonly initializedValue: boolean = true, readonly optionalValue?: number) { }
}

@Reusable
@Inject
export class ReusableOptional {
    constructor(readonly requiredValue: number, readonly optionalSymbol?: symbol) { }
}

@Module
export class NestedOptionalModule {

    @Provides
    static provideSymbol(): symbol {
        return Symbol.for("optional")
    }
}

@Module
export class ChildOptionalModule {

    @Provides
    static provideOptionalNumber(): number {
        return 1337
    }
}

@Module
export class OptionalModule {

    @Provides
    static provideRequiredString(): string {
        return "not optional"
    }
}

@Subcomponent({modules: [NestedOptionalModule]})
export abstract class NestedOptionalSubcomponent {
    abstract readonly presentOptional: ReusableOptional
}

@Subcomponent({modules: [ChildOptionalModule], subcomponents: [NestedOptionalSubcomponent]})
export abstract class OptionalSubcomponent {
    abstract readonly presentOptional?: ReusableOptional
    abstract readonly subcomponentFactory: SubcomponentFactory<typeof NestedOptionalSubcomponent>
}

@Component({modules: [OptionalModule], subcomponents: [OptionalSubcomponent]})
export abstract class OptionalComponent {
    abstract readonly providedOptional?: ProvidedOptional
    abstract readonly missingOptional?: ReusableOptional
    abstract readonly subcomponentFactory: SubcomponentFactory<typeof OptionalSubcomponent>
}
