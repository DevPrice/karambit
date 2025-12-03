import * as ts from "typescript"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {createQualifiedType, QualifiedType} from "./QualifiedType"
import {Inject, Reusable} from "karambit-decorators"
import {ProviderType, ProvidesMethod, ProvidesMethodParameter} from "./Providers"
import {ErrorReporter} from "./ErrorReporter"
import {findAllChildren} from "./Visitor"
import {bound, isNotNull, memoized} from "./Util"
import {KarambitOptions} from "./karambit"

export interface Binding {
    paramType: QualifiedType
    returnType: QualifiedType
    declaration: ts.MethodDeclaration | ts.PropertyDeclaration
}

export interface Module {
    includes: readonly ts.Symbol[]
    factories: readonly ProvidesMethod[]
    bindings: readonly Binding[]
}

@Inject
@Reusable
export class ModuleLocator {

    constructor(
        private readonly karambitOptions: KarambitOptions,
        private readonly typeChecker: ts.TypeChecker,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly errorReporter: ErrorReporter,
    ) { }

    getInstalledModules(declaration: ts.ClassLikeDeclaration, decorator: ts.Decorator | undefined): Module[] {
        const installedFromTags = this.getInstalledFromTags(declaration)
        if (installedFromTags.length > 0) {
            const installedSymbols = this.getInstalledFromTags(declaration)
            return this.getModulesFromSymbols(installedSymbols)
        }
        if (decorator) {
            return this.getModulesFromSymbols(this.getSymbolList(decorator, "modules"))
        }
        return []
    }

    private getInstalledFromTags(declaration: ts.ClassLikeDeclaration): ts.Symbol[] {
        const tags = this.nodeDetector.getJSDocTags(declaration, "includeModule")
        return tags
            .flatMap(tag => {
                const linkTags = tag.getChildren().filter(ts.isJSDocLink)
                if (linkTags.length <= 0) {
                    this.errorReporter.reportParseFailed("Expected at least one @link TSDoc tag for @includeModule tag!", tag)
                }
                return linkTags
            })
            .map(tag => {
                const symbol = tag.name && this.typeChecker.getSymbolAtLocation(tag.name)
                if (!symbol) {
                    this.errorReporter.reportParseFailed("Expected valid symbol!", tag)
                }
                return symbol
            })
    }

    private getModulesFromSymbols(symbols: ts.Symbol[]): Module[] {
        const installedModules: Map<ts.Symbol, Module> = new Map()
        let symbol: ts.Symbol | undefined
        while (symbol = symbols.shift()) { // eslint-disable-line
            if (!installedModules.has(symbol)) {
                const module = this.getModuleForSymbol(symbol)
                installedModules.set(symbol, module)
                symbols.push(...module.includes)
            }
        }
        return Array.from(installedModules.values())
    }

    getInstalledSubcomponents(declaration: ts.ClassLikeDeclaration, decorator: ts.Decorator | undefined): ts.Symbol[] {
        const tags = this.nodeDetector.getJSDocTags(declaration, "includeSubcomponent")
        if (tags.length > 0) {
            const linkTags = tags
                .flatMap(tag => {
                    const linkTags = tag.getChildren().filter(ts.isJSDocLink)
                    if (linkTags.length <= 0) {
                        this.errorReporter.reportParseFailed("Expected at least one @link TSDoc tag for @includeSubcomponent tag!", tag)
                    }
                    return linkTags
                })

            return linkTags
                .map(tag => {
                    const symbol = tag.name && this.typeChecker.getSymbolAtLocation(tag.name)
                    if (!symbol) {
                        this.errorReporter.reportParseFailed("Expected valid symbol!", tag)
                    }
                    return symbol
                })
        }
        if (decorator) {
            return this.getSymbolList(decorator, "subcomponents")
        }
        return []
    }

    getGeneratedName(declaration: ts.ClassLikeDeclaration): string | undefined {
        const tag = this.nodeDetector.getJSDocTag(declaration, "generatedName")
        if (tag && typeof tag.comment === "string") {
            if (!isValidIdentifier(tag.comment)) {
                this.errorReporter.reportParseFailed(`Invalid identifier '${tag.comment}'!`, tag)
            }
            return tag.comment
        }
        const decorator = this.nodeDetector.getComponentAnnotation(declaration)
        if (decorator && ts.isDecorator(decorator)) {
            return this.nodeDetector.getStringPropertyNode(decorator, "generatedClassName")
        }
    }

    @memoized
    private getModuleForSymbol(symbol: ts.Symbol): Module {
        const declarations = this.nodeDetector.getOriginalSymbol(symbol).getDeclarations()?.filter(dec => ts.isClassDeclaration(dec))
        if (declarations === undefined || declarations.length === 0) {
            this.errorReporter.reportParseFailed(`No declarations found for symbol '${symbol.name}'!`)
        }
        const includes = declarations.flatMap(declaration => {
            const moduleAnnotation = this.nodeDetector.getModuleAnnotation(declaration)
            const tagIncludes = this.getInstalledFromTags(declaration)
            if (tagIncludes.length > 0) {
                return tagIncludes
            }
            return moduleAnnotation && ts.isDecorator(moduleAnnotation) ? this.getSymbolList(moduleAnnotation, "includes") : []
        })
        const {factories, bindings} = declarations.reduce<{factories: ProvidesMethod[], bindings: Binding[]}>((prev, declaration) => {
            const {factories, bindings} = this.getFactoriesAndBindings(declaration)
            return {
                factories: prev.factories.concat(factories),
                bindings: prev.bindings.concat(bindings),
            }
        }, {factories: [], bindings: []})
        if (includes.length <= 0 && factories.length <= 0 && bindings.length <= 0 && !this.karambitOptions.allowEmptyModules) {
            this.errorReporter.reportParseFailed("Modules must define at least one @provides or @binds, or include another module! If you really want this to succeed, use --allow-empty-modules", declarations[0])
        }
        return {includes, factories, bindings}
    }

