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
import { createQualifiedType, qualifiedTypeToString } from "./QualifiedType";
import { isInjectableConstructor, isPropertyProvider, isProvidesMethod, isSubcomponentFactory, ProviderType } from "./Providers";
import { filterTree, printTreeMap } from "./Util";
const chalk = require("chalk");
export var KarambitErrorScope;
(function (KarambitErrorScope) {
    KarambitErrorScope["TRANSFORM"] = "NotTransformed";
    KarambitErrorScope["PARSE"] = "Parse";
    KarambitErrorScope["INVALID_SCOPE"] = "InvalidScope";
    KarambitErrorScope["INVALID_BINDING"] = "InvalidBinding";
    KarambitErrorScope["MISSING_PROVIDER"] = "MissingProviders";
    KarambitErrorScope["DUPLICATE_PROVIDERS"] = "DuplicateProviders";
    KarambitErrorScope["DUPLICATE_BINDINGS"] = "DuplicateBindings";
    KarambitErrorScope["DEPENDENCY_CYCLE"] = "DependencyCycle";
    KarambitErrorScope["BINDING_CYCLE"] = "BindingCycle";
})(KarambitErrorScope || (KarambitErrorScope = {}));
let ErrorReporter = (() => {
    let _classDecorators = [Inject, Reusable];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var ErrorReporter = _classThis = class {
        constructor(typeChecker, component) {
            this.typeChecker = typeChecker;
            this.component = component;
        }
        reportCompileTimeConstantRequired(context, identifierName) {
            ErrorReporter.fail(KarambitErrorScope.PARSE, `'${identifierName}' must be a compile-time constant (array literal)!\n\n${nodeForDisplay(context)}\n`, this.component);
        }
        reportComponentPropertyMustBeReadOnly(property) {
            ErrorReporter.fail(KarambitErrorScope.PARSE, `Abstract component properties must be read-only!\n\n${nodeForDisplay(property)}\n`, this.component);
        }
        reportComponentDependencyMayNotBeOptional(property) {
            ErrorReporter.fail(KarambitErrorScope.PARSE, `Non-instance dependencies may not be optional!\n\n${nodeForDisplay(property)}\n`, this.component);
        }
        reportParseFailed(message, contextNode) {
            return ErrorReporter.reportParseFailed(message + (contextNode ? "\n\n" + nodeForDisplay(contextNode) + "\n" : ""));
        }
        reportDuplicateScope(subcomponentName, ancestorName) {
            ErrorReporter.fail(KarambitErrorScope.INVALID_SCOPE, `Subcomponent may not share a scope with an ancestor! ${subcomponentName} has the same scope as its ancestor ${ancestorName}.\n`, this.component);
        }
        reportInvalidScope(provider, expected) {
            var _a, _b, _c;
            const type = isProvidesMethod(provider) ? provider.type : createQualifiedType({ type: provider.type });
            ErrorReporter.fail(KarambitErrorScope.INVALID_SCOPE, `Invalid scope for type ${qualifiedTypeToString(type)}! ` +
                `Got: ${(_b = (_a = provider.scope) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : "no scope"}, expected: ${(_c = expected === null || expected === void 0 ? void 0 : expected.name) !== null && _c !== void 0 ? _c : "no scope"}.\n\n${providerForDisplay(provider)}\n`, this.component);
        }
        reportBindingMustBeAssignable(context, parameterType, returnType) {
            ErrorReporter.fail(KarambitErrorScope.INVALID_BINDING, "Binding parameter must be assignable to the return type! " +
                `${this.typeChecker.typeToString(parameterType)} is not assignable to ${this.typeChecker.typeToString(returnType)}\n\n` +
                nodeForDisplay(context) + "\n", this.component);
        }
        reportTypeBoundToSelf(context) {
            ErrorReporter.fail(KarambitErrorScope.INVALID_BINDING, "Cannot bind a type to itself!\n\n" + nodeForDisplay(context) + "\n", this.component);
        }
        reportBindingNotAbstract(context) {
            ErrorReporter.fail(KarambitErrorScope.INVALID_BINDING, "Binding must be abstract!\n\n" + nodeForDisplay(context) + "\n", this.component);
        }
        reportInvalidBindingArguments(context) {
            ErrorReporter.fail(KarambitErrorScope.INVALID_BINDING, "Binding signature must have exactly one argument!\n\n" + nodeForDisplay(context) + "\n", this.component);
        }
        reportMissingProviders(missingTypes, component, graph) {
            const missingSet = new Set(missingTypes);
            const getChildren = (item) => { var _a, _b; return item === component.type ? Array.from(component.rootDependencies).map(it => it.type) : (_b = (_a = graph.get(item)) === null || _a === void 0 ? void 0 : _a.dependencies) !== null && _b !== void 0 ? _b : []; };
            const typeToString = (item) => {
                if (missingSet.has(item))
                    return chalk.yellow(qualifiedTypeToString(item));
                return qualifiedTypeToString(item);
            };
            ErrorReporter.fail(KarambitErrorScope.MISSING_PROVIDER, `No provider in ${qualifiedTypeToString(component.type)} for required types: ${Array.from(missingSet.keys()).map(typeToString).join(", ")}\n\n` +
                `${printTreeMap(component.type, filterTree(component.type, getChildren, item => missingSet.has(item), typeToString), typeToString)}\n`, this.component);
        }
        reportMissingRequiredProviders(parentProvider, missingProvider) {
            const parentDeclarationContext = parentProvider.declaration ? nodeForDisplay(parentProvider.declaration) : "";
            const declarations = Array.from(missingProvider).map(it => it.declaration).filterNotNull();
            const parentType = parentProvider.providerType === ProviderType.INJECTABLE_CONSTRUCTOR
                ? createQualifiedType({ type: parentProvider.type })
                : parentProvider.type;
            ErrorReporter.fail(KarambitErrorScope.MISSING_PROVIDER, `Required type(s) of ${qualifiedTypeToString(parentType)} may not be provided by optional binding(s): \n\n` +
                parentDeclarationContext + "\n\n" +
                declarations.map(nodeForDisplay).join("\n"), this.component);
        }
        reportDuplicateProviders(type, providers) {
            ErrorReporter.fail(KarambitErrorScope.DUPLICATE_PROVIDERS, `${qualifiedTypeToString(type)} is provided multiple times!\n\n` +
                providers.map(providerForDisplay).filterNotNull().map(it => `provided by:\n${it}\n`).join("\n") + "\n", this.component);
        }
        reportDuplicateBindings(type, bindings) {
            ErrorReporter.fail(KarambitErrorScope.DUPLICATE_BINDINGS, `${qualifiedTypeToString(type)} is bound multiple times!\n\n` +
                bindings.map(it => it.declaration).map(nodeForDisplay).filterNotNull().map(it => `bound at:\n${it}\n`).join("\n") + "\n", this.component);
        }
        reportDependencyCycle(type, chain) {
            ErrorReporter.fail(KarambitErrorScope.DEPENDENCY_CYCLE, `${qualifiedTypeToString(type)} causes a dependency cycle (circular dependency)!\n\n` +
                `${chain.map(qualifiedTypeToString).join(" -> ")}\n`, this.component);
        }
        reportBindingCycle(type, chain) {
            ErrorReporter.fail(KarambitErrorScope.BINDING_CYCLE, "Binding cycle detected!\n\n" +
                `${chain.map(qualifiedTypeToString).join(" -> ")}\n`, this.component);
        }
        static reportCodeNotTransformed() {
            ErrorReporter.fail(KarambitErrorScope.TRANSFORM, "Decorated code was not processed by transformer! Ensure this project is configured to use the Karambit compiler plugin.");
        }
        static reportParseFailed(message, component) {
            ErrorReporter.fail(KarambitErrorScope.PARSE, message, component);
        }
        static fail(scope, message, component) {
            throw new KarambitError(message, scope, component);
        }
    };
    __setFunctionName(_classThis, "ErrorReporter");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ErrorReporter = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ErrorReporter = _classThis;
})();
export { ErrorReporter };
export class KarambitError extends Error {
    constructor(description, scope, component) {
        super(`${chalk.red(`[Karambit/${scope}]`)} ${component && component.name ? `${component.name.getText()}: ` : ""}${description}`);
        this.scope = scope;
    }
}
function providerForDisplay(provider) {
    if (isPropertyProvider(provider))
        return nodeForDisplay(provider.declaration);
    if (isProvidesMethod(provider))
        return nodeForDisplay(provider.declaration);
    if (isInjectableConstructor(provider))
        return nodeForDisplay(provider.declaration);
    if (isSubcomponentFactory(provider))
        return nodeForDisplay(provider.declaration);
    if (provider.providerType === ProviderType.PARENT)
        return "Parent binding";
    if (provider.providerType === ProviderType.SET_MULTIBINDING)
        return "@IntoSet multibinding";
    if (provider.providerType === ProviderType.MAP_MULTIBINDING)
        return "@IntoMap multibinding";
    return undefined;
}
function nodeForDisplay(node) {
    const sf = node.getSourceFile();
    const { line, character } = sf.getLineAndCharacterOfPosition(node.pos);
    const nodeText = chalk.yellow(`${sf.fileName}:${line}:${character}`) + "\n" +
        normalizeWhitespace(node.getText());
    return nodeText.split(" {\n")[0];
}
function normalizeWhitespace(text) {
    const lines = text.split("\n");
    if (lines.length < 2)
        return lines[0];
    const leadingWhitespace = lines[1].match(/^(\s+)/);
    if (leadingWhitespace) {
        return lines[0] + "\n" + lines.slice(1).map(it => it.substring(leadingWhitespace[1].length)).join("\n");
    }
    return lines.join("\n");
}
