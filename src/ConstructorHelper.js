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
let ConstructorHelper = (() => {
    let _classDecorators = [Inject, Reusable];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var ConstructorHelper = _classThis = class {
        constructor(typeChecker, nodeDetector) {
            this.typeChecker = typeChecker;
            this.nodeDetector = nodeDetector;
        }
        getConstructorParamsForDeclaration(declaration) {
            const constructor = declaration.getChildren().flatMap(it => it.getChildren())
                .find(it => ts.isConstructorDeclaration(it) && it.body !== undefined);
            if (!constructor)
                return [];
            return constructor.getChildren()
                .flatMap(it => it.kind == ts.SyntaxKind.SyntaxList ? it.getChildren() : [it])
                .filter(ts.isParameter)
                .map(it => it)
                .map(param => {
                var _a, _b;
                return {
                    type: createQualifiedType({
                        type: this.typeChecker.getTypeAtLocation((_a = param.type) !== null && _a !== void 0 ? _a : param),
                        qualifier: this.nodeDetector.getQualifier(param)
                    }),
                    name: param.name.getText(),
                    declaration: param,
                    decorators: Array.from((_b = ts.getDecorators(param)) !== null && _b !== void 0 ? _b : []),
                    optional: param.questionToken !== undefined || param.initializer !== undefined
                };
            });
        }
    };
    __setFunctionName(_classThis, "ConstructorHelper");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ConstructorHelper = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ConstructorHelper = _classThis;
})();
export { ConstructorHelper };
