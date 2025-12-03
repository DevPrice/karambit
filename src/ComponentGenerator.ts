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
import {ComponentDeclaration, ComponentLikeDeclaration, ComponentScope, isTypeNullable} from "./TypescriptUtil"
import {ModuleProviders, ProviderLocator} from "./ProviderLocator"
import {distinctBy, isNotNull} from "./Util"

interface GeneratedSubcomponent {
    readonly name: string
    readonly classElement: ts.ClassElement
    readonly graph: DependencyGraph
    readonly type: QualifiedType
    readonly exposedProperties: Iterable<Dependency>
    readonly requiresUnsetSymbolDeclaration: boolean
}

export interface GeneratedComponent {
    readonly classDeclaration: ts.ClassDeclaration
    readonly requiresUnsetSymbolDeclaration: boolean
}

export interface ComponentGeneratorDependencies {
    readonly generatedComponent: GeneratedComponent
}

export type ComponentGeneratorDependenciesFactory = (componentDeclaration: ComponentDeclaration) => ComponentGeneratorDependencies

type RootDependency = Dependency & {name: ts.PropertyName, typeNode?: ts.TypeNode}

interface ComponentDefinition extends ModuleProviders {
    declaration: ComponentLikeDeclaration
    scope?: ComponentScope
    preferredClassName?: string
    providedProperties: ReadonlyMap<QualifiedType, PropertyProvider>
    exposedProperties: RootDependency[]
    subcomponents: ts.Symbol[]
}

@Inject
@Reusable
export class ComponentGenerator {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly nameGenerator: NameGenerator,
        private readonly moduleLocator: ModuleLocator,
        private readonly constructorHelper: ConstructorHelper,
        private readonly propertyExtractor: PropertyExtractor,
        private readonly errorReporter: ErrorReporter,
        private readonly providerLocator: ProviderLocator,
        private readonly component: ComponentDeclaration,
        private readonly componentDeclarationBuilderFactory: ComponentDeclarationBuilderFactory,
        private readonly subcomponentFactoryLocatorFactory: SubcomponentFactoryLocatorFactory,
        private readonly typeResolverFactory: TypeResolverFactory,
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
        const componentAnnotation = this.nodeDetector.getComponentAnnotation(component)
        const definition = this.getComponentDefinition(component, componentAnnotation && ts.isDecorator(componentAnnotation) ? componentAnnotation : undefined)
        if (definition.exposedProperties.length === 0) {
            this.errorReporter.reportParseFailed(
                "Component exposes no properties! A Component must have at least one abstract property for Karambit to implement!",
                component,
            )
        }

        const componentType = this.typeChecker.getTypeAtLocation(component)
        const generatedName = component.name ? `Karambit${component.name?.text}` : undefined
        const componentIdentifier = this.nameGenerator.getComponentIdentifier(componentType, definition.preferredClassName ?? generatedName)
        const subcomponentFactoryLocator = this.subcomponentFactoryLocatorFactory(new Set(definition.subcomponents))

        const typeResolver = this.typeResolverFactory(definition.bindings)
        const graphBuilder = this.dependencyGraphBuilderFactory(
            typeResolver,
            definition.providedProperties,
            definition.factories,
            definition.setMultibindings,
            definition.mapMultibindings,
            subcomponentFactoryLocator,
        )
        const graph = graphBuilder.buildDependencyGraph(new Set(definition.exposedProperties))
        const missingDependencies = Array.from(graph.missing.keys()).filter(it => !it.optional)
        if (missingDependencies.length > 0) {
            this.errorReporter.reportMissingProviders(
                missingDependencies.map(it => it.type),
                {type: createQualifiedType({type: componentType, qualifier: internalQualifier}), exposedProperties: definition.exposedProperties},
                graph.resolved
            )
        }

