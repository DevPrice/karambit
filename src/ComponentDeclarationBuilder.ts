import * as ts from "typescript"
import {ProviderMethod} from "./ModuleLocator"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {NameGenerator} from "./NameGenerator"
import {PropertyProvider} from "./DependencyGraphBuilder"
import {Importer} from "./Importer"
import {ConstructorHelper} from "./ConstructorHelper"
import {Resolver} from "./Resolver"
import {createQualifiedType, QualifiedType, qualifiedTypeToString} from "./QualifiedType"
import {Container} from "./Util"
import {SubcomponentFactory, SubcomponentFactoryLocator} from "./SubcomponentFactoryLocator"

export class ComponentDeclarationBuilder {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly context: ts.TransformationContext,
        private readonly sourceFile: ts.SourceFile,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly nameGenerator: NameGenerator,
        private readonly importer: Importer,
        private readonly constructorHelper: ConstructorHelper,
        private readonly typeResolver: Resolver<QualifiedType>,
        private readonly dependencyMap: ReadonlyMap<QualifiedType, PropertyProvider>,
        private readonly factoryMap: ReadonlyMap<QualifiedType, ProviderMethod>,
        private readonly subcomponentFactoryLocator: SubcomponentFactoryLocator,
        private readonly parentProviders: Container<QualifiedType> = new Set(),
        private readonly optionalTypes: Container<QualifiedType> = new Set(),
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
                undefined,
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
                member.decorators,
                member.modifiers,
                member.parameters.map(param =>
                    ts.factory.createParameterDeclaration(
                        param.decorators,
                        undefined, // see above comment
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

    getProviderDeclaration(type: QualifiedType, componentScope?: ts.Symbol): ts.ClassElement[] {
        if (this.nodeDetector.isProvider(type.type)) return []
        if (this.parentProviders.has(type)) return [this.getParentProvidedDeclaration(type)]
        const componentProvider = this.dependencyMap.get(type)
        if (componentProvider) return [this.getComponentProvidedDeclaration(componentProvider)]
        const sub = this.subcomponentFactoryLocator.asSubcomponentFactory(type.type)
        if (sub) return [this.getSubcomponentFactoryDeclaration(sub)]
        const factory = this.factoryMap.get(type)
        if (factory) return this.getFactoryDeclaration(factory)
        if (this.optionalTypes.has(type)) return [this.getMissingOptionalDeclaration(type)]
        return this.getConstructorProviderDeclaration(type, componentScope)
    }

    declareSubcomponent(
        factory: SubcomponentFactory,
        members: Iterable<ts.ClassElement>,
    ): ts.ClassElement {
        const symbol = factory.subcomponentType.type.symbol
        const declaration = symbol.declarations![0]
        return ts.factory.createPropertyDeclaration(
            undefined,
            undefined,
            this.nameGenerator.getPropertyIdentifier(factory.subcomponentType),
            undefined,
            undefined,
            ts.factory.createClassExpression(
                undefined,
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
                        undefined,
                        [ts.factory.createParameterDeclaration(
                            undefined,
                            [ts.factory.createModifier(ts.SyntaxKind.PrivateKeyword), ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
                            undefined,
                            this.nameGenerator.parentName,
                            undefined,
                            undefined,
                            undefined
                        ), ...factory.constructorParams.map(param =>
                            ts.factory.createParameterDeclaration(
                                undefined,
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
        if (this.parentProviders.has(paramType)) {
            return this.accessParentGetter(paramType)
        }
        const subcomponentFactory = this.subcomponentFactoryLocator.asSubcomponentFactory(paramType.type)
        const identifier = subcomponentFactory ?
            this.nameGenerator.getSubcomponentFactoryGetterMethodIdentifier(subcomponentFactory.subcomponentType) :
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

    private getConstructorProviderDeclaration(type: QualifiedType, componentScope?: ts.Symbol): ts.ClassElement[] {
        const symbol = type.type.getSymbol() ?? type.type.aliasSymbol
        if (!symbol) throw new Error(`Couldn't find a constructor for type ${qualifiedTypeToString(type)}`)
        const self = this
        function constructorCallExpression(): ts.Expression {
            return ts.factory.createNewExpression(
                self.getExpressionForDeclaration(declaration),
                undefined,
                params.map(it => it.type).map(self.typeResolver.resolveBoundType).map(self.getParamExpression)
            )
        }
        const params = this.constructorHelper.getInjectConstructorParams(type.type) ?? []
        if (!params) throw new Error(`Can't find injectable constructor for type: ${this.typeChecker.typeToString(type.type)}`)
        const declaration = symbol.getDeclarations()![0]
        const scope = this.nodeDetector.getScope(declaration)
        if (scope) {
            if (!this.nodeDetector.isReusableScope(scope) && scope !== componentScope) {
                throw new Error(`Invalid scope for ${self.typeChecker.typeToString(type.type)}! Got: ${scope.getName()}, expected: ${componentScope?.getName() ?? "No scope"}`)
            }
            const propIdentifier = self.nameGenerator.getPropertyIdentifier(type)
            return [
                ts.factory.createPropertyDeclaration(
                    undefined,
                    undefined,
                    propIdentifier,
                    undefined,
                    undefined,
                    undefined
                ),
                self.getterMethodDeclaration(
                    type,
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
        return [self.getterMethodDeclaration(type, constructorCallExpression())]
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

    private factoryCallExpression(factory: ProviderMethod): ts.Expression {
        return ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
                this.getExpressionForDeclaration(factory.module),
                ts.factory.createIdentifier(factory.method.name.getText())
            ),
            undefined,
            factory.parameters.map(it => it.type).map(this.typeResolver.resolveBoundType).map(this.getParamExpression)
        )
    }

    private getFactoryDeclaration(factory: ProviderMethod): ts.ClassElement[] {
        if (factory.scope) return this.getCachedFactoryDeclaration(factory)
        return [this.getterMethodDeclaration(factory.returnType, this.factoryCallExpression(factory))]
    }

    private getMissingOptionalDeclaration(type: QualifiedType): ts.ClassElement {
        return this.getterMethodDeclaration(type, ts.factory.createVoidExpression(ts.factory.createNumericLiteral(0)))
    }

    private isTypeNullable(type: ts.Type): boolean {
        if (type.flags & ts.TypeFlags.Null || type.flags & ts.TypeFlags.Undefined) return true
        return type.isUnionOrIntersection() && type.types.some(it => this.isTypeNullable(it))
    }

    private getCachedFactoryDeclaration(factory: ProviderMethod): ts.ClassElement[] {
        const propIdentifier = this.nameGenerator.getPropertyIdentifier(factory.returnType)
        const nullable = this.isTypeNullable(factory.returnType.type)
        return [
            ts.factory.createPropertyDeclaration(
                undefined,
                undefined,
                propIdentifier,
                undefined,
                undefined,
                nullable ? this.getUnsetPropertyExpression() : undefined
            ),
            this.getterMethodDeclaration(
                factory.returnType,
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
