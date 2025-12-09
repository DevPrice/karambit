/**
 * @component
 * @includeModule {@link HelloWorldModule}
 */
export interface HelloWorldComponent {
    readonly greeter: Greeter
}

/** @inject */
export class Greeter {
    constructor(private readonly greeting: string) { }

    greet(): string {
        return `${this.greeting}, World!`
    }
}

export const HelloWorldModule = {
    /** @provides */
    provideGreeting(): string {
        return "Hello"
    },
}
