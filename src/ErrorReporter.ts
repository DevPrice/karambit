import ts from "typescript"
import * as Path from "path"
import {createQualifiedType, QualifiedType, qualifiedTypeToString} from "./QualifiedType"
import {
    InjectableConstructor,
    InstanceProvider,
    isInjectableConstructor,
    isPropertyProvider,
    isProvidesMethod,
    isSubcomponentFactory,
    ProviderType,
    ProvidesMethod,
} from "./Providers"
import {filterTree, isNotNull, printTreeMap} from "./Util"
import {Dependency, DependencyProvider} from "./DependencyGraphBuilder"
import {Binding} from "./ModuleLocator"
import chalk from "chalk"
import {KarambitError, KarambitErrorScope} from "./KarambitError"
import {ComponentDeclaration, ComponentScope, scopeToString} from "./TypescriptUtil"

type ErrorContext = ts.Node | ts.Node[]

/**
 * @inject
 * @reusable
 */
export class ErrorReporter {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly component?: ComponentDeclaration,
    ) { }

    reportCompileTimeConstantRequired(context: ts.Node, identifierName: string): never {
        ErrorReporter.fail(
            KarambitErrorScope.PARSE,
            addContext(`'${identifierName}' must be a compile-time constant (array literal)!`, context),
            this.component,
        )
    }

    reportComponentPropertyMustBeReadOnly(context: ErrorContext): never {
        ErrorReporter.fail(
            KarambitErrorScope.PARSE,
            addContext("Abstract component properties must be read-only!", context),
            this.component,
        )
    }

    reportComponentDependencyMayNotBeOptional(context: ErrorContext): never {
        ErrorReporter.fail(
            KarambitErrorScope.PARSE,
            addContext("Non-instance dependencies may not be optional!", context),
            this.component,
        )
    }

    reportParseFailed(message: string, contextNode?: ts.Node): never {
        return ErrorReporter.reportParseFailed(message + (contextNode ? "\n\n" + nodeForDisplay(contextNode) + "\n" : ""))
    }

    reportDuplicateScope(subcomponentName: string, ancestorName: string): never {
        ErrorReporter.fail(
            KarambitErrorScope.INVALID_SCOPE,
            `Subcomponent may not share a scope with an ancestor! ${subcomponentName} has the same scope as its ancestor ${ancestorName}.\n`,
            this.component,
        )
    }

    reportInvalidScope(provider: ProvidesMethod | InjectableConstructor, expected?: ComponentScope): never {
        const type = isProvidesMethod(provider) ? provider.type : createQualifiedType({type: provider.type})
        ErrorReporter.fail(
            KarambitErrorScope.INVALID_SCOPE,
            addContext(
                `Invalid scope for type ${qualifiedTypeToString(type)}! ` +
                `Got: ${provider.scope ? scopeToString(provider.scope) : "no scope"}, expected: ${expected ? scopeToString(expected) : "no scope"}.\n`,
                provider.declaration,
            ),
            this.component
        )
    }

    reportBindingMustBeAssignable(context: ErrorContext, parameterType: ts.Type, returnType: ts.Type): never {
        ErrorReporter.fail(
            KarambitErrorScope.INVALID_BINDING,
            addContext(
                "Binding parameter must be assignable to the return type! " +
                `${this.typeChecker.typeToString(parameterType)} is not assignable to ${this.typeChecker.typeToString(returnType)}`,
                context,
            ),
            this.component
        )
    }

    reportTypeBoundToSelf(context: ErrorContext): never {
        ErrorReporter.fail(
            KarambitErrorScope.INVALID_BINDING,
            addContext("Cannot bind a type to itself!", context),
            this.component
        )
    }

    reportBindingNotAbstract(context: ErrorContext): never {
        ErrorReporter.fail(
            KarambitErrorScope.INVALID_BINDING,
            addContext("Binding must be abstract!", context),
            this.component
        )
    }

    reportInvalidBindingArguments(context: ErrorContext): never {
        ErrorReporter.fail(
            KarambitErrorScope.INVALID_BINDING,
            addContext("Binding signature must have exactly one argument!", context),
            this.component
        )
    }

    reportMissingProviders(missingTypes: Iterable<QualifiedType>, component: {type: QualifiedType, exposedProperties: Iterable<Dependency>}, graph: ReadonlyMap<QualifiedType, DependencyProvider>): never {
        const missingSet = new Set(missingTypes)
        const getChildren = (item: QualifiedType) => item === component.type ? Array.from(component.exposedProperties).map(it => it.type) : graph.get(item)?.dependencies ?? []
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
        const declarations = Array.from(missingProvider).map(it => it.declaration).filter(isNotNull)
        const parentType = parentProvider.providerType === ProviderType.INJECTABLE_CONSTRUCTOR
            ? createQualifiedType({type: parentProvider.type})
            : parentProvider.type
        ErrorReporter.fail(
            KarambitErrorScope.MISSING_PROVIDER,
            addContext(`Required type(s) of ${qualifiedTypeToString(parentType)} may not be provided by optional binding(s)!\n\n${parentDeclarationContext}`, declarations),
            this.component,
        )
    }

    reportDuplicateProviders(type: QualifiedType, providers: InstanceProvider[]): never {
        ErrorReporter.fail(
            KarambitErrorScope.DUPLICATE_PROVIDERS,
            `${qualifiedTypeToString(type)} is provided multiple times!\n\n` +
            providers.map(providerForDisplay).filter(isNotNull).map(it => `provided by:\n${it}\n`).join("\n") + "\n",
            this.component,
        )
    }

    reportDuplicateBindings(type: QualifiedType, bindings: Binding[]): never {
        ErrorReporter.fail(
            KarambitErrorScope.DUPLICATE_BINDINGS,
            `${qualifiedTypeToString(type)} is bound multiple times!\n\n` +
            bindings.map(it => it.declaration).map(nodeForDisplay).filter(isNotNull).map(it => it.toString()).join("\n\n") + "\n",
            this.component,
        )
    }

    reportDependencyCycle(type: QualifiedType, chain: QualifiedType[], context: ErrorContext): never {
        ErrorReporter.fail(
            KarambitErrorScope.DEPENDENCY_CYCLE,
            addContext(
                `${qualifiedTypeToString(type)} causes a dependency cycle (circular dependency)!\n\n` +
                    `${chain.map(qualifiedTypeToString).join(" -> ")}`,
                context,
            ),
            this.component,
        )
    }

    reportBindingCycle(type: QualifiedType, chain: QualifiedType[]): never {
        ErrorReporter.fail(
            KarambitErrorScope.BINDING_CYCLE,
            "Binding cycle detected!\n\n" +
            `${chain.map(qualifiedTypeToString).join(" -> ")}\n`,
            this.component,
        )
    }

    reportInternalFailure(message: string, context?: ts.Node): never {
        ErrorReporter.reportInternalFailure(addContext(message, context), this.component)
    }

    static reportParseFailed(message: string, component?: ComponentDeclaration): never {
        ErrorReporter.fail(KarambitErrorScope.PARSE, message, component)
    }

    static reportNoComponents(): never {
        ErrorReporter.fail(KarambitErrorScope.NO_COMPONENTS, "No components were found! If you really want this to succeed, use --allow-empty-output")
    }

    static reportInternalFailure(message: string, context?: ErrorContext, component?: ComponentDeclaration): never {
        ErrorReporter.fail(KarambitErrorScope.INTERNAL, addContext(message, context), component)
    }

    static fail(scope: KarambitErrorScope, message: string, component?: ComponentDeclaration): never {
        throw new KarambitError(message, scope, component)
    }
}

