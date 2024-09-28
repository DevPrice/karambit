var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
import * as ts from "typescript";
import { createQualifiedType } from "./QualifiedType";
import { ProviderType } from "./Providers";
import { AssistedInject } from "karambit-inject";
let ComponentDeclarationBuilder = (() => {
    let _classDecorators = [AssistedInject];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var ComponentDeclarationBuilder = _classThis = class {
        constructor(typeChecker, nodeDetector, nameGenerator, importer, errorReporter, typeResolver, instanceProviders) {
            this.typeChecker = typeChecker;
            this.nodeDetector = nodeDetector;
            this.nameGenerator = nameGenerator;
            this.importer = importer;
            this.errorReporter = errorReporter;
            this.typeResolver = typeResolver;
            this.instanceProviders = instanceProviders;
            this.getParamExpression = this.getParamExpression.bind(this);
        }
        declareComponent(options) {
            return ts.factory.createClassDeclaration([ts.factory.createToken(ts.SyntaxKind.ExportKeyword)], this.nameGenerator.getComponentIdentifier(options.componentType, options.preferredClassName), [], [ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [ts.factory.createExpressionWithTypeArguments(this.getExpressionForDeclaration(options.declaration), undefined)])], [
                ts.factory.createConstructorDeclaration(undefined, options.constructorParams.map(param => ts.factory.createParameterDeclaration([ts.factory.createModifier(ts.SyntaxKind.PrivateKeyword), ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)], undefined, this.nameGenerator.getPropertyIdentifierForParameter(param.declaration), undefined, this.typeToTypeNode(this.typeChecker.getTypeAtLocation(param.declaration)), undefined)), ts.factory.createBlock([ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createSuper(), undefined, options.constructorParams.map(param => this.nameGenerator.getPropertyIdentifierForParameter(param.declaration))))], true)),
                ...options.members,
            ]);
        }
        declareComponentProperty(options) {
            const resolvedType = this.typeResolver.resolveBoundType(options.type);
            const expression = this.getParamExpression(resolvedType);
            return ts.factory.createGetAccessorDeclaration([], options.name, [], this.typeToTypeNode(options.type.type), ts.factory.createBlock([ts.factory.createReturnStatement(expression)]));
        }
        getProviderDeclaration(provider, componentScope) {
            if (provider.providerType == ProviderType.PARENT)
                return [this.getParentProvidedDeclaration(provider.type)];
            if (provider.providerType == ProviderType.PROPERTY)
                return [this.getComponentProvidedDeclaration(provider)];
            if (provider.providerType == ProviderType.SUBCOMPONENT_FACTORY)
                return [this.getSubcomponentFactoryDeclaration(provider)];
            if (provider.providerType == ProviderType.ASSISTED_FACTORY)
                return [this.getAssistedFactoryDeclaration(provider)];
            if (provider.providerType == ProviderType.PROVIDES_METHOD)
                return this.getFactoryDeclaration(provider);
            if (provider.providerType == ProviderType.INJECTABLE_CONSTRUCTOR)
                return this.getConstructorProviderDeclaration(provider, componentScope);
            if (provider.providerType == ProviderType.SET_MULTIBINDING)
                return this.getSetMultibindingProviderDeclaration(provider);
            if (provider.providerType == ProviderType.MAP_MULTIBINDING)
                return this.getMapMultibindingProviderDeclaration(provider);
            return [this.getMissingOptionalDeclaration(provider.type)];
        }
        declareSubcomponent(factory, parentType, members) {
            const symbol = factory.subcomponentType.type.symbol;
            const declaration = symbol.declarations[0];
            return ts.factory.createPropertyDeclaration(undefined, this.nameGenerator.getPropertyIdentifier(factory.subcomponentType), undefined, undefined, ts.factory.createClassExpression(undefined, undefined, undefined, [ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [ts.factory.createExpressionWithTypeArguments(this.getExpressionForDeclaration(declaration), undefined)])], [
                ts.factory.createConstructorDeclaration(undefined, [ts.factory.createParameterDeclaration([ts.factory.createModifier(ts.SyntaxKind.PrivateKeyword), ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)], undefined, this.nameGenerator.parentName, undefined, ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword), undefined), ...factory.constructorParams.map(param => ts.factory.createParameterDeclaration([ts.factory.createModifier(ts.SyntaxKind.PrivateKeyword), ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)], undefined, this.nameGenerator.getPropertyIdentifierForParameter(param.declaration), undefined, this.typeToTypeNode(param.type.type), undefined))], ts.factory.createBlock([ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createSuper(), undefined, factory.constructorParams.map(param => this.nameGenerator.getPropertyIdentifierForParameter(param.declaration))))], true)),
                ...members,
            ]));
        }
        getParamExpression(paramType) {
            const instanceProvider = this.instanceProviders.get(paramType);
            const providedType = this.nodeDetector.isProvider(paramType.type);
            if (providedType) {
                const qualifiedProvidedType = createQualifiedType(Object.assign(Object.assign({}, paramType), { type: providedType }));
                return ts.factory.createArrowFunction(undefined, undefined, [], undefined, ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken), this.getParamExpression(qualifiedProvidedType));
            }
            const subcomponentFactory = instanceProvider && instanceProvider.providerType === ProviderType.SUBCOMPONENT_FACTORY;
            const assistedFactory = instanceProvider && instanceProvider.providerType === ProviderType.ASSISTED_FACTORY;
            const identifier = subcomponentFactory
                ? this.nameGenerator.getSubcomponentFactoryGetterMethodIdentifier(instanceProvider.subcomponentType)
                : (assistedFactory ? this.nameGenerator.getAssistedFactoryGetterMethodIdentifier(instanceProvider.resultType) : this.nameGenerator.getGetterMethodIdentifier(paramType));
            return ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(ts.factory.createThis(), identifier), undefined, []);
        }
        getSubcomponentFactoryDeclaration(factory) {
            return ts.factory.createMethodDeclaration(undefined, undefined, this.nameGenerator.getGetterMethodIdentifier(factory.subcomponentType), undefined, undefined, [], undefined, ts.factory.createBlock([
                ts.factory.createReturnStatement(ts.factory.createArrowFunction(undefined, undefined, factory.constructorParams.map(it => ts.factory.createParameterDeclaration(undefined, undefined, it.name, undefined, this.typeToTypeNode(it.type.type), undefined)), undefined, ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken), this.createSubcomponentExpression(factory, factory.constructorParams.map(it => ts.factory.createIdentifier(it.name)))))
            ], true));
        }
        createSubcomponentExpression(factory, params) {
            return ts.factory.createNewExpression(ts.factory.createPropertyAccessExpression(ts.factory.createThis(), this.nameGenerator.getPropertyIdentifier(factory.subcomponentType)), undefined, [ts.factory.createThis(), ...params]);
        }
        getAssistedFactoryDeclaration(factory) {
            return ts.factory.createMethodDeclaration(undefined, undefined, this.nameGenerator.getAssistedFactoryGetterMethodIdentifier(factory.resultType), undefined, undefined, [], undefined, ts.factory.createBlock([
                ts.factory.createReturnStatement(ts.factory.createArrowFunction(undefined, undefined, factory.factoryParams
                    .map(it => ts.factory.createParameterDeclaration(undefined, undefined, it.name, undefined, this.typeToTypeNode(it.type.type), undefined)), undefined, ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken), this.createAssistedFactoryExpression(factory, factory.constructorParams
                    .map(it => {
                    if (it.decorators.some(this.nodeDetector.isAssistedDecorator)) {
                        const factoryParam = factory.factoryParams
                            .find(p => p.type === it.type);
                        if (!factoryParam)
                            throw new Error("Error generating Assisted Factory!");
                        return ts.factory.createIdentifier(factoryParam.name);
                    }
                    else {
                        return this.getParamExpression(it.type);
                    }
                }))))
            ], true));
        }
        createAssistedFactoryExpression(factory, params) {
            return ts.factory.createNewExpression(this.getExpressionForDeclaration(factory.declaration), undefined, params);
        }
        getSetMultibindingProviderDeclaration(provider, componentScope) {
            return [this.getterMethodDeclaration(provider.type, this.createSetMultibindingExpression(provider))];
        }
        createSetMultibindingExpression(provider) {
            const parentAccessExpression = provider.parentBinding
                ? ts.factory.createSpreadElement(this.accessParentGetter(provider.type))
                : undefined;
            return ts.factory.createNewExpression(ts.factory.createIdentifier("Set"), undefined, [ts.factory.createArrayLiteralExpression(provider.elementProviders
                    .map(it => {
                    if (it.isIterableProvider) {
                        return ts.factory.createSpreadElement(this.getParamExpression(it.type));
                    }
                    else {
                        return this.getParamExpression(it.type);
                    }
                })
                    .concat(parentAccessExpression !== null && parentAccessExpression !== void 0 ? parentAccessExpression : []), false)]);
        }
        getMapMultibindingProviderDeclaration(provider, componentScope) {
            return [this.getterMethodDeclaration(provider.type, this.createMapMultibindingExpression(provider))];
        }
        createMapMultibindingExpression(provider) {
            const parentAccessExpression = provider.parentBinding
                ? ts.factory.createSpreadElement(this.accessParentGetter(provider.type))
                : undefined;
            return ts.factory.createNewExpression(ts.factory.createIdentifier("Map"), undefined, [ts.factory.createArrayLiteralExpression(provider.entryProviders
                    .map(entryProvider => {
                    if (entryProvider.isIterableProvider) {
                        return ts.factory.createSpreadElement(this.getMapEntryExpression(entryProvider.type, entryProvider.key));
                    }
                    else {
                        return this.getMapEntryExpression(entryProvider.type, entryProvider.key);
                    }
                })
                    .concat(parentAccessExpression !== null && parentAccessExpression !== void 0 ? parentAccessExpression : []), false)]);
        }
        getMapEntryExpression(type, keyExpression) {
            if (keyExpression) {
                return ts.factory.createArrayLiteralExpression([keyExpression, this.getParamExpression(type)], false);
            }
            return this.getParamExpression(type);
        }
        getterMethodDeclaration(type, expression) {
            return ts.factory.createMethodDeclaration([], undefined, this.nameGenerator.getGetterMethodIdentifier(type), undefined, [], [], this.typeToTypeNode(type.type), ts.factory.createBlock([ts.factory.createReturnStatement(expression)]));
        }
        getConstructorProviderDeclaration(constructor, componentScope) {
            const self = this;
            function constructorCallExpression() {
                return ts.factory.createNewExpression(self.getExpressionForDeclaration(constructor.declaration), undefined, constructor.parameters.map(it => it.type).map(self.typeResolver.resolveBoundType).map(self.getParamExpression));
            }
            const scope = constructor.scope;
            const qualifiedType = createQualifiedType({ type: constructor.type });
            if (scope) {
                if (!this.nodeDetector.isReusableScope(scope) && scope !== componentScope) {
                    this.errorReporter.reportInvalidScope(constructor, componentScope);
                }
                const propIdentifier = self.nameGenerator.getPropertyIdentifier(qualifiedType);
                return [
                    ts.factory.createPropertyDeclaration(undefined, propIdentifier, undefined, this.typeToTypeNode(constructor.type), undefined),
                    self.getterMethodDeclaration(qualifiedType, ts.factory.createBinaryExpression(ts.factory.createPropertyAccessExpression(ts.factory.createThis(), propIdentifier), ts.factory.createToken(ts.SyntaxKind.QuestionQuestionToken), ts.factory.createParenthesizedExpression(ts.factory.createBinaryExpression(ts.factory.createPropertyAccessExpression(ts.factory.createThis(), propIdentifier), ts.factory.createToken(ts.SyntaxKind.EqualsToken), constructorCallExpression()))))
                ];
            }
            return [self.getterMethodDeclaration(qualifiedType, constructorCallExpression())];
        }
        getUnsetPropertyExpression(type) {
            return ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("Symbol"), ts.factory.createIdentifier("for")), type && [this.typeToTypeNode(type)], [ts.factory.createStringLiteral("unset")]);
        }
        createScopedExpression(propIdentifier, expression) {
            return ts.factory.createBinaryExpression(ts.factory.createPropertyAccessExpression(ts.factory.createThis(), propIdentifier), ts.factory.createToken(ts.SyntaxKind.QuestionQuestionToken), ts.factory.createParenthesizedExpression(ts.factory.createBinaryExpression(ts.factory.createPropertyAccessExpression(ts.factory.createThis(), propIdentifier), ts.factory.createToken(ts.SyntaxKind.EqualsToken), expression)));
        }
        createScopedNullableExpression(propIdentifier, expression) {
            return ts.factory.createConditionalExpression(ts.factory.createBinaryExpression(ts.factory.createPropertyAccessExpression(ts.factory.createThis(), propIdentifier), ts.factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken), this.getUnsetPropertyExpression()), ts.factory.createToken(ts.SyntaxKind.QuestionToken), ts.factory.createParenthesizedExpression(ts.factory.createBinaryExpression(ts.factory.createPropertyAccessExpression(ts.factory.createThis(), propIdentifier), ts.factory.createToken(ts.SyntaxKind.EqualsToken), expression)), ts.factory.createToken(ts.SyntaxKind.ColonToken), ts.factory.createPropertyAccessExpression(ts.factory.createThis(), propIdentifier));
        }
        factoryCallExpression(providesMethod) {
            return ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(this.getExpressionForDeclaration(providesMethod.module), ts.factory.createIdentifier(providesMethod.declaration.name.getText())), undefined, providesMethod.parameters.map(it => it.type).map(this.typeResolver.resolveBoundType).map(this.getParamExpression));
        }
        getFactoryDeclaration(factory) {
            if (factory.scope)
                return this.getCachedFactoryDeclaration(factory);
            return [this.getterMethodDeclaration(factory.type, this.factoryCallExpression(factory))];
        }
        getMissingOptionalDeclaration(type) {
            return this.getterMethodDeclaration(type, ts.factory.createVoidExpression(ts.factory.createNumericLiteral(0)));
        }
        isTypeNullable(type) {
            if (type.flags & ts.TypeFlags.Null || type.flags & ts.TypeFlags.Undefined)
                return true;
            return type.isUnionOrIntersection() && type.types.some(it => this.isTypeNullable(it));
        }
        getCachedFactoryDeclaration(factory) {
            return [
                this.getCachedPropertyDeclaration(factory.type),
                this.getterMethodDeclaration(factory.type, this.getCachedFactoryCallExpression(factory))
            ];
        }
        getCachedFactoryCallExpression(providesMethod) {
            const propIdentifier = this.nameGenerator.getPropertyIdentifier(providesMethod.type);
            const nullable = this.isTypeNullable(providesMethod.type.type);
            return nullable ?
                this.createScopedNullableExpression(propIdentifier, this.factoryCallExpression(providesMethod)) :
                this.createScopedExpression(propIdentifier, this.factoryCallExpression(providesMethod));
        }
        getCachedPropertyDeclaration(type) {
            const propIdentifier = this.nameGenerator.getPropertyIdentifier(type);
            const nullable = this.isTypeNullable(type.type);
            return ts.factory.createPropertyDeclaration(undefined, propIdentifier, ts.factory.createToken(ts.SyntaxKind.QuestionToken), this.typeToTypeNode(type.type), nullable ? this.getUnsetPropertyExpression(type.type) : undefined);
        }
        getParentProvidedDeclaration(type) {
            return this.getterMethodDeclaration(type, this.accessParentGetter(type));
        }
        getComponentProvidedDeclaration(provider) {
            return this.getterMethodDeclaration(provider.type, accessDependencyProperty(provider.name, provider.propertyName));
        }
        getExpressionForDeclaration(node) {
            const type = this.typeChecker.getTypeAtLocation(node);
            const symbol = type.getSymbol();
            return this.importer.getExpressionForDeclaration(symbol, node.getSourceFile());
        }
        typeToTypeNode(type, enclosingDeclaration = undefined) {
            type.symbol && this.importer.getImportForSymbol(type.symbol);
            this.importTypeArguments(type);
            return this.typeChecker.typeToTypeNode(type, enclosingDeclaration, undefined);
        }
        importTypeArguments(type) {
            const withTypeArguments = type;
            if (withTypeArguments.typeArguments) {
                withTypeArguments.typeArguments
                    .forEach(it => it && this.typeToTypeNode(it));
            }
        }
        accessParentGetter(type) {
            return ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(ts.factory.createPropertyAccessExpression(ts.factory.createThis(), this.nameGenerator.parentName), this.nameGenerator.getGetterMethodIdentifier(type)), undefined, []);
        }
    };
    __setFunctionName(_classThis, "ComponentDeclarationBuilder");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ComponentDeclarationBuilder = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ComponentDeclarationBuilder = _classThis;
})();
export { ComponentDeclarationBuilder };
function accessDependencyProperty(memberName, propertyName) {
    const propertyAccess = ts.factory.createPropertyAccessExpression(ts.factory.createThis(), memberName);
    if (!propertyName) {
        return propertyAccess;
    }
    return ts.factory.createPropertyAccessExpression(propertyAccess, ts.factory.createIdentifier(propertyName));
}
