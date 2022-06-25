import * as ts from "typescript"
import {filterNotNull} from "./Util"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {createQualifiedType, QualifiedType} from "./QualifiedType"

export type Bindings = ReadonlyMap<QualifiedType, QualifiedType>

export interface Module {
    includes: ts.Symbol[]
    factories: ProviderMethod[]
    bindings: Bindings
}

export interface FactoryParameter {
    type: QualifiedType
    optional: boolean
}

export interface ProviderMethod {
    module: ts.ClassDeclaration
    method: ts.MethodDeclaration
    returnType: QualifiedType
    parameters: FactoryParameter[]
    scope?: ts.Symbol
}

export class ModuleLocator {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly context: ts.TransformationContext,
        private readonly nodeDetector: InjectNodeDetector,
    ) { }

    getInstalledModules(decorator: ts.Decorator): Module[] {
        const installedModules: ts.Symbol[] = this.getSymbolList(decorator, "modules")
        return this.withIncludedModules(installedModules)
    }

    getInstalledSubcomponents(decorator: ts.Decorator): ts.Symbol[] {
        return this.getSymbolList(decorator, "subcomponents")
    }

    private withIncludedModules(symbols: ts.Symbol[]): Module[] {
        const directlyReferencedModules = this.getModuleMap(symbols)
        function withIncludedModules(symbol: ts.Symbol): Module[] {
            const module = directlyReferencedModules.get(symbol)
            if (!module) throw new Error(`Module missing for symbol: ${symbol.getName()}`)
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
            const moduleDecorator = node.decorators!.find(self.nodeDetector.isModuleDecorator)!
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
            if (ts.isClassDeclaration(node) && node.decorators?.some(self.nodeDetector.isModuleDecorator)) {
                return visitModule(node)
            } else {
                return ts.visitEachChild(node, visit, self.context)
            }
        }
        nodes.forEach(it => ts.visitEachChild(it, visit, this.context))
        return modules
    }

    private getFactoriesAndBindings(module: ts.ClassDeclaration): {factories: ProviderMethod[], bindings: Bindings} {
        const typeChecker = this.typeChecker
        const nodeDetector = this.nodeDetector
        const ctx = this.context
        const bindings = new Map<QualifiedType, QualifiedType>()
        const factories: ProviderMethod[] = []
        function visitFactory(method: ts.MethodDeclaration) {
            if (!method.modifiers?.some(it => it.kind === ts.SyntaxKind.StaticKeyword)) {
                throw Error(`Provider methods must be static! Provider: ${module.name?.getText()}.${method.name?.getText()}`)
            }
            const signature = typeChecker.getSignatureFromDeclaration(method)!
            const returnType = createQualifiedType({
                type: signature.getReturnType(),
                qualifier: nodeDetector.getQualifier(method)
            })
            const parameters: FactoryParameter[] = method.getChildren()
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

            factories.push({module, method, returnType, parameters, scope})
        }
        function visitBinding(method: ts.MethodDeclaration) {
            if (!method.modifiers?.some(it => it.kind === ts.SyntaxKind.AbstractKeyword)) {
                throw Error(`Binds method must be abstract! Binding: ${module.name?.getText()}.${method.name?.getText()}`)
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
            if (parameters.length != 1) throw new Error("Binding method must have exactly one argument!")
            const parameterType = createQualifiedType({
                type: typeChecker.getTypeAtLocation(parameters[0].type ?? parameters[0]),
                qualifier: nodeDetector.getQualifier(parameters[0])
            })
            if (parameterType === returnType) throw new Error(`Cannot bind a type to itself! Binding: ${module.name?.getText()}.${method.name?.getText()}`)
            // @ts-ignore
            const assignable: boolean = typeChecker.isTypeAssignableTo(parameterType.type, returnType.type)
            if (!assignable) throw Error(`Binding parameter must be assignable to the return type! ${typeChecker.typeToString(parameterType.type)} is not assignable to ${typeChecker.typeToString(returnType.type)}`)

            if (bindings.has(returnType)) throw new Error(`Type ${typeChecker.typeToString(returnType.type)} bound twice in ${module.name?.getText()}!`)
            bindings.set(returnType, parameterType)
        }
        function visit(node: ts.Node): ts.Node {
            if (ts.isMethodDeclaration(node) && node.decorators?.some(nodeDetector.isProvidesDecorator)) {
                visitFactory(node)
                return node
            } else if (ts.isMethodDeclaration(node) && node.decorators?.some(nodeDetector.isBindsDecorator)) {
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
        function visit(node: ts.Node): ts.Node {
            if (ts.isPropertyAssignment(node)) {
                const identifier = node.getChildren()
                    .find(it => ts.isIdentifier(it) && it.getText() === identifierName)
                if (identifier) {
                    const includesArrayLiteral = node.getChildren().find(it => ts.isArrayLiteralExpression(it))
                    if (!includesArrayLiteral) throw new Error(`'${identifierName}' must be a compile-time constant (array literal)!`)
                    moduleSymbols = filterNotNull(
                        includesArrayLiteral.getChildren()
                            .flatMap(it => it.getChildren())
                            .map(it => typeChecker.getTypeAtLocation(it).getSymbol())
                    )
                }
                return node
            }
            return ts.visitEachChild(node, visit, ctx)
        }
        ts.visitEachChild(decorator, visit, ctx)
        return moduleSymbols
    }
}
