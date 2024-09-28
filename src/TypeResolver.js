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
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
import { findCycles } from "./Util";
import { AssistedInject } from "karambit-inject";
let TypeResolver = (() => {
    var _TypeResolver_bindingMap;
    let _classDecorators = [AssistedInject];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var TypeResolver = _classThis = class {
        constructor(errorReporter, bindings) {
            this.errorReporter = errorReporter;
            this.bindings = bindings;
            _TypeResolver_bindingMap.set(this, void 0);
            this.resolveBoundType = this.resolveBoundType.bind(this);
            const bindingMap = new Map();
            for (const binding of bindings) {
                const duplicate = bindingMap.get(binding.returnType);
                if (duplicate)
                    this.errorReporter.reportDuplicateBindings(binding.returnType, [binding, duplicate]);
                bindingMap.set(binding.returnType, binding);
            }
            __classPrivateFieldSet(this, _TypeResolver_bindingMap, new Map(Array.from(bindingMap.entries()).map(([type, binding]) => [type, binding.paramType])), "f");
            for (const binding of __classPrivateFieldGet(this, _TypeResolver_bindingMap, "f").keys()) {
                const cycle = findCycles(binding, (b) => [__classPrivateFieldGet(this, _TypeResolver_bindingMap, "f").get(b)].filterNotNull());
                if (cycle.length > 0) {
                    throw this.errorReporter.reportBindingCycle(cycle[cycle.length - 1], cycle);
                }
            }
        }
        resolveBoundType(type) {
            const binding = __classPrivateFieldGet(this, _TypeResolver_bindingMap, "f").get(type);
            if (!binding)
                return type;
            return this.resolveBoundType(binding);
        }
        static merge(original, additionalBindings) {
            return new TypeResolver(original.errorReporter, [...original.bindings, ...additionalBindings]);
        }
    };
    _TypeResolver_bindingMap = new WeakMap();
    __setFunctionName(_classThis, "TypeResolver");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        TypeResolver = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return TypeResolver = _classThis;
})();
export { TypeResolver };
