import * as ts from "typescript"
import {Inject, Reusable} from "karambit-inject"
import {createQualifiedType, QualifiedType, qualifiedTypeToString} from "./QualifiedType"
import {
    InjectableConstructor,
    InstanceProvider,
    isInjectableConstructor,
    isPropertyProvider,
    isProvidesMethod,
    isSubcomponentFactory, ProvidesMethod
} from "./Providers"
import {filterNotNull} from "./Util"
import {PropertyLike} from "./PropertyExtractor"

export enum KarambitErrorScope {
    TRANSFORM = "NotTransformed",
    PARSE = "Parse",
    INVALID_SCOPE = "InvalidScope",
    INVALID_BINDING = "InvalidBinding",
    DUPLICATE_PROVIDERS = "DuplicateProviders",
    DUPLICATE_BINDINGS = "DuplicateBindings",
    DEPENDENCY_CYCLE = "DependencyCycle",
    BINDING_CYCLE = "BindingCycle",
}

@Inject
@Reusable
export class ErrorReporter {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly sourceFile: ts.SourceFile,
    ) { }

    reportCompileTimeConstantRequired(context: ts.Node, identifierName: string): never {
        ErrorReporter.fail(
            KarambitErrorScope.PARSE,
            `'${identifierName}' must be a compile-time constant (array literal)!\n\n${nodeForDisplay(context)}\n`,
            this.sourceFile
        )
    }

    reportComponentPropertyMustBeReadOnly(property: ts.Node): never {
        ErrorReporter.fail(
            KarambitErrorScope.PARSE,
            `Generated component properties must be read-only!\n\n${nodeForDisplay(property)}\n`,
            this.sourceFile
        )
    }

    reportDuplicateScope(subcomponentName: string, ancestorName: string): never {
        ErrorReporter.fail(
            KarambitErrorScope.INVALID_SCOPE,
            `Subcomponent may not share a scope with an ancestor! ${subcomponentName} has the same scope as its ancestor ${ancestorName}.\n`,
            this.sourceFile
        )
    }

    reportInvalidScope(provider: ProvidesMethod | InjectableConstructor, expected?: ts.Symbol): never {
        const type = isProvidesMethod(provider) ? provider.returnType : createQualifiedType({type: provider.type})
        ErrorReporter.fail(
            KarambitErrorScope.INVALID_SCOPE,
            `Invalid scope for type ${qualifiedTypeToString(type)}! ` +
            `Got: ${provider.scope?.name ?? "no scope"}, expected: ${expected?.name ?? "no scope"}.\n\n${providerForDisplay(provider)}\n`,
            this.sourceFile
        )
    }

    reportBindingMustBeAssignable(context: ts.Node, parameterType: ts.Type, returnType: ts.Type): never {
        ErrorReporter.fail(
            KarambitErrorScope.INVALID_BINDING,
            "Binding parameter must be assignable to the return type! " +
            `${this.typeChecker.typeToString(parameterType)} is not assignable to ${this.typeChecker.typeToString(returnType)}\n\n` +
            nodeForDisplay(context) + "\n",
            this.sourceFile
        )
    }

    reportTypeBoundToSelf(context: ts.Node): never {
        ErrorReporter.fail(
            KarambitErrorScope.INVALID_BINDING,
            "Cannot bind a type to itself!\n\n" + nodeForDisplay(context) + "\n",
            this.sourceFile
        )
    }

    reportBindingNotAbstract(context: ts.Node): never {
        ErrorReporter.fail(
            KarambitErrorScope.INVALID_BINDING,
            "@Binds method must be abstract!\n\n" + nodeForDisplay(context) + "\n",
            this.sourceFile
        )
    }

    reportInvalidBindingArguments(context: ts.Node): never {
        ErrorReporter.fail(
            KarambitErrorScope.INVALID_BINDING,
            "Binding method must have exactly one argument!\n\n" + nodeForDisplay(context) + "\n",
            this.sourceFile
        )
    }

    reportDuplicateProviders(type: QualifiedType, providers: InstanceProvider[]): never {
        ErrorReporter.fail(
            KarambitErrorScope.DUPLICATE_PROVIDERS,
            `${qualifiedTypeToString(type)} is provided multiple times!\n\n` +
            `${filterNotNull(providers.map(providerForDisplay)).map(it => `provided by:\n${it}\n`).join("\n")}`,
            this.sourceFile
        )
    }

    reportDependencyCycle(type: QualifiedType, chain: QualifiedType[]): never {
        ErrorReporter.fail(
            KarambitErrorScope.DEPENDENCY_CYCLE,
            `${qualifiedTypeToString(type)} causes a dependency cycle (circular dependency)!\n\n` +
            `${chain.map(qualifiedTypeToString).join(" -> ")}\n`,
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
