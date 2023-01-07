import * as ts from "typescript"
import {Inject, Reusable} from "karambit-inject"
import {createQualifiedType, QualifiedType, qualifiedTypeToString} from "./QualifiedType"
import {
    InjectableConstructor,
    InstanceProvider,
    isInjectableConstructor,
    isPropertyProvider,
    isProvidesMethod,
    isSubcomponentFactory,
    ProviderType,
    ProvidesMethod
} from "./Providers"
import {filterTree, printTreeMap} from "./Util"
import {Dependency, DependencyProvider} from "./DependencyGraphBuilder"
import {Binding} from "./ModuleLocator"
import {Chalk} from "chalk"

const chalk: Chalk = require("chalk")

export enum KarambitErrorScope {
    TRANSFORM = "NotTransformed",
    PARSE = "Parse",
    INVALID_SCOPE = "InvalidScope",
    INVALID_BINDING = "InvalidBinding",
    MISSING_PROVIDER = "MissingProviders",
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
        private readonly component?: ts.ClassDeclaration,
    ) { }

    reportCompileTimeConstantRequired(context: ts.Node, identifierName: string): never {
        ErrorReporter.fail(
            KarambitErrorScope.PARSE,
            `'${identifierName}' must be a compile-time constant (array literal)!\n\n${nodeForDisplay(context)}\n`,
            this.component
        )
    }

    reportComponentPropertyMustBeReadOnly(property: ts.Node): never {
        ErrorReporter.fail(
            KarambitErrorScope.PARSE,
            `Abstract component properties must be read-only!\n\n${nodeForDisplay(property)}\n`,
            this.component
        )
    }

    reportComponentDependencyMayNotBeOptional(property: ts.Node): never {
        ErrorReporter.fail(
            KarambitErrorScope.PARSE,
            `Non-instance dependencies may not be optional!\n\n${nodeForDisplay(property)}\n`,
            this.component
        )
    }

    reportParseFailed(message: string, contextNode?: ts.Node): never {
        return ErrorReporter.reportParseFailed(message + (contextNode ? "\n\n" + nodeForDisplay(contextNode) + "\n" : ""))
    }

    reportDuplicateScope(subcomponentName: string, ancestorName: string): never {
        ErrorReporter.fail(
            KarambitErrorScope.INVALID_SCOPE,
            `Subcomponent may not share a scope with an ancestor! ${subcomponentName} has the same scope as its ancestor ${ancestorName}.\n`,
            this.component
        )
    }

    reportInvalidScope(provider: ProvidesMethod | InjectableConstructor, expected?: ts.Symbol): never {
        const type = isProvidesMethod(provider) ? provider.type : createQualifiedType({type: provider.type})
        ErrorReporter.fail(
            KarambitErrorScope.INVALID_SCOPE,
            `Invalid scope for type ${qualifiedTypeToString(type)}! ` +
            `Got: ${provider.scope?.name ?? "no scope"}, expected: ${expected?.name ?? "no scope"}.\n\n${providerForDisplay(provider)}\n`,
            this.component
        )
    }

    reportBindingMustBeAssignable(context: ts.Node, parameterType: ts.Type, returnType: ts.Type): never {
        ErrorReporter.fail(
            KarambitErrorScope.INVALID_BINDING,
            "Binding parameter must be assignable to the return type! " +
            `${this.typeChecker.typeToString(parameterType)} is not assignable to ${this.typeChecker.typeToString(returnType)}\n\n` +
            nodeForDisplay(context) + "\n",
            this.component
        )
    }

    reportTypeBoundToSelf(context: ts.Node): never {
        ErrorReporter.fail(
            KarambitErrorScope.INVALID_BINDING,
            "Cannot bind a type to itself!\n\n" + nodeForDisplay(context) + "\n",
            this.component
        )
    }

    reportBindingNotAbstract(context: ts.Node): never {
        ErrorReporter.fail(
            KarambitErrorScope.INVALID_BINDING,
            "@Binds method must be abstract!\n\n" + nodeForDisplay(context) + "\n",
            this.component
        )
    }

    reportInvalidBindingArguments(context: ts.Node): never {
        ErrorReporter.fail(
            KarambitErrorScope.INVALID_BINDING,
            "Binding method must have exactly one argument!\n\n" + nodeForDisplay(context) + "\n",
            this.component
        )
    }

    reportMissingProviders(missingTypes: Iterable<QualifiedType>, component: {type: QualifiedType, rootDependencies: Iterable<Dependency>}, graph: ReadonlyMap<QualifiedType, DependencyProvider>): never {
        const missingSet = new Set(missingTypes)
        const getChildren = (item: QualifiedType) => item === component.type ? Array.from(component.rootDependencies).map(it => it.type) : graph.get(item)?.dependencies ?? []
        const typeToString = (item: QualifiedType) => {
            if (missingSet.has(item)) return chalk.yellow(qualifiedTypeToString(item))
            return qualifiedTypeToString(item)
        }
        ErrorReporter.fail(
            KarambitErrorScope.MISSING_PROVIDER,
            `No provider in ${qualifiedTypeToString(component.type)} for required types: ${Array.from(missingSet.keys()).map(typeToString).join(", ")}\n\n` +
            `${printTreeMap(component.type, filterTree(component.type, getChildren, item => missingSet.has(item), typeToString), typeToString)}\n`,
            this.component
        )
    }

    reportMissingRequiredProviders(parentProvider: InstanceProvider, missingProvider: Iterable<InstanceProvider>): never {
        const parentDeclarationContext = parentProvider.declaration ? nodeForDisplay(parentProvider.declaration) : ""
        const declarations = Array.from(missingProvider).map(it => it.declaration).filterNotNull()
        const parentType = parentProvider.providerType === ProviderType.INJECTABLE_CONSTRUCTOR
            ? createQualifiedType({type: parentProvider.type})
            : parentProvider.type
        ErrorReporter.fail(
            KarambitErrorScope.MISSING_PROVIDER,
            `Required type(s) of ${qualifiedTypeToString(parentType)} may not be provided by optional binding(s): \n\n` +
            parentDeclarationContext + "\n\n" +
            declarations.map(nodeForDisplay).join("\n"),
            this.component
        )
    }

    reportDuplicateProviders(type: QualifiedType, providers: InstanceProvider[]): never {
        ErrorReporter.fail(
            KarambitErrorScope.DUPLICATE_PROVIDERS,
            `${qualifiedTypeToString(type)} is provided multiple times!\n\n` +
            providers.map(providerForDisplay).filterNotNull().map(it => `provided by:\n${it}\n`).join("\n") + "\n",
            this.component
        )
    }

    reportDuplicateBindings(type: QualifiedType, bindings: Binding[]): never {
        ErrorReporter.fail(
            KarambitErrorScope.DUPLICATE_BINDINGS,
            `${qualifiedTypeToString(type)} is bound multiple times!\n\n` +
            bindings.map(it => it.declaration).map(nodeForDisplay).filterNotNull().map(it => `bound at:\n${it}\n`).join("\n") + "\n",
            this.component
        )
    }

    reportDependencyCycle(type: QualifiedType, chain: QualifiedType[]): never {
        ErrorReporter.fail(
            KarambitErrorScope.DEPENDENCY_CYCLE,
            `${qualifiedTypeToString(type)} causes a dependency cycle (circular dependency)!\n\n` +
            `${chain.map(qualifiedTypeToString).join(" -> ")}\n`,
            this.component
        )
    }

    reportBindingCycle(type: QualifiedType, chain: QualifiedType[]): never {
        ErrorReporter.fail(
            KarambitErrorScope.BINDING_CYCLE,
            "Binding cycle detected!\n\n" +
            `${chain.map(qualifiedTypeToString).join(" -> ")}\n`,
            this.component
        )
    }

    static reportCodeNotTransformed(): never {
        ErrorReporter.fail(
            KarambitErrorScope.TRANSFORM,
            "Decorated code was not processed by transformer! Ensure this project is configured to use the Karambit compiler plugin.",
        )
    }

    static reportParseFailed(message: string, component?: ts.ClassLikeDeclaration): never {
        ErrorReporter.fail(KarambitErrorScope.PARSE, message, component)
    }

    static fail(scope: KarambitErrorScope, message: string, component?: ts.ClassLikeDeclaration): never {
        throw new KarambitError(message, scope, component)
    }
}

