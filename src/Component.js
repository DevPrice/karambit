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
import { Component, createComponent, Module, Provides, Reusable, Subcomponent } from "karambit-inject";
import { ComponentGenerationScope, ProgramScope, SourceFileScope } from "./Scopes";
let ComponentGenerationSubcomponent = (() => {
    let _classDecorators = [Subcomponent, ComponentGenerationScope];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var ComponentGenerationSubcomponent = _classThis = class {
        constructor(componentDeclaration) { }
    };
    __setFunctionName(_classThis, "ComponentGenerationSubcomponent");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ComponentGenerationSubcomponent = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ComponentGenerationSubcomponent = _classThis;
})();
export { ComponentGenerationSubcomponent };
let SourceFileModule = (() => {
    let _classDecorators = [Module];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _staticExtraInitializers = [];
    let _static_provideTransformers_decorators;
    var SourceFileModule = _classThis = class {
        static provideTransformers(componentVisitor, importer) {
            return [
                componentVisitor.visitComponents,
                importer.addImportsToSourceFile,
            ];
        }
    };
    __setFunctionName(_classThis, "SourceFileModule");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _static_provideTransformers_decorators = [Provides];
        __esDecorate(_classThis, null, _static_provideTransformers_decorators, { kind: "method", name: "provideTransformers", static: true, private: false, access: { has: obj => "provideTransformers" in obj, get: obj => obj.provideTransformers }, metadata: _metadata }, null, _staticExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        SourceFileModule = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _staticExtraInitializers);
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return SourceFileModule = _classThis;
})();
export { SourceFileModule };
let SourceFileSubcomponent = (() => {
    let _classDecorators = [Subcomponent({ modules: [SourceFileModule], subcomponents: [ComponentGenerationSubcomponent] }), SourceFileScope];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var SourceFileSubcomponent = _classThis = class {
        constructor(sourceFile) { }
    };
    __setFunctionName(_classThis, "SourceFileSubcomponent");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        SourceFileSubcomponent = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return SourceFileSubcomponent = _classThis;
})();
export { SourceFileSubcomponent };
let TransformationContextSubcomponent = (() => {
    let _classDecorators = [Subcomponent({ subcomponents: [SourceFileSubcomponent] })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var TransformationContextSubcomponent = _classThis = class {
        constructor(transformationContext) { }
    };
    __setFunctionName(_classThis, "TransformationContextSubcomponent");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        TransformationContextSubcomponent = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return TransformationContextSubcomponent = _classThis;
})();
export { TransformationContextSubcomponent };
let ProgramModule = (() => {
    let _classDecorators = [Module];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _staticExtraInitializers = [];
    let _static_provideTypeChecker_decorators;
    let _static_provideComponentIdentifiers_decorators;
    var ProgramModule = _classThis = class {
        static provideTypeChecker(program) {
            return program.getTypeChecker();
        }
        static provideComponentIdentifiers() {
            return new Map();
        }
    };
    __setFunctionName(_classThis, "ProgramModule");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _static_provideTypeChecker_decorators = [Provides, Reusable];
        _static_provideComponentIdentifiers_decorators = [Provides, ProgramScope];
        __esDecorate(_classThis, null, _static_provideTypeChecker_decorators, { kind: "method", name: "provideTypeChecker", static: true, private: false, access: { has: obj => "provideTypeChecker" in obj, get: obj => obj.provideTypeChecker }, metadata: _metadata }, null, _staticExtraInitializers);
        __esDecorate(_classThis, null, _static_provideComponentIdentifiers_decorators, { kind: "method", name: "provideComponentIdentifiers", static: true, private: false, access: { has: obj => "provideComponentIdentifiers" in obj, get: obj => obj.provideComponentIdentifiers }, metadata: _metadata }, null, _staticExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ProgramModule = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _staticExtraInitializers);
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ProgramModule = _classThis;
})();
export { ProgramModule };
let ProgramComponent = (() => {
    let _classDecorators = [Component({ modules: [ProgramModule], subcomponents: [TransformationContextSubcomponent] }), ProgramScope];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var ProgramComponent = _classThis = class {
        constructor(program, options) { }
    };
    __setFunctionName(_classThis, "ProgramComponent");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ProgramComponent = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ProgramComponent = _classThis;
})();
export { ProgramComponent };
export function createProgramComponent(program, options) {
    return createComponent(program, options);
}
