import * as ts from "typescript"
import {NameGenerator} from "./NameGenerator"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {ModuleLocator} from "./ModuleLocator"
import {Dependency, DependencyGraph, DependencyGraphBuilderFactory} from "./DependencyGraphBuilder"
import {ConstructorHelper} from "./ConstructorHelper"
import {TypeResolver, TypeResolverFactory} from "./TypeResolver"
import {createQualifiedType, internalQualifier, QualifiedType} from "./QualifiedType"
import {SubcomponentFactoryLocatorFactory} from "./SubcomponentFactoryLocator"
import {PropertyExtractor} from "./PropertyExtractor"
import {
    InstanceProvider,
    isSubcomponentFactory,
    ParentProvider,
    PropertyProvider,
    ProviderType,
    ProvidesMethod,
    SubcomponentFactory,
    UndefinedProvider,
} from "./Providers"
import {ErrorReporter} from "./ErrorReporter"
import {Inject, Reusable} from "karambit-decorators"
import {ComponentDeclarationBuilderFactory} from "./ComponentDeclarationBuilder"
import {isTypeNullable} from "./TypescriptUtil"
import {ProviderLocator} from "./ProviderLocator"

interface GeneratedSubcomponent {
    readonly name: string
    readonly classElement: ts.ClassElement
    readonly graph: DependencyGraph
    readonly type: QualifiedType
    readonly rootDependencies: Iterable<Dependency>
    readonly requiresUnsetSymbolDeclaration: boolean
}

export interface GeneratedComponent {
    readonly classDeclaration: ts.ClassDeclaration
    readonly requiresUnsetSymbolDeclaration: boolean
}

export interface ComponentGeneratorDependencies {
    readonly generatedComponent: GeneratedComponent
}

export type ComponentGeneratorDependenciesFactory = (componentDeclaration: ts.ClassDeclaration) => ComponentGeneratorDependencies

type RootDependency = Dependency & {name: ts.PropertyName, typeNode?: ts.TypeNode}

