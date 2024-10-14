import {Component, Module, Provides} from "karambit-decorators"

@Module
export abstract class DuplicateProvidersModule {

    @Provides
    static provideNumber1(): number {
        return 1
    }

    @Provides
    static provideNumber2(): number {
        return 2
    }
}

@Component({modules: [DuplicateProvidersModule]})
export abstract class DuplicateProvidersComponent {
    abstract readonly number: number
}
