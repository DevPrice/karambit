import {Component, Module, Provides} from "karambit-decorators"

@Module
export abstract class MissingProviderModule {

    @Provides
    static provideNumber(): number {
        return 1
    }
}

@Component({modules: [MissingProviderModule]})
export abstract class MissingProviderComponent {
    abstract readonly string: string
}