    @bound
    private getProvidesMethod(method: ts.MethodDeclaration): Omit<ProvidesMethod, "module"> {
        if (!method.modifiers?.some(it => it.kind === ts.SyntaxKind.StaticKeyword)) {
            this.errorReporter.reportParseFailed("Provider methods must be static!", method)
        }
        const signature = this.typeChecker.getSignatureFromDeclaration(method)!
        const returnType = createQualifiedType({
            type: signature.getReturnType(),
            qualifier: this.nodeDetector.getQualifier(method)
        })
        const parameters: ProvidesMethodParameter[] = method.parameters.map(param => {
            return {
                type: createQualifiedType({
                    type: this.typeChecker.getTypeAtLocation(param.type ?? param),
                    qualifier: this.nodeDetector.getQualifier(param)
                }),
                optional: param.questionToken !== undefined || param.initializer !== undefined
            }
        })
        const scope = this.nodeDetector.getScope(method)
        const isIterableProvider = this.nodeDetector.isIterableProvider(method)

        return {providerType: ProviderType.PROVIDES_METHOD, declaration: method, type: returnType, parameters, scope, isIterableProvider}
    }

    @bound
    private getBinding(method: ts.MethodDeclaration): Binding {
        if (!method.modifiers?.some(it => it.kind === ts.SyntaxKind.AbstractKeyword)) {
            this.errorReporter.reportBindingNotAbstract(method)
        }
        const signature = this.typeChecker.getSignatureFromDeclaration(method)!
        const returnType = createQualifiedType({
            type: signature.getReturnType(),
            qualifier: this.nodeDetector.getQualifier(method)
        })
        const parameters = method.parameters
        if (parameters.length != 1) this.errorReporter.reportInvalidBindingArguments(method)
        const paramType = createQualifiedType({
            type: this.typeChecker.getTypeAtLocation(parameters[0].type ?? parameters[0]),
            qualifier: this.nodeDetector.getQualifier(parameters[0])
        })
        if (paramType === returnType) this.errorReporter.reportTypeBoundToSelf(method)
        const assignable = this.typeChecker.isTypeAssignableTo(paramType.type, returnType.type)
        if (!assignable) this.errorReporter.reportBindingMustBeAssignable(method, paramType.type, returnType.type)

        return {paramType, returnType, declaration: method}
    }

    @bound
    private getPropertyBinding(property: ts.PropertyDeclaration): Binding {
        if (!property.modifiers?.some(it => it.kind === ts.SyntaxKind.AbstractKeyword)) {
            this.errorReporter.reportBindingNotAbstract(property)
        }
        const type = this.typeChecker.getTypeAtLocation(property)
        const signatures = this.typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call)
        if (signatures.length !== 1) this.errorReporter.reportParseFailed("Couldn't read signature of @Binds property!")
        const signature = signatures[0]
        const returnType = createQualifiedType({
            type: signature.getReturnType(),
            qualifier: this.nodeDetector.getQualifier(property)
        })
        const parameters = signature.parameters
            .map(it => this.typeChecker.getTypeOfSymbolAtLocation(it, property))
        if (parameters.length != 1) this.errorReporter.reportInvalidBindingArguments(property)
        const paramType = createQualifiedType({
            type: parameters[0]
        })
        if (paramType === returnType) this.errorReporter.reportTypeBoundToSelf(property)
        const assignable = this.typeChecker.isTypeAssignableTo(paramType.type, returnType.type)
        if (!assignable) this.errorReporter.reportBindingMustBeAssignable(property, paramType.type, returnType.type)

        return {paramType, returnType, declaration: property}
    }

    private getFactoriesAndBindings(module: ts.ClassDeclaration): {factories: ProvidesMethod[], bindings: Binding[]} {
        const factories = module.members.filter((node): node is ts.MethodDeclaration => {
            return ts.isMethodDeclaration(node) && !!this.nodeDetector.getProvidesAnnotation(node)
        })
            .flatMap(this.getProvidesMethod)
            .map(factory => ({...factory, module}))

        const bindings = module.members.filter((node): node is ts.MethodDeclaration => {
            return ts.isMethodDeclaration(node) && !!this.nodeDetector.getBindsAnnotation(node)
        })
            .map(this.getBinding)
            .concat(
                module.members.filter((node): node is ts.PropertyDeclaration => {
                    return ts.isPropertyDeclaration(node) && !!this.nodeDetector.getBindsAnnotation(node)
                })
                    .map(this.getPropertyBinding)
            )
        return {factories, bindings}
    }

    private getSymbolList(decorator: ts.Decorator, identifierName: string): ts.Symbol[] {
        const property = findAllChildren(decorator, ts.isPropertyAssignment)
            .find(it => ts.isIdentifier(it.name) && it.name.text === identifierName)
        if (!property) return []

        const arrayLiteral = property.initializer
        if (!ts.isArrayLiteralExpression(arrayLiteral)) {
            this.errorReporter.reportCompileTimeConstantRequired(decorator, identifierName)
        }
        return arrayLiteral.elements
            .map(it => this.typeChecker.getTypeAtLocation(it).getSymbol())
            .filter(isNotNull)
    }
}

function isValidIdentifier(identifier: string): boolean {
    return identifier.match(/^[a-zA-Z_$][a-zA-Z_$0-9]*$/) !== null
}
