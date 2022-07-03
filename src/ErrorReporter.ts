import * as ts from "typescript"
import {Inject, Reusable} from "karambit-inject"
import {QualifiedType, qualifiedTypeToString} from "./QualifiedType"
import {
    InstanceProvider,
    isInjectableConstructor,
    isPropertyProvider,
    isProvidesMethod,
    isSubcomponentFactory
} from "./Providers"
import {filterNotNull} from "./Util"

export enum KarambitErrorScope {
    TRANSFORM = "NotTransformed",
    DUPLICATE_PROVIDERS = "DuplicateProviders",
    DUPLICATE_BINDINGS = "DuplicateBindings",
    DEPENDENCY_CYCLE = "DependencyCycle",
    BINDING_CYCLE = "BindingCycle",
}

@Inject
@Reusable
export class ErrorReporter {

    constructor(private readonly sourceFile: ts.SourceFile) { }

    reportDuplicateProviders(type: QualifiedType, providers: InstanceProvider[]): never {
        ErrorReporter.fail(
            KarambitErrorScope.DUPLICATE_PROVIDERS,
            `${qualifiedTypeToString(type)} is provided multiple times!\n\n` +
                `${filterNotNull(providers.map(providerForDisplay)).map(it => `provided by:\n${it}\n`).join("\n")}`,
            this.sourceFile
        )
    }

    static reportCodeNotTransformed(): never {
        ErrorReporter.fail(
            KarambitErrorScope.TRANSFORM,
            "Decorated code was not processed by transformer! Ensure this project is configured to use the Karambit compiler plugin.",
        )
    }

    static fail(scope: KarambitErrorScope, message: string, sourceFile?: ts.SourceFile): never {
        throw new KarambitError(message, scope, sourceFile)
    }
}

export class KarambitError extends Error {

    constructor(description: string, readonly scope: KarambitErrorScope, sourceFile?: ts.SourceFile) {
        super(`${sourceFile ? `${sourceFile.fileName}: ` : ""}[Karambit/${scope}] ${description}`)
    }
}

function providerForDisplay(provider: InstanceProvider): string | undefined {
    if (isPropertyProvider(provider)) return nodeForDisplay(provider.declaration)
    if (isProvidesMethod(provider)) return nodeForDisplay(provider.method)
    if (isInjectableConstructor(provider)) return nodeForDisplay(provider.declaration)
    if (isSubcomponentFactory(provider)) return nodeForDisplay(provider.declaration)
    return undefined
}

function nodeForDisplay(node: ts.Node): string {
    return normalizeWhitespace(node.getText())
}

function normalizeWhitespace(text: string): string {
    const lines = text.split("\n")
    if (lines.length < 2) return lines[0]
    const leadingWhitespace = lines[1].match(/^(\s+)/)
    if (leadingWhitespace) {
        return lines[0] + "\n" + lines.slice(1).map(it => it.substring(leadingWhitespace[1].length)).join("\n")
    }
    return lines.join("\n")
}
