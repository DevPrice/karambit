import {ComponentDeclaration} from "./TypescriptUtil"
import chalk from "chalk"

/**
 * Represents the high-level reason that a failure occurred.
 */
export enum KarambitErrorScope {
    /**
     * Indicates that Karambit was able to parse component declarations, but still failed to generate an implementation. This likely indicates a bug in Karambit.
     * Consider filling an {@link https://github.com/DevPrice/karambit/issues | issue} if you see this error scope.
     */
    INTERNAL = "Internal",
    /**
     * The most generic failure reason, generally indicating that a declaration used for component generation was malformed.
     */
    PARSE = "Parse",
    /**
     * Indicates that a scope was used improperly.
     */
    INVALID_SCOPE = "InvalidScope",
    /**
     * Indicates that the TypeScript compiler failed to resolve a dependency type used within a Component.
     */
    INVALID_TYPE = "InvalidType",
    /**
     * Indicates that a provider declaration was malformed.
     */
    INVALID_BINDING = "InvalidBinding",
    /**
     * Indicates that a type necessary to construct a component did not have an associated provider.
     */
    MISSING_PROVIDER = "MissingProviders",
    /**
     * Indicates that a there were multiple providers for the same type.
     */
    DUPLICATE_PROVIDERS = "DuplicateProviders",
    /**
     * Indicates that a there were multiple bindings for the same type.
     */
    DUPLICATE_BINDINGS = "DuplicateBindings",
    /**
     * Indicates a component declaration has a dependency cycle. That is, at least one type's provider directly or transitively depends on an instance of itself.
     */
    DEPENDENCY_CYCLE = "DependencyCycle",
    /**
     * Indicates a component's type bindings have a dependency cycle.
     */
    BINDING_CYCLE = "BindingCycle",
    /**
     * No component declarations were found in the input source files. This error may be disabled via configuration.
     */
    NO_COMPONENTS = "NoComponents",
}

/**
 * The only type of error that will be thrown intentionally during code generation.
 *
 * @property scope the high-level reason that cde generation failed
 */
export class KarambitError extends Error {

    constructor(description: string, readonly scope: KarambitErrorScope, component?: ComponentDeclaration) {
        super(`${chalk.red(`[Karambit/${scope}]`)} ${component && component.name ? `${component.name.getText()}: ` : ""}${description}`)
    }
}
