import {Inject, Module, Provides, Component} from "karambit-inject"

@Inject
class Greeter {

    constructor(private readonly target: string) { }

    greet(): string {
        return `Hello, ${this.target}!`
    }
}

@Module
abstract class HelloWorldModule {

    @Provides
    static provideGreetingTarget(): string {
        return "World"
    }
}

@Component({modules: [HelloWorldModule]})
class HelloWorldComponent {

    readonly greeter: Greeter
}

const component = new HelloWorldComponent()
console.log(component.greeter.greet())