        const subcomponents = distinctBy(
            Array.from(graph.resolved.keys()).map(it => it.type)
                .map(subcomponentFactoryLocator.asSubcomponentFactory)
                .filter(isNotNull),
            it => it.subcomponentType
        )
        const canBind = (type: QualifiedType, given: ReadonlySet<QualifiedType>) => {
            return graphBuilder.buildDependencyGraph(new Set([{type, optional: false}]), given).missing.size === 0
        }
        const generatedSubcomponents = subcomponents.map(it =>
            this.generateSubcomponent(it, componentIdentifier, typeResolver, definition.scope ? new Map([[definition.scope, componentType.symbol.name]]) : new Map(), canBind)
        )

        const missingSubcomponentDependencies = generatedSubcomponents.flatMap(it => Array.from(it.graph.missing.keys()))
        const mergedGraph = graphBuilder.buildDependencyGraph(new Set([...definition.exposedProperties, ...missingSubcomponentDependencies]))
        generatedSubcomponents.forEach(it => {
            this.verifyNoDuplicates(graph, it.graph, definition.providedProperties, definition.factories)
            const missingSubcomponentDependencies = Array.from(it.graph.missing.keys()).filter(it => !it.optional && !mergedGraph.resolved.has(it.type))
            if (missingSubcomponentDependencies.length > 0) {
                this.errorReporter.reportMissingProviders(
                    missingSubcomponentDependencies.map(it => it.type),
                    {type: it.type, exposedProperties: it.exposedProperties},
                    graph.resolved
                )
            }
        })

