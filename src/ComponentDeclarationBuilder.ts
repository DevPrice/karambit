import * as ts from "./compiler/index.js"
import {InjectNodeDetector} from "./InjectNodeDetector.js"
import {NameGenerator} from "./NameGenerator.js"
import {Importer} from "./Importer.js"
import {TypeResolver} from "./TypeResolver.js"
import {createQualifiedType, QualifiedType} from "./QualifiedType.js"
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
} from "./Providers.js"
import {ErrorReporter} from "./ErrorReporter.js"
import {bound, isNotNull} from "./Util.js"
import {ComponentDeclaration, ComponentScope, isTypeNullable} from "./TypescriptUtil.js"
import {findAllChildren} from "./Visitor.js"
import {ConstructorHelper} from "./ConstructorHelper.js"

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
        return ts.createClassDeclaration(
            [ts.createToken(ts.SyntaxKind.ExportKeyword)],
            options.identifier,
            [],
            [ts.createHeritageClause(
                ts.isClassLike(options.declaration) ? ts.SyntaxKind.ExtendsKeyword : ts.SyntaxKind.ImplementsKeyword,
                [ts.createExpressionWithTypeArguments(
                    this.importer.getExpressionForSymbol(parentSymbol),
                    undefined
                )]
            )],
            [
                ts.createConstructorDeclaration(
                    undefined,
                    options.factoryParams.map(param =>
                        ts.createParameterDeclaration(
                            [ts.createModifier(ts.SyntaxKind.PrivateKeyword), ts.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
                            undefined,
                            this.nameGenerator.getPropertyIdentifierForParameter(param.declaration),
                            undefined,
                            options.factorySymbol
                                ? paramType(
                                    ts.createTypeReferenceNode(this.importer.getQualifiedNameForSymbol(options.factorySymbol)),
                                    param.index,
                                )
                                : this.constructorParamTypeNode(ts.createTypeQueryNode(this.importer.getQualifiedNameForSymbol(parentSymbol)), param.index, parentSymbol),
                            undefined,
                        )
                    ),
                    ts.createBlock(
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
        return ts.createExpressionStatement(ts.createCallExpression(
            ts.createSuper(),
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
        const typeNode = ts.createIndexedAccessTypeNode(
            ts.createTypeReferenceNode(this.importer.getQualifiedNameForSymbol(parentSymbol)),
            ts.createLiteralTypeNode(ts.createStringLiteral(options.name.text)),
        )
        const resolvedType = this.typeResolver.resolveBoundType(options.type)
        if (options.getter) {
            return ts.createGetAccessorDeclaration(
                [],
                options.name,
                [],
                options.optional && typeNode ? ts.createUnionTypeNode([typeNode, ts.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword)]) : typeNode,
                ts.createBlock([ts.createReturnStatement(this.getParamExpression(resolvedType))]),
            )
        } else {
            return ts.createMethodDeclaration(
                [],
                undefined,
                options.name,
                undefined,
                [],
                [],
                ts.createTypeReferenceNode(ts.createIdentifier("ReturnType"), [typeNode]),
                ts.createBlock([ts.createReturnStatement(this.getParamExpression(resolvedType))]),
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
        const symbol = ts.getTypeSymbol(factory.subcomponentType.type)
        const declaration = symbol.declarations![0]
        return ts.createPropertyDeclaration(
            [ts.createToken(ts.SyntaxKind.PrivateKeyword)],
            this.nameGenerator.getPropertyIdentifier(factory.subcomponentType),
            undefined,
            undefined,
            ts.createClassExpression(
                undefined,
                identifier,
                undefined,
                [ts.createHeritageClause(
                    ts.isClassLike(declaration) ? ts.SyntaxKind.ExtendsKeyword : ts.SyntaxKind.ImplementsKeyword,
                    [ts.createExpressionWithTypeArguments(
                        this.importer.getExpressionForSymbol(symbol),
                        undefined
                    )]
                )],
                [
                    ts.createConstructorDeclaration(
                        undefined,
                        [ts.createParameterDeclaration(
                            [ts.createModifier(ts.SyntaxKind.PrivateKeyword), ts.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
                            undefined,
                            this.nameGenerator.parentName,
                            undefined,
                            ts.createTypeReferenceNode(parentType, undefined),
                            undefined,
                        ), ...factory.factoryParams.map(param =>
                            ts.createParameterDeclaration(
                                [ts.createModifier(ts.SyntaxKind.PrivateKeyword), ts.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
                                undefined,
                                this.nameGenerator.getPropertyIdentifierForParameter(param.declaration),
                                undefined,
                                factory.factorySymbol
                                    ? paramType(ts.createTypeReferenceNode(this.importer.getQualifiedNameForSymbol(factory.factorySymbol)), param.index)
                                    : this.constructorParamTypeNode(ts.createTypeQueryNode(this.importer.getQualifiedNameForSymbol(symbol)), param.index, symbol),
                                undefined
                            )
                        )],
                        ts.createBlock(
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
            return ts.createArrowFunction(
                undefined,
                undefined,
                [],
                undefined,
                ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                this.getParamExpression(qualifiedProvidedType)
            )
        }
        const subcomponentFactory = instanceProvider && instanceProvider.providerType === ProviderType.SUBCOMPONENT_FACTORY
        const assistedFactory = instanceProvider && instanceProvider.providerType === ProviderType.ASSISTED_FACTORY
        const identifier = subcomponentFactory
            ? this.nameGenerator.getSubcomponentFactoryGetterMethodIdentifier(instanceProvider.subcomponentType)
            : (assistedFactory ? this.nameGenerator.getAssistedFactoryGetterMethodIdentifier(instanceProvider.resultType) : this.nameGenerator.getGetterMethodIdentifier(paramType))
        return ts.createCallExpression(
            ts.createPropertyAccessExpression(ts.createThis(), identifier),
            undefined,
            []
        )
    }

    private getSubcomponentFactoryDeclaration(factory: SubcomponentFactory): ts.ClassElement {
        return ts.createMethodDeclaration(
            [ts.createToken(ts.SyntaxKind.PrivateKeyword)],
            undefined,
            this.nameGenerator.getGetterMethodIdentifier(factory.subcomponentType),
            undefined,
            undefined,
            [],
            factory.factorySymbol && ts.createTypeReferenceNode(this.importer.getQualifiedNameForSymbol(factory.factorySymbol)),
            ts.createBlock(
                [
                    ts.createReturnStatement(
                        ts.createArrowFunction(
                            undefined,
                            undefined,
                            factory.factoryParams.map(it =>
                                ts.createParameterDeclaration(
                                    undefined,
                                    undefined,
                                    it.name,
                                    undefined,
                                    factory.factorySymbol
                                        ? undefined
                                        : this.constructorParamTypeNode(
                                            ts.createTypeQueryNode(
                                                ts.createQualifiedName(
                                                    ts.createIdentifier("this"),
                                                    this.nameGenerator.getPropertyIdentifier(factory.subcomponentType),
                                                )
                                            ),
                                            it.index + 1,
                                            ts.getTypeSymbol(factory.subcomponentType.type),
                                        ),
                                    undefined
                                )
                            ),
                            undefined,
                            ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                            this.createSubcomponentExpression(factory, factory.factoryParams.map(it => ts.createIdentifier(it.name))),
                        )
                    )
                ],
                true
            )
        )
    }

    private createSubcomponentExpression(factory: SubcomponentFactory, params: ts.Expression[]): ts.Expression {
        return ts.createNewExpression(
            ts.createPropertyAccessExpression(
                ts.createThis(),
                this.nameGenerator.getPropertyIdentifier(factory.subcomponentType)
            ),
            undefined,
            [ts.createThis(), ...params]
        )
    }

    private getAssistedFactoryDeclaration(factory: AssistedFactory): ts.ClassElement {
        const symbol = this.typeChecker.getSymbolAtLocation(factory.declaration.name!)!
        const typeNode = factory.declaration.name && ts.createTypeQueryNode(this.importer.getQualifiedNameForSymbol(symbol))
        return ts.createMethodDeclaration(
            [ts.createToken(ts.SyntaxKind.PrivateKeyword)],
            undefined,
            this.nameGenerator.getAssistedFactoryGetterMethodIdentifier(factory.resultType),
            undefined,
            undefined,
            [],
            undefined,
            ts.createBlock(
                [
                    ts.createReturnStatement(
                        ts.createArrowFunction(
                            undefined,
                            undefined,
                            factory.factoryParams
                                .map(it =>
                                    ts.createParameterDeclaration(
                                        undefined,
                                        undefined,
                                        it.name,
                                        undefined,
                                        typeNode && this.constructorParamTypeNode(typeNode, it.constructorParamIndex),
                                        undefined,
                                    )
                                ),
                            undefined,
                            ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                            this.createAssistedFactoryExpression(
                                factory,
                                factory.constructorParams
                                    .map(it => {
                                        if (this.nodeDetector.getAssistedAnnotation(it.declaration)) {
                                            const factoryParam = factory.factoryParams
                                                .find(p => p.type === it.type)
                                            if (!factoryParam) throw new Error("Error generating Assisted Factory!")
                                            return ts.createIdentifier(factoryParam.name)
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
        return ts.createNewExpression(
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
            ? ts.createSpreadElement(this.accessParentGetter(provider.type))
            : undefined
        return ts.createNewExpression(
            ts.createIdentifier("Set"),
            undefined,
            [ts.createArrayLiteralExpression(
                provider.elementProviders
                    .map(it => {
                        if (it.isIterableProvider) {
                            return ts.createSpreadElement(this.getParamExpression(it.type))
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
            ? ts.createSpreadElement(this.accessParentGetter(provider.type))
            : undefined
        return ts.createNewExpression(
            ts.createIdentifier("Map"),
            undefined,
            [ts.createArrayLiteralExpression(
                provider.entryProviders
                    .map(entryProvider => {
                        if (entryProvider.isIterableProvider) {
                            return ts.createSpreadElement(this.getMapEntryExpression(entryProvider.type, entryProvider.key))
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
            return ts.createArrayLiteralExpression([asConst(keyExpression), this.getParamExpression(type)], false)
        }
        return this.getParamExpression(type)
    }

    private getterMethodDeclaration(type: QualifiedType, expression: ts.Expression, optional: boolean = false): ts.MethodDeclaration {
        return this.getterMethodDeclarationWithTypeNode(type, undefined, expression, optional)
    }

    private getterMethodDeclarationWithTypeNode(type: QualifiedType, typeNode: ts.TypeNode | undefined, expression: ts.Expression, optional: boolean = false): ts.MethodDeclaration {
        return ts.createMethodDeclaration(
            [ts.createToken(ts.SyntaxKind.PrivateKeyword)],
            undefined,
            this.nameGenerator.getGetterMethodIdentifier(type),
            undefined,
            [],
            [],
            optional && typeNode ? ts.createUnionTypeNode([typeNode, ts.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword)]) : typeNode,
            ts.createBlock([ts.createReturnStatement(expression)])
        )
    }

    private getConstructorProviderDeclaration(constructor: InjectableConstructor, componentScope?: ComponentScope): ts.ClassElement[] {
        const self = this
        function constructorCallExpression(): ts.Expression {
            return ts.createNewExpression(
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
                ts.createPropertyDeclaration(
                    [ts.createToken(ts.SyntaxKind.PrivateKeyword)],
                    propIdentifier,
                    ts.createToken(ts.SyntaxKind.QuestionToken),
                    ts.createTypeReferenceNode(this.importer.getQualifiedNameForSymbol(symbol)),
                    undefined
                ),
                self.getterMethodDeclarationWithTypeNode(
                    qualifiedType,
                    ts.createTypeReferenceNode(this.importer.getQualifiedNameForSymbol(symbol)),
                    ts.createBinaryExpression(
                        ts.createPropertyAccessExpression(
                            ts.createThis(),
                            propIdentifier
                        ),
                        ts.createToken(ts.SyntaxKind.QuestionQuestionToken),
                        ts.createParenthesizedExpression(
                            ts.createBinaryExpression(
                                ts.createPropertyAccessExpression(
                                    ts.createThis(),
                                    propIdentifier
                                ),
                                ts.createToken(ts.SyntaxKind.EqualsToken),
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
        return ts.createBinaryExpression(
            ts.createPropertyAccessExpression(
                ts.createThis(),
                propIdentifier
            ),
            ts.createToken(ts.SyntaxKind.QuestionQuestionToken),
            ts.createParenthesizedExpression(
                ts.createBinaryExpression(
                    ts.createPropertyAccessExpression(
                        ts.createThis(),
                        propIdentifier
                    ),
                    ts.createToken(ts.SyntaxKind.EqualsToken),
                    expression
                )
            )
        )
    }

    private createScopedNullableExpression(propIdentifier: ts.Identifier | ts.PrivateIdentifier, expression: ts.Expression) {
        return ts.createConditionalExpression(
            ts.createBinaryExpression(
                ts.createPropertyAccessExpression(
                    ts.createThis(),
                    propIdentifier
                ),
                ts.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
                this.getUnsetPropertyExpression()
            ),
            ts.createToken(ts.SyntaxKind.QuestionToken),
            ts.createParenthesizedExpression(ts.createBinaryExpression(
                ts.createPropertyAccessExpression(
                    ts.createThis(),
                    propIdentifier
                ),
                ts.createToken(ts.SyntaxKind.EqualsToken),
                expression
            )),
            ts.createToken(ts.SyntaxKind.ColonToken),
            ts.createPropertyAccessExpression(
                ts.createThis(),
                propIdentifier
            )
        )
    }

    private factoryCallExpression(providesMethod: ProvidesMethod): ts.Expression {
        return ts.createCallExpression(
            this.providesMethodExpression(providesMethod),
            undefined,
            providesMethod.parameters.map(it => it.type).map(this.typeResolver.resolveBoundType).map(this.getParamExpression)
        )
    }

    private providesMethodExpression(providesMethod: ProvidesMethod): ts.Expression {
        return ts.createPropertyAccessExpression(
            this.importer.getExpressionForDeclaration(providesMethod.module),
            ts.createIdentifier(providesMethod.declaration.name.getText())
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
            ts.createTypeQueryNode(
                ts.createQualifiedName(this.importer.getQualifiedNameForSymbol(moduleSymbol), methodName),
                undefined,
            )
        )
    }

    private getMissingOptionalDeclaration(type: QualifiedType): ts.ClassElement {
        return this.getterMethodDeclarationWithTypeNode(
            type,
            ts.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
            ts.createVoidExpression(ts.createNumericLiteral(0)),
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
        return ts.createPropertyDeclaration(
            [ts.createToken(ts.SyntaxKind.PrivateKeyword)],
            propIdentifier,
            nullable ? undefined : ts.createToken(ts.SyntaxKind.QuestionToken),
            nullable ? typeNode && ts.createUnionTypeNode([this.typeOfUnsetSymbol(), typeNode]) : typeNode,
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
        return ts.createTypeQueryNode(this.nameGenerator.getUnsetSymbolIdentifier(), undefined)
    }

    private constructorParamTypeNode(typeNode: ts.TypeNode, index: number, constructorSymbol?: ts.Symbol) {
        const type = constructorSymbol && this.typeChecker.getTypeOfSymbol(constructorSymbol)
        const isProtected = type && !!ts.getTypeSymbol(type) && !!ts.getTypeSymbol(type).declarations && ts.getTypeSymbol(type).declarations.some(declaration => {
            if (ts.isClassDeclaration(declaration)) {
                const constructor = findAllChildren(declaration, ts.isConstructorDeclaration)
                    .find(constructor => constructor.body)
                return constructor && constructor.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ProtectedKeyword || modifier.kind === ts.SyntaxKind.PrivateKeyword)
            }
        })
        if (isProtected) {
            // for protected constructors, we need to intersect with the { new(): never } type to satisfy the type checker
            return constructorParamType(
                ts.createIntersectionTypeNode([
                    ts.createTypeLiteralNode([
                        ts.createConstructSignature(
                            undefined,
                            [],
                            ts.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword),
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
        return ts.createCallExpression(
            ts.createPropertyAccessExpression(
                ts.createPropertyAccessExpression(
                    ts.createThis(),
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
    return ts.createIndexedAccessTypeNode(
        ts.createTypeReferenceNode(
            ts.createIdentifier("ConstructorParameters"),
            [type],
        ),
        ts.createLiteralTypeNode(ts.createNumericLiteral(index)),
    )
}

function paramType(type: ts.TypeNode, index: number) {
    return ts.createIndexedAccessTypeNode(
        ts.createTypeReferenceNode(
            ts.createIdentifier("Parameters"),
            [type],
        ),
        ts.createLiteralTypeNode(ts.createNumericLiteral(index)),
    )
}

function functionReturnType(type: ts.TypeNode) {
    return ts.createTypeReferenceNode(
        ts.createIdentifier("ReturnType"),
        [type],
    )
}

function iterableType(type: ts.TypeNode) {
    return ts.createExpressionWithTypeArguments(ts.createIdentifier("Iterable"), [type])
}

function accessDependencyProperty(memberName: ts.Identifier | ts.PrivateIdentifier, propertyName?: string): ts.PropertyAccessExpression {
    const propertyAccess = ts.createPropertyAccessExpression(
        ts.createThis(),
        memberName
    )
    if (!propertyName) {
        return propertyAccess
    }
    return ts.createPropertyAccessExpression(
        propertyAccess,
        ts.createIdentifier(propertyName)
    )
}

function asConst(literalExpression: ts.Expression) {
    return ts.createAsExpression(
        literalExpression,
        ts.createTypeReferenceNode(ts.createIdentifier("const"), undefined),
    )
}
