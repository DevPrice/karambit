import * as ts from "typescript"
import {Inject, Reusable} from "karambit-decorators"
import {createQualifiedType, QualifiedType, TypeQualifier} from "./QualifiedType"
import {ErrorReporter} from "./ErrorReporter"
import type {KarambitTransformOptions} from "./karambit"

interface Decorated {
    name?: { getText: () => string }
    modifiers?: ts.NodeArray<ts.ModifierLike>
}

@Inject
@Reusable
export class InjectNodeDetector {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly karambitOptions: KarambitTransformOptions,
        private readonly errorReporter: ErrorReporter,
    ) {
        this.isCreateComponentCall = this.isCreateComponentCall.bind(this)
        this.isScopeDecorator = this.isScopeDecorator.bind(this)
        this.isScope = this.isScope.bind(this)
        this.isQualifier = this.isQualifier.bind(this)
        this.isQualifierDecorator = this.isQualifierDecorator.bind(this)
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

    isCreateComponentCall(expression: ts.CallExpression): ts.Type | undefined {
        if (this.getKarambitNodeName(expression) === "createComponent") {
            return this.typeChecker.getTypeAtLocation(expression)
        }
    }

    isGetConstructorCall(expression: ts.CallExpression): ts.Type | undefined {
        if (this.getKarambitNodeName(expression) === "getConstructor") {
            const symbol = this.typeChecker.getSymbolAtLocation(expression.arguments[0])
            const type = symbol?.valueDeclaration && this.typeChecker.getTypeAtLocation(symbol.valueDeclaration)
            if (type) return type
            this.errorReporter.reportParseFailed("Unable to parse getComponent call!", expression)
        }
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
        const [symbol] = scopeDecorators
        return this.getAliasedSymbol(symbol)
    }

    private isScope(type: ts.Type): boolean {
        const symbol = type.getSymbol() ?? type.aliasSymbol
        // TODO: Use type brand
        return (symbol?.getName() === "ScopeDecorator" || symbol?.getName() === "ReusableScopeDecorator" || symbol?.getName() === "ScopeAnnotation" || symbol?.getName() === "ReusableScopeAnnotation") && this.isInjectSymbol(symbol)
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
        return ts.isDecorator(decorator) && this.getKarambitNodeName(decorator) === name
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
        return this.isKarambitGenericType(type, "Provider")
    }

    isSubcomponentFactory(type: ts.Type): ts.Type | undefined {
        return this.isKarambitGenericType(type, "SubcomponentFactory")
    }

    private isKarambitGenericType(type: ts.Type, typeName: string): ts.Type | undefined {
        const symbol = type.getSymbol()
        if (symbol?.getName() === typeName && this.isInjectSymbol(symbol)) {
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
        const declaration = symbol.declarations && symbol.declarations[0]
        const type = declaration && this.typeChecker.getTypeAtLocation(declaration)
        const typeSymbol = type?.symbol
        // TODO: Use type brand
        return (typeSymbol?.name == "ReusableScopeDecorator" || typeSymbol?.name == "ReusableScopeAnnotation") && this.isInjectSymbol(typeSymbol)
    }

    private isInjectSymbol(symbol: ts.Symbol): boolean {
        const aliasedSymbol = this.getAliasedSymbol(symbol)
        const declarations = aliasedSymbol.getDeclarations() ?? []
        for (const declaration of declarations) {
            const sourceWithoutExtension = declaration.getSourceFile().fileName.replace(/\..*$/, "")
            // if (sourceWithoutExtension.endsWith(injectSourceFileNameWithoutExtension)) return true
            // TODO: Verify module
            return true
        }
        return false
    }

    private getKarambitNodeName(node: ts.Node): string | undefined {
        const identifiers = this.getIdentifiers(node)
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