@Inject
@Reusable
export class ComponentGenerator {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly nameGenerator: NameGenerator,
        private readonly componentDeclarationBuilderFactory: ComponentDeclarationBuilderFactory,
        private readonly subcomponentFactoryLocatorFactory: SubcomponentFactoryLocatorFactory,
        private readonly typeResolverFactory: TypeResolverFactory,
        private readonly moduleLocator: ModuleLocator,
        private readonly constructorHelper: ConstructorHelper,
        private readonly propertyExtractor: PropertyExtractor,
        private readonly errorReporter: ErrorReporter,
        private readonly providerLocator: ProviderLocator,
        private readonly component: ts.ClassDeclaration,
        private readonly dependencyGraphBuilderFactory: DependencyGraphBuilderFactory,
    ) { }

    private getRootDependencies(componentType: ts.Type): RootDependency[] {
        const unimplementedMethods = this.propertyExtractor.getUnimplementedAbstractMethods(componentType)
        // TODO: Eventually we can implement some simple methods. For now fail on any unimplemented methods.
        if (unimplementedMethods.length > 0) this.errorReporter.reportParseFailed("Component has method(s) that Karambit cannot implement! A Component should not have any abstract methods.", unimplementedMethods[0])
        return this.propertyExtractor.getUnimplementedAbstractProperties(componentType)
            .map(property => {
                if (property.modifiers && !property.modifiers.some(it => it.kind === ts.SyntaxKind.ReadonlyKeyword)) {
                    this.errorReporter.reportComponentPropertyMustBeReadOnly(property)
                }
                return {
                    type: this.propertyExtractor.typeFromPropertyDeclaration(property),
                    optional: property.questionToken !== undefined,
                    name: property.name,
                    typeNode: property.type,
                }
            })
    }

    generateComponent(): GeneratedComponent {
        const component = this.component
        const componentDecorator = component.modifiers?.find(this.nodeDetector.isComponentDecorator)!
        const componentScope = this.nodeDetector.getScope(component)
        const {factories, bindings, setMultibindings, mapMultibindings} = this.providerLocator.findFactoriesAndBindings(componentDecorator, componentScope)
        const dependencyMap = this.providerLocator.findPropertyProviders(this.component)

        const componentType = this.typeChecker.getTypeAtLocation(component)

        const preferredClassName = this.moduleLocator.getGeneratedClassName(componentDecorator)
        const componentIdentifier = this.nameGenerator.getComponentIdentifier(componentType, preferredClassName)

        const rootDependencies = this.getRootDependencies(componentType)
        if (rootDependencies.length === 0) this.errorReporter.reportParseFailed("Component exposes no properties! A Component must have at least one abstract property for Karambit to implement!", component)

        const typeResolver = this.typeResolverFactory(bindings)
        const subcomponentFactoryLocator = this.subcomponentFactoryLocatorFactory(
            new Set(this.moduleLocator.getInstalledSubcomponents(componentDecorator))
        )
        const graphBuilder = this.dependencyGraphBuilderFactory(
            typeResolver,
            dependencyMap,
            factories,
            setMultibindings,
            mapMultibindings,
            subcomponentFactoryLocator,
        )
        const graph = graphBuilder.buildDependencyGraph(new Set(rootDependencies))
        const missingDependencies = Array.from(graph.missing.keys()).filter(it => !it.optional)
        if (missingDependencies.length > 0) {
            this.errorReporter.reportMissingProviders(
                missingDependencies.map(it => it.type),
                {type: createQualifiedType({type: componentType, qualifier: internalQualifier}), rootDependencies},
                graph.resolved
            )
        }

        const subcomponents = Array.from(graph.resolved.keys()).map(it => it.type)
            .map(subcomponentFactoryLocator.asSubcomponentFactory)
            .filterNotNull()
            .distinctBy(it => it.subcomponentType)
        const canBind = (type: QualifiedType, given: ReadonlySet<QualifiedType>) => {
            return graphBuilder.buildDependencyGraph(new Set([{type, optional: false}]), given).missing.size === 0
        }
        const generatedSubcomponents = subcomponents.map(it =>
            this.generateSubcomponent(it, componentIdentifier, typeResolver, componentScope ? new Map([[componentScope, componentType.symbol.name]]) : new Map(), canBind)
        )

        const missingSubcomponentDependencies = generatedSubcomponents.flatMap(it => Array.from(it.graph.missing.keys()))
        const mergedGraph = graphBuilder.buildDependencyGraph(new Set([...rootDependencies, ...missingSubcomponentDependencies]))
        generatedSubcomponents.forEach(it => {
            this.verifyNoDuplicates(graph, it.graph, dependencyMap, factories)
            const missingSubcomponentDependencies = Array.from(it.graph.missing.keys()).filter(it => !it.optional && !mergedGraph.resolved.has(it.type))
            if (missingSubcomponentDependencies.length > 0) {
                this.errorReporter.reportMissingProviders(
                    missingSubcomponentDependencies.map(it => it.type),
                    {type: it.type, rootDependencies: it.rootDependencies},
                    graph.resolved
                )
            }
        })

        const missing = Array.from(mergedGraph.missing.keys())
        const missingRequired = missing.filter(it => !it.optional)
        if (missingRequired.length > 0) {
            this.errorReporter.reportMissingProviders(
                missingRequired.map(it => it.type),
                {type: createQualifiedType({type: componentType, qualifier: internalQualifier}), rootDependencies},
                graph.resolved
            )
        }

        const builder = this.componentDeclarationBuilderFactory(
            typeResolver,
            mergedGraph.resolved,
        )

        const missingOptionals: [QualifiedType, UndefinedProvider][] = Array.from(mergedGraph.missing.keys()).map(it => {
            return [it.type, {providerType: ProviderType.UNDEFINED, type: it.type}]
        })
        const generatedDeps = new Map(
            Array.from<[QualifiedType, InstanceProvider]>(mergedGraph.resolved.entries()).concat(missingOptionals)
                .distinctBy(([type, provider]) => isSubcomponentFactory(provider) ? provider.subcomponentType : type)
        )
        const classDeclaration = builder.declareComponent({
            identifier: componentIdentifier,
            declaration: component,
            constructorParams: this.constructorHelper.getConstructorParamsForDeclaration(component) ?? [],
            members: [
                ...rootDependencies.map(it => builder.declareComponentProperty(component, it)),
                ...Array.from(generatedDeps.values()).flatMap(it => builder.getProviderDeclaration(it, componentScope)),
                ...generatedSubcomponents.map(it => it.classElement)
            ]
        })
        const requiresUnsetSymbolDeclaration = generatedSubcomponents.some(it => it.requiresUnsetSymbolDeclaration)
            || Array.from(generatedDeps.entries()).some(([type, provider]) => isTypeNullable(type.type) && provider.scope)
        return {classDeclaration, requiresUnsetSymbolDeclaration}
    }

    private generateSubcomponent(
        factory: SubcomponentFactory,
        parentType: ts.EntityName,
        resolver: TypeResolver,
        ancestorScopes: ReadonlyMap<ts.Symbol, string>,
        parentCanBind: (type: QualifiedType, given: ReadonlySet<QualifiedType>) => boolean,
    ): GeneratedSubcomponent {
        const dependencyMap = this.providerLocator.findPropertyProviders(factory.declaration)
        const subcomponentScope = this.nodeDetector.getScope(factory.declaration)
        const {factories, bindings, setMultibindings, mapMultibindings} = this.providerLocator.findFactoriesAndBindings(factory.decorator, subcomponentScope)
        const typeResolver = TypeResolver.merge(resolver, bindings)
        const rootDependencies = this.getRootDependencies(factory.subcomponentType.type)
        if (rootDependencies.length === 0) this.errorReporter.reportParseFailed("Subcomponent exposes no properties! A Subcomponent must have at least one abstract property for Karambit to implement!", factory.declaration)

        const subcomponentFactoryLocator = this.subcomponentFactoryLocatorFactory(
            new Set(this.moduleLocator.getInstalledSubcomponents(factory.decorator)),
        )
        const scope = this.nodeDetector.getScope(factory.declaration)
        const graphBuilder = this.dependencyGraphBuilderFactory(
            typeResolver,
            dependencyMap,
            factories,
            setMultibindings,
            mapMultibindings,
            subcomponentFactoryLocator,
            {filterOnly: scope},
            type => parentCanBind(type, new Set()),
        )
        const graph = graphBuilder.buildDependencyGraph(new Set(rootDependencies))

        const subcomponentName = factory.subcomponentType.type.symbol.name
        const subcomponentIdentifier = ts.factory.createUniqueName(subcomponentName)

        const subcomponents = Array.from(graph.resolved.keys()).map(it => it.type)
            .map(subcomponentFactoryLocator.asSubcomponentFactory)
            .filterNotNull()
            .distinctBy(it => it.subcomponentType)
        const duplicateScope = scope && ancestorScopes.get(scope)
        if (duplicateScope) {
            this.errorReporter.reportDuplicateScope(subcomponentName, duplicateScope)
        }
        const graphResolver = (type: QualifiedType, given: ReadonlySet<QualifiedType>) => {
            return parentCanBind(type, new Set([...given, ...graph.resolved.keys()])) || graphBuilder.buildDependencyGraph(new Set([{type, optional: false}])).missing.size === 0
        }
        const generatedSubcomponents = subcomponents.map(it =>
            this.generateSubcomponent(it, subcomponentIdentifier, typeResolver, scope ? new Map([...ancestorScopes.entries(), [scope, subcomponentName]]) : ancestorScopes, graphResolver)
        )
        const missingSubcomponentDependencies = generatedSubcomponents.flatMap(it => Array.from(it.graph.missing.keys()))

        generatedSubcomponents.forEach(it => {
            this.verifyNoDuplicates(graph, it.graph, dependencyMap, factories)
        })

        const mergedGraph = graphBuilder.buildDependencyGraph(new Set([...rootDependencies, ...missingSubcomponentDependencies]))

        const subcomponentBuilder = this.componentDeclarationBuilderFactory(
            typeResolver,
            mergedGraph.resolved,
        )

        const resolvedTypes = new Set(mergedGraph.resolved.keys())
        const missing = Array.from(mergedGraph.missing.keys())
        const missingRequired = missing.filter(it => !it.optional && !parentCanBind(it.type, resolvedTypes))
            .map(it => it.type)

        if (missingRequired.length > 0) {
            this.errorReporter.reportMissingProviders(missingRequired, {type: factory.subcomponentType, rootDependencies}, mergedGraph.resolved)
        }

        const missingOptionals: [QualifiedType, ParentProvider][] = missing.map(it => {
            return [it.type, {providerType: ProviderType.PARENT, type: it.type, optional: !parentCanBind(it.type, resolvedTypes)}]
        })
        const generatedDeps = new Map(
            Array.from<[QualifiedType, InstanceProvider]>(mergedGraph.resolved.entries()).concat(missingOptionals)
                .distinctBy(([type, provider]) => isSubcomponentFactory(provider) ? provider.subcomponentType : type)
        )
        const members = [
            ...rootDependencies.map(it => subcomponentBuilder.declareComponentProperty(factory.declaration, it)),
            ...Array.from(generatedDeps.values()).flatMap(it => subcomponentBuilder.getProviderDeclaration(it, scope)),
            ...generatedSubcomponents.map(it => it.classElement),
        ]
        const requiresUnsetSymbolDeclaration = generatedSubcomponents.some(it => it.requiresUnsetSymbolDeclaration)
            || Array.from(generatedDeps.entries()).some(([type, provider]) => isTypeNullable(type.type) && provider.scope)
        return {
            classElement: subcomponentBuilder.declareSubcomponent(factory, subcomponentIdentifier, parentType, members),
            type: factory.subcomponentType,
            graph: mergedGraph,
            name: subcomponentName,
            rootDependencies,
            requiresUnsetSymbolDeclaration,
        }
    }

    private verifyNoDuplicates(
        parentGraph: DependencyGraph,
        subgraph: DependencyGraph,
        dependencyMap: ReadonlyMap<QualifiedType, PropertyProvider>,
        providesMethods: ReadonlyMap<QualifiedType, ProvidesMethod>,
    ) {
        Array.from(subgraph.resolved.entries())
            .forEach(([type, provider]) => {
                const duplicate = parentGraph.resolved.get(type) ?? dependencyMap.get(type) ?? providesMethods.get(type)
                if (duplicate
                    && !(provider.providerType === ProviderType.INJECTABLE_CONSTRUCTOR && duplicate.providerType === ProviderType.INJECTABLE_CONSTRUCTOR)
                    && !(provider.providerType === ProviderType.SET_MULTIBINDING && duplicate.providerType === ProviderType.SET_MULTIBINDING)
                    && !(provider.providerType === ProviderType.MAP_MULTIBINDING && duplicate.providerType === ProviderType.MAP_MULTIBINDING)) {
                    this.errorReporter.reportDuplicateProviders(type, [duplicate, provider])
                }
            })
    }
}
