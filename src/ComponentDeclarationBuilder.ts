import * as ts from "typescript"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {NameGenerator} from "./NameGenerator"
import {Importer} from "./Importer"
import {TypeResolver} from "./TypeResolver"
import {createQualifiedType, QualifiedType} from "./QualifiedType"
import {
    InjectableConstructor,
    InstanceProvider,
    PropertyProvider,
    ProviderType,
    ProvidesMethod,
    SetMultibinding,
    MapMultibinding,
    SubcomponentFactory, ConstructorParameter, AssistedFactory
} from "./Providers"
import {ErrorReporter} from "./ErrorReporter"
import {Assisted, AssistedInject} from "karambit-decorators"

export type ComponentDeclarationBuilderFactory = (typeResolver: TypeResolver, instanceProviders: ReadonlyMap<QualifiedType, InstanceProvider>) => ComponentDeclarationBuilder

@AssistedInject
export class ComponentDeclarationBuilder {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly nameGenerator: NameGenerator,
        private readonly importer: Importer,
        private readonly errorReporter: ErrorReporter,
        @Assisted private readonly typeResolver: TypeResolver,
        @Assisted private readonly instanceProviders: ReadonlyMap<QualifiedType, InstanceProvider>,
    ) {
        this.getParamExpression = this.getParamExpression.bind(this)
    }

    declareComponent(options: {declaration: ts.ClassDeclaration, constructorParams: ConstructorParameter[], members: ts.ClassElement[], identifier: ts.Identifier}): ts.ClassDeclaration {
        return ts.factory.createClassDeclaration(
            [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
            options.identifier,
            [],
            [ts.factory.createHeritageClause(
                ts.SyntaxKind.ExtendsKeyword,
                [ts.factory.createExpressionWithTypeArguments(
                    this.getExpressionForDeclaration(options.declaration),
                    undefined
                )]
            )],
            [
                ts.factory.createConstructorDeclaration(
                    undefined,
                    options.constructorParams.map(param =>
                        ts.factory.createParameterDeclaration(
                            [ts.factory.createModifier(ts.SyntaxKind.PrivateKeyword), ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
                            undefined,
                            this.nameGenerator.getPropertyIdentifierForParameter(param.declaration),
                            undefined,
                            this.typeToTypeNode(this.typeChecker.getTypeAtLocation(param.declaration)),
                            undefined
                        )
                    ),
                    ts.factory.createBlock(
                        [ts.factory.createExpressionStatement(ts.factory.createCallExpression(
                            ts.factory.createSuper(),
                            undefined,
                            options.constructorParams.map(param => this.nameGenerator.getPropertyIdentifierForParameter(param.declaration))
                        ))],
                        true
                    )
                ),
                ...options.members,
            ]
        )
    }

    declareComponentProperty(options: {type: QualifiedType, name: ts.PropertyName, optional: boolean, typeNode?: ts.TypeNode}) {
        const typeNode = this.typeToTypeNode(options.type.type)
        const resolvedType = this.typeResolver.resolveBoundType(options.type)
        const expression = this.getParamExpression(resolvedType)
        return ts.factory.createGetAccessorDeclaration(
            [],
            options.name,
            [],
            options.optional && typeNode ? ts.factory.createUnionTypeNode([typeNode, ts.factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword)]) : typeNode,
            ts.factory.createBlock([ts.factory.createReturnStatement(expression)])
        )
    }

    getProviderDeclaration(provider: InstanceProvider, componentScope?: ts.Symbol): ts.ClassElement[] {
        if (provider.providerType == ProviderType.PARENT) return [this.getParentProvidedDeclaration(provider.type, provider.optional)]
        if (provider.providerType == ProviderType.PROPERTY) return [this.getComponentProvidedDeclaration(provider)]
        if (provider.providerType == ProviderType.SUBCOMPONENT_FACTORY) return [this.getSubcomponentFactoryDeclaration(provider)]
        if (provider.providerType == ProviderType.ASSISTED_FACTORY) return [this.getAssistedFactoryDeclaration(provider)]
        if (provider.providerType == ProviderType.PROVIDES_METHOD) return this.getFactoryDeclaration(provider)
        if (provider.providerType == ProviderType.INJECTABLE_CONSTRUCTOR) return this.getConstructorProviderDeclaration(provider, componentScope)
        if (provider.providerType == ProviderType.SET_MULTIBINDING) return this.getSetMultibindingProviderDeclaration(provider)
        if (provider.providerType == ProviderType.MAP_MULTIBINDING) return this.getMapMultibindingProviderDeclaration(provider)
        return [this.getMissingOptionalDeclaration(provider.type)]
    }

    declareSubcomponent(
        factory: SubcomponentFactory,
        identifier: ts.Identifier | string,
        parentType: ts.EntityName | string,
        members: Iterable<ts.ClassElement>,
    ): ts.ClassElement {
        const symbol = factory.subcomponentType.type.symbol
        const declaration = symbol.declarations![0]
        return ts.factory.createPropertyDeclaration(
            [ts.factory.createToken(ts.SyntaxKind.PrivateKeyword)],
            this.nameGenerator.getPropertyIdentifier(factory.subcomponentType),
            undefined,
            undefined,
            ts.factory.createClassExpression(
                undefined,
                identifier,
                undefined,
                [ts.factory.createHeritageClause(
                    ts.SyntaxKind.ExtendsKeyword,
                    [ts.factory.createExpressionWithTypeArguments(
                        this.getExpressionForDeclaration(declaration),
                        undefined
                    )]
                )],
                [
                    ts.factory.createConstructorDeclaration(
                        undefined,
                        [ts.factory.createParameterDeclaration(
                            [ts.factory.createModifier(ts.SyntaxKind.PrivateKeyword), ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
                            undefined,
                            this.nameGenerator.parentName,
                            undefined,
                            ts.factory.createTypeReferenceNode(parentType, undefined), //ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
                            undefined,
                        ), ...factory.constructorParams.map(param =>
                            ts.factory.createParameterDeclaration(
                                [ts.factory.createModifier(ts.SyntaxKind.PrivateKeyword), ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
                                undefined,
                                this.nameGenerator.getPropertyIdentifierForParameter(param.declaration),
                                undefined,
                                this.typeToTypeNode(param.type.type),
                                undefined
                            )
                        )],
                        ts.factory.createBlock(
                            [ts.factory.createExpressionStatement(ts.factory.createCallExpression(
                                ts.factory.createSuper(),
                                undefined,
                                factory.constructorParams.map(param => this.nameGenerator.getPropertyIdentifierForParameter(param.declaration))
                            ))],
                            true
                        )
                    ),
                    ...members,
                ]
            )
        )
    }

    private getParamExpression(paramType: QualifiedType): ts.Expression {
        const instanceProvider = this.instanceProviders.get(paramType)
        const providedType = this.nodeDetector.isProvider(paramType.type)
        if (providedType) {
            const qualifiedProvidedType = createQualifiedType({
                ...paramType,
                type: providedType
            })
            return ts.factory.createArrowFunction(
                undefined,
                undefined,
                [],
                undefined,
                ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                this.getParamExpression(qualifiedProvidedType)
            )
        }
        const subcomponentFactory = instanceProvider && instanceProvider.providerType === ProviderType.SUBCOMPONENT_FACTORY
        const assistedFactory = instanceProvider && instanceProvider.providerType === ProviderType.ASSISTED_FACTORY
        const identifier = subcomponentFactory
            ? this.nameGenerator.getSubcomponentFactoryGetterMethodIdentifier(instanceProvider.subcomponentType)
            : (assistedFactory ? this.nameGenerator.getAssistedFactoryGetterMethodIdentifier(instanceProvider.resultType) : this.nameGenerator.getGetterMethodIdentifier(paramType))
        return ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(ts.factory.createThis(), identifier),
            undefined,
            []
        )
    }

    private getSubcomponentFactoryDeclaration(factory: SubcomponentFactory): ts.ClassElement {
        return ts.factory.createMethodDeclaration(
            [ts.factory.createToken(ts.SyntaxKind.PrivateKeyword)],
            undefined,
            this.nameGenerator.getGetterMethodIdentifier(factory.subcomponentType),
            undefined,
            undefined,
            [],
            undefined,
            ts.factory.createBlock(
                [
                    ts.factory.createReturnStatement(
                        ts.factory.createArrowFunction(
                            undefined,
                            undefined,
                            factory.constructorParams.map(it =>
                                ts.factory.createParameterDeclaration(
                                    undefined,
                                    undefined,
                                    it.name,
                                    undefined,
                                    this.typeToTypeNode(it.type.type),
                                    undefined
                                )
                            ),
                            undefined,
                            ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                            this.createSubcomponentExpression(factory, factory.constructorParams.map(it => ts.factory.createIdentifier(it.name))),
                        )
                    )
                ],
                true
            )
        )
    }

    private createSubcomponentExpression(factory: SubcomponentFactory, params: ts.Expression[]): ts.Expression {
        return ts.factory.createNewExpression(
            ts.factory.createPropertyAccessExpression(
                ts.factory.createThis(),
                this.nameGenerator.getPropertyIdentifier(factory.subcomponentType)
            ),
            undefined,
            [ts.factory.createThis(), ...params]
        )
    }

    private getAssistedFactoryDeclaration(factory: AssistedFactory): ts.ClassElement {
        const typeNode = this.typeToTypeNode(factory.type.type)
        return ts.factory.createMethodDeclaration(
            [ts.factory.createToken(ts.SyntaxKind.PrivateKeyword)],
            undefined,
            this.nameGenerator.getAssistedFactoryGetterMethodIdentifier(factory.resultType),
            undefined,
            undefined,
            [],
            typeNode,
            ts.factory.createBlock(
                [
                    ts.factory.createReturnStatement(
                        ts.factory.createArrowFunction(
                            undefined,
                            undefined,
                            factory.factoryParams
                                .map((it, index) =>
                                    ts.factory.createParameterDeclaration(
                                        undefined,
                                        undefined,
                                        it.name,
                                        undefined,
                                        typeNode && paramType(typeNode, index),
                                        undefined,
                                    )
                                ),
                            undefined,
                            ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                            this.createAssistedFactoryExpression(
                                factory,
                                factory.constructorParams
                                    .map(it => {
                                        if (it.decorators.some(this.nodeDetector.isAssistedDecorator)) {
                                            const factoryParam = factory.factoryParams
                                                .find(p => p.type === it.type)
                                            if (!factoryParam) throw new Error("Error generating Assisted Factory!")
                                            return ts.factory.createIdentifier(factoryParam.name)
                                        } else {
                                            return this.getParamExpression(it.type)
                                        }
                                    })
                            ),
                        )
                    )
                ],
                true
            )
        )
    }

    private createAssistedFactoryExpression(factory: AssistedFactory, params: ts.Expression[]): ts.Expression {
        return ts.factory.createNewExpression(
            this.getExpressionForDeclaration(factory.declaration),
            undefined,
            params,
        )
    }

    private getSetMultibindingProviderDeclaration(provider: SetMultibinding, componentScope?: ts.Symbol): ts.ClassElement[] {
        return [this.getterMethodDeclaration(provider.type, this.createSetMultibindingExpression(provider))]
    }

    private createSetMultibindingExpression(provider: SetMultibinding): ts.Expression {
        const parentAccessExpression: ts.Expression | undefined = provider.parentBinding
            ? ts.factory.createSpreadElement(this.accessParentGetter(provider.type))
            : undefined
        return ts.factory.createNewExpression(
            ts.factory.createIdentifier("Set"),
            undefined,
            [ts.factory.createArrayLiteralExpression(
                provider.elementProviders
                    .map(it => {
                        if (it.isIterableProvider) {
                            return ts.factory.createSpreadElement(this.getParamExpression(it.type))
                        } else {
                            return this.getParamExpression(it.type)
                        }
                    })
                    .concat(parentAccessExpression ?? []),
                false
            )]
        )
    }

    private getMapMultibindingProviderDeclaration(provider: MapMultibinding, componentScope?: ts.Symbol): ts.ClassElement[] {
        return [this.getterMethodDeclaration(provider.type, this.createMapMultibindingExpression(provider))]
    }

    private createMapMultibindingExpression(provider: MapMultibinding): ts.Expression {
        const parentAccessExpression: ts.Expression | undefined = provider.parentBinding
            ? ts.factory.createSpreadElement(this.accessParentGetter(provider.type))
            : undefined
        return ts.factory.createNewExpression(
            ts.factory.createIdentifier("Map"),
            undefined,
            [ts.factory.createArrayLiteralExpression(
                provider.entryProviders
                    .map(entryProvider => {
                        if (entryProvider.isIterableProvider) {
                            return ts.factory.createSpreadElement(this.getMapEntryExpression(entryProvider.type, entryProvider.key))
                        } else {
                            return this.getMapEntryExpression(entryProvider.type, entryProvider.key)
                        }
                    })
                    .concat(parentAccessExpression ?? []),
                false
            )]
        )
    }

    private getMapEntryExpression(type: QualifiedType, keyExpression?: ts.Expression): ts.Expression {
        if (keyExpression) {
            return ts.factory.createArrayLiteralExpression([keyExpression, this.getParamExpression(type)], false)
        }
        return this.getParamExpression(type)
    }

    private getterMethodDeclaration(type: QualifiedType, expression: ts.Expression, optional: boolean = false): ts.MethodDeclaration {
        const typeNode = this.typeToTypeNode(type.type)
        return this.getterMethodDeclarationWithTypeNode(type, typeNode, expression, optional)
    }

    private getterMethodDeclarationWithTypeNode(type: QualifiedType, typeNode: ts.TypeNode | undefined, expression: ts.Expression, optional: boolean = false): ts.MethodDeclaration {
        return ts.factory.createMethodDeclaration(
            [ts.factory.createToken(ts.SyntaxKind.PrivateKeyword)],
            undefined,
            this.nameGenerator.getGetterMethodIdentifier(type),
            undefined,
            [],
            [],
            optional && typeNode ? ts.factory.createUnionTypeNode([typeNode, ts.factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword)]) : typeNode,
            ts.factory.createBlock([ts.factory.createReturnStatement(expression)])
        )
    }

    private getConstructorProviderDeclaration(constructor: InjectableConstructor, componentScope?: ts.Symbol): ts.ClassElement[] {
        const self = this
        function constructorCallExpression(): ts.Expression {
            return ts.factory.createNewExpression(
                self.getExpressionForDeclaration(constructor.declaration),
                undefined,
                constructor.parameters.map(it => it.type).map(self.typeResolver.resolveBoundType).map(self.getParamExpression)
            )
        }
        const scope = constructor.scope
        const qualifiedType = createQualifiedType({type: constructor.type})
        if (scope) {
            if (!this.nodeDetector.isReusableScope(scope) && scope !== componentScope) {
                this.errorReporter.reportInvalidScope(constructor, componentScope)
            }
            const propIdentifier = self.nameGenerator.getPropertyIdentifier(qualifiedType)
            return [
                ts.factory.createPropertyDeclaration(
                    [ts.factory.createToken(ts.SyntaxKind.PrivateKeyword)],
                    propIdentifier,
                    ts.factory.createToken(ts.SyntaxKind.QuestionToken),
                    this.typeToTypeNode(constructor.type),
                    undefined
                ),
                self.getterMethodDeclaration(
                    qualifiedType,
                    ts.factory.createBinaryExpression(
                        ts.factory.createPropertyAccessExpression(
                            ts.factory.createThis(),
                            propIdentifier
                        ),
                        ts.factory.createToken(ts.SyntaxKind.QuestionQuestionToken),
                        ts.factory.createParenthesizedExpression(
                            ts.factory.createBinaryExpression(
                                ts.factory.createPropertyAccessExpression(
                                    ts.factory.createThis(),
                                    propIdentifier
                                ),
                                ts.factory.createToken(ts.SyntaxKind.EqualsToken),
                                constructorCallExpression()
                            )
                        )
                    )
                )
            ]
        }
        return [self.getterMethodDeclaration(qualifiedType, constructorCallExpression())]
    }

    private getUnsetPropertyExpression(): ts.Expression {
        return ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier("Symbol"),
                ts.factory.createIdentifier("for")
            ),
            undefined,
            [ts.factory.createStringLiteral("unset")]
        )
    }

    private createScopedExpression(propIdentifier: ts.Identifier | ts.PrivateIdentifier, expression: ts.Expression) {
        return ts.factory.createBinaryExpression(
            ts.factory.createPropertyAccessExpression(
                ts.factory.createThis(),
                propIdentifier
            ),
            ts.factory.createToken(ts.SyntaxKind.QuestionQuestionToken),
            ts.factory.createParenthesizedExpression(
                ts.factory.createBinaryExpression(
                    ts.factory.createPropertyAccessExpression(
                        ts.factory.createThis(),
                        propIdentifier
                    ),
                    ts.factory.createToken(ts.SyntaxKind.EqualsToken),
                    expression
                )
            )
        )
    }

    private createScopedNullableExpression(propIdentifier: ts.Identifier | ts.PrivateIdentifier, expression: ts.Expression) {
        return ts.factory.createConditionalExpression(
            ts.factory.createBinaryExpression(
                ts.factory.createPropertyAccessExpression(
                    ts.factory.createThis(),
                    propIdentifier
                ),
                ts.factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
                this.getUnsetPropertyExpression()
            ),
            ts.factory.createToken(ts.SyntaxKind.QuestionToken),
            ts.factory.createParenthesizedExpression(ts.factory.createBinaryExpression(
                ts.factory.createPropertyAccessExpression(
                    ts.factory.createThis(),
                    propIdentifier
                ),
                ts.factory.createToken(ts.SyntaxKind.EqualsToken),
                expression
            )),
            ts.factory.createToken(ts.SyntaxKind.ColonToken),
            ts.factory.createPropertyAccessExpression(
                ts.factory.createThis(),
                propIdentifier
            )
        )
    }

    private factoryCallExpression(providesMethod: ProvidesMethod): ts.Expression {
        return ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
                this.getExpressionForDeclaration(providesMethod.module),
                ts.factory.createIdentifier(providesMethod.declaration.name.getText())
            ),
            undefined,
            providesMethod.parameters.map(it => it.type).map(this.typeResolver.resolveBoundType).map(this.getParamExpression)
        )
    }

    private getFactoryDeclaration(factory: ProvidesMethod): ts.ClassElement[] {
        if (factory.scope) return this.getCachedFactoryDeclaration(factory)

        const typeNode = this.typeToTypeNode(factory.type.type)
        return [
            this.getterMethodDeclarationWithTypeNode(
                factory.type,
                typeNode && factory.isIterableProvider ? iterableType(typeNode) : typeNode,
                this.factoryCallExpression(factory),
            )
        ]
    }

    private getMissingOptionalDeclaration(type: QualifiedType): ts.ClassElement {
        return this.getterMethodDeclaration(type, ts.factory.createVoidExpression(ts.factory.createNumericLiteral(0)), true)
    }

    private isTypeNullable(type: ts.Type): boolean {
        if (type.flags & ts.TypeFlags.Null || type.flags & ts.TypeFlags.Undefined) return true
        return type.isUnionOrIntersection() && type.types.some(it => this.isTypeNullable(it))
    }

    private getCachedFactoryDeclaration(factory: ProvidesMethod): ts.ClassElement[] {
        // TODO: Should handle iterable providers?
        return [
            this.getCachedPropertyDeclaration(factory.type),
            this.getterMethodDeclaration(
                factory.type,
                this.getCachedFactoryCallExpression(factory)
            )
        ]
    }

    private getCachedFactoryCallExpression(providesMethod: ProvidesMethod): ts.Expression {
        const propIdentifier = this.nameGenerator.getPropertyIdentifier(providesMethod.type)
        const nullable = this.isTypeNullable(providesMethod.type.type)
        return nullable ?
            this.createScopedNullableExpression(propIdentifier, this.factoryCallExpression(providesMethod)) :
            this.createScopedExpression(propIdentifier, this.factoryCallExpression(providesMethod))
    }

    private getCachedPropertyDeclaration(type: QualifiedType): ts.ClassElement {
        const propIdentifier = this.nameGenerator.getPropertyIdentifier(type)
        const nullable = this.isTypeNullable(type.type)
        return ts.factory.createPropertyDeclaration(
            [ts.factory.createToken(ts.SyntaxKind.PrivateKeyword)],
            propIdentifier,
            nullable ? undefined : ts.factory.createToken(ts.SyntaxKind.QuestionToken),
            this.typeToTypeNode(type.type),
            nullable ? this.getUnsetPropertyExpression() : undefined
        )
    }

    private getParentProvidedDeclaration(type: QualifiedType, optional: boolean): ts.ClassElement {
        return this.getterMethodDeclaration(type, this.accessParentGetter(type), optional)
    }

    private getComponentProvidedDeclaration(provider: PropertyProvider): ts.MethodDeclaration {
        return this.getterMethodDeclaration(
            provider.type,
            accessDependencyProperty(provider.name, provider.propertyName)
        )
    }

    private getExpressionForDeclaration(node: ts.Declaration): ts.Expression {
        const type = this.typeChecker.getTypeAtLocation(node)!
        const symbol = this.symbolForType(type)
        return this.importer.getExpressionForDeclaration(symbol, node.getSourceFile())
    }

    private typeToTypeNode(type: ts.Type, enclosingDeclaration: ts.Node | undefined = undefined): ts.TypeNode | undefined {
        const symbol = this.symbolForType(type)
        if (symbol && symbol.getName && symbol.getName() === "__type") {
            // no import needed
        } else if (symbol) {
            this.importer.getImportForSymbol(symbol)
            this.importTypeArguments(type)
        }
        if (type.isUnionOrIntersection()) {
            // TODO: Maybe this could break with recursively defined types
            type.types.forEach(it => this.typeToTypeNode(it))
        }
        return this.typeChecker.typeToTypeNode(type, enclosingDeclaration, undefined)
    }

    private symbolForType(type: ts.Type) {
        return type.aliasSymbol ?? type.symbol
    }

    private importTypeArguments(type: ts.Type) {
        const withTypeArguments = type as any as {typeArguments?: ts.Type[]}
        if (withTypeArguments.typeArguments) {
            withTypeArguments.typeArguments
                .forEach(it => it && this.typeToTypeNode(it))
        }
    }

    accessParentGetter(type: QualifiedType): ts.Expression {
        return ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
                ts.factory.createPropertyAccessExpression(
                    ts.factory.createThis(),
                    this.nameGenerator.parentName
                ),
                this.nameGenerator.getGetterMethodIdentifier(type)
            ),
            undefined,
            []
        )
    }
}

function paramType(type: ts.TypeNode, index: number) {
    return ts.factory.createIndexedAccessTypeNode(
        ts.factory.createTypeReferenceNode(
            ts.factory.createIdentifier("Parameters"),
            [type],
        ),
        ts.factory.createLiteralTypeNode(ts.factory.createNumericLiteral(index)),
    )
}

function iterableType(type: ts.TypeNode) {
    return ts.factory.createExpressionWithTypeArguments(ts.factory.createIdentifier("Iterable"), [type])
}

function accessDependencyProperty(memberName: ts.Identifier | ts.PrivateIdentifier, propertyName?: string): ts.PropertyAccessExpression {
    const propertyAccess = ts.factory.createPropertyAccessExpression(
        ts.factory.createThis(),
        memberName
    )
    if (!propertyName) {
        return propertyAccess
    }
    return ts.factory.createPropertyAccessExpression(
        propertyAccess,
        ts.factory.createIdentifier(propertyName)
    )
}
