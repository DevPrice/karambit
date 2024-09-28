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
import { createQualifiedType } from "./QualifiedType";
import { findCycles } from "./Util";
import * as ts from "typescript";
import { ProviderType } from "./Providers";
import { AssistedInject } from "karambit-inject";
let DependencyGraphBuilder = (() => {
    let _classDecorators = [AssistedInject];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var DependencyGraphBuilder = _classThis = class {
        constructor(typeResolver, nodeDetector, dependencyMap, factoryMap, setMultibindings, mapMultibindings, subcomponentFactoryLocator, assistedFactoryLocator, propertyExtractor, constructorHelper, errorReporter, scopeFilter, parentGraph) {
            this.typeResolver = typeResolver;
            this.nodeDetector = nodeDetector;
            this.dependencyMap = dependencyMap;
            this.factoryMap = factoryMap;
            this.setMultibindings = setMultibindings;
            this.mapMultibindings = mapMultibindings;
            this.subcomponentFactoryLocator = subcomponentFactoryLocator;
            this.assistedFactoryLocator = assistedFactoryLocator;
            this.propertyExtractor = propertyExtractor;
            this.constructorHelper = constructorHelper;
            this.errorReporter = errorReporter;
            this.scopeFilter = scopeFilter;
            this.parentGraph = parentGraph;
            this.assertNoDuplicateBindings();
        }
        buildDependencyGraph(dependencies) {
            const result = new Map();
            const missing = new Set();
            const todo = Array.from(dependencies);
            let next;
            while (next = todo.shift()) { // eslint-disable-line
                const boundType = this.typeResolver.resolveBoundType(next.type);
                if (result.has(boundType))
                    continue;
                const providerResult = this.getProvider(boundType);
                if (providerResult) {
                    const { provider, dependencies } = providerResult;
                    if (provider !== undefined)
                        result.set(boundType, provider);
                    if (dependencies !== undefined)
                        todo.push(...dependencies);
                }
                else {
                    missing.add(next);
                }
            }
            for (const dep of dependencies) {
                this.assertNoCycles(dep.type, result);
            }
            for (const dep of dependencies) {
                if (!dep.optional) {
                    const provider = result.get(dep.type);
                    if (provider) {
                        const missing = Array.from(provider.dependencies)
                            .map(it => result.get(it))
                            .filterNotNull()
                            .filter(it => it.providerType === ProviderType.PROPERTY && it.optional);
                        if (missing.length > 0) {
                            this.errorReporter.reportMissingRequiredProviders(provider, missing);
                        }
                    }
                }
            }
            return {
                resolved: result,
                missing,
            };
        }
        getProvider(boundType) {
            var _a;
            const providedType = this.nodeDetector.isProvider(boundType.type);
            if (providedType) {
                const qualifiedProvidedType = createQualifiedType(Object.assign(Object.assign({}, boundType), { type: providedType }));
                return {
                    dependencies: [{ type: qualifiedProvidedType, optional: false }]
                };
            }
            const propertyProvider = this.dependencyMap.get(boundType);
            if (propertyProvider) {
                return {
                    provider: Object.assign(Object.assign({}, propertyProvider), { dependencies: new Set() })
                };
            }
            const provider = (_a = this.factoryMap.get(boundType)) !== null && _a !== void 0 ? _a : this.getInjectableConstructor(boundType.type);
            if (provider) {
                const dependencies = provider.parameters;
                return {
                    provider: Object.assign(Object.assign({}, provider), { dependencies: new Set(dependencies.map(it => it.type)) }),
                    dependencies
                };
            }
            const factory = this.subcomponentFactoryLocator.asSubcomponentFactory(boundType.type);
            if (factory) {
                return {
                    provider: Object.assign(Object.assign({}, factory), { dependencies: new Set() })
                };
            }
            const assistedFactory = this.assistedFactoryLocator.asAssistedFactory(boundType.type);
            if (assistedFactory) {
                const dependencies = assistedFactory.constructorParams.filter(it => !it.decorators.some(this.nodeDetector.isAssistedDecorator));
                return {
                    provider: Object.assign(Object.assign({}, assistedFactory), { dependencies: new Set(dependencies.map(it => it.type)) }),
                    dependencies,
                };
            }
            const readonlySetType = this.nodeDetector.isReadonlySet(boundType.type);
            if (readonlySetType) {
                const multibinding = this.setMultibindings.get(createQualifiedType(Object.assign(Object.assign({}, boundType), { type: readonlySetType })));
                if (multibinding) {
                    const dependencies = multibinding.elementProviders;
                    const parentBinding = this.parentGraph ? this.parentGraph(boundType) : false;
                    return {
                        provider: Object.assign(Object.assign({}, multibinding), { type: boundType, dependencies: new Set(dependencies.map(it => it.type)), parentBinding }),
                        dependencies,
                    };
                }
            }
            const readonlyMapTypes = this.nodeDetector.isReadonlyMap(boundType.type);
            if (readonlyMapTypes) {
                const multibinding = this.mapMultibindings.get([createQualifiedType(Object.assign(Object.assign({}, boundType), { type: readonlyMapTypes[1] })), readonlyMapTypes[0]]);
                if (multibinding) {
                    const dependencies = multibinding.entryProviders;
                    const parentBinding = this.parentGraph ? this.parentGraph(boundType) : false;
                    return {
                        provider: Object.assign(Object.assign({}, multibinding), { type: boundType, dependencies: new Set(dependencies.map(it => it.type)), parentBinding }),
                        dependencies,
                    };
                }
            }
            return undefined;
        }
        getInjectableConstructor(type) {
            var _a, _b, _c;
            const symbol = type.getSymbol();
            const declarations = (_a = symbol === null || symbol === void 0 ? void 0 : symbol.getDeclarations()) === null || _a === void 0 ? void 0 : _a.filter(ts.isClassDeclaration);
            const declaration = declarations && declarations.length > 0 ? declarations[0] : undefined;
            if (!declaration)
                return undefined;
            if (!((_b = declaration.modifiers) === null || _b === void 0 ? void 0 : _b.some(this.nodeDetector.isInjectDecorator)))
                return undefined;
            if ((_c = declaration.modifiers) === null || _c === void 0 ? void 0 : _c.some(it => it.kind === ts.SyntaxKind.AbstractKeyword)) {
                this.errorReporter.reportParseFailed("@Inject class should not be abstract!", declaration);
            }
            const parameters = this.constructorHelper.getConstructorParamsForDeclaration(declaration);
            if (!parameters)
                return undefined;
            const scope = this.nodeDetector.getScope(declaration);
            const constructor = {
                providerType: ProviderType.INJECTABLE_CONSTRUCTOR,
                declaration,
                type,
                parameters,
                scope,
            };
            if (this.scopeFilter === undefined)
                return constructor;
            //  this is another component's scope
            if (scope && !this.nodeDetector.isReusableScope(scope) && scope !== this.scopeFilter.filterOnly)
                return undefined;
            // this is our scope
            if (scope === this.scopeFilter.filterOnly && this.scopeFilter.filterOnly)
                return constructor;
            const parentGraph = this.parentGraph;
            // unscoped, if the parent can provide this, then let it
            if (parentGraph && parentGraph(createQualifiedType({ type })))
                return undefined;
            return constructor;
        }
        assertNoCycles(type, map) {
            const cycle = findCycles(type, (item) => {
                var _a, _b;
                if (this.nodeDetector.isProvider(type.type))
                    return [];
                const boundType = this.typeResolver.resolveBoundType(item);
                return (_b = (_a = map.get(boundType)) === null || _a === void 0 ? void 0 : _a.dependencies) !== null && _b !== void 0 ? _b : [];
            });
            if (cycle.length > 0) {
                this.errorReporter.reportDependencyCycle(cycle[cycle.length - 1], cycle);
            }
        }
        assertNoDuplicateBindings() {
            const allBoundTypes = [...this.dependencyMap.keys(), ...this.factoryMap.keys()];
            const boundTypeSet = new Set(allBoundTypes);
            if (allBoundTypes.length !== boundTypeSet.size) {
                for (const type of boundTypeSet) {
                    const propertyProvider = this.dependencyMap.get(type);
                    const factoryProvider = this.factoryMap.get(type);
                    if (propertyProvider && factoryProvider) {
                        this.errorReporter.reportDuplicateProviders(type, [propertyProvider, factoryProvider]);
                    }
                }
            }
        }
    };
    __setFunctionName(_classThis, "DependencyGraphBuilder");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        DependencyGraphBuilder = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return DependencyGraphBuilder = _classThis;
})();
export { DependencyGraphBuilder };
