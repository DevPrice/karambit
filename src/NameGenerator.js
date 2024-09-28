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
import { Inject } from "karambit-inject";
import { SourceFileScope } from "./Scopes";
let NameGenerator = (() => {
    let _classDecorators = [Inject, SourceFileScope];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var NameGenerator = _classThis = class {
        constructor(typeChecker, componentIdentifiers) {
            this.typeChecker = typeChecker;
            this.componentIdentifiers = componentIdentifiers;
            this.propertyNames = new Map();
            this.paramPropertyNames = new Map();
            this.getterNames = new Map();
            this.parentName = ts.factory.createUniqueName("parent");
        }
        getComponentIdentifier(type, preferredName) {
            const existingName = this.componentIdentifiers.get(type);
            if (existingName)
                return existingName;
            // for some reason, createUniqueName doesn't work with the export keyword here...?
            const newName = ts.factory.createIdentifier(preferredName !== null && preferredName !== void 0 ? preferredName : `Karambit${capitalize(this.getValidIdentifier(type))}`);
            this.componentIdentifiers.set(type, newName);
            return newName;
        }
        getPropertyIdentifier(type) {
            const existingName = this.propertyNames.get(type);
            if (existingName)
                return existingName;
            const identifierText = this.getValidIdentifier(type.type);
            const newName = ts.factory.createUniqueName(uncapitalize(identifierText));
            this.propertyNames.set(type, newName);
            return newName;
        }
        getPropertyIdentifierForParameter(param) {
            var _a;
            const existingName = this.paramPropertyNames.get(param);
            if (existingName)
                return existingName;
            const type = this.typeChecker.getTypeAtLocation((_a = param.type) !== null && _a !== void 0 ? _a : param);
            const identifierText = this.getValidIdentifier(type);
            const newName = ts.factory.createUniqueName(uncapitalize(identifierText));
            this.paramPropertyNames.set(param, newName);
            return newName;
        }
        getGetterMethodIdentifier(type) {
            const existingName = this.getterNames.get(type);
            if (existingName)
                return existingName;
            const identifierText = this.getValidIdentifier(type.type);
            const newName = ts.factory.createUniqueName(`get${capitalize(identifierText)}`);
            this.getterNames.set(type, newName);
            return newName;
        }
        getSubcomponentFactoryGetterMethodIdentifier(type) {
            const existingName = this.getterNames.get(type);
            if (existingName)
                return existingName;
            const identifierText = this.getValidIdentifier(type.type);
            const newName = ts.factory.createUniqueName(`get${capitalize(identifierText)}_Factory`);
            this.getterNames.set(type, newName);
            return newName;
        }
        getAssistedFactoryGetterMethodIdentifier(type) {
            const existingName = this.getterNames.get(type);
            if (existingName)
                return existingName;
            const identifierText = this.getValidIdentifier(type.type);
            const newName = ts.factory.createUniqueName(`get${capitalize(identifierText)}_Factory`);
            this.getterNames.set(type, newName);
            return newName;
        }
        getValidIdentifier(type) {
            return this.typeChecker.typeToString(type).replaceAll(/[^a-z\d]+/ig, "$");
        }
    };
    __setFunctionName(_classThis, "NameGenerator");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        NameGenerator = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return NameGenerator = _classThis;
})();
export { NameGenerator };
function capitalize(str) {
    if (str.length < 1)
        return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}
function uncapitalize(str) {
    if (str.length < 1)
        return str;
    return str.charAt(0).toLowerCase() + str.slice(1);
}
