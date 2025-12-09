import ts from "typescript"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {NameGenerator} from "./NameGenerator"
import {Importer} from "./Importer"
import {TypeResolver} from "./TypeResolver"
import {createQualifiedType, QualifiedType} from "./QualifiedType"
import {
    AssistedFactory,
    ConstructorParameter,
    InjectableConstructor,
    InstanceProvider,
    MapMultibinding,
    PropertyProvider,
    ProviderType,
    ProvidesMethod,
    SetMultibinding,
    SubcomponentFactory,
} from "./Providers"
import {ErrorReporter} from "./ErrorReporter"
import {bound, isNotNull} from "./Util"
import {ComponentDeclaration, ComponentScope, isTypeNullable} from "./TypescriptUtil"
import {findAllChildren} from "./Visitor"
import {ConstructorHelper} from "./ConstructorHelper"

export type ComponentDeclarationBuilderFactory = (typeResolver: TypeResolver, instanceProviders: ReadonlyMap<QualifiedType, InstanceProvider>) => ComponentDeclarationBuilder

/**
 * @assistedInject
 */
export class ComponentDeclarationBuilder {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly constructorHelper: ConstructorHelper,
        private readonly nameGenerator: NameGenerator,
        private readonly importer: Importer,
        private readonly errorReporter: ErrorReporter,
        /** @assisted */ private readonly typeResolver: TypeResolver,
        /** @assisted */ private readonly instanceProviders: ReadonlyMap<QualifiedType, InstanceProvider>,
    ) { }

    declareComponent(options: {declaration: ComponentDeclaration, factorySymbol?: ts.Symbol, factoryParams: ConstructorParameter[], members: ts.ClassElement[], identifier: ts.Identifier}): ts.ClassDeclaration {
        const parentName = options.declaration.name
        if (!parentName) {
            this.errorReporter.reportParseFailed("Component missing name!", options.declaration)
        }
        const parentSymbol = this.typeChecker.getSymbolAtLocation(parentName)!
        return ts.factory.createClassDeclaration(
            [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
            options.identifier,
            [],
            [ts.factory.createHeritageClause(
                ts.isClassLike(options.declaration) ? ts.SyntaxKind.ExtendsKeyword : ts.SyntaxKind.ImplementsKeyword,
                [ts.factory.createExpressionWithTypeArguments(
                    this.importer.getExpressionForSymbol(parentSymbol),
                    undefined
                )]
            )],
            [
                ts.factory.createConstructorDeclaration(
                    undefined,
                    options.factoryParams.map(param =>
                        ts.factory.createParameterDeclaration(
                            [ts.factory.createModifier(ts.SyntaxKind.PrivateKeyword), ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
                            undefined,
                            this.nameGenerator.getPropertyIdentifierForParameter(param.declaration),
                            undefined,
                            options.factorySymbol
                                ? paramType(
                                    ts.factory.createTypeReferenceNode(this.importer.getQualifiedNameForSymbol(options.factorySymbol)),
                                    param.index,
                                )
                                : this.constructorParamTypeNode(ts.factory.createTypeQueryNode(this.importer.getQualifiedNameForSymbol(parentSymbol)), param.index, parentSymbol),
                            undefined,
                        )
                    ),
                    ts.factory.createBlock(
                        [
                            ts.isClassLike(options.declaration)
                                ? this.componentSuperCall(options.declaration, options.factoryParams)
                                : undefined
                        ].filter(isNotNull),
                        true
                    )
                ),
                ...options.members,
            ]
        )
    }

    private componentSuperCall(declaration: ts.ClassLikeDeclaration, factoryParameters: ConstructorParameter[]): ts.Statement {
        const superParams = this.constructorHelper.getConstructorParamsForDeclaration(declaration)
        const mappedParams = superParams
            .map(superParam => {
                const match = factoryParameters.find(factoryParam => superParam.type === factoryParam.type)
                if (!match) {
                    // TODO: These should be part of the dependency graph and report a missing dependency error
                    this.errorReporter.reportParseFailed(`No factory param matches constructor param: ${superParam.name}`, declaration)
                }
                return match
            })
        return ts.factory.createExpressionStatement(ts.factory.createCallExpression(
            ts.factory.createSuper(),
            undefined,
            mappedParams.map(param => {
                return this.nameGenerator.getPropertyIdentifierForParameter(param.declaration)
            }),
        ))
    }

    declareComponentProperty(declaration: ComponentDeclaration, options: {type: QualifiedType, name: ts.PropertyName, optional: boolean, getter: boolean}) {
        const parentName = declaration.name
        if (!parentName) {
            this.errorReporter.reportParseFailed("Component missing name!", declaration)
        }
        if (!ts.isIdentifier(options.name)) {
            this.errorReporter.reportParseFailed("Invalid property!")
        }
        const parentSymbol = this.typeChecker.getSymbolAtLocation(parentName)!
        const typeNode = ts.factory.createIndexedAccessTypeNode(
            ts.factory.createTypeReferenceNode(this.importer.getQualifiedNameForSymbol(parentSymbol)),
            ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(options.name.text)),
        )
        const resolvedType = this.typeResolver.resolveBoundType(options.type)
        if (options.getter) {
            return ts.factory.createGetAccessorDeclaration(
                [],
                options.name,
                [],
                options.optional && typeNode ? ts.factory.createUnionTypeNode([typeNode, ts.factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword)]) : typeNode,
                ts.factory.createBlock([ts.factory.createReturnStatement(this.getParamExpression(resolvedType))]),
            )
        } else {
            return ts.factory.createMethodDeclaration(
                [],
                undefined,
                options.name,
                undefined,
                [],
                [],
                ts.factory.createTypeReferenceNode(ts.factory.createIdentifier("ReturnType"), [typeNode]),
                ts.factory.createBlock([ts.factory.createReturnStatement(this.getParamExpression(resolvedType))]),
            )
        }
    }

    getProviderDeclaration(provider: InstanceProvider, componentScope?: ComponentScope): ts.ClassElement[] {
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
        parentType: ts.EntityName,
        members: Iterable<ts.ClassElement>,
    ): ts.ClassElement {
        const parentName = factory.declaration.name
        if (!parentName) {
            this.errorReporter.reportParseFailed("Component missing name!", factory.declaration)
        }
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
                    ts.isClassLike(declaration) ? ts.SyntaxKind.ExtendsKeyword : ts.SyntaxKind.ImplementsKeyword,
                    [ts.factory.createExpressionWithTypeArguments(
                        this.importer.getExpressionForDeclaration(declaration),
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
                            ts.factory.createTypeReferenceNode(parentType, undefined),
                            undefined,
                        ), ...factory.factoryParams.map(param =>
                            ts.factory.createParameterDeclaration(
                                [ts.factory.createModifier(ts.SyntaxKind.PrivateKeyword), ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
                                undefined,
                                this.nameGenerator.getPropertyIdentifierForParameter(param.declaration),
                                undefined,
                                factory.factorySymbol
                                    ? paramType(ts.factory.createTypeReferenceNode(this.importer.getQualifiedNameForSymbol(factory.factorySymbol)), param.index)
                                    : this.constructorParamTypeNode(ts.factory.createTypeQueryNode(this.importer.getQualifiedNameForSymbol(symbol)), param.index, symbol),
                                undefined
                            )
                        )],
                        ts.factory.createBlock(
                            [
                                ts.isClassLike(declaration)
                                    ? this.componentSuperCall(declaration, factory.factoryParams)
                                    : undefined
                            ].filter(isNotNull),
                            true
                        )
                    ),
                    ...members,
                ]
            )
        )
    }

    @bound
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
            factory.factorySymbol && ts.factory.createTypeReferenceNode(this.importer.getQualifiedNameForSymbol(factory.factorySymbol)),
            ts.factory.createBlock(
                [
                    ts.factory.createReturnStatement(
                        ts.factory.createArrowFunction(
                            undefined,
                            undefined,
                            factory.factoryParams.map(it =>
                                ts.factory.createParameterDeclaration(
                                    undefined,
                                    undefined,
                                    it.name,
                                    undefined,
                                    factory.factorySymbol
                                        ? undefined
                                        : this.constructorParamTypeNode(
                                            ts.factory.createTypeQueryNode(
                                                ts.factory.createQualifiedName(
                                                    ts.factory.createIdentifier("this"),
                                                    this.nameGenerator.getPropertyIdentifier(factory.subcomponentType),
                                                )
                                            ),
                                            it.index + 1,
                                            factory.subcomponentType.type.symbol,
                                        ),
                                    undefined
                                )
                            ),
                            undefined,
                            ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                            this.createSubcomponentExpression(factory, factory.factoryParams.map(it => ts.factory.createIdentifier(it.name))),
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
        const symbol = this.typeChecker.getSymbolAtLocation(factory.declaration.name!)!
        const typeNode = factory.declaration.name && ts.factory.createTypeQueryNode(this.importer.getQualifiedNameForSymbol(symbol))
        return ts.factory.createMethodDeclaration(
            [ts.factory.createToken(ts.SyntaxKind.PrivateKeyword)],
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
                                        typeNode && this.constructorParamTypeNode(typeNode, it.constructorParamIndex),
                                        undefined,
                                    )
                                ),
                            undefined,
                            ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                            this.createAssistedFactoryExpression(
                                factory,
                                factory.constructorParams
                                    .map(it => {
                                        if (this.nodeDetector.getAssistedAnnotation(it.declaration)) {
                                            const factoryParam = factory.factoryParams
                                                .find(p => p.type === it.type)
                                            if (!factoryParam) throw new Error("Error generating Assisted Factory!")
                                            return ts.factory.createIdentifier(factoryParam.name)
                                        } else {
                                            return this.getParamExpression(it.type)
                                        }
                                    }),
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
            this.importer.getExpressionForDeclaration(factory.declaration),
            undefined,
            params,
        )
    }

    private getSetMultibindingProviderDeclaration(provider: SetMultibinding): ts.ClassElement[] {
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

    private getMapMultibindingProviderDeclaration(provider: MapMultibinding): ts.ClassElement[] {
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
            return ts.factory.createArrayLiteralExpression([asConst(keyExpression), this.getParamExpression(type)], false)
        }
        return this.getParamExpression(type)
    }

    private getterMethodDeclaration(type: QualifiedType, expression: ts.Expression, optional: boolean = false): ts.MethodDeclaration {
        return this.getterMethodDeclarationWithTypeNode(type, undefined, expression, optional)
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

    private getConstructorProviderDeclaration(constructor: InjectableConstructor, componentScope?: ComponentScope): ts.ClassElement[] {
        const self = this
        function constructorCallExpression(): ts.Expression {
            return ts.factory.createNewExpression(
                self.importer.getExpressionForDeclaration(constructor.declaration),
                undefined,
                constructor.parameters.map(it => it.type).map(self.typeResolver.resolveBoundType).map(self.getParamExpression)
            )
        }
        const scope = constructor.scope
        const qualifiedType = createQualifiedType({type: constructor.type})
        const symbol = this.typeChecker.getSymbolAtLocation(constructor.declaration.name!)!
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
                    ts.factory.createTypeReferenceNode(this.importer.getQualifiedNameForSymbol(symbol)),
                    undefined
                ),
                self.getterMethodDeclarationWithTypeNode(
                    qualifiedType,
                    ts.factory.createTypeReferenceNode(this.importer.getQualifiedNameForSymbol(symbol)),
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
        return this.nameGenerator.unsetSymbolName
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
            this.providesMethodExpression(providesMethod),
            undefined,
            providesMethod.parameters.map(it => it.type).map(this.typeResolver.resolveBoundType).map(this.getParamExpression)
        )
    }

    private providesMethodExpression(providesMethod: ProvidesMethod): ts.Expression {
        return ts.factory.createPropertyAccessExpression(
            this.importer.getExpressionForDeclaration(providesMethod.module),
            ts.factory.createIdentifier(providesMethod.declaration.name.getText())
        )
    }

    private getFactoryDeclaration(factory: ProvidesMethod): ts.ClassElement[] {
        const typeNode = this.getFactoryReturnType(factory)
        if (factory.scope) return this.getCachedFactoryDeclaration(factory, typeNode)

        return [this.getterMethodDeclarationWithTypeNode(factory.type, typeNode, this.factoryCallExpression(factory))]
    }

    private getFactoryReturnType(factory: ProvidesMethod): ts.TypeNode {
        const moduleName = factory.module.name
        const methodName = factory.declaration.name
        if (!moduleName || !ts.isIdentifier(methodName)) {
            this.errorReporter.reportParseFailed("Invalid @Provides method!", factory.declaration)
        }
        const moduleSymbol = this.typeChecker.getSymbolAtLocation(moduleName)!
        return functionReturnType(
            ts.factory.createTypeQueryNode(
                ts.factory.createQualifiedName(this.importer.getQualifiedNameForSymbol(moduleSymbol), methodName),
                undefined,
            )
        )
    }

    private getMissingOptionalDeclaration(type: QualifiedType): ts.ClassElement {
        return this.getterMethodDeclarationWithTypeNode(
            type,
            ts.factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
            ts.factory.createVoidExpression(ts.factory.createNumericLiteral(0)),
        )
    }

    private getCachedFactoryDeclaration(factory: ProvidesMethod, typeNode: ts.TypeNode): ts.ClassElement[] {
        return [
            this.getCachedPropertyDeclaration(factory.type, typeNode),
            this.getterMethodDeclarationWithTypeNode(
                factory.type,
                typeNode,
                this.getCachedFactoryCallExpression(factory),
            )
        ]
    }

    private getCachedFactoryCallExpression(providesMethod: ProvidesMethod): ts.Expression {
        const propIdentifier = this.nameGenerator.getPropertyIdentifier(providesMethod.type)
        const nullable = isTypeNullable(providesMethod.type.type)
        return nullable ?
            this.createScopedNullableExpression(propIdentifier, this.factoryCallExpression(providesMethod)) :
            this.createScopedExpression(propIdentifier, this.factoryCallExpression(providesMethod))
    }

    private getCachedPropertyDeclaration(type: QualifiedType, typeNode: ts.TypeNode): ts.ClassElement {
        const propIdentifier = this.nameGenerator.getPropertyIdentifier(type)
        const nullable = isTypeNullable(type.type)
        return ts.factory.createPropertyDeclaration(
            [ts.factory.createToken(ts.SyntaxKind.PrivateKeyword)],
            propIdentifier,
            nullable ? undefined : ts.factory.createToken(ts.SyntaxKind.QuestionToken),
            nullable ? typeNode && ts.factory.createUnionTypeNode([this.typeOfUnsetSymbol(), typeNode]) : typeNode,
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

    private typeOfUnsetSymbol() {
        return ts.factory.createTypeQueryNode(this.nameGenerator.getUnsetSymbolIdentifier(), undefined)
    }

    private constructorParamTypeNode(typeNode: ts.TypeNode, index: number, constructorSymbol?: ts.Symbol) {
        const type = constructorSymbol && this.typeChecker.getTypeOfSymbol(constructorSymbol)
        const isProtected = type && !!type.symbol && !!type.symbol.declarations && type.symbol.declarations.some(declaration => {
            if (ts.isClassDeclaration(declaration)) {
                const constructor = findAllChildren(declaration, ts.isConstructorDeclaration)
                    .find(constructor => constructor.body)
                return constructor && constructor.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ProtectedKeyword || modifier.kind === ts.SyntaxKind.PrivateKeyword)
            }
        })
        if (isProtected) {
            // for protected constructors, we need to intersect with the { new(): never } type to satisfy the type checker
            return constructorParamType(
                ts.factory.createIntersectionTypeNode([
                    ts.factory.createTypeLiteralNode([
                        ts.factory.createConstructSignature(
                            undefined,
                            [],
                            ts.factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword),
                        )
                    ]),
                    typeNode,
                ]),
                index,
            )
        } else {
            return constructorParamType(typeNode, index)
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

function constructorParamType(type: ts.TypeNode, index: number) {
    return ts.factory.createIndexedAccessTypeNode(
        ts.factory.createTypeReferenceNode(
            ts.factory.createIdentifier("ConstructorParameters"),
            [type],
        ),
        ts.factory.createLiteralTypeNode(ts.factory.createNumericLiteral(index)),
    )
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

function functionReturnType(type: ts.TypeNode) {
    return ts.factory.createTypeReferenceNode(
        ts.factory.createIdentifier("ReturnType"),
        [type],
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

function asConst(literalExpression: ts.Expression) {
    return ts.factory.createAsExpression(
        literalExpression,
        ts.factory.createTypeReferenceNode(ts.factory.createIdentifier("const"), undefined),
    )
}
