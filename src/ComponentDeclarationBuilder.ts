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

export class ComponentDeclarationBuilder {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly sourceFile: ts.SourceFile,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly nameGenerator: NameGenerator,
        private readonly importer: Importer,
        private readonly errorReporter: ErrorReporter,
        private readonly typeResolver: TypeResolver,
        private readonly instanceProviders: ReadonlyMap<QualifiedType, InstanceProvider>,
    ) {
        this.getParamExpression = this.getParamExpression.bind(this)
    }

    declareComponent(options: {componentType: ts.Type, declaration: ts.ClassDeclaration, constructorParams: ConstructorParameter[], members: ts.ClassElement[], preferredClassName?: string}): ts.ClassDeclaration {
        return ts.factory.createClassDeclaration(
            [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
            this.nameGenerator.getComponentIdentifier(options.componentType, options.preferredClassName),
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
                            undefined,
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

    declareComponentProperty(options: {type: QualifiedType, name: ts.PropertyName, typeNode?: ts.TypeNode}) {
        const resolvedType = this.typeResolver.resolveBoundType(options.type)
        const expression = this.getParamExpression(resolvedType)
        return ts.factory.createGetAccessorDeclaration(
            [ts.factory.createToken(ts.SyntaxKind.ReadonlyKeyword)],
            options.name,
            [],
            options.typeNode,
            ts.factory.createBlock([ts.factory.createReturnStatement(expression)])
        )
    }

    getProviderDeclaration(provider: InstanceProvider, componentScope?: ts.Symbol): ts.ClassElement[] {
        if (provider.providerType == ProviderType.PARENT) return [this.getParentProvidedDeclaration(provider.type)]
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
        members: Iterable<ts.ClassElement>,
    ): ts.ClassElement {
        const symbol = factory.subcomponentType.type.symbol
        const declaration = symbol.declarations![0]
        return ts.factory.createPropertyDeclaration(
            undefined,
            this.nameGenerator.getPropertyIdentifier(factory.subcomponentType),
            undefined,
            undefined,
            ts.factory.createClassExpression(
                undefined,
                undefined,
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
                            undefined,
                            undefined
                        ), ...factory.constructorParams.map(param =>
                            ts.factory.createParameterDeclaration(
                                [ts.factory.createModifier(ts.SyntaxKind.PrivateKeyword), ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
                                undefined,
                                this.nameGenerator.getPropertyIdentifierForParameter(param.declaration),
                                undefined,
                                undefined,
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
            undefined,
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
                                    ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
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
        return ts.factory.createMethodDeclaration(
            undefined,
            undefined,
            this.nameGenerator.getAssistedFactoryGetterMethodIdentifier(factory.resultType),
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
                            factory.factoryParams
                                .map(it =>
                                    ts.factory.createParameterDeclaration(
                                        undefined,
                                        undefined,
                                        it.name,
                                        undefined,
                                        ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
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
        const members = provider.elementProviders.flatMap(it => this.getProviderDeclaration(it, componentScope))
        return [...members, this.getterMethodDeclaration(provider.type, this.createSetMultibindingExpression(provider))]
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
                    .map(elementProvider => this.getParamExpression(elementProvider.type))
                    .concat(provider.elementBindings.map(this.getParamExpression))
                    .concat(parentAccessExpression ?? []),
                false
            )]
        )
    }

    private getMapMultibindingProviderDeclaration(provider: MapMultibinding, componentScope?: ts.Symbol): ts.ClassElement[] {
        const members = provider.entryProviders.flatMap(it => this.getProviderDeclaration(it, componentScope))
        return [...members, this.getterMethodDeclaration(provider.type, this.createMapMultibindingExpression(provider))]
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
                    .map(entryProvider => this.getMapEntryExpression(entryProvider.type, entryProvider.key))
                    .concat(provider.entryBindings.map(it => this.getMapEntryExpression(it.valueType, it.key)))
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

    private getterMethodDeclaration(type: QualifiedType, expression: ts.Expression): ts.MethodDeclaration {
        return ts.factory.createMethodDeclaration(
            [],
            undefined,
            this.nameGenerator.getGetterMethodIdentifier(type),
            undefined,
            [],
            [],
            this.typeChecker.typeToTypeNode(type.type, undefined, undefined),
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
                    undefined,
                    propIdentifier,
                    undefined,
                    undefined,
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
        return [this.getterMethodDeclaration(factory.type, this.factoryCallExpression(factory))]
    }

    private getMissingOptionalDeclaration(type: QualifiedType): ts.ClassElement {
        return this.getterMethodDeclaration(type, ts.factory.createVoidExpression(ts.factory.createNumericLiteral(0)))
    }

    private isTypeNullable(type: ts.Type): boolean {
        if (type.flags & ts.TypeFlags.Null || type.flags & ts.TypeFlags.Undefined) return true
        return type.isUnionOrIntersection() && type.types.some(it => this.isTypeNullable(it))
    }

    private getCachedFactoryDeclaration(factory: ProvidesMethod): ts.ClassElement[] {
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
            undefined,
            propIdentifier,
            undefined,
            undefined,
            nullable ? this.getUnsetPropertyExpression() : undefined
        )
    }

    private getParentProvidedDeclaration(type: QualifiedType): ts.ClassElement {
        return this.getterMethodDeclaration(type, this.accessParentGetter(type))
    }

    private getComponentProvidedDeclaration(provider: PropertyProvider): ts.MethodDeclaration {
        return this.getterMethodDeclaration(
            provider.type,
            accessDependencyProperty(provider.name, provider.propertyName)
        )
    }

    private getExpressionForDeclaration(node: ts.Declaration): ts.Expression {
        const type = this.typeChecker.getTypeAtLocation(node)!
        const symbol = type.getSymbol()!
        return this.importer.getExpressionForDeclaration(symbol, node.getSourceFile())
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
