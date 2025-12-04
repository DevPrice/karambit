/** @inject */
export class Greeter {
    constructor(private readonly greeting: string) { }

    greet(): string {
        return `${this.greeting}, World!`
    }
}

export abstract class HelloWorldModule {
    /** @provides */
    static provideGreeting(): string {
        return "Hello"
    }
}

/**
 * @component
 * @includeModule {@link HelloWorldModule}
 */
export interface HelloWorldComponent {
    readonly greeter: Greeter
}
