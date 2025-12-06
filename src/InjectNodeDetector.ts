import * as ts from "typescript"
import {Inject, Reusable} from "karambit-decorators"
import {createQualifiedType, QualifiedType, TypeQualifier} from "./QualifiedType"
import {ErrorReporter} from "./ErrorReporter"
import {bound, isNotNull} from "./Util"
import {Hacks} from "./Hacks"
import {KarambitOptions} from "./karambit"
import {Annotated, AnnotationLike, ComponentScope, isJSDocTag, isValidIdentifier, reusableScope} from "./TypescriptUtil"

export const KarambitAnnotationTag = {
    component: "component",
    subcomponent: "subcomponent",
    inject: "inject",
    assistedInject: "assistedInject",
    assisted: "assisted",
    provides: "provides",
    binds: "binds",
    bindsInstance: "bindInstance",
    intoSet: "intoSet",
    intoMap: "intoMap",
    elementsIntoSet: "elementsIntoSet",
    elementsIntoMap: "elementsIntoMap",
    scope: "scope",
    reusable: "reusable",
    includeModule: "includeModule",
    includeSubcomponent: "includeSubcomponent",
    factory: "factory",
} as const

const annotationTagNames = new Set<string>(Object.values(KarambitAnnotationTag).map(it => it.toLowerCase()))

