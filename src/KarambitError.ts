import * as ts from "typescript"
import chalk = require("chalk")

export enum KarambitErrorScope {
    INTERNAL = "Internal",
    PARSE = "Parse",
    INVALID_SCOPE = "InvalidScope",
    INVALID_BINDING = "InvalidBinding",
    MISSING_PROVIDER = "MissingProviders",
    DUPLICATE_PROVIDERS = "DuplicateProviders",
    DUPLICATE_BINDINGS = "DuplicateBindings",
    DEPENDENCY_CYCLE = "DependencyCycle",
    BINDING_CYCLE = "BindingCycle",
}

export class KarambitError extends Error {

    constructor(description: string, readonly scope: KarambitErrorScope, component?: ts.ClassLikeDeclaration) {
        super(`${chalk.red(`[Karambit/${scope}]`)} ${component && component.name ? `${component.name.getText()}: ` : ""}${description}`)
    }
}
