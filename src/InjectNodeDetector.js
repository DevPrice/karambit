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
import { Inject, Reusable } from "karambit-inject";
import { createQualifiedType } from "./QualifiedType";
import { ErrorReporter } from "./ErrorReporter";
const injectModuleName = require("../package.json").name;
const injectSourceFileName = require("../package.json").main;
const injectSourceFileNameWithoutExtension = injectSourceFileName.replace(/\..*$/, "");
let InjectNodeDetector = (() => {
    let _classDecorators = [Inject, Reusable];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var InjectNodeDetector = _classThis = class {
        constructor(typeChecker, karambitOptions, errorReporter) {
            this.typeChecker = typeChecker;
            this.karambitOptions = karambitOptions;
            this.errorReporter = errorReporter;
            this.isCreateComponentCall = this.isCreateComponentCall.bind(this);
            this.isScopeDecorator = this.isScopeDecorator.bind(this);
            this.isScope = this.isScope.bind(this);
            this.isQualifier = this.isQualifier.bind(this);
            this.isQualifierDecorator = this.isQualifierDecorator.bind(this);
            this.isComponentDecorator = this.isComponentDecorator.bind(this);
            this.isSubcomponentDecorator = this.isSubcomponentDecorator.bind(this);
            this.isAssistedDecorator = this.isAssistedDecorator.bind(this);
            this.isAssistedInjectDecorator = this.isAssistedInjectDecorator.bind(this);
            this.isProvidesDecorator = this.isProvidesDecorator.bind(this);
            this.isBindsDecorator = this.isBindsDecorator.bind(this);
            this.isBindsInstanceDecorator = this.isBindsInstanceDecorator.bind(this);
            this.isInjectDecorator = this.isInjectDecorator.bind(this);
            this.isModuleDecorator = this.isModuleDecorator.bind(this);
            this.isIntoSetDecorator = this.isIntoSetDecorator.bind(this);
            this.isIntoMapDecorator = this.isIntoMapDecorator.bind(this);
            this.isElementsIntoSetDecorator = this.isElementsIntoSetDecorator.bind(this);
            this.isElementsIntoMapDecorator = this.isElementsIntoMapDecorator.bind(this);
            this.isMapKeyDecorator = this.isMapKeyDecorator.bind(this);
            this.isCompileTimeConstant = this.isCompileTimeConstant.bind(this);
            this.isEraseable = this.isEraseable.bind(this);
            this.eraseInjectRuntime = this.eraseInjectRuntime.bind(this);
        }
        isCreateComponentCall(expression) {
            if (this.getKarambitNodeName(expression) === "createComponent") {
                return this.typeChecker.getTypeAtLocation(expression);
            }
        }
        isGetConstructorCall(expression) {
            if (this.getKarambitNodeName(expression) === "getConstructor") {
                const symbol = this.typeChecker.getSymbolAtLocation(expression.arguments[0]);
                const type = (symbol === null || symbol === void 0 ? void 0 : symbol.valueDeclaration) && this.typeChecker.getTypeAtLocation(symbol.valueDeclaration);
                if (type)
                    return type;
                this.errorReporter.reportParseFailed("Unable to parse getComponent call!", expression);
            }
        }
        isScopeDecorator(decorator) {
            if (!ts.isDecorator(decorator))
                return false;
            const type = this.typeChecker.getTypeAtLocation(decorator.expression);
            return this.isScope(type);
        }
        getScope(item) {
            var _a, _b, _c;
            const scopeDecorators = (_b = (_a = item.modifiers) === null || _a === void 0 ? void 0 : _a.filter(this.isScopeDecorator).map(it => this.typeChecker.getSymbolAtLocation(it.expression)).filterNotNull()) !== null && _b !== void 0 ? _b : [];
            if (scopeDecorators.length > 1)
                ErrorReporter.reportParseFailed(`Scoped element may only have one scope! ${(_c = item.name) === null || _c === void 0 ? void 0 : _c.getText()} has ${scopeDecorators.length}.`);
            const [symbol] = scopeDecorators;
            return this.getAliasedSymbol(symbol);
        }
        isScope(type) {
            var _a;
            const symbol = (_a = type.getSymbol()) !== null && _a !== void 0 ? _a : type.aliasSymbol;
            return ((symbol === null || symbol === void 0 ? void 0 : symbol.getName()) === "ScopeDecorator" || (symbol === null || symbol === void 0 ? void 0 : symbol.getName()) === "ReusableScopeDecorator") && this.isInjectSymbol(symbol);
        }
        isQualifierDecorator(decorator) {
            if (!ts.isDecorator(decorator))
                return false;
            const type = this.typeChecker.getTypeAtLocation(decorator.expression);
            return this.isQualifier(type) || this.isNamedQualifier(type);
        }
        getQualifier(item) {
            var _a, _b, _c;
            const qualifierDecorators = (_b = (_a = item.modifiers) === null || _a === void 0 ? void 0 : _a.filter(this.isQualifierDecorator)) !== null && _b !== void 0 ? _b : [];
            if (qualifierDecorators.length > 1)
                ErrorReporter.reportParseFailed(`Qualified element may only have one qualifier! ${(_c = item.name) === null || _c === void 0 ? void 0 : _c.getText()} has ${qualifierDecorators.length}.`);
            if (qualifierDecorators.length === 0)
                return undefined;
            const qualifier = qualifierDecorators[0];
            const type = this.typeChecker.getTypeAtLocation(qualifier.expression);
            if (this.isNamedQualifier(type)) {
                return this.getQualifierName(qualifier);
            }
            const qualifierSymbol = this.typeChecker.getSymbolAtLocation(qualifier.expression);
            return qualifierSymbol && this.getAliasedSymbol(qualifierSymbol);
        }
        isQualifier(type) {
            var _a;
            const symbol = (_a = type.getSymbol()) !== null && _a !== void 0 ? _a : type.aliasSymbol;
            return (symbol === null || symbol === void 0 ? void 0 : symbol.getName()) === "QualifierDecorator" && this.isInjectSymbol(symbol);
        }
        isNamedQualifier(type) {
            var _a;
            const symbol = (_a = type.getSymbol()) !== null && _a !== void 0 ? _a : type.aliasSymbol;
            return (symbol === null || symbol === void 0 ? void 0 : symbol.getName()) === "NamedQualifierDecorator" && this.isInjectSymbol(symbol);
        }
        getQualifierName(decorator) {
            if (ts.isCallExpression(decorator.expression)) {
                const literal = decorator.expression.getChildren()
                    .flatMap(it => it.kind === ts.SyntaxKind.SyntaxList ? it.getChildren() : [it])
                    .find(ts.isStringLiteral);
                if (literal) {
                    return this.resolveStringLiteral(literal);
                }
            }
            return undefined;
        }
        isComponentDecorator(decorator) {
            return this.isKarambitDecorator(decorator, "Component");
        }
        isSubcomponentDecorator(decorator) {
            return this.isKarambitDecorator(decorator, "Subcomponent");
        }
        isAssistedDecorator(decorator) {
            return this.isKarambitDecorator(decorator, "Assisted");
        }
        isAssistedInjectDecorator(decorator) {
            return this.isKarambitDecorator(decorator, "AssistedInject");
        }
        isProvidesDecorator(decorator) {
            return this.isKarambitDecorator(decorator, "Provides");
        }
        isBindsDecorator(decorator) {
            return this.isKarambitDecorator(decorator, "Binds");
        }
        isBindsInstanceDecorator(decorator) {
            return this.isKarambitDecorator(decorator, "BindsInstance");
        }
        isInjectDecorator(decorator) {
            return this.isKarambitDecorator(decorator, "Inject");
        }
        isModuleDecorator(decorator) {
            return this.isKarambitDecorator(decorator, "Module");
        }
        isIntoSetDecorator(decorator) {
            return this.isKarambitDecorator(decorator, "IntoSet");
        }
        isIntoMapDecorator(decorator) {
            return this.isKarambitDecorator(decorator, "IntoMap");
        }
        isElementsIntoSetDecorator(decorator) {
            return this.isKarambitDecorator(decorator, "ElementsIntoSet");
        }
        isElementsIntoMapDecorator(decorator) {
            return this.isKarambitDecorator(decorator, "ElementsIntoMap");
        }
        isMapKeyDecorator(decorator) {
            return this.isKarambitDecorator(decorator, "MapKey");
        }
        getMapBindingInfo(returnType, declaration) {
            const keyInfo = this.getMapKey(declaration);
            if (keyInfo)
                return Object.assign(Object.assign({}, keyInfo), { valueType: returnType });
            return this.getMapTupleBindingInfo(returnType);
        }
        getMapTupleBindingInfo(returnType) {
            var _a;
            const type = returnType.type;
            if (type.target && type.target.fixedLength === 2) {
                const typeArgs = (_a = type.resolvedTypeArguments) !== null && _a !== void 0 ? _a : [];
                if (typeArgs.length === 2) {
                    return { keyType: typeArgs[0], valueType: createQualifiedType(Object.assign(Object.assign({}, returnType), { type: typeArgs[1] })) };
                }
            }
            return undefined;
        }
        getMapKey(declaration) {
            var _a;
            const decorators = (_a = declaration.modifiers) === null || _a === void 0 ? void 0 : _a.filter(this.isMapKeyDecorator);
            if (!decorators || decorators.length !== 1)
                return undefined;
            const decorator = decorators[0];
            if (ts.isCallExpression(decorator.expression)) {
                const argument = decorator.expression.arguments[0];
                if (!argument)
                    return undefined;
                if (!this.isCompileTimeConstant(argument))
                    this.errorReporter.reportParseFailed("@MapKey argument must be a literal!", decorator);
                const keyTypeNode = decorator.expression.typeArguments
                    ? decorator.expression.typeArguments[0]
                    : undefined;
                const keyType = keyTypeNode ? this.typeChecker.getTypeAtLocation(keyTypeNode) : undefined;
                return {
                    keyType: keyType !== null && keyType !== void 0 ? keyType : this.typeChecker.getBaseTypeOfLiteralType(this.typeChecker.getTypeAtLocation(argument)),
                    expression: argument,
                };
            }
        }
        isKarambitDecorator(decorator, name) {
            return ts.isDecorator(decorator) && this.getKarambitNodeName(decorator) === name;
        }
        isCompileTimeConstant(expression) {
            return expression.kind === ts.SyntaxKind.NumericLiteral
                || expression.kind === ts.SyntaxKind.BigIntLiteral
                || expression.kind === ts.SyntaxKind.StringLiteral
                || expression.kind === ts.SyntaxKind.BooleanKeyword
                || (ts.isObjectLiteralExpression(expression) && expression.properties.every(it => it.kind === ts.SyntaxKind.PropertyAssignment && this.isCompileTimeConstant(it.initializer)))
                || (ts.isArrayLiteralExpression(expression) && expression.elements.every(this.isCompileTimeConstant));
        }
        isProvider(type) {
            return this.isKarambitGenericType(type, "Provider");
        }
        isSubcomponentFactory(type) {
            return this.isKarambitGenericType(type, "SubcomponentFactory");
        }
        isKarambitGenericType(type, typeName) {
            var _a, _b;
            const symbol = type.getSymbol();
            if ((symbol === null || symbol === void 0 ? void 0 : symbol.getName()) === typeName && this.isInjectSymbol(symbol)) {
                const typeArguments = (_b = (_a = type === null || type === void 0 ? void 0 : type.resolvedTypeArguments) !== null && _a !== void 0 ? _a : type.aliasTypeArguments) !== null && _b !== void 0 ? _b : [];
                if (typeArguments.length != 1)
                    ErrorReporter.reportParseFailed(`Invalid ${typeName} type!`);
                return typeArguments[0];
            }
        }
        isReadonlySet(type) {
            var _a, _b;
            const symbol = type.getSymbol();
            if ((symbol === null || symbol === void 0 ? void 0 : symbol.getName()) === "ReadonlySet") {
                const typeArguments = (_b = (_a = type === null || type === void 0 ? void 0 : type.resolvedTypeArguments) !== null && _a !== void 0 ? _a : type.aliasTypeArguments) !== null && _b !== void 0 ? _b : [];
                if (typeArguments.length != 1)
                    ErrorReporter.reportParseFailed("Invalid ReadonlySet type!");
                return typeArguments[0];
            }
        }
        isReadonlyMap(type) {
            var _a, _b;
            const symbol = type.getSymbol();
            if ((symbol === null || symbol === void 0 ? void 0 : symbol.getName()) === "ReadonlyMap") {
                const typeArguments = (_b = (_a = type === null || type === void 0 ? void 0 : type.resolvedTypeArguments) !== null && _a !== void 0 ? _a : type.aliasTypeArguments) !== null && _b !== void 0 ? _b : [];
                if (typeArguments.length != 2)
                    ErrorReporter.reportParseFailed("Invalid ReadonlyMap type!");
                return typeArguments;
            }
        }
        isIterable(type) {
            var _a, _b;
            const iterator = type.getProperties().find(it => it.name.startsWith("__@iterator@"));
            const iterableType = (iterator === null || iterator === void 0 ? void 0 : iterator.valueDeclaration) && this.typeChecker.getTypeOfSymbolAtLocation(iterator, iterator === null || iterator === void 0 ? void 0 : iterator.valueDeclaration);
            if (iterableType) {
                const iteratorTypes = this.typeChecker.getSignaturesOfType(iterableType, ts.SignatureKind.Call).map(this.typeChecker.getReturnTypeOfSignature);
                if (iteratorTypes.length !== 1)
                    this.errorReporter.reportParseFailed(`Invalid Iterable type: ${this.typeChecker.typeToString(type)}!`);
                const iteratorType = iteratorTypes[0];
                const typeArguments = (_b = (_a = iteratorType === null || iteratorType === void 0 ? void 0 : iteratorType.resolvedTypeArguments) !== null && _a !== void 0 ? _a : type.aliasTypeArguments) !== null && _b !== void 0 ? _b : [];
                if (typeArguments.length != 1)
                    this.errorReporter.reportParseFailed(`Invalid Iterable type: ${this.typeChecker.typeToString(type)}!`);
                return typeArguments[0];
            }
        }
        getIdentifiers(node) {
            try {
                for (const child of node.getChildren()) {
                    if (ts.isPropertyAccessExpression(child)) {
                        return child.getChildren().filter(ts.isIdentifier);
                    }
                    if (ts.isIdentifier(child))
                        return [child];
                    if (ts.isCallExpression(child)) {
                        if (ts.isPropertyAccessExpression(child.expression)) {
                            return child.expression.getChildren().filter(ts.isIdentifier);
                        }
                        return [child.getChildren().find(ts.isIdentifier)].filterNotNull();
                    }
                }
            }
            catch (e) {
                // getChildren may throw for synthetic nodes (which we can safely ignore)
            }
            return [];
        }
        isReusableScope(symbol) {
            const declaration = symbol.declarations && symbol.declarations[0];
            const type = declaration && this.typeChecker.getTypeAtLocation(declaration);
            const typeSymbol = type === null || type === void 0 ? void 0 : type.symbol;
            return (typeSymbol === null || typeSymbol === void 0 ? void 0 : typeSymbol.name) == "ReusableScopeDecorator" && this.isInjectSymbol(typeSymbol);
        }
        isInjectionModuleImport(node) {
            return ts.isImportDeclaration(node) && node.getChildren().some(child => ts.isStringLiteral(child) && this.resolveStringLiteral(child) === injectModuleName);
        }
        isEraseable(node) {
            return this.isScopeDecorator(node) ||
                this.isQualifierDecorator(node) ||
                (this.karambitOptions.stripImports && this.isInjectionModuleImport(node)) ||
                (ts.isDecorator(node) && this.getKarambitNodeName(node) !== undefined);
        }
        eraseInjectRuntime(node, ctx) {
            const detector = this;
            function visitNode(n) {
                var _a;
                if (detector.isEraseable(n)) {
                    return undefined;
                }
                if (ts.isVariableDeclaration(n)) {
                    // TODO: Replace calls to Scope() and Qualifier() instead
                    const type = detector.typeChecker.getTypeAtLocation((_a = n.type) !== null && _a !== void 0 ? _a : n);
                    if (detector.isScope(type) || detector.isQualifier(type)) {
                        return ts.factory.updateVariableDeclaration(n, n.name, n.exclamationToken, n.type, ts.factory.createArrowFunction(undefined, undefined, [], undefined, ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken), ts.factory.createBlock([], false)));
                    }
                }
                return ts.visitEachChild(n, visitNode, ctx);
            }
            return ts.visitEachChild(node, visitNode, ctx);
        }
        isInjectSymbol(symbol) {
            var _a;
            const aliasedSymbol = this.getAliasedSymbol(symbol);
            const declarations = (_a = aliasedSymbol.getDeclarations()) !== null && _a !== void 0 ? _a : [];
            for (const declaration of declarations) {
                const sourceWithoutExtension = declaration.getSourceFile().fileName.replace(/\..*$/, "");
                if (sourceWithoutExtension.endsWith(injectSourceFileNameWithoutExtension))
                    return true;
            }
            return false;
        }
        getKarambitNodeName(node) {
            var _a;
            const identifiers = this.getIdentifiers(node);
            if (identifiers.length === 1) {
                const [identifier] = identifiers;
                const symbol = this.typeChecker.getSymbolAtLocation(identifier);
                const aliasedSymbol = symbol && this.getAliasedSymbol(symbol);
                return (aliasedSymbol && this.isInjectSymbol(aliasedSymbol)) ? aliasedSymbol === null || aliasedSymbol === void 0 ? void 0 : aliasedSymbol.getName() : undefined;
            }
            else if (identifiers.length === 2) {
                const [namespace, identifier] = identifiers;
                const symbol = this.typeChecker.getSymbolAtLocation(namespace);
                const aliasedSymbol = symbol && this.getAliasedSymbol(symbol);
                return (aliasedSymbol && this.isInjectSymbol(aliasedSymbol)) ? (_a = this.typeChecker.getSymbolAtLocation(identifier)) === null || _a === void 0 ? void 0 : _a.getName() : undefined;
            }
            return undefined;
        }
        getAliasedSymbol(symbol) {
            // this throws for unknown reasons?
            try {
                return this.typeChecker.getAliasedSymbol(symbol);
            }
            catch (_a) {
                return symbol;
            }
        }
        getPropertyNode(decorator, propertyName) {
            if (ts.isCallExpression(decorator.expression)) {
                if (decorator.expression.arguments.length === 1) {
                    const componentInfo = decorator.expression.arguments[0];
                    if (ts.isObjectLiteralExpression(componentInfo)) {
                        for (const child of componentInfo.getChildren().flatMap(it => it.kind === ts.SyntaxKind.SyntaxList ? it.getChildren() : [it])) {
                            if (ts.isPropertyAssignment(child) && child.name.getText() === propertyName) {
                                return child.initializer;
                            }
                        }
                    }
                }
            }
        }
        getStringPropertyNode(decorator, propertyName) {
            const valueExpression = this.getPropertyNode(decorator, propertyName);
            if (valueExpression) {
                if (!ts.isStringLiteral(valueExpression))
                    this.errorReporter.reportParseFailed(`${propertyName} must be a string literal!`, decorator);
                return this.resolveStringLiteral(valueExpression);
            }
        }
        getBooleanPropertyNode(decorator, propertyName) {
            const valueExpression = this.getPropertyNode(decorator, propertyName);
            if (valueExpression) {
                if (valueExpression.kind === ts.SyntaxKind.TrueKeyword)
                    return true;
                if (valueExpression.kind === ts.SyntaxKind.FalseKeyword)
                    return false;
                this.errorReporter.reportParseFailed(`${propertyName} must be a boolean literal!`, decorator);
            }
        }
        resolveStringLiteral(literal) {
            const match = literal.getText().match(/^['"](.*)['"]$/);
            if (!match || match.length < 2)
                throw ErrorReporter.reportParseFailed(`Failed to resolve string literal: ${literal.getText()}`);
            return match[1];
        }
    };
    __setFunctionName(_classThis, "InjectNodeDetector");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        InjectNodeDetector = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return InjectNodeDetector = _classThis;
})();
export { InjectNodeDetector };