@Inject
@Reusable
export class InjectNodeDetector {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly hacks: Hacks,
        private readonly errorReporter: ErrorReporter,
        private readonly karambitOptions: KarambitOptions,
    ) { }

    @bound
    isScopeDecorator(decorator: ts.Node): decorator is ts.Decorator {
        if (!ts.isDecorator(decorator)) return false
        const type = this.typeChecker.getTypeAtLocation(decorator.expression)
        return this.isScope(type)
    }

    @bound
    isIterableProvider(item: ts.MethodDeclaration): boolean {
        return !!(this.getElementsIntoSetAnnotation(item) || this.getElementsIntoMapAnnotation(item))
    }

    @bound
    getScope(item: Annotated): ComponentScope | undefined {
        const tagScope = this.getTagScope(item)
        if (tagScope) return tagScope
        const scopeDecorators = item.modifiers?.filter(this.isScopeDecorator).map(it => this.typeChecker.getSymbolAtLocation(it.expression)).filter(isNotNull) ?? []
        if (scopeDecorators.length > 1) ErrorReporter.reportParseFailed(`Scoped element may only have one scope! ${item.name?.getText()} has ${scopeDecorators.length}.`)
        if (scopeDecorators.length === 1) {
            const [symbol] = scopeDecorators
            return this.getOriginalSymbol(symbol)
        }
    }

    private getTagScope(item: Annotated): ComponentScope | undefined {
        const reusableTag = this.getJSDocTag(item, KarambitAnnotationTag.reusable)
        if (reusableTag) return reusableScope

        const scopeTag = this.getJSDocTag(item, KarambitAnnotationTag.scope)
        if (scopeTag) {
            const children = scopeTag.getChildren()
            const linkTags = children.filter(ts.isJSDocLink)
            if (linkTags.length > 0) {
                if (linkTags.length > 1) {
                    this.errorReporter.reportParseFailed("@scope must have at most one @link reference!", scopeTag)
                }
                const linkTag = linkTags[0]
                const symbol = linkTag.name && this.typeChecker.getSymbolAtLocation(linkTag.name)
                const symbolType = symbol && this.typeChecker.getTypeOfSymbol(symbol)
                if (!symbolType || !this.isValidTagScope(symbolType)) {
                    this.errorReporter.reportParseFailed("Invalid scope reference, should reference a `unique symbol` declaration!", linkTag)
                }
                return this.getOriginalSymbol(symbol)
            }
            if (scopeTag && typeof scopeTag.comment === "string") {
                if (!isValidIdentifier(scopeTag.comment)) {
                    this.errorReporter.reportParseFailed(`Invalid identifier '${scopeTag.comment}'!`, scopeTag)
                }
                return scopeTag.comment
            }
        }
    }

    private isValidTagScope(type: ts.Type): boolean {
        return this.isScope(type) || !!(type.flags & ts.TypeFlags.UniqueESSymbol)
    }

    private isScope(type: ts.Type): boolean {
        return this.getPropertyNames(type).has("__karambitScopeAnnotation")
    }

    @bound
    getQualifier(_: unknown): TypeQualifier | undefined {
        return undefined
    }

    @bound
    getComponentAnnotation(node: Annotated): AnnotationLike | undefined {
        return node.modifiers?.find(this.isComponentDecorator) ?? this.getJSDocTag(node, KarambitAnnotationTag.component)
    }

    @bound
    isComponentAnnotation(annotation: AnnotationLike): boolean {
        return ts.isDecorator(annotation)
            ? this.isKarambitDecorator(annotation, "Component")
            : this.karambitOptions.enableDocTags && annotation.tagName.getText() === KarambitAnnotationTag.component
    }

    @bound
    isComponentDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "Component")
    }

    @bound
    isSubcomponentAnnotation(annotation: AnnotationLike): boolean {
        return ts.isDecorator(annotation)
            ? this.isKarambitDecorator(annotation, "Subcomponent")
            : this.karambitOptions.enableDocTags && annotation.tagName.getText() === KarambitAnnotationTag.subcomponent
    }

    @bound
    getSubcomponentAnnotation(node: Annotated): AnnotationLike | undefined {
        return node.modifiers?.find(this.isSubcomponentDecorator) ?? this.getJSDocTag(node, "subcomponent")
    }

    @bound
    private isSubcomponentDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "Subcomponent")
    }

    @bound
    getAssistedInjectAnnotation(node: Annotated): AnnotationLike | undefined {
        return node.modifiers?.find(this.isAssistedInjectDecorator) ?? this.getJSDocTag(node, KarambitAnnotationTag.assistedInject)
    }

    @bound
    getAssistedAnnotation(node: Annotated): AnnotationLike | undefined {
        return node.modifiers?.find(this.isAssistedDecorator) ?? this.getJSDocTag(node, KarambitAnnotationTag.assisted)
    }

    @bound
    private isAssistedDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "Assisted")
    }

    @bound
    private isAssistedInjectDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "AssistedInject")
    }

    @bound
    getProvidesAnnotation(node: Annotated): AnnotationLike | undefined {
        return node.modifiers?.find(this.isProvidesDecorator) || this.getJSDocTag(node, "provides")
    }

    @bound
    private isProvidesDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "Provides")
    }

    @bound
    getBindsAnnotation(node: Annotated): AnnotationLike | undefined {
        return node.modifiers?.find(this.isBindsDecorator) || this.getJSDocTag(node, "binds")
    }

    @bound
    private isBindsDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "Binds")
    }

    @bound
    getBindsInstanceAnnotation(node: Annotated): AnnotationLike | undefined {
        return node.modifiers?.find(this.isBindsInstanceDecorator) || this.getJSDocTag(node, "bindsInstance")
    }

    @bound
    private isBindsInstanceDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "BindsInstance")
    }

    @bound
    getInjectAnnotation(node: Annotated): AnnotationLike | undefined {
        return node.modifiers?.find(this.isInjectDecorator) ?? this.getJSDocTag(node, "inject")
    }

    @bound
    isInjectAnnotation(annotation: AnnotationLike): boolean {
        return ts.isDecorator(annotation)
            ? this.isKarambitDecorator(annotation, "Inject")
            : this.isKarambitDocTag(annotation, KarambitAnnotationTag.inject)
    }

    @bound
    isInjectDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "Inject")
    }

    @bound
    isAssistedInjectAnnotation(annotation: AnnotationLike): boolean {
        return ts.isDecorator(annotation)
            ? this.isKarambitDecorator(annotation, "AssistedInject")
            : this.isKarambitDocTag(annotation, KarambitAnnotationTag.assistedInject)
    }

    @bound
    isAssistedAnnotation(annotation: AnnotationLike): boolean {
        return ts.isDecorator(annotation)
            ? this.isKarambitDecorator(annotation, "Assisted")
            : this.isKarambitDocTag(annotation, KarambitAnnotationTag.assisted)
    }

    @bound
    getModuleAnnotation(node: Annotated): AnnotationLike | undefined {
        const tags = ts.getJSDocTags(node).filter(tag => tag.tagName.text.localeCompare("includes", undefined, {sensitivity: "base"}) === 0)
        for (const tag of tags) {
            const linkTags = tag.getChildren().filter(ts.isJSDocLink)
            for (const linkTag of linkTags) {
                const type = linkTag.name && this.typeChecker.getTypeAtLocation(linkTag.name)
                console.log(type && this.typeChecker.typeToString(type))
            }
            console.log(node.name?.getText() ?? "<unknown_node>", ": ", linkTags.map(it => it.getText()).join(", "))
        }
        return node.modifiers?.find(this.isModuleDecorator) ?? this.getJSDocTag(node, "karambitModule")
    }

    @bound
    isModuleDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "Module")
    }

    @bound
    getIntoSetAnnotation(node: Annotated): AnnotationLike | undefined {
        return node.modifiers?.find(this.isIntoSetDecorator) ?? this.getJSDocTag(node, "intoSet")
    }

    @bound
    private isIntoSetDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "IntoSet")
    }

    @bound
    getIntoMapAnnotation(node: Annotated): AnnotationLike | undefined {
        return node.modifiers?.find(this.isIntoMapDecorator) ?? this.getJSDocTag(node, "intoMap")
    }

    @bound
    private isIntoMapDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "IntoMap")
    }

    @bound
    getElementsIntoSetAnnotation(node: Annotated): AnnotationLike | undefined {
        return node.modifiers?.find(this.isElementsIntoSetDecorator) ?? this.getJSDocTag(node, "elementsIntoSet")
    }

    @bound
    private isElementsIntoSetDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "ElementsIntoSet")
    }

    @bound
    getElementsIntoMapAnnotation(node: Annotated): AnnotationLike | undefined {
        return node.modifiers?.find(this.isElementsIntoMapDecorator) ?? this.getJSDocTag(node, "elementsIntoMap")
    }

    @bound
    private isElementsIntoMapDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "ElementsIntoMap")
    }

    @bound
    isMapKeyDecorator(decorator: ts.Node): decorator is ts.Decorator {
        return this.isKarambitDecorator(decorator, "MapKey")
    }

    @bound
    getMapBindingInfo(returnType: QualifiedType, declaration: ts.MethodDeclaration | ts.PropertyDeclaration): {keyType: ts.Type, valueType: QualifiedType, expression?: ts.Expression} | undefined {
        const keyInfo = this.getMapKey(declaration)
        if (keyInfo) return {...keyInfo, valueType: returnType}

        return this.getMapTupleBindingInfo(returnType)
    }

    @bound
    getMapTupleBindingInfo(returnType: QualifiedType): {keyType: ts.Type, valueType: QualifiedType} | undefined {
        const target = this.hacks.getTarget(returnType.type)
        if (target && this.hacks.isTupleType(target) && target.fixedLength === 2) {
            const typeArgs = this.hacks.getResolvedTypeArguments(returnType.type) ?? []
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
                expression: this.hacks.cloneNode(argument),
            }
        }
    }

    @bound
    isKarambitAnnotation(annotation: ts.Node): annotation is AnnotationLike {
        return this.isKarambitDocTag(annotation) || this.isKarambitDecorator(annotation)
    }

    @bound
    isKarambitDocTag(node: ts.Node, name?: string): node is ts.JSDocTag {
        if (this.karambitOptions.enableDocTags && isJSDocTag(node)) {
            return name
                ? name.localeCompare(node.tagName.getText(), undefined, {sensitivity: "base"}) === 0
                : annotationTagNames.has(node.tagName.getText().toLowerCase())
        }
        return false
    }

    @bound
    isKarambitDecorator(decorator: ts.Node, name?: string): decorator is ts.Decorator {
        if (!ts.isDecorator(decorator)) return false
        const type = ts.isCallExpression(decorator.expression)
            ? this.typeChecker.getTypeAtLocation(decorator.expression.expression)
            : this.typeChecker.getTypeAtLocation(decorator.expression)
        return type.getProperties().some(property => property.name === (name ? `__karambit${name}Annotation` : "__karambitAnnotation"))
    }

    private isCompileTimeConstant(expression: ts.Expression): boolean {
        return expression.kind === ts.SyntaxKind.NumericLiteral
            || expression.kind === ts.SyntaxKind.BigIntLiteral
            || expression.kind === ts.SyntaxKind.StringLiteral
            || expression.kind === ts.SyntaxKind.BooleanKeyword
            || (ts.isObjectLiteralExpression(expression) && expression.properties.every(it => it.kind === ts.SyntaxKind.PropertyAssignment && this.isCompileTimeConstant(it.initializer)))
            || (ts.isArrayLiteralExpression(expression) && expression.elements.every(this.isCompileTimeConstant))
    }

    @bound
    isProvider(type: ts.Type): ts.Type | undefined {
        return this.isKarambitGenericType(type, "Provider", "__karambitProvider")
    }

    @bound
    isSubcomponentFactory(type: ts.Type): ts.Type | undefined {
        return this.isKarambitGenericType(type, "SubcomponentFactory", "__karambitSubcomponentFactory")
    }

    private isKarambitGenericType(type: ts.Type, typeName: string, typeBrand: string): ts.Type | undefined {
        const symbol = type.getSymbol()
        if (symbol && (symbol.getName() === typeName || this.getPropertyNames(type).has(typeBrand))) {
            const typeArguments = this.hacks.getResolvedTypeArguments(type) ?? type.aliasTypeArguments ?? []
            if (typeArguments.length != 1) ErrorReporter.reportParseFailed(`Invalid ${typeName} type!`)
            return typeArguments[0]
        }
    }

    @bound
    isReadonlySet(type: ts.Type): ts.Type | undefined {
        const symbol = type.getSymbol()
        if (symbol?.getName() === "ReadonlySet") {
            const typeArguments = this.hacks.getResolvedTypeArguments(type) ?? type.aliasTypeArguments ?? []
            if (typeArguments.length != 1) ErrorReporter.reportParseFailed("Invalid ReadonlySet type!")
            return typeArguments[0]
        }
    }

    @bound
    isReadonlyMap(type: ts.Type): [ts.Type, ts.Type] | undefined {
        const symbol = type.getSymbol()
        if (symbol?.getName() === "ReadonlyMap") {
            const typeArguments = this.hacks.getResolvedTypeArguments(type) ?? type.aliasTypeArguments ?? []
            if (typeArguments.length != 2) ErrorReporter.reportParseFailed("Invalid ReadonlyMap type!")
            return typeArguments as [ts.Type, ts.Type]
        }
    }

    @bound
    isIterable(type: ts.Type): ts.Type | undefined {
        const iterator = type.getProperties().find(it => it.name.startsWith("__@iterator@"))
        const iterableType = iterator?.valueDeclaration && this.typeChecker.getTypeOfSymbolAtLocation(iterator, iterator?.valueDeclaration)
        if (iterableType) {
            const iteratorTypes = this.typeChecker.getSignaturesOfType(iterableType, ts.SignatureKind.Call).map(this.typeChecker.getReturnTypeOfSignature)
            if (iteratorTypes.length !== 1) this.errorReporter.reportParseFailed(`Invalid Iterable type: ${this.typeChecker.typeToString(type)}!`)
            const iteratorType = iteratorTypes[0]
            const typeArguments = this.hacks.getResolvedTypeArguments(iteratorType) ?? type.aliasTypeArguments ?? []
            if (typeArguments.length != 1) this.errorReporter.reportParseFailed(`Invalid Iterable type: ${this.typeChecker.typeToString(type)}!`)
            return typeArguments[0]
        }
    }

    @bound
    isReusableScope(symbol: ComponentScope): boolean {
        if (symbol === reusableScope) return true
        if (typeof symbol === "string") return false
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

    getOriginalSymbol(symbol: ts.Symbol): ts.Symbol {
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
                    for (const property of componentInfo.properties) {
                        if (ts.isPropertyAssignment(property) && property.name.getText() === propertyName) {
                            return property.initializer
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

    getJSDocTag(node: ts.Node, tagName: string): ts.JSDocTag | undefined {
        if (!this.karambitOptions.enableDocTags) return undefined
        return ts.getJSDocTags(node).find(tag => tag.tagName.text.localeCompare(tagName, undefined, {sensitivity: "accent"}) === 0)
    }

    getJSDocTags(node: ts.Node, tagName: string): ts.JSDocTag[] {
        if (!this.karambitOptions.enableDocTags) return []
        return ts.getJSDocTags(node).filter(tag => tag.tagName.text.localeCompare(tagName, undefined, {sensitivity: "accent"}) === 0)
    }

    private resolveStringLiteral(literal: ts.StringLiteral): string {
        const match = literal.getText().match(/^['"](.*)['"]$/)
        if (!match || match.length < 2) throw ErrorReporter.reportParseFailed(`Failed to resolve string literal: ${literal.getText()}`)
        return match[1]
    }
}