function addContext(message: string, context?: ErrorContext): string {
    if (Array.isArray(context)) {
        if (context.length === 1) {
            return `${message}\n\n${nodeForDisplay(context[0])}\n`
        }
        return `${message}\n\n${context.map(nodeForDisplay).join("\n\n")}\n`
    } else if (context) {
        return `${message}\n\n${nodeForDisplay(context)}\n`
    }
    return message
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
    const nodeText = chalk.yellow(`at ${getPrettyLocation(node)} (${sf.fileName}:${line}:${character})`) + "\n" +
        normalizeWhitespace(node.getText())
    return nodeText.split(" {\n")[0]
}

function getPrettyLocation(node: ts.Node): string {
    const parentNames: string[] = []
    let n: ts.Node | undefined = node
    while (n) {
        const name = getNodeName(n)
        const readableName = name?.getText()
        if (readableName) {
            parentNames.unshift(readableName)
        }
        n = n.parent
    }

    return parentNames.length > 0
        ? parentNames.join(".")
        : Path.basename(node.getSourceFile().fileName).replace(/\..*$/, "")
}

function getNodeName(node: ts.Node): ts.Node | undefined {
    const maybeNamed = node as { name?: ts.Node }
    if (maybeNamed.name) {
        return maybeNamed.name
    }
    return undefined
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
