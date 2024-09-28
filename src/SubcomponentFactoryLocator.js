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
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
import * as ts from "typescript";
import { createQualifiedType, internalQualifier } from "./QualifiedType";
import { ProviderType } from "./Providers";
import { AssistedInject } from "karambit-inject";
let SubcomponentFactoryLocator = (() => {
    var _SubcomponentFactoryLocator_cache;
    let _classDecorators = [AssistedInject];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var SubcomponentFactoryLocator = _classThis = class {
        constructor(typeChecker, nodeDetector, constructorHelper, installedSubcomponents) {
            this.typeChecker = typeChecker;
            this.nodeDetector = nodeDetector;
            this.constructorHelper = constructorHelper;
            this.installedSubcomponents = installedSubcomponents;
            _SubcomponentFactoryLocator_cache.set(this, new Map());
            this.asSubcomponentFactory = this.asSubcomponentFactory.bind(this);
        }
        asSubcomponentFactory(type) {
            var _a;
            const cached = __classPrivateFieldGet(this, _SubcomponentFactoryLocator_cache, "f").get(type);
            if (cached)
                return cached;
            const located = (_a = this.locateAliasedSubcomponentFactory(type)) !== null && _a !== void 0 ? _a : this.locateSubcomponentFactory(type);
            __classPrivateFieldGet(this, _SubcomponentFactoryLocator_cache, "f").set(type, located);
            return located;
        }
        locateSubcomponentFactory(type) {
            var _a;
            const signatures = this.typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call);
            if (signatures.length === 0)
                return undefined;
            const signature = signatures[0];
            const signatureDeclaration = signature.declaration;
            if (!signatureDeclaration || ts.isJSDocSignature(signatureDeclaration))
                return undefined;
            const returnType = signature.getReturnType();
            if (!this.installedSubcomponents.has(returnType.symbol))
                return undefined;
            const declarations = returnType.symbol.declarations;
            if (!declarations || declarations.length === 0)
                return undefined;
            const declaration = declarations[0];
            if (!ts.isClassDeclaration(declaration))
                return undefined;
            const decorator = (_a = declaration.modifiers) === null || _a === void 0 ? void 0 : _a.find(this.nodeDetector.isSubcomponentDecorator);
            if (!decorator)
                return undefined;
            const constructorParams = this.constructorHelper.getConstructorParamsForDeclaration(declaration);
            if (!constructorParams)
                return undefined;
            const factoryParamTypes = signatureDeclaration.parameters
                .map(it => { var _a; return this.typeChecker.getTypeAtLocation((_a = it.type) !== null && _a !== void 0 ? _a : it); });
            if (factoryParamTypes.length != constructorParams.length)
                return undefined;
            if (!constructorParams.map(it => it.type.type).every((it, index) => it === factoryParamTypes[index]))
                return undefined;
            return {
                providerType: ProviderType.SUBCOMPONENT_FACTORY,
                subcomponentType: createQualifiedType({ type: returnType, qualifier: internalQualifier }),
                type: createQualifiedType({ type }),
                constructorParams,
                declaration,
                decorator
            };
        }
        locateAliasedSubcomponentFactory(type) {
            var _a;
            const aliasedType = this.nodeDetector.isSubcomponentFactory(type);
            if (!aliasedType)
                return undefined;
            const declarations = aliasedType.symbol.declarations;
            if (!declarations || declarations.length === 0)
                return undefined;
            const declaration = declarations[0];
            if (!ts.isClassDeclaration(declaration))
                return undefined;
            const decorator = (_a = declaration.modifiers) === null || _a === void 0 ? void 0 : _a.find(this.nodeDetector.isSubcomponentDecorator);
            if (!decorator)
                return undefined;
            const constructorParams = this.constructorHelper.getConstructorParamsForDeclaration(declaration);
            if (!constructorParams)
                return undefined;
            const subcomponentType = this.typeChecker.getTypeAtLocation(declaration);
            return {
                providerType: ProviderType.SUBCOMPONENT_FACTORY,
                subcomponentType: createQualifiedType({ type: subcomponentType, qualifier: internalQualifier }),
                type: createQualifiedType({ type }),
                constructorParams,
                declaration,
                decorator
            };
        }
    };
    _SubcomponentFactoryLocator_cache = new WeakMap();
    __setFunctionName(_classThis, "SubcomponentFactoryLocator");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        SubcomponentFactoryLocator = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return SubcomponentFactoryLocator = _classThis;
})();
export { SubcomponentFactoryLocator };