        const missing = Array.from(mergedGraph.missing.keys())
        const missingRequired = missing.filter(it => !it.optional)
        if (missingRequired.length > 0) {
            this.errorReporter.reportMissingProviders(
                missingRequired.map(it => it.type),
                {type: createQualifiedType({type: componentType, qualifier: internalQualifier}), exposedProperties: definition.exposedProperties},
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
            distinctBy(
                Array.from<[QualifiedType, InstanceProvider]>(mergedGraph.resolved.entries()).concat(missingOptionals),
                ([type, provider]) => isSubcomponentFactory(provider) ? provider.subcomponentType : type
            )
        )
        const classDeclaration = builder.declareComponent({
            identifier: componentIdentifier,
            declaration: component,
            constructorParams: ts.isClassLike(component) ? this.constructorHelper.getConstructorParamsForDeclaration(component) : [],
            members: [
                ...definition.exposedProperties.map(it => builder.declareComponentProperty(component, it)),
                ...Array.from(generatedDeps.values()).flatMap(it => builder.getProviderDeclaration(it, definition.scope)),
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
        ancestorScopes: ReadonlyMap<ComponentScope, string>,
        parentCanBind: (type: QualifiedType, given: ReadonlySet<QualifiedType>) => boolean,
    ): GeneratedSubcomponent {
        const definition = this.getComponentDefinition(factory.declaration, factory.decorator)
        if (definition.exposedProperties.length === 0) {
            this.errorReporter.reportParseFailed(
                "Subcomponent exposes no properties! A Subcomponent must have at least one abstract property for Karambit to implement!",
                factory.declaration,
            )
        }

        const typeResolver = TypeResolver.merge(resolver, definition.bindings)
        const subcomponentFactoryLocator = this.subcomponentFactoryLocatorFactory(new Set(definition.subcomponents))
        const graphBuilder = this.dependencyGraphBuilderFactory(
            typeResolver,
            definition.providedProperties,
            definition.factories,
            definition.setMultibindings,
            definition.mapMultibindings,
            subcomponentFactoryLocator,
            {filterOnly: definition.scope},
            type => parentCanBind(type, new Set()),
        )
        const graph = graphBuilder.buildDependencyGraph(new Set(definition.exposedProperties))

        const subcomponentName = factory.subcomponentType.type.symbol.name
        const subcomponentIdentifier = ts.factory.createUniqueName(subcomponentName)

        const subcomponents = distinctBy(
            Array.from(graph.resolved.keys()).map(it => it.type)
                .map(subcomponentFactoryLocator.asSubcomponentFactory)
                .filter(isNotNull),
            it => it.subcomponentType
        )
        const duplicateScope = definition.scope && ancestorScopes.get(definition.scope)
        if (duplicateScope) {
            this.errorReporter.reportDuplicateScope(subcomponentName, duplicateScope)
        }
        const graphResolver = (type: QualifiedType, given: ReadonlySet<QualifiedType>) => {
            return parentCanBind(type, new Set([...given, ...graph.resolved.keys()])) || graphBuilder.buildDependencyGraph(new Set([{type, optional: false}])).missing.size === 0
        }
        const generatedSubcomponents = subcomponents.map(it =>
            this.generateSubcomponent(it, subcomponentIdentifier, typeResolver, definition.scope ? new Map([...ancestorScopes.entries(), [definition.scope, subcomponentName]]) : ancestorScopes, graphResolver)
        )
        const missingSubcomponentDependencies = generatedSubcomponents.flatMap(it => Array.from(it.graph.missing.keys()))

        generatedSubcomponents.forEach(it => {
            this.verifyNoDuplicates(graph, it.graph, definition.providedProperties, definition.factories)
        })

        const mergedGraph = graphBuilder.buildDependencyGraph(new Set([...definition.exposedProperties, ...missingSubcomponentDependencies]))

        const subcomponentBuilder = this.componentDeclarationBuilderFactory(
            typeResolver,
            mergedGraph.resolved,
        )

        const resolvedTypes = new Set(mergedGraph.resolved.keys())
        const missing = Array.from(mergedGraph.missing.keys())
        const missingRequired = missing.filter(it => !it.optional && !parentCanBind(it.type, resolvedTypes))
            .map(it => it.type)

        if (missingRequired.length > 0) {
            this.errorReporter.reportMissingProviders(
                missingRequired,
                {type: factory.subcomponentType, exposedProperties: definition.exposedProperties},
                mergedGraph.resolved,
            )
        }

        const missingOptionals: [QualifiedType, ParentProvider][] = missing.map(it => {
            return [it.type, {providerType: ProviderType.PARENT, type: it.type, optional: !parentCanBind(it.type, resolvedTypes)}]
        })
        const generatedDeps = new Map(
            distinctBy(
                Array.from<[QualifiedType, InstanceProvider]>(mergedGraph.resolved.entries()).concat(missingOptionals),
                ([type, provider]) => isSubcomponentFactory(provider) ? provider.subcomponentType : type
            )
        )
        const members = [
            ...definition.exposedProperties.map(it => subcomponentBuilder.declareComponentProperty(factory.declaration, it)),
            ...Array.from(generatedDeps.values()).flatMap(it => subcomponentBuilder.getProviderDeclaration(it, definition.scope)),
            ...generatedSubcomponents.map(it => it.classElement),
        ]
        const requiresUnsetSymbolDeclaration = generatedSubcomponents.some(it => it.requiresUnsetSymbolDeclaration)
            || Array.from(generatedDeps.entries()).some(([type, provider]) => isTypeNullable(type.type) && provider.scope)
        return {
            classElement: subcomponentBuilder.declareSubcomponent(factory, subcomponentIdentifier, parentType, members),
            type: factory.subcomponentType,
            graph: mergedGraph,
            name: subcomponentName,
            exposedProperties: definition.exposedProperties,
            requiresUnsetSymbolDeclaration,
        }
    }

    private getComponentDefinition(declaration: ComponentLikeDeclaration, annotation: ts.Decorator | undefined): ComponentDefinition {
        const scope = this.nodeDetector.getScope(declaration)
        const providers = this.providerLocator.findFactoriesAndBindings(declaration, annotation, scope)
        return {
            ...providers,
            declaration,
            scope,
            preferredClassName: this.moduleLocator.getGeneratedName(declaration),
            providedProperties: this.providerLocator.findPropertyProviders(declaration),
            exposedProperties: this.getRootDependencies(this.typeChecker.getTypeAtLocation(declaration)),
            subcomponents: this.moduleLocator.getInstalledSubcomponents(declaration, annotation),
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
