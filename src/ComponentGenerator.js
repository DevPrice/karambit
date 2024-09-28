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
import { TypeResolver } from "./TypeResolver";
import { createQualifiedType, internalQualifier } from "./QualifiedType";
import { isSubcomponentFactory, ProviderType } from "./Providers";
import { Inject, Reusable } from "karambit-inject";
import { TupleMap } from "./Util";
let ComponentGenerator = (() => {
    let _classDecorators = [Inject, Reusable];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var ComponentGenerator = _classThis = class {
        constructor(typeChecker, nodeDetector, nameGenerator, assistedFactoryLocator, componentDeclarationBuilderFactory, subcomponentFactoryLocatorFactory, typeResolverFactory, moduleLocator, constructorHelper, propertyExtractor, errorReporter, component, dependencyGraphBuilderFactory) {
            this.typeChecker = typeChecker;
            this.nodeDetector = nodeDetector;
            this.nameGenerator = nameGenerator;
            this.assistedFactoryLocator = assistedFactoryLocator;
            this.componentDeclarationBuilderFactory = componentDeclarationBuilderFactory;
            this.subcomponentFactoryLocatorFactory = subcomponentFactoryLocatorFactory;
            this.typeResolverFactory = typeResolverFactory;
            this.moduleLocator = moduleLocator;
            this.constructorHelper = constructorHelper;
            this.propertyExtractor = propertyExtractor;
            this.errorReporter = errorReporter;
            this.component = component;
            this.dependencyGraphBuilderFactory = dependencyGraphBuilderFactory;
        }
        getDependencyMap(component) {
            var _a;
            const dependencyParams = (_a = this.constructorHelper.getConstructorParamsForDeclaration(component)) !== null && _a !== void 0 ? _a : [];
            const dependencyMap = new Map();
            dependencyParams.forEach(param => {
                const name = this.nameGenerator.getPropertyIdentifierForParameter(param.declaration);
                const type = param.type;
                const isInstanceBinding = param.decorators.some(this.nodeDetector.isBindsInstanceDecorator);
                if (isInstanceBinding) {
                    const provider = {
                        providerType: ProviderType.PROPERTY,
                        declaration: param.declaration,
                        optional: param.optional,
                        name,
                        type,
                    };
                    const existing = dependencyMap.get(type);
                    if (existing)
                        throw this.errorReporter.reportDuplicateProviders(type, [existing, provider]);
                    dependencyMap.set(type, provider);
                }
                else {
                    // TODO: Handle non-objects here as an error
                    // if (!(type.type.flags & ts.TypeFlags.Object)) throw Error("???")
                    // TODO: Maybe treat this as a bag of optional types instead of failing
                    if (param.optional)
                        this.errorReporter.reportComponentDependencyMayNotBeOptional(param.declaration);
                    this.propertyExtractor.getDeclaredPropertiesForType(type.type).forEach(property => {
                        const propertyType = this.propertyExtractor.typeFromPropertyDeclaration(property);
                        const propertyName = property.name.getText();
                        const provider = {
                            providerType: ProviderType.PROPERTY,
                            declaration: param.declaration,
                            type: propertyType,
                            optional: property.questionToken !== undefined,
                            name,
                            propertyName,
                        };
                        const existing = dependencyMap.get(type);
                        if (existing)
                            throw this.errorReporter.reportDuplicateProviders(type, [existing, provider]);
                        dependencyMap.set(propertyType, provider);
                    });
                }
            });
            return dependencyMap;
        }
        getRootDependencies(componentType) {
            const unimplementedMethods = this.propertyExtractor.getUnimplementedAbstractMethods(componentType);
            // TODO: Eventually we can implement some simple methods. For now fail on any unimplemented methods.
            if (unimplementedMethods.length > 0)
                this.errorReporter.reportParseFailed("Component has method(s) that Karambit cannot implement! A Component should not have any abstract methods.", unimplementedMethods[0]);
            return this.propertyExtractor.getUnimplementedAbstractProperties(componentType)
                .map(property => {
                if (property.modifiers && !property.modifiers.some(it => it.kind === ts.SyntaxKind.ReadonlyKeyword)) {
                    this.errorReporter.reportComponentPropertyMustBeReadOnly(property);
                }
                return {
                    type: this.propertyExtractor.typeFromPropertyDeclaration(property),
                    optional: property.questionToken !== undefined,
                    name: property.name,
                    typeNode: property.type,
                };
            });
        }
        getFactoriesAndBindings(componentDecorator, componentScope) {
            const installedModules = this.moduleLocator.getInstalledModules(componentDecorator);
            const factories = new Map();
            const setMultibindings = new Map();
            const mapMultibindings = new TupleMap();
            installedModules.flatMap(module => module.factories).forEach(providesMethod => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                if (providesMethod.scope && !this.nodeDetector.isReusableScope(providesMethod.scope) && providesMethod.scope != componentScope) {
                    this.errorReporter.reportInvalidScope(providesMethod, componentScope);
                }
                const intoSetDecorator = (_a = providesMethod.declaration.modifiers) === null || _a === void 0 ? void 0 : _a.find(this.nodeDetector.isIntoSetDecorator);
                const intoMapDecorator = (_b = providesMethod.declaration.modifiers) === null || _b === void 0 ? void 0 : _b.find(this.nodeDetector.isIntoMapDecorator);
                if (intoSetDecorator) {
                    const existing = (_c = setMultibindings.get(providesMethod.type)) !== null && _c !== void 0 ? _c : {
                        providerType: ProviderType.SET_MULTIBINDING,
                        type: providesMethod.type,
                        elementProviders: [],
                    };
                    const optional = (_d = this.nodeDetector.getBooleanPropertyNode(intoSetDecorator, "optional")) !== null && _d !== void 0 ? _d : false;
                    if (optional)
                        this.errorReporter.reportParseFailed("Optional multibindings not currently supported!", intoSetDecorator);
                    const elementProviderType = createQualifiedType(Object.assign(Object.assign({}, providesMethod.type), { discriminator: Symbol("element") }));
                    existing.elementProviders.push({
                        type: elementProviderType,
                        optional,
                        isIterableProvider: false,
                    });
                    setMultibindings.set(providesMethod.type, existing);
                    const existingFactory = factories.get(elementProviderType);
                    if (existingFactory)
                        throw this.errorReporter.reportDuplicateProviders(elementProviderType, [existingFactory, providesMethod]);
                    factories.set(elementProviderType, Object.assign(Object.assign({}, providesMethod), { type: elementProviderType }));
                }
                else if ((_e = providesMethod.declaration.modifiers) === null || _e === void 0 ? void 0 : _e.some(this.nodeDetector.isElementsIntoSetDecorator)) {
                    const iterableType = this.nodeDetector.isIterable(providesMethod.type.type);
                    if (!iterableType)
                        this.errorReporter.reportParseFailed("@ElementsIntoSet provider must return an iterable!", providesMethod.declaration);
                    const qualifiedType = createQualifiedType(Object.assign(Object.assign({}, providesMethod.type), { type: iterableType }));
                    const existing = (_f = setMultibindings.get(qualifiedType)) !== null && _f !== void 0 ? _f : {
                        providerType: ProviderType.SET_MULTIBINDING,
                        type: providesMethod.type,
                        elementProviders: [],
                    };
                    const elementsProviderType = createQualifiedType(Object.assign(Object.assign({}, qualifiedType), { discriminator: Symbol("element") }));
                    existing.elementProviders.push({
                        type: elementsProviderType,
                        optional: false,
                        isIterableProvider: true,
                    });
                    setMultibindings.set(providesMethod.type, existing);
                    const existingFactory = factories.get(elementsProviderType);
                    if (existingFactory)
                        throw this.errorReporter.reportDuplicateProviders(elementsProviderType, [existingFactory, providesMethod]);
                    factories.set(elementsProviderType, Object.assign(Object.assign({}, providesMethod), { type: elementsProviderType }));
                }
                else if ((_g = providesMethod.declaration.modifiers) === null || _g === void 0 ? void 0 : _g.some(this.nodeDetector.isElementsIntoMapDecorator)) {
                    const iterableType = this.nodeDetector.isIterable(providesMethod.type.type);
                    if (!iterableType)
                        this.errorReporter.reportParseFailed("@ElementsIntoMap provider must return an iterable!", providesMethod.declaration);
                    const qualifiedType = createQualifiedType(Object.assign(Object.assign({}, providesMethod.type), { type: iterableType }));
                    const info = this.nodeDetector.getMapTupleBindingInfo(qualifiedType);
                    if (!info)
                        this.errorReporter.reportParseFailed("@ElementsIntoMap provider must return an iterable of a tuple of size 2.", providesMethod.declaration);
                    const existing = (_h = mapMultibindings.get([info.valueType, info.keyType])) !== null && _h !== void 0 ? _h : {
                        providerType: ProviderType.MAP_MULTIBINDING,
                        type: info.valueType,
                        entryProviders: [],
                    };
                    const entriesProviderType = createQualifiedType(Object.assign(Object.assign({}, qualifiedType), { discriminator: Symbol("entry") }));
                    existing.entryProviders.push({
                        type: entriesProviderType,
                        optional: false,
                        isIterableProvider: true,
                    });
                    mapMultibindings.set([info.valueType, info.keyType], existing);
                    const existingFactory = factories.get(entriesProviderType);
                    if (existingFactory)
                        throw this.errorReporter.reportDuplicateProviders(entriesProviderType, [existingFactory, providesMethod]);
                    factories.set(entriesProviderType, Object.assign(Object.assign({}, providesMethod), { type: entriesProviderType }));
                }
                else if (intoMapDecorator) {
                    const info = this.nodeDetector.getMapBindingInfo(providesMethod.type, providesMethod.declaration);
                    if (!info)
                        this.errorReporter.reportParseFailed("@IntoMap provider must have @MapKey or return tuple of size 2.", providesMethod.declaration);
                    const existing = (_j = mapMultibindings.get([info.valueType, info.keyType])) !== null && _j !== void 0 ? _j : {
                        providerType: ProviderType.MAP_MULTIBINDING,
                        type: info.valueType,
                        entryProviders: [],
                    };
                    const optional = (_k = this.nodeDetector.getBooleanPropertyNode(intoMapDecorator, "optional")) !== null && _k !== void 0 ? _k : false;
                    if (optional)
                        this.errorReporter.reportParseFailed("Optional multibindings not currently supported!", intoMapDecorator);
                    const entryProviderType = createQualifiedType(Object.assign(Object.assign({}, providesMethod.type), { discriminator: Symbol("entry") }));
                    existing.entryProviders.push({
                        type: entryProviderType,
                        key: info.expression,
                        optional,
                        isIterableProvider: false,
                    });
                    mapMultibindings.set([info.valueType, info.keyType], existing);
                    const existingFactory = factories.get(entryProviderType);
                    if (existingFactory)
                        throw this.errorReporter.reportDuplicateProviders(entryProviderType, [existingFactory, providesMethod]);
                    factories.set(entryProviderType, Object.assign(Object.assign({}, providesMethod), { type: entryProviderType }));
                }
                else {
                    const existing = factories.get(providesMethod.type);
                    if (existing)
                        throw this.errorReporter.reportDuplicateProviders(providesMethod.type, [existing, providesMethod]);
                    factories.set(providesMethod.type, providesMethod);
                }
            });
            const bindings = [];
            installedModules.flatMap(it => it.bindings).forEach(binding => {
                var _a, _b, _c, _d;
                if ((_a = binding.declaration.modifiers) === null || _a === void 0 ? void 0 : _a.some(this.nodeDetector.isIntoSetDecorator)) {
                    const existing = (_b = setMultibindings.get(binding.returnType)) !== null && _b !== void 0 ? _b : {
                        providerType: ProviderType.SET_MULTIBINDING,
                        type: binding.returnType,
                        elementProviders: [],
                    };
                    const elementProviderType = createQualifiedType(Object.assign(Object.assign({}, binding.returnType), { discriminator: Symbol("element") }));
                    existing.elementProviders.push({
                        type: binding.paramType,
                        optional: false,
                        isIterableProvider: false,
                    });
                    setMultibindings.set(binding.returnType, existing);
                    const entryBinding = Object.assign(Object.assign({}, binding), { returnType: elementProviderType });
                    bindings.push(entryBinding);
                }
                else if ((_c = binding.declaration.modifiers) === null || _c === void 0 ? void 0 : _c.some(this.nodeDetector.isIntoMapDecorator)) {
                    const info = this.nodeDetector.getMapBindingInfo(binding.returnType, binding.declaration);
                    if (!info)
                        this.errorReporter.reportParseFailed("@IntoMap binding must have @MapKey or return tuple of size 2.", binding.declaration);
                    const existing = (_d = mapMultibindings.get([info.valueType, info.keyType])) !== null && _d !== void 0 ? _d : {
                        providerType: ProviderType.MAP_MULTIBINDING,
                        type: info.valueType,
                        entryProviders: [],
                    };
                    const entryProviderType = createQualifiedType(Object.assign(Object.assign({}, binding.returnType), { discriminator: Symbol("entry") }));
                    existing.entryProviders.push({
                        type: binding.paramType,
                        optional: false,
                        isIterableProvider: false,
                        key: info.expression,
                    });
                    mapMultibindings.set([info.valueType, info.keyType], existing);
                    const entryBinding = Object.assign(Object.assign({}, binding), { returnType: entryProviderType });
                    bindings.push(entryBinding);
                }
                else {
                    bindings.push(binding);
                }
            });
            return { factories, bindings, setMultibindings, mapMultibindings };
        }
        updateComponent() {
            var _a, _b;
            const component = this.component;
            const componentDecorator = (_a = component.modifiers) === null || _a === void 0 ? void 0 : _a.find(this.nodeDetector.isComponentDecorator);
            const componentScope = this.nodeDetector.getScope(component);
            const { factories, bindings, setMultibindings, mapMultibindings } = this.getFactoriesAndBindings(componentDecorator, componentScope);
            const dependencyMap = this.getDependencyMap(this.component);
            const componentType = this.typeChecker.getTypeAtLocation(component);
            const rootDependencies = this.getRootDependencies(componentType);
            if (rootDependencies.length === 0)
                this.errorReporter.reportParseFailed("Component exposes no properties! A Component must have at least one abstract property for Karambit to implement!", component);
            const typeResolver = this.typeResolverFactory(bindings);
            const subcomponentFactoryLocator = this.subcomponentFactoryLocatorFactory(new Set(this.moduleLocator.getInstalledSubcomponents(componentDecorator)));
            const graphBuilder = this.dependencyGraphBuilderFactory(typeResolver, dependencyMap, factories, setMultibindings, mapMultibindings, subcomponentFactoryLocator);
            const graph = graphBuilder.buildDependencyGraph(new Set(rootDependencies));
            const missingDependencies = Array.from(graph.missing.keys()).filter(it => !it.optional);
            if (missingDependencies.length > 0) {
                this.errorReporter.reportMissingProviders(missingDependencies.map(it => it.type), { type: createQualifiedType({ type: componentType, qualifier: internalQualifier }), rootDependencies }, graph.resolved);
            }
            const subcomponents = Array.from(graph.resolved.keys()).map(it => it.type)
                .map(subcomponentFactoryLocator.asSubcomponentFactory)
                .filterNotNull()
                .distinctBy(it => it.subcomponentType);
            const canBind = (type) => {
                return graphBuilder.buildDependencyGraph(new Set([{ type, optional: false }])).missing.size === 0;
            };
            const generatedSubcomponents = subcomponents.map(it => this.generateSubcomponent(it, componentType, typeResolver, componentScope ? new Map([[componentScope, componentType.symbol.name]]) : new Map(), canBind));
            const missingSubcomponentDependencies = generatedSubcomponents.flatMap(it => Array.from(it.graph.missing.keys()));
            const mergedGraph = graphBuilder.buildDependencyGraph(new Set([...rootDependencies, ...missingSubcomponentDependencies]));
            generatedSubcomponents.forEach(it => {
                this.verifyNoDuplicates(graph, it.graph, dependencyMap, factories);
                const missingSubcomponentDependencies = Array.from(it.graph.missing.keys()).filter(it => !it.optional && !mergedGraph.resolved.has(it.type));
                if (missingSubcomponentDependencies.length > 0) {
                    this.errorReporter.reportMissingProviders(missingSubcomponentDependencies.map(it => it.type), { type: it.type, rootDependencies: it.rootDependencies }, graph.resolved);
                }
            });
            const missing = Array.from(mergedGraph.missing.keys());
            const missingRequired = missing.filter(it => !it.optional);
            if (missingRequired.length > 0) {
                this.errorReporter.reportMissingProviders(missingRequired.map(it => it.type), { type: createQualifiedType({ type: componentType, qualifier: internalQualifier }), rootDependencies }, graph.resolved);
            }
            const builder = this.componentDeclarationBuilderFactory(typeResolver, mergedGraph.resolved);
            const missingOptionals = Array.from(mergedGraph.missing.keys()).map(it => {
                return [it.type, { providerType: ProviderType.UNDEFINED, type: it.type }];
            });
            const generatedDeps = new Map(Array.from(mergedGraph.resolved.entries()).concat(missingOptionals)
                .distinctBy(([type, provider]) => isSubcomponentFactory(provider) ? provider.subcomponentType : type));
            return [builder.declareComponent({
                    componentType: componentType,
                    preferredClassName: this.moduleLocator.getGeneratedClassName(componentDecorator),
                    declaration: component,
                    constructorParams: (_b = this.constructorHelper.getConstructorParamsForDeclaration(component)) !== null && _b !== void 0 ? _b : [],
                    members: [
                        ...rootDependencies.map(it => builder.declareComponentProperty(it)),
                        ...Array.from(generatedDeps.values()).flatMap(it => builder.getProviderDeclaration(it, componentScope)),
                        ...generatedSubcomponents.map(it => it.classElement)
                    ]
                })];
        }
        generateSubcomponent(factory, parentType, resolver, ancestorScopes, parentCanBind) {
            const dependencyMap = this.getDependencyMap(factory.declaration);
            const subcomponentScope = this.nodeDetector.getScope(factory.declaration);
            const { factories, bindings, setMultibindings, mapMultibindings } = this.getFactoriesAndBindings(factory.decorator, subcomponentScope);
            const typeResolver = TypeResolver.merge(resolver, bindings);
            const rootDependencies = this.getRootDependencies(factory.subcomponentType.type);
            if (rootDependencies.length === 0)
                this.errorReporter.reportParseFailed("Subcomponent exposes no properties! A Subcomponent must have at least one abstract property for Karambit to implement!", factory.declaration);
            const subcomponentFactoryLocator = this.subcomponentFactoryLocatorFactory(new Set(this.moduleLocator.getInstalledSubcomponents(factory.decorator)));
            const scope = this.nodeDetector.getScope(factory.declaration);
            const graphBuilder = this.dependencyGraphBuilderFactory(typeResolver, dependencyMap, factories, setMultibindings, mapMultibindings, subcomponentFactoryLocator, { filterOnly: scope }, parentCanBind);
            const graph = graphBuilder.buildDependencyGraph(new Set(rootDependencies));
            const subcomponents = Array.from(graph.resolved.keys()).map(it => it.type)
                .map(subcomponentFactoryLocator.asSubcomponentFactory)
                .filterNotNull()
                .distinctBy(it => it.subcomponentType);
            const subcomponentName = factory.subcomponentType.type.symbol.name;
            const duplicateScope = scope && ancestorScopes.get(scope);
            if (duplicateScope) {
                this.errorReporter.reportDuplicateScope(subcomponentName, duplicateScope);
            }
            const graphResolver = (type) => {
                return parentCanBind(type) || graphBuilder.buildDependencyGraph(new Set([{ type, optional: false }])).missing.size === 0;
            };
            const generatedSubcomponents = subcomponents.map(it => this.generateSubcomponent(it, factory.subcomponentType.type, typeResolver, scope ? new Map([...ancestorScopes.entries(), [scope, subcomponentName]]) : ancestorScopes, graphResolver));
            const missingSubcomponentDependencies = generatedSubcomponents.flatMap(it => Array.from(it.graph.missing.keys()));
            generatedSubcomponents.forEach(it => {
                this.verifyNoDuplicates(graph, it.graph, dependencyMap, factories);
            });
            const mergedGraph = graphBuilder.buildDependencyGraph(new Set([...rootDependencies, ...missingSubcomponentDependencies]));
            const subcomponentBuilder = this.componentDeclarationBuilderFactory(typeResolver, mergedGraph.resolved);
            const missing = Array.from(mergedGraph.missing.keys());
            const missingRequired = missing.filter(it => !it.optional && !parentCanBind(it.type))
                .map(it => it.type);
            if (missingRequired.length > 0) {
                this.errorReporter.reportMissingProviders(missingRequired, { type: factory.subcomponentType, rootDependencies }, mergedGraph.resolved);
            }
            const missingOptionals = missing.map(it => {
                return [it.type, { providerType: ProviderType.PARENT, type: it.type }];
            });
            const generatedDeps = new Map(Array.from(mergedGraph.resolved.entries()).concat(missingOptionals)
                .distinctBy(([type, provider]) => isSubcomponentFactory(provider) ? provider.subcomponentType : type));
            const members = [
                ...rootDependencies.map(it => subcomponentBuilder.declareComponentProperty(it)),
                ...Array.from(generatedDeps.values()).flatMap(it => subcomponentBuilder.getProviderDeclaration(it, scope)),
                ...generatedSubcomponents.map(it => it.classElement),
            ];
            return {
                classElement: subcomponentBuilder.declareSubcomponent(factory, parentType, members),
                type: factory.subcomponentType,
                graph: mergedGraph,
                name: subcomponentName,
                rootDependencies,
            };
        }
        verifyNoDuplicates(parentGraph, subgraph, dependencyMap, providesMethods) {
            Array.from(subgraph.resolved.entries())
                .forEach(([type, provider]) => {
                var _a, _b;
                const duplicate = (_b = (_a = parentGraph.resolved.get(type)) !== null && _a !== void 0 ? _a : dependencyMap.get(type)) !== null && _b !== void 0 ? _b : providesMethods.get(type);
                if (duplicate
                    && !(provider.providerType === ProviderType.INJECTABLE_CONSTRUCTOR && duplicate.providerType === ProviderType.INJECTABLE_CONSTRUCTOR)
                    && !(provider.providerType === ProviderType.SET_MULTIBINDING && duplicate.providerType === ProviderType.SET_MULTIBINDING)
                    && !(provider.providerType === ProviderType.MAP_MULTIBINDING && duplicate.providerType === ProviderType.MAP_MULTIBINDING)) {
                    this.errorReporter.reportDuplicateProviders(type, [duplicate, provider]);
                }
            });
        }
    };
    __setFunctionName(_classThis, "ComponentGenerator");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ComponentGenerator = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ComponentGenerator = _classThis;
})();
export { ComponentGenerator };
