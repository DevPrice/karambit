export abstract class InstancePropertyModule {

    /** @provides */
    provideString = () => "provided"
}

/**
 * @component
 * @includeModule {@link InstancePropertyModule}
 */
export abstract class InstancePropertyComponent {
    abstract readonly string: string
}
