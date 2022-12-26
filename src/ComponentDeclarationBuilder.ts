import * as ts from "typescript"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {NameGenerator} from "./NameGenerator"
import {Importer} from "./Importer"
import {TypeResolver} from "./TypeResolver"
import {createQualifiedType, QualifiedType} from "./QualifiedType"
import {
    InjectableConstructor,
    InstanceProvider,
    isInjectableConstructor,
    isParentProvider,
    isPropertyProvider,
    isProvidesMethod,
    isSubcomponentFactory,
    PropertyProvider,
    ProviderType,
    ProvidesMethod,
    SubcomponentFactory
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
        this.updateComponentMember = this.updateComponentMember.bind(this)
        this.getParamExpression = this.getParamExpression.bind(this)
    }

    updateComponentMember(member: ts.ClassElement): ts.Node {
        if (ts.isPropertyDeclaration(member) && !member.initializer) {
            const type = createQualifiedType({
                type: this.typeChecker.getTypeAtLocation(member.type ?? member),
                qualifier: this.nodeDetector.getQualifier(member)
            })
            const resolvedType = this.typeResolver.resolveBoundType(type)
            const expression = this.getParamExpression(resolvedType)
            return ts.factory.createGetAccessorDeclaration(
                member.modifiers,
                member.name,
                [],
                member.type,
                ts.factory.createBlock([ts.factory.createReturnStatement(expression)])
            )
        } else if (ts.isConstructorDeclaration(member)) {
            // for some reason decorator metadata isn't stripped (and is invalid) if we
            // use modifiers to ensure these assignments happen
            const initializerStatements = member.parameters.map(param =>
                ts.factory.createExpressionStatement(
                    ts.factory.createBinaryExpression(
                        ts.factory.createPropertyAccessExpression(
                            ts.factory.createThis(),
                            this.nameGenerator.getPropertyIdentifierForParameter(param)
                        ),
                        ts.factory.createToken(ts.SyntaxKind.EqualsToken),
                        ts.factory.createIdentifier(param.name.getText())
                    )
                )
            )
            return ts.factory.updateConstructorDeclaration(
                member,
                member.modifiers,
                member.parameters.map(param =>
                    ts.factory.createParameterDeclaration(
                        ts.getDecorators(param), // see above comment
                        param.dotDotDotToken,
                        param.name,
                        param.questionToken,
                        param.type,
                        param.initializer
                    )
                ),
                member.body ?
                    ts.factory.updateBlock(member.body, [...initializerStatements, ...member.body.statements]) :
                    ts.factory.createBlock(initializerStatements)
            )
        }
        return member
    }

    getProviderDeclaration(provider: InstanceProvider, componentScope?: ts.Symbol): ts.ClassElement[] {
        if (isParentProvider(provider)) return [this.getParentProvidedDeclaration(provider.type)]
        if (isPropertyProvider(provider)) return [this.getComponentProvidedDeclaration(provider)]
        if (isSubcomponentFactory(provider)) return [this.getSubcomponentFactoryDeclaration(provider)]
        if (isProvidesMethod(provider)) return this.getFactoryDeclaration(provider)
        if (isInjectableConstructor(provider)) return this.getConstructorProviderDeclaration(provider, componentScope)
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
        const identifier = subcomponentFactory ?
            this.nameGenerator.getSubcomponentFactoryGetterMethodIdentifier(instanceProvider.subcomponentType) :
            this.nameGenerator.getGetterMethodIdentifier(paramType)
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

    private factoryCallExpression(factory: ProvidesMethod): ts.Expression {
        return ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
                this.getExpressionForDeclaration(factory.module),
                ts.factory.createIdentifier(factory.declaration.name.getText())
            ),
            undefined,
            factory.parameters.map(it => it.type).map(this.typeResolver.resolveBoundType).map(this.getParamExpression)
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
        const propIdentifier = this.nameGenerator.getPropertyIdentifier(factory.type)
        const nullable = this.isTypeNullable(factory.type.type)
        return [
            ts.factory.createPropertyDeclaration(
                undefined,
                propIdentifier,
                undefined,
                undefined,
                nullable ? this.getUnsetPropertyExpression() : undefined
            ),
            this.getterMethodDeclaration(
                factory.type,
                nullable ?
                    this.createScopedNullableExpression(propIdentifier, this.factoryCallExpression(factory)) :
                    this.createScopedExpression(propIdentifier, this.factoryCallExpression(factory))
            )
        ]
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
        if (this.sourceFile === node.getSourceFile()) return ts.factory.createIdentifier(symbol.getName())

        return ts.factory.createPropertyAccessExpression(
            ts.factory.getGeneratedNameForNode(this.importer.getImportForSymbol(symbol)),
            ts.factory.createIdentifier(symbol.getName())
        )
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
