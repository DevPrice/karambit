import {Component, Module, Provides, Scope} from "karambit-decorators"

const OneScope = Scope()
const TwoScope = Scope()

@Module
export abstract class MultipleScopesProvidersModule {

    @Provides
    @OneScope
    static provideNumber(): number {
        return 1
    }

    @Provides
    @TwoScope
    static provideString(): string {
        return "string"
    }
}

@Component({modules: [MultipleScopesProvidersModule]})
export abstract class MultipleScopesComponent {
    abstract readonly number: number
    abstract readonly string: string
}
