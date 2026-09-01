export const notAFunctionModule = {
    /** @provides */
    provideString: "provided",
}

/**
 * @component
 * @includeModule {@link notAFunctionModule}
 */
export abstract class NotAFunctionComponent {
    abstract readonly string: string
}
