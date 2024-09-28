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
import { Inject, Reusable } from "karambit-inject";
import * as ts from "typescript";
let CreateComponentTransformer = (() => {
    let _classDecorators = [Inject, Reusable];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var CreateComponentTransformer = _classThis = class {
        constructor(context, nodeDetector, componentIdentifiers, typeChecker, importer, errorReporter) {
            this.context = context;
            this.nodeDetector = nodeDetector;
            this.componentIdentifiers = componentIdentifiers;
            this.typeChecker = typeChecker;
            this.importer = importer;
            this.errorReporter = errorReporter;
            this.replaceCreateComponent = this.replaceCreateComponent.bind(this);
            this.replaceGetConstructor = this.replaceGetConstructor.bind(this);
        }
        replaceCreateComponent(node) {
            const componentType = ts.isCallExpression(node) && this.nodeDetector.isCreateComponentCall(node);
            if (componentType) {
                return ts.factory.createNewExpression(this.getComponentConstructorExpression(componentType, node), undefined, node.arguments.map(it => ts.visitNode(it, this.replaceCreateComponent)));
            }
            else {
                return ts.visitEachChild(node, this.replaceCreateComponent, this.context);
            }
        }
        replaceGetConstructor(node) {
            const componentType = ts.isCallExpression(node) && this.nodeDetector.isGetConstructorCall(node);
            if (componentType) {
                return this.getComponentConstructorExpression(componentType, node);
            }
            else {
                return ts.visitEachChild(node, this.replaceGetConstructor, this.context);
            }
        }
        getComponentConstructorExpression(componentType, contextNode) {
            const identifier = this.componentIdentifiers.get(componentType);
            if (!identifier)
                this.errorReporter.reportParseFailed(`Cannot create instance of ${this.typeChecker.typeToString(componentType)}! Is the type decorated with @Component?`, contextNode);
            const symbol = componentType.getSymbol();
            if (!symbol)
                this.errorReporter.reportParseFailed(`Couldn't find symbol of type ${this.typeChecker.typeToString(componentType)}!`, contextNode);
            const declaration = symbol.valueDeclaration;
            if (!declaration)
                this.errorReporter.reportParseFailed(`Couldn't find declaration of type ${this.typeChecker.typeToString(componentType)}!`, contextNode);
            return this.importer.getExpressionForDeclaration(componentType.symbol, declaration.getSourceFile(), identifier);
        }
    };
    __setFunctionName(_classThis, "CreateComponentTransformer");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CreateComponentTransformer = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CreateComponentTransformer = _classThis;
})();
export { CreateComponentTransformer };
