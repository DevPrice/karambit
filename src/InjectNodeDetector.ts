import * as ts from "typescript"
import {Inject, Reusable} from "karambit-inject"
import {TypeQualifier} from "./QualifiedType"
import {ErrorReporter} from "./ErrorReporter"
import type {KarambitTransformOptions} from "./karambit"

const injectModuleName = require("../package.json").name
const injectSourceFileName = require("../package.json").main
const injectSourceFileNameWithoutExtension = injectSourceFileName.replace(/\..*$/, "")

interface Decorated {
    name?: { getText: () => string }
    modifiers?: ts.NodeArray<ts.ModifierLike>
}

@Inject
@Reusable
export class InjectNodeDetector {

    constructor(private readonly typeChecker: ts.TypeChecker, private readonly karambitOptions: KarambitTransformOptions) {
        this.isScopeDecorator = this.isScopeDecorator.bind(this)
        this.isScope = this.isScope.bind(this)
        this.isQualifier = this.isQualifier.bind(this)
        this.isQualifierDecorator = this.isQualifierDecorator.bind(this)
        this.isComponentDecorator = this.isComponentDecorator.bind(this)
        this.isSubcomponentDecorator = this.isSubcomponentDecorator.bind(this)
        this.isProvidesDecorator = this.isProvidesDecorator.bind(this)
        this.isBindsDecorator = this.isBindsDecorator.bind(this)
        this.isBindsInstanceDecorator = this.isBindsInstanceDecorator.bind(this)
        this.isInjectDecorator = this.isInjectDecorator.bind(this)
        this.isModuleDecorator = this.isModuleDecorator.bind(this)
        this.isEraseable = this.isEraseable.bind(this)
        this.eraseInjectRuntime = this.eraseInjectRuntime.bind(this)
    }

    isScopeDecorator(decorator: ts.Node): decorator is ts.Decorator {
        if (!ts.isDecorator(decorator)) return false
        const type = this.typeChecker.getTypeAtLocation(decorator.expression)
        return this.isScope(type)
    }

    getScope(item: Decorated): ts.Symbol | undefined {
        const scopeDecorators = item.modifiers?.filter(this.isScopeDecorator).map(it => this.typeChecker.getSymbolAtLocation(it.expression)).filterNotNull() ?? []
        if (scopeDecorators.length > 1) ErrorReporter.reportParseFailed(`Scoped element may only have one scope! ${item.name?.getText()} has ${scopeDecorators.length}.`)
        const [symbol] = scopeDecorators
        return this.getAliasedSymbol(symbol)
    }

    private isScope(type: ts.Type): boolean {
        const symbol = type.getSymbol() ?? type.aliasSymbol
        return (symbol?.getName() === "ScopeDecorator" || symbol?.getName() === "ReusableScopeDecorator") && this.isInjectSymbol(symbol)
    }

    isQualifierDecorator(decorator: ts.Node): decorator is ts.Decorator {
        if (!ts.isDecorator(decorator)) return false
        const type = this.typeChecker.getTypeAtLocation(decorator.expression)
        return this.isQualifier(type) || this.isNamedQualifier(type)
    }

    getQualifier(item: Decorated): TypeQualifier | undefined {
        const qualifierDecorators = item.modifiers?.filter(this.isQualifierDecorator) ?? []
        if (qualifierDecorators.length > 1) ErrorReporter.reportParseFailed(`Qualified element may only have one qualifier! ${item.name?.getText()} has ${qualifierDecorators.length}.`)
        if (qualifierDecorators.length === 0) return undefined
        const qualifier = qualifierDecorators[0]
        const type = this.typeChecker.getTypeAtLocation(qualifier.expression)
        if (this.isNamedQualifier(type)) {
            return this.getQualifierName(qualifier)
        }

        const qualifierSymbol = this.typeChecker.getSymbolAtLocation(qualifier.expression)
        return qualifierSymbol && this.getAliasedSymbol(qualifierSymbol)
    }

    private isQualifier(type: ts.Type): boolean {
        const symbol = type.getSymbol() ?? type.aliasSymbol
        return symbol?.getName() === "QualifierDecorator" && this.isInjectSymbol(symbol)
    }

    private isNamedQualifier(type: ts.Type): boolean {
        const symbol = type.getSymbol() ?? type.aliasSymbol
        return symbol?.getName() === "NamedQualifierDecorator" && this.isInjectSymbol(symbol)
    }

    private getQualifierName(decorator: ts.Decorator): string | undefined {
        if (ts.isCallExpression(decorator.expression)) {
            const literal = decorator.expression.getChildren()
                .flatMap(it => it.kind === ts.SyntaxKind.SyntaxList ? it.getChildren() : [it])
                .find(ts.isStringLiteral)
            if (literal) {
                return this.resolveStringLiteral(literal)
            }
        }
        return undefined
    }

    isComponentDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return ts.isDecorator(decorator) && this.getKarambitDecoratorName(decorator) === "Component"
    }

    isSubcomponentDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return ts.isDecorator(decorator) && this.getKarambitDecoratorName(decorator) === "Subcomponent"
    }

    isProvidesDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return ts.isDecorator(decorator) && this.getKarambitDecoratorName(decorator) === "Provides"
    }

    isBindsDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return ts.isDecorator(decorator) && this.getKarambitDecoratorName(decorator) === "Binds"
    }

    isBindsInstanceDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return ts.isDecorator(decorator) && this.getKarambitDecoratorName(decorator) === "BindsInstance"
    }

    isInjectDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return ts.isDecorator(decorator) && this.getKarambitDecoratorName(decorator) === "Inject"
    }

    isModuleDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return ts.isDecorator(decorator) && this.getKarambitDecoratorName(decorator) === "Module"
    }

    isProvider(type: ts.Type): ts.Type | undefined {
        const symbol = type.getSymbol()
        if (symbol?.getName() === "Provider" && this.isInjectSymbol(symbol)) {
            const typeArguments = (type as any)?.resolvedTypeArguments as ts.Type[] ?? type.aliasTypeArguments ?? []
            if (typeArguments.length != 1) ErrorReporter.reportParseFailed("Invalid Provider type!")
            return typeArguments[0]
        }
    }

    private getIdentifiers(decorator: ts.Node): [ts.Identifier] | [ts.Identifier, ts.Identifier] | [] {
        for (const child of decorator.getChildren()) {
            if (ts.isPropertyAccessExpression(child)) {
                return child.getChildren().filter(ts.isIdentifier) as any
            }
            if (ts.isIdentifier(child)) return [child]
            if (ts.isCallExpression(child)) {
                if (ts.isPropertyAccessExpression(child.expression)) {
                    return child.expression.getChildren().filter(ts.isIdentifier) as any
                }
                return [child.getChildren().find(ts.isIdentifier)].filterNotNull() as any
            }
        }
        return []
    }

    isReusableScope(symbol: ts.Symbol): boolean {
        const declaration = symbol.declarations && symbol.declarations[0]
        const type = declaration && this.typeChecker.getTypeAtLocation(declaration)
        const typeSymbol = type?.symbol
        return typeSymbol?.name == "ReusableScopeDecorator" && this.isInjectSymbol(typeSymbol)
    }

    isInjectionModuleImport(node: ts.Node) {
        return ts.isImportDeclaration(node) && node.getChildren().some(child => ts.isStringLiteral(child) && this.resolveStringLiteral(child) === injectModuleName)
    }

    isEraseable(node: ts.Node) {
        return this.isScopeDecorator(node) ||
            this.isQualifierDecorator(node) ||
            (this.karambitOptions.stripImports && this.isInjectionModuleImport(node)) ||
            (ts.isDecorator(node) && this.getKarambitDecoratorName(node) !== undefined)
    }

    eraseInjectRuntime<T extends ts.Node>(node: T, ctx: ts.TransformationContext): T {
        const detector = this
        function visitNode(n: ts.Node): ts.Node | undefined {
            if (detector.isEraseable(n)) {
                return undefined
            }
            if (ts.isVariableDeclaration(n)) {
                // TODO: Replace calls to Scope() and Qualifier() instead
                const type = detector.typeChecker.getTypeAtLocation(n.type ?? n)
                if (detector.isScope(type) || detector.isQualifier(type)) {
                    return ts.factory.updateVariableDeclaration(
                        n,
                        n.name,
                        n.exclamationToken,
                        n.type,
                        ts.factory.createArrowFunction(
                            undefined,
                            undefined,
                            [],
                            undefined,
                            ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                            ts.factory.createBlock(
                                [],
                                false
                            )
                        )
                    )
                }
            }
            return ts.visitEachChild(n, visitNode, ctx)
        }
        return ts.visitEachChild(node, visitNode, ctx)
    }

    private isInjectSymbol(symbol: ts.Symbol): boolean {
        const declarations = symbol.getDeclarations() ?? []
        for (const declaration of declarations) {
            const sourceWithoutExtension = declaration.getSourceFile().fileName.replace(/\..*$/, "")
            if (sourceWithoutExtension.endsWith(injectSourceFileNameWithoutExtension)) return true
        }
        return false
    }

    private getKarambitDecoratorName(decorator: ts.Decorator): string | undefined {
        const identifiers = this.getIdentifiers(decorator)
        if (identifiers.length === 1) {
            const [identifier] = identifiers
            const symbol = this.typeChecker.getSymbolAtLocation(identifier)
            const aliasedSymbol = symbol && this.getAliasedSymbol(symbol)
            return (aliasedSymbol && this.isInjectSymbol(aliasedSymbol)) ? aliasedSymbol?.getName() : undefined
        } else if (identifiers.length === 2) {
            const [namespace, identifier] = identifiers
            const symbol = this.typeChecker.getSymbolAtLocation(namespace)
            const aliasedSymbol = symbol && this.getAliasedSymbol(symbol)
            return (aliasedSymbol && this.isInjectSymbol(aliasedSymbol)) ? this.typeChecker.getSymbolAtLocation(identifier)?.getName() : undefined
        }
        return undefined
    }

    private getAliasedSymbol(symbol: ts.Symbol): ts.Symbol {
        // this throws for unknown reasons?
        try {
            return this.typeChecker.getAliasedSymbol(symbol)
        } catch {
            return symbol
        }
    }

    resolveStringLiteral(literal: ts.StringLiteral): string {
        const match = literal.getText().match(/^['"](.*)['"]$/)
        if (!match || match.length < 2) throw ErrorReporter.reportParseFailed(`Failed to resolve string literal: ${literal.getText()}`)
        return match[1]
    }
}
