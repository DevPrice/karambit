import {Component, Module, Provides, Scope} from "karambit-decorators"

const ModuleScope = Scope()
const ComponentScope = Scope()

@Module
export abstract class WrongScopeProvidersModule {

    @Provides
    @ModuleScope
    static provideNumber(): number {
        return 1
    }
}

@Component({modules: [WrongScopeProvidersModule]})
@ComponentScope
export abstract class WrongScopeComponent {
    abstract readonly number: number
    abstract readonly string: string
}
