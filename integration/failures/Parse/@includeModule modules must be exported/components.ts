const notExportedModule = {
    /** @provides */
    provideString(): string {
        return "provided"
    },
}

/**
 * @component
 * @includeModule {@link notExportedModule}
 */
export abstract class NotExportedModuleComponent {
    abstract readonly string: string
}
