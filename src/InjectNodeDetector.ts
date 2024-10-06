import * as ts from "typescript"
import {Inject, Reusable} from "karambit-decorators"
import {createQualifiedType, QualifiedType, TypeQualifier} from "./QualifiedType"
import {ErrorReporter} from "./ErrorReporter"

interface Decorated {
    name?: { getText: () => string }
    modifiers?: ts.NodeArray<ts.ModifierLike>
}

@Inject
@Reusable
export class InjectNodeDetector {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly errorReporter: ErrorReporter,
    ) {
        this.isScopeDecorator = this.isScopeDecorator.bind(this)
        this.isScope = this.isScope.bind(this)
        this.isComponentDecorator = this.isComponentDecorator.bind(this)
        this.isSubcomponentDecorator = this.isSubcomponentDecorator.bind(this)
        this.isAssistedDecorator = this.isAssistedDecorator.bind(this)
        this.isAssistedInjectDecorator = this.isAssistedInjectDecorator.bind(this)
        this.isProvidesDecorator = this.isProvidesDecorator.bind(this)
        this.isBindsDecorator = this.isBindsDecorator.bind(this)
        this.isBindsInstanceDecorator = this.isBindsInstanceDecorator.bind(this)
        this.isInjectDecorator = this.isInjectDecorator.bind(this)
        this.isModuleDecorator = this.isModuleDecorator.bind(this)
        this.isIntoSetDecorator = this.isIntoSetDecorator.bind(this)
        this.isIntoMapDecorator = this.isIntoMapDecorator.bind(this)
        this.isElementsIntoSetDecorator = this.isElementsIntoSetDecorator.bind(this)
        this.isElementsIntoMapDecorator = this.isElementsIntoMapDecorator.bind(this)
        this.isMapKeyDecorator = this.isMapKeyDecorator.bind(this)
        this.isCompileTimeConstant = this.isCompileTimeConstant.bind(this)
    }

    isScopeDecorator(decorator: ts.Node): decorator is ts.Decorator {
        if (!ts.isDecorator(decorator)) return false
        const type = this.typeChecker.getTypeAtLocation(decorator.expression)
        return this.isScope(type)
    }

    isIterableProvider(item: ts.MethodDeclaration): boolean {
        const modifiers = item.modifiers ?? []
        return modifiers.some(it => this.isElementsIntoMapDecorator(it) || this.isElementsIntoSetDecorator(it))
    }

    getScope(item: Decorated): ts.Symbol | undefined {
        const scopeDecorators = item.modifiers?.filter(this.isScopeDecorator).map(it => this.typeChecker.getSymbolAtLocation(it.expression)).filterNotNull() ?? []
        if (scopeDecorators.length > 1) ErrorReporter.reportParseFailed(`Scoped element may only have one scope! ${item.name?.getText()} has ${scopeDecorators.length}.`)
        if (scopeDecorators.length === 1) {
            const [symbol] = scopeDecorators
            return this.getAliasedSymbol(symbol)
        }
    }

    private isScope(type: ts.Type): boolean {
        return this.getPropertyNames(type).has("__karambitScopeAnnotation")
    }

    getQualifier(_: Decorated): TypeQualifier | undefined {
        return undefined
    }

    isComponentDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "Component")
    }

    isSubcomponentDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "Subcomponent")
    }

    isAssistedDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "Assisted")
    }

    isAssistedInjectDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "AssistedInject")
    }

    isProvidesDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "Provides")
    }

    isBindsDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "Binds")
    }

    isBindsInstanceDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "BindsInstance")
    }

    isInjectDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "Inject")
    }

    isModuleDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "Module")
    }

    isIntoSetDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "IntoSet")
    }

    isIntoMapDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "IntoMap")
    }

    isElementsIntoSetDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "ElementsIntoSet")
    }

    isElementsIntoMapDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "ElementsIntoMap")
    }

    isMapKeyDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "MapKey")
    }

    getMapBindingInfo(returnType: QualifiedType, declaration: ts.MethodDeclaration | ts.PropertyDeclaration): {keyType: ts.Type, valueType: QualifiedType, expression?: ts.Expression} | undefined {
        const keyInfo = this.getMapKey(declaration)
        if (keyInfo) return {...keyInfo, valueType: returnType}

        return this.getMapTupleBindingInfo(returnType)
    }

    getMapTupleBindingInfo(returnType: QualifiedType): {keyType: ts.Type, valueType: QualifiedType} | undefined {
        const type = returnType.type as any
        if (type.target && type.target.fixedLength === 2) {
            const typeArgs = type.resolvedTypeArguments as ts.Type[] ?? []
            if (typeArgs.length === 2) {
                return {keyType: typeArgs[0], valueType: createQualifiedType({...returnType, type: typeArgs[1]})}
            }
        }

        return undefined
    }

    private getMapKey(declaration: ts.MethodDeclaration | ts.PropertyDeclaration): {keyType: ts.Type, expression: ts.Expression} | undefined {
        const decorators = declaration.modifiers?.filter(this.isMapKeyDecorator)
        if (!decorators || decorators.length !== 1) return undefined
        const decorator = decorators[0]

        if (ts.isCallExpression(decorator.expression)) {
            const argument = decorator.expression.arguments[0]
            if (!argument) return undefined

            if (!this.isCompileTimeConstant(argument)) this.errorReporter.reportParseFailed("@MapKey argument must be a literal!", decorator)

            const keyTypeNode = decorator.expression.typeArguments
                ? decorator.expression.typeArguments[0]
                : undefined
            const keyType = keyTypeNode ? this.typeChecker.getTypeAtLocation(keyTypeNode) : undefined
            return {
                keyType: keyType ?? this.typeChecker.getBaseTypeOfLiteralType(this.typeChecker.getTypeAtLocation(argument)),
                expression: argument,
            }
        }
    }

    private isKarambitDecorator(decorator: ts.Node, name: string): decorator is ts.Decorator {
        return ts.isDecorator(decorator) && this.getKarambitAnnotationName(decorator) === name
    }

    private isCompileTimeConstant(expression: ts.Expression): boolean {
        return expression.kind === ts.SyntaxKind.NumericLiteral
            || expression.kind === ts.SyntaxKind.BigIntLiteral
            || expression.kind === ts.SyntaxKind.StringLiteral
            || expression.kind === ts.SyntaxKind.BooleanKeyword
            || (ts.isObjectLiteralExpression(expression) && expression.properties.every(it => it.kind === ts.SyntaxKind.PropertyAssignment && this.isCompileTimeConstant(it.initializer)))
            || (ts.isArrayLiteralExpression(expression) && expression.elements.every(this.isCompileTimeConstant))
    }

    isProvider(type: ts.Type): ts.Type | undefined {
        return this.isKarambitGenericType(type, "Provider", "__karambitProvider")
    }

    isSubcomponentFactory(type: ts.Type): ts.Type | undefined {
        return this.isKarambitGenericType(type, "SubcomponentFactory", "__karambitSubcomponentFactory")
    }

    private isKarambitGenericType(type: ts.Type, typeName: string, typeBrand: string): ts.Type | undefined {
        const symbol = type.getSymbol()
        if (symbol && (symbol.getName() === typeName || this.getPropertyNames(type).has(typeBrand))) {
            const typeArguments = (type as any)?.resolvedTypeArguments as ts.Type[] ?? type.aliasTypeArguments ?? []
            if (typeArguments.length != 1) ErrorReporter.reportParseFailed(`Invalid ${typeName} type!`)
            return typeArguments[0]
        }
    }

    isReadonlySet(type: ts.Type): ts.Type | undefined {
        const symbol = type.getSymbol()
        if (symbol?.getName() === "ReadonlySet") {
            const typeArguments = (type as any)?.resolvedTypeArguments as ts.Type[] ?? type.aliasTypeArguments ?? []
            if (typeArguments.length != 1) ErrorReporter.reportParseFailed("Invalid ReadonlySet type!")
            return typeArguments[0]
        }
    }

    isReadonlyMap(type: ts.Type): [ts.Type, ts.Type] | undefined {
        const symbol = type.getSymbol()
        if (symbol?.getName() === "ReadonlyMap") {
            const typeArguments = (type as any)?.resolvedTypeArguments as ts.Type[] ?? type.aliasTypeArguments ?? []
            if (typeArguments.length != 2) ErrorReporter.reportParseFailed("Invalid ReadonlyMap type!")
            return typeArguments as [ts.Type, ts.Type]
        }
    }

    isIterable(type: ts.Type): ts.Type | undefined {
        const iterator = type.getProperties().find(it => it.name.startsWith("__@iterator@"))
        const iterableType = iterator?.valueDeclaration && this.typeChecker.getTypeOfSymbolAtLocation(iterator, iterator?.valueDeclaration)
        if (iterableType) {
            const iteratorTypes = this.typeChecker.getSignaturesOfType(iterableType, ts.SignatureKind.Call).map(this.typeChecker.getReturnTypeOfSignature)
            if (iteratorTypes.length !== 1) this.errorReporter.reportParseFailed(`Invalid Iterable type: ${this.typeChecker.typeToString(type)}!`)
            const iteratorType = iteratorTypes[0]
            const typeArguments = (iteratorType as any)?.resolvedTypeArguments as ts.Type[] ?? type.aliasTypeArguments ?? []
            if (typeArguments.length != 1) this.errorReporter.reportParseFailed(`Invalid Iterable type: ${this.typeChecker.typeToString(type)}!`)
            return typeArguments[0]
        }
    }

    private getIdentifiers(node: ts.Node): [ts.Identifier] | [ts.Identifier, ts.Identifier] | [] {
        try {
            for (const child of node.getChildren()) {
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
        } catch (e) {
            // getChildren may throw for synthetic nodes (which we can safely ignore)
        }
        return []
    }

    isReusableScope(symbol: ts.Symbol): boolean {
        return this.getPropertyNamesForSymbol(symbol).has("__karambitReusableScopeAnnotation")
    }

    private getPropertyNamesForSymbol(symbol: ts.Symbol): ReadonlySet<string> {
        const type = this.typeChecker.getTypeOfSymbol(symbol)
        if (!type) return new Set()
        return this.getPropertyNames(type)
    }

    private getPropertyNames(type: ts.Type): ReadonlySet<string> {
        return new Set(type.getProperties().map(it => it.name))
    }

    private getKarambitAnnotationName(node: ts.Node): string | undefined {
        const identifiers = this.getIdentifiers(node)
        if (identifiers.length === 1) {
            const [identifier] = identifiers
            const symbol = this.typeChecker.getSymbolAtLocation(identifier)
            const aliasedSymbol = symbol && this.getAliasedSymbol(symbol)
            if (aliasedSymbol && this.getPropertyNamesForSymbol(aliasedSymbol).has("__karambitAnnotation")) {
                return aliasedSymbol.getName()
            }
        } else if (identifiers.length === 2) {
            const [_, identifier] = identifiers
            const symbol = this.typeChecker.getSymbolAtLocation(identifier)
            const aliasedSymbol = symbol && this.getAliasedSymbol(symbol)
            if (aliasedSymbol && this.getPropertyNamesForSymbol(aliasedSymbol).has("__karambitAnnotation")) {
                return aliasedSymbol.getName()
            }
        }
        return undefined
    }

    private getAliasedSymbol(symbol: ts.Symbol): ts.Symbol {
        if (symbol.flags & ts.SymbolFlags.Alias) {
            return this.typeChecker.getAliasedSymbol(symbol)
        } else {
            return symbol
        }
    }

    getPropertyNode(decorator: ts.Decorator, propertyName: string): ts.Node | undefined {
        if (ts.isCallExpression(decorator.expression)) {
            if (decorator.expression.arguments.length === 1) {
                const componentInfo = decorator.expression.arguments[0]
                if (ts.isObjectLiteralExpression(componentInfo)) {
                    for (const child of componentInfo.getChildren().flatMap(it => it.kind === ts.SyntaxKind.SyntaxList ? it.getChildren() : [it])) {
                        if (ts.isPropertyAssignment(child) && child.name.getText() === propertyName) {
                            return child.initializer
                        }
                    }
                }
            }
        }
    }

    getStringPropertyNode(decorator: ts.Decorator, propertyName: string): string | undefined {
        const valueExpression = this.getPropertyNode(decorator, propertyName)
        if (valueExpression) {
            if (!ts.isStringLiteral(valueExpression)) this.errorReporter.reportParseFailed(`${propertyName} must be a string literal!`, decorator)
            return this.resolveStringLiteral(valueExpression)
        }
    }

    getBooleanPropertyNode(decorator: ts.Decorator, propertyName: string): boolean | undefined {
        const valueExpression = this.getPropertyNode(decorator, propertyName)
        if (valueExpression) {
            if (valueExpression.kind === ts.SyntaxKind.TrueKeyword) return true
            if (valueExpression.kind === ts.SyntaxKind.FalseKeyword) return false
            this.errorReporter.reportParseFailed(`${propertyName} must be a boolean literal!`, decorator)
        }
    }

    resolveStringLiteral(literal: ts.StringLiteral): string {
        const match = literal.getText().match(/^['"](.*)['"]$/)
        if (!match || match.length < 2) throw ErrorReporter.reportParseFailed(`Failed to resolve string literal: ${literal.getText()}`)
        return match[1]
    }
}
