import {Component, Module, Provides} from "karambit-decorators"

@Module
export abstract class CyclicProvidersModule {

    @Provides
    static provideNumber(str: string): number {
        return parseInt(str)
    }

    @Provides
    static provideString(number: number): string {
        return number.toString()
    }
}

@Component({modules: [CyclicProvidersModule]})
export abstract class CyclicProvidersComponent {
    abstract readonly number: number
    abstract readonly string: string
}