export class KarambitError extends Error {

    constructor(description: string, readonly scope: KarambitErrorScope, component?: ts.ClassLikeDeclaration) {
        super(`${chalk.red(`[Karambit/${scope}]`)} ${component && component.name ? `${component.name.getText()}: ` : ""}${description}`)
    }
}

function providerForDisplay(provider: InstanceProvider): string | undefined {
    if (isPropertyProvider(provider)) return nodeForDisplay(provider.declaration)
    if (isProvidesMethod(provider)) return nodeForDisplay(provider.declaration)
    if (isInjectableConstructor(provider)) return nodeForDisplay(provider.declaration)
    if (isSubcomponentFactory(provider)) return nodeForDisplay(provider.declaration)
    if (provider.providerType === ProviderType.PARENT) return "Parent binding"
    if (provider.providerType === ProviderType.SET_MULTIBINDING) return "@IntoSet multibinding"
    if (provider.providerType === ProviderType.MAP_MULTIBINDING) return "@IntoMap multibinding"
    return undefined
}

function nodeForDisplay(node: ts.Node): string {
    const sf = node.getSourceFile()
    const {line, character} = sf.getLineAndCharacterOfPosition(node.pos)
    const nodeText = chalk.yellow(`${sf.fileName}:${line}:${character}`) + "\n" +
        normalizeWhitespace(node.getText())
    return nodeText.split(" {\n")[0]
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
