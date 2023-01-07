import {Inject, Module, Provides, Component, createComponent} from "karambit-inject"

@Inject
class Greeter {

    constructor(private readonly greeting: string) { }

    greet(): string {
        return `${this.greeting}, World!`
    }
}

@Module
abstract class HelloWorldModule {

    @Provides
    static provideGreeting(): string {
        return "Hello"
    }
}

@Component({modules: [HelloWorldModule]})
abstract class HelloWorldComponent {

    abstract readonly greeter: Greeter
}

const component = createComponent<typeof HelloWorldComponent>()
console.log(component.greeter.greet())
