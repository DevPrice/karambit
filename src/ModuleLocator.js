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
import { Inject, Reusable } from "karambit-inject";
import { ProviderType } from "./Providers";
let ModuleLocator = (() => {
    let _classDecorators = [Inject, Reusable];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var ModuleLocator = _classThis = class {
        constructor(typeChecker, context, nodeDetector, errorReporter) {
            this.typeChecker = typeChecker;
            this.context = context;
            this.nodeDetector = nodeDetector;
            this.errorReporter = errorReporter;
        }
        getInstalledModules(decorator) {
            const installedModules = this.getSymbolList(decorator, "modules");
            return this.withIncludedModules(installedModules);
        }
        getInstalledSubcomponents(decorator) {
            return this.getSymbolList(decorator, "subcomponents");
        }
        getGeneratedClassName(decorator) {
            return this.nodeDetector.getStringPropertyNode(decorator, "generatedClassName");
        }
        withIncludedModules(symbols) {
            const directlyReferencedModules = this.getModuleMap(symbols);
            const errorReporter = this.errorReporter;
            function withIncludedModules(symbol) {
                const module = directlyReferencedModules.get(symbol);
                if (!module)
                    throw errorReporter.reportParseFailed(`Module missing for symbol: ${symbol.getName()}`);
                return [module, ...module.includes.flatMap(it => withIncludedModules(it))];
            }
            return symbols.flatMap(it => withIncludedModules(it));
        }
        getModuleMap(symbols) {
            const distinctSourceFiles = new Set(symbols.flatMap(it => { var _a; return (_a = it.getDeclarations()) !== null && _a !== void 0 ? _a : []; })
                .flatMap(it => it.getSourceFile()));
            return this.getModules(distinctSourceFiles);
        }
        getModules(nodes) {
            const modules = new Map();
            const self = this;
            function visitModule(node) {
                const symbol = self.typeChecker.getTypeAtLocation(node).getSymbol();
                const moduleDecorator = node.modifiers.find(self.nodeDetector.isModuleDecorator);
                const includes = self.getSymbolList(moduleDecorator, "includes");
                const { factories, bindings } = self.getFactoriesAndBindings(node);
                modules.set(symbol, { includes, factories, bindings });
                const distinct = new Set(includes.flatMap(it => { var _a; return (_a = it.getDeclarations()) !== null && _a !== void 0 ? _a : []; })
                    .map(it => it.getSourceFile())
                    .filter(it => !nodes.has(it)));
                self.getModules(distinct)
                    .forEach((module, symbol) => modules.set(symbol, module));
                return node;
            }
            function visit(node) {
                var _a;
                if (ts.isClassDeclaration(node) && ((_a = node.modifiers) === null || _a === void 0 ? void 0 : _a.some(self.nodeDetector.isModuleDecorator))) {
                    return visitModule(node);
                }
                else {
                    return ts.visitEachChild(node, visit, self.context);
                }
            }
            nodes.forEach(it => ts.visitEachChild(it, visit, this.context));
            return modules;
        }
        getFactoriesAndBindings(module) {
            const typeChecker = this.typeChecker;
            const nodeDetector = this.nodeDetector;
            const ctx = this.context;
            const bindings = [];
            const errorReporter = this.errorReporter;
            const factories = [];
            function visitFactory(method) {
                var _a, _b, _c;
                if (!((_a = method.modifiers) === null || _a === void 0 ? void 0 : _a.some(it => it.kind === ts.SyntaxKind.StaticKeyword))) {
                    throw Error(`Provider methods must be static! Provider: ${(_b = module.name) === null || _b === void 0 ? void 0 : _b.getText()}.${(_c = method.name) === null || _c === void 0 ? void 0 : _c.getText()}`);
                }
                const signature = typeChecker.getSignatureFromDeclaration(method);
                const returnType = createQualifiedType({
                    type: signature.getReturnType(),
                    qualifier: nodeDetector.getQualifier(method)
                });
                const parameters = method.getChildren()
                    .flatMap(it => it.kind == ts.SyntaxKind.SyntaxList ? it.getChildren() : [it])
                    .filter(ts.isParameter)
                    .map(it => it)
                    .map(param => {
                    var _a;
                    return {
                        type: createQualifiedType({
                            type: typeChecker.getTypeAtLocation((_a = param.type) !== null && _a !== void 0 ? _a : param),
                            qualifier: nodeDetector.getQualifier(param)
                        }),
                        optional: param.questionToken !== undefined || param.initializer !== undefined
                    };
                });
                const scope = nodeDetector.getScope(method);
                factories.push({ providerType: ProviderType.PROVIDES_METHOD, module, declaration: method, type: returnType, parameters, scope });
            }
            function visitBinding(method) {
                var _a, _b;
                if (!((_a = method.modifiers) === null || _a === void 0 ? void 0 : _a.some(it => it.kind === ts.SyntaxKind.AbstractKeyword))) {
                    errorReporter.reportBindingNotAbstract(method);
                }
                const signature = typeChecker.getSignatureFromDeclaration(method);
                const returnType = createQualifiedType({
                    type: signature.getReturnType(),
                    qualifier: nodeDetector.getQualifier(method)
                });
                const parameters = method.getChildren()
                    .flatMap(it => it.kind == ts.SyntaxKind.SyntaxList ? it.getChildren() : [it])
                    .filter(ts.isParameter)
                    .map(it => it);
                if (parameters.length != 1)
                    throw errorReporter.reportInvalidBindingArguments(method);
                const paramType = createQualifiedType({
                    type: typeChecker.getTypeAtLocation((_b = parameters[0].type) !== null && _b !== void 0 ? _b : parameters[0]),
                    qualifier: nodeDetector.getQualifier(parameters[0])
                });
                if (paramType === returnType)
                    throw errorReporter.reportTypeBoundToSelf(method);
                // @ts-ignore
                const assignable = typeChecker.isTypeAssignableTo(paramType.type, returnType.type);
                if (!assignable)
                    throw errorReporter.reportBindingMustBeAssignable(method, paramType.type, returnType.type);
                bindings.push({ paramType, returnType, declaration: method });
            }
            function visitBindingProperty(property) {
                var _a;
                if (!((_a = property.modifiers) === null || _a === void 0 ? void 0 : _a.some(it => it.kind === ts.SyntaxKind.AbstractKeyword))) {
                    errorReporter.reportBindingNotAbstract(property);
                }
                const type = typeChecker.getTypeAtLocation(property);
                const signatures = typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call);
                if (signatures.length !== 1)
                    errorReporter.reportParseFailed("Couldn't read signature of @Binds property!");
                const signature = signatures[0];
                const returnType = createQualifiedType({
                    type: signature.getReturnType(),
                    qualifier: nodeDetector.getQualifier(property)
                });
                const parameters = signature.parameters
                    .map(it => typeChecker.getTypeOfSymbolAtLocation(it, property));
                if (parameters.length != 1)
                    throw errorReporter.reportInvalidBindingArguments(property);
                const paramType = createQualifiedType({
                    type: parameters[0]
                });
                if (paramType === returnType)
                    throw errorReporter.reportTypeBoundToSelf(property);
                // @ts-ignore
                const assignable = typeChecker.isTypeAssignableTo(paramType.type, returnType.type);
                if (!assignable)
                    throw errorReporter.reportBindingMustBeAssignable(property, paramType.type, returnType.type);
                bindings.push({ paramType, returnType, declaration: property });
            }
            function visit(node) {
                var _a, _b, _c;
                if (ts.isMethodDeclaration(node) && ((_a = node.modifiers) === null || _a === void 0 ? void 0 : _a.some(nodeDetector.isProvidesDecorator))) {
                    visitFactory(node);
                    return node;
                }
                else if (ts.isPropertyDeclaration(node) && ((_b = node.modifiers) === null || _b === void 0 ? void 0 : _b.some(nodeDetector.isBindsDecorator))) {
                    visitBindingProperty(node);
                    return node;
                }
                else if (ts.isMethodDeclaration(node) && ((_c = node.modifiers) === null || _c === void 0 ? void 0 : _c.some(nodeDetector.isBindsDecorator))) {
                    visitBinding(node);
                    return node;
                }
                else {
                    return ts.visitEachChild(node, visit, ctx);
                }
            }
            ts.visitEachChild(module, visit, ctx);
            return { factories, bindings };
        }
        getSymbolList(decorator, identifierName) {
            let moduleSymbols = [];
            const ctx = this.context;
            const typeChecker = this.typeChecker;
            const errorReporter = this.errorReporter;
            function visit(node) {
                if (ts.isPropertyAssignment(node)) {
                    const identifier = node.getChildren()
                        .find(it => ts.isIdentifier(it) && it.getText() === identifierName);
                    if (identifier) {
                        const includesArrayLiteral = node.getChildren().find(it => ts.isArrayLiteralExpression(it));
                        if (!includesArrayLiteral)
                            throw errorReporter.reportCompileTimeConstantRequired(decorator, identifierName);
                        moduleSymbols = includesArrayLiteral.getChildren()
                            .flatMap(it => it.getChildren())
                            .map(it => typeChecker.getTypeAtLocation(it).getSymbol())
                            .filterNotNull();
                    }
                    return node;
                }
                return ts.visitEachChild(node, visit, ctx);
            }
            ts.visitEachChild(decorator, visit, ctx);
            return moduleSymbols;
        }
    };
    __setFunctionName(_classThis, "ModuleLocator");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ModuleLocator = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ModuleLocator = _classThis;
})();
export { ModuleLocator };
