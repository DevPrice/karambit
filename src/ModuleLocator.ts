import * as ts from "typescript"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {createQualifiedType, QualifiedType} from "./QualifiedType"
import {Inject, Reusable} from "karambit-decorators"
import {ProviderType, ProvidesMethod, ProvidesMethodParameter} from "./Providers"
import {ErrorReporter} from "./ErrorReporter"

export interface Binding {
    paramType: QualifiedType
    returnType: QualifiedType
    declaration: ts.MethodDeclaration | ts.PropertyDeclaration
}

export interface Module {
    includes: ts.Symbol[]
    factories: ProvidesMethod[]
    bindings: Binding[]
}

@Inject
@Reusable
export class ModuleLocator {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly context: ts.TransformationContext,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly errorReporter: ErrorReporter,
    ) { }

    getInstalledModules(decorator: ts.Decorator): Module[] {
        const installedModules: ts.Symbol[] = this.getSymbolList(decorator, "modules")
        return this.withIncludedModules(installedModules)
    }

    getInstalledSubcomponents(decorator: ts.Decorator): ts.Symbol[] {
        return this.getSymbolList(decorator, "subcomponents")
    }

    getGeneratedClassName(decorator: ts.Decorator): string | undefined {
        return this.nodeDetector.getStringPropertyNode(decorator, "generatedClassName")
    }

    private withIncludedModules(symbols: ts.Symbol[]): Module[] {
        const directlyReferencedModules = this.getModuleMap(symbols)
        const errorReporter = this.errorReporter
        function withIncludedModules(symbol: ts.Symbol): Module[] {
            const module = directlyReferencedModules.get(symbol)
            if (!module) throw errorReporter.reportParseFailed(`Module missing for symbol: ${symbol.getName()}`)
            return [module, ...module.includes.flatMap(it => withIncludedModules(it))]
        }
        return symbols.flatMap(it => withIncludedModules(it))
    }

    private getModuleMap(symbols: ts.Symbol[]): ReadonlyMap<ts.Symbol, Module> {
        const distinctSourceFiles = new Set(
            symbols.flatMap(it => it.getDeclarations() ?? [])
                .flatMap(it => it.getSourceFile())
        )
        return this.getModules(distinctSourceFiles)
    }

    private getModules(nodes: Set<ts.Node>): ReadonlyMap<ts.Symbol, Module> {
        const modules = new Map<ts.Symbol, Module>()
        const self = this
        function visitModule(node: ts.ClassDeclaration): ts.Node {
            const symbol = self.typeChecker.getTypeAtLocation(node).getSymbol()!
            const moduleDecorator = node.modifiers!.find(self.nodeDetector.isModuleDecorator)!
            const includes = self.getSymbolList(moduleDecorator, "includes")
            const {factories, bindings} = self.getFactoriesAndBindings(node)
            modules.set(symbol, {includes, factories, bindings})
            const distinct = new Set(
                includes.flatMap(it => it.getDeclarations() ?? [])
                    .map(it => it.getSourceFile())
                    .filter(it => !nodes.has(it))
            )
            self.getModules(distinct)
                .forEach((module, symbol) => modules.set(symbol, module))
            return node
        }
        function visit(node: ts.Node): ts.Node {
            if (ts.isClassDeclaration(node) && node.modifiers?.some(self.nodeDetector.isModuleDecorator)) {
                return visitModule(node)
            } else {
                return ts.visitEachChild(node, visit, self.context)
            }
        }
        nodes.forEach(it => ts.visitEachChild(it, visit, this.context))
        return modules
    }

    private getFactoriesAndBindings(module: ts.ClassDeclaration): {factories: ProvidesMethod[], bindings: Binding[]} {
        const typeChecker = this.typeChecker
        const nodeDetector = this.nodeDetector
        const ctx = this.context
        const bindings: Binding[] = []
        const errorReporter = this.errorReporter
        const factories: ProvidesMethod[] = []
        function visitFactory(method: ts.MethodDeclaration) {
            if (!method.modifiers?.some(it => it.kind === ts.SyntaxKind.StaticKeyword)) {
                throw errorReporter.reportParseFailed("Provider methods must be static!", method)
            }
            const signature = typeChecker.getSignatureFromDeclaration(method)!
            const returnType = createQualifiedType({
                type: signature.getReturnType(),
                qualifier: nodeDetector.getQualifier(method)
            })
            const parameters: ProvidesMethodParameter[] = method.getChildren()
                .flatMap(it => it.kind == ts.SyntaxKind.SyntaxList ? it.getChildren() : [it])
                .filter(ts.isParameter)
                .map(it => it as ts.ParameterDeclaration)
                .map(param => {
                    return {
                        type: createQualifiedType({
                            type: typeChecker.getTypeAtLocation(param.type ?? param),
                            qualifier: nodeDetector.getQualifier(param)
                        }),
                        optional: param.questionToken !== undefined || param.initializer !== undefined
                    }
                })
            const scope = nodeDetector.getScope(method)
            const isIterableProvider = nodeDetector.isIterableProvider(method)

            factories.push({providerType: ProviderType.PROVIDES_METHOD, module, declaration: method, type: returnType, parameters, scope, isIterableProvider})
        }
        function visitBinding(method: ts.MethodDeclaration) {
            if (!method.modifiers?.some(it => it.kind === ts.SyntaxKind.AbstractKeyword)) {
                errorReporter.reportBindingNotAbstract(method)
            }
            const signature = typeChecker.getSignatureFromDeclaration(method)!
            const returnType = createQualifiedType({
                type: signature.getReturnType(),
                qualifier: nodeDetector.getQualifier(method)
            })
            const parameters = method.getChildren()
                .flatMap(it => it.kind == ts.SyntaxKind.SyntaxList ? it.getChildren() : [it])
                .filter(ts.isParameter)
                .map(it => it as ts.ParameterDeclaration)
            if (parameters.length != 1) throw errorReporter.reportInvalidBindingArguments(method)
            const paramType = createQualifiedType({
                type: typeChecker.getTypeAtLocation(parameters[0].type ?? parameters[0]),
                qualifier: nodeDetector.getQualifier(parameters[0])
            })
            if (paramType === returnType) throw errorReporter.reportTypeBoundToSelf(method)
            // @ts-ignore
            const assignable: boolean = typeChecker.isTypeAssignableTo(paramType.type, returnType.type)
            if (!assignable) throw errorReporter.reportBindingMustBeAssignable(method, paramType.type, returnType.type)

            bindings.push({paramType, returnType, declaration: method})
        }
        function visitBindingProperty(property: ts.PropertyDeclaration) {
            if (!property.modifiers?.some(it => it.kind === ts.SyntaxKind.AbstractKeyword)) {
                errorReporter.reportBindingNotAbstract(property)
            }
            const type = typeChecker.getTypeAtLocation(property)
            const signatures = typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call)
            if (signatures.length !== 1) errorReporter.reportParseFailed("Couldn't read signature of @Binds property!")
            const signature = signatures[0]
            const returnType = createQualifiedType({
                type: signature.getReturnType(),
                qualifier: nodeDetector.getQualifier(property)
            })
            const parameters = signature.parameters
                .map(it => typeChecker.getTypeOfSymbolAtLocation(it, property))
            if (parameters.length != 1) throw errorReporter.reportInvalidBindingArguments(property)
            const paramType = createQualifiedType({
                type: parameters[0]
            })
            if (paramType === returnType) throw errorReporter.reportTypeBoundToSelf(property)
            // @ts-ignore
            const assignable: boolean = typeChecker.isTypeAssignableTo(paramType.type, returnType.type)
            if (!assignable) throw errorReporter.reportBindingMustBeAssignable(property, paramType.type, returnType.type)

            bindings.push({paramType, returnType, declaration: property})
        }
        function visit(node: ts.Node): ts.Node {
            if (ts.isMethodDeclaration(node) && node.modifiers?.some(nodeDetector.isProvidesDecorator)) {
                visitFactory(node)
                return node
            } else if (ts.isPropertyDeclaration(node) && node.modifiers?.some(nodeDetector.isBindsDecorator)) {
                visitBindingProperty(node)
                return node
            } else if (ts.isMethodDeclaration(node) && node.modifiers?.some(nodeDetector.isBindsDecorator)) {
                visitBinding(node)
                return node
            } else {
                return ts.visitEachChild(node, visit, ctx)
            }
        }
        ts.visitEachChild(module, visit, ctx)
        return {factories, bindings}
    }

    private getSymbolList(decorator: ts.Decorator, identifierName: string): ts.Symbol[] {
        let moduleSymbols: ts.Symbol[] = []
        const ctx = this.context
        const typeChecker = this.typeChecker
        const errorReporter = this.errorReporter
        function visit(node: ts.Node): ts.Node {
            if (ts.isPropertyAssignment(node)) {
                const identifier = node.getChildren()
                    .find(it => ts.isIdentifier(it) && it.getText() === identifierName)
                if (identifier) {
                    const includesArrayLiteral = node.getChildren().find(it => ts.isArrayLiteralExpression(it))
                    if (!includesArrayLiteral) throw errorReporter.reportCompileTimeConstantRequired(decorator, identifierName)
                    moduleSymbols = includesArrayLiteral.getChildren()
                        .flatMap(it => it.getChildren())
                        .map(it => typeChecker.getTypeAtLocation(it).getSymbol())
                        .filterNotNull()
                }
                return node
            }
            return ts.visitEachChild(node, visit, ctx)
        }
        ts.visitEachChild(decorator, visit, ctx)
        return moduleSymbols
    }
}
