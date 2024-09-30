import {Inject, Module, Provides, Component} from "karambit-decorators"

@Inject
export class Greeter {

    constructor(private readonly greeting: string) { }

    greet(): string {
        return `${this.greeting}, World!`
    }
}

@Module
export abstract class HelloWorldModule {

    @Provides
    static provideGreeting(): string {
        return "Hello"
    }
}

@Component({modules: [HelloWorldModule]})
export abstract class HelloWorldComponent {

    abstract readonly greeter: Greeter
}
