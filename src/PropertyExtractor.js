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
let PropertyExtractor = (() => {
    let _classDecorators = [Inject, Reusable];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var PropertyExtractor = _classThis = class {
        constructor(typeChecker, nodeDetector) {
            this.typeChecker = typeChecker;
            this.nodeDetector = nodeDetector;
        }
        getDeclaredPropertiesForType(type) {
            var _a, _b, _c;
            const baseTypes = (_a = type.getBaseTypes()) !== null && _a !== void 0 ? _a : [];
            const baseProperties = baseTypes.flatMap(it => this.getDeclaredPropertiesForType(it));
            const declarations = (_c = (_b = type.getSymbol()) === null || _b === void 0 ? void 0 : _b.getDeclarations()) !== null && _c !== void 0 ? _c : [];
            return declarations
                .filter(it => ts.isClassDeclaration(it) || ts.isInterfaceDeclaration(it) || ts.isTypeLiteralNode(it))
                .map(it => it)
                .flatMap(declaration => declaration.members)
                .filter((it) => ts.isPropertyDeclaration(it) || ts.isPropertySignature(it))
                .map(it => it)
                .concat(baseProperties);
        }
        getUnimplementedAbstractProperties(type) {
            var _a, _b, _c;
            const declarations = (_b = (_a = type.getSymbol()) === null || _a === void 0 ? void 0 : _a.getDeclarations()) !== null && _b !== void 0 ? _b : [];
            const properties = declarations
                .filter(it => ts.isClassLike(it))
                .map(it => it)
                .flatMap(declaration => declaration.members)
                .filter(it => ts.isPropertyDeclaration(it) || ts.isPropertySignature(it))
                .map(it => it);
            const implementedProperties = properties.filter(it => it.initializer !== undefined)
                .map(it => it.name.getText());
            const baseTypes = (_c = type.getBaseTypes()) !== null && _c !== void 0 ? _c : [];
            const baseProperties = baseTypes.flatMap(it => this.getUnimplementedAbstractProperties(it))
                .filter(it => !implementedProperties.includes(it.name.getText()));
            return properties
                .filter(it => { var _a; return (_a = it.modifiers) === null || _a === void 0 ? void 0 : _a.some(modifier => modifier.kind === ts.SyntaxKind.AbstractKeyword); })
                .map(it => it)
                .concat(baseProperties);
        }
        getUnimplementedAbstractMethods(type) {
            var _a, _b, _c;
            const declarations = (_b = (_a = type.getSymbol()) === null || _a === void 0 ? void 0 : _a.getDeclarations()) !== null && _b !== void 0 ? _b : [];
            const methods = declarations
                .filter(it => ts.isClassLike(it))
                .map(it => it)
                .flatMap(declaration => declaration.members)
                .filter(it => ts.isMethodDeclaration(it) || ts.isMethodSignature(it))
                .map(it => it);
            const implementedMethods = methods.filter(it => it.body !== undefined)
                .map(it => it.name.getText());
            const baseTypes = (_c = type.getBaseTypes()) !== null && _c !== void 0 ? _c : [];
            const baseMethods = baseTypes.flatMap(it => this.getUnimplementedAbstractMethods(it))
                .filter(it => !implementedMethods.includes(it.name.getText()));
            return methods
                .filter(it => { var _a; return (_a = it.modifiers) === null || _a === void 0 ? void 0 : _a.some(modifier => modifier.kind === ts.SyntaxKind.AbstractKeyword); })
                .concat(baseMethods);
        }
        typeFromPropertyDeclaration(property) {
            var _a;
            return createQualifiedType({
                type: this.typeChecker.getTypeAtLocation((_a = property.type) !== null && _a !== void 0 ? _a : property),
                qualifier: this.nodeDetector.getQualifier(property)
            });
        }
    };
    __setFunctionName(_classThis, "PropertyExtractor");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        PropertyExtractor = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return PropertyExtractor = _classThis;
})();
export { PropertyExtractor };
