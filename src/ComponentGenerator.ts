import * as ts from "typescript"
import {NameGenerator} from "./NameGenerator"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {Importer} from "./Importer"
import {Binding, ModuleLocator} from "./ModuleLocator"
import {ComponentDeclarationBuilder} from "./ComponentDeclarationBuilder"
import {Dependency, DependencyGraph, DependencyGraphBuilder} from "./DependencyGraphBuilder"
import {ConstructorHelper} from "./ConstructorHelper"
import {TypeResolver} from "./TypeResolver"
import {createQualifiedType, internalQualifier, QualifiedType} from "./QualifiedType"
import {SubcomponentFactoryLocator} from "./SubcomponentFactoryLocator"
import {PropertyExtractor} from "./PropertyExtractor"
import {
    InstanceProvider,
    isSubcomponentFactory,
    MapMultibinding,
    ParentProvider,
    PropertyProvider,
    ProviderType,
    ProvidesMethod,
    SetMultibinding,
    SubcomponentFactory,
    UndefinedProvider
} from "./Providers"
import {ErrorReporter} from "./ErrorReporter"
import {Inject, Reusable} from "karambit-inject"
import {TupleMap} from "./Util"

interface GeneratedSubcomponent {
    readonly name: string
    readonly classElement: ts.ClassElement
    readonly graph: DependencyGraph
    readonly type: QualifiedType
    readonly rootDependencies: Iterable<Dependency>
}

export interface ModuleProviders {
    factories: ReadonlyMap<QualifiedType, ProvidesMethod>
    bindings: Iterable<Binding>
    setMultibindings: ReadonlyMap<QualifiedType, SetMultibinding>
    mapMultibindings: ReadonlyMap<[QualifiedType, ts.Type], MapMultibinding>
}

export interface ComponentGeneratorDependencies {
    readonly generator: ComponentGenerator
}

export type ComponentGeneratorDependenciesFactory = (componentDeclaration: ts.ClassDeclaration) => ComponentGeneratorDependencies

@Inject
@Reusable
export class ComponentGenerator {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly context: ts.TransformationContext,
        private readonly sourceFile: ts.SourceFile,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly nameGenerator: NameGenerator,
        private readonly importer: Importer,
        private readonly moduleLocator: ModuleLocator,
        private readonly constructorHelper: ConstructorHelper,
        private readonly propertyExtractor: PropertyExtractor,
        private readonly errorReporter: ErrorReporter,
        private readonly component: ts.ClassDeclaration,
    ) { }

    private getDependencyMap(component: ts.ClassLikeDeclaration): ReadonlyMap<QualifiedType, PropertyProvider> {
        const dependencyParams = this.constructorHelper.getConstructorParamsForDeclaration(component) ?? []
        const dependencyMap = new Map<QualifiedType, PropertyProvider>()
        dependencyParams.forEach(param => {
            const name = this.nameGenerator.getPropertyIdentifierForParameter(param.declaration)
            const type = param.type
            const isInstanceBinding = param.decorators.some(this.nodeDetector.isBindsInstanceDecorator)
            if (isInstanceBinding) {
                const provider: PropertyProvider = {
                    providerType: ProviderType.PROPERTY,
                    declaration: param.declaration,
                    optional: param.optional,
                    name,
                    type,
                }
                const existing = dependencyMap.get(type)
                if (existing) throw this.errorReporter.reportDuplicateProviders(type, [existing, provider])
                dependencyMap.set(type, provider)
            } else {
                // TODO: Handle non-objects here as an error
                // if (!(type.type.flags & ts.TypeFlags.Object)) throw Error("???")

                // TODO: Maybe treat this as a bag of optional types instead of failing
                if (param.optional) this.errorReporter.reportComponentDependencyMayNotBeOptional(param.declaration)

                this.propertyExtractor.getDeclaredPropertiesForType(type.type).forEach(property => {
                    const propertyType = this.propertyExtractor.typeFromPropertyDeclaration(property)
                    const propertyName = property.name.getText()
                    const provider: PropertyProvider = {
                        providerType: ProviderType.PROPERTY,
                        declaration: param.declaration,
                        type: propertyType,
                        optional: property.questionToken !== undefined,
                        name,
                        propertyName,
                    }
                    const existing = dependencyMap.get(type)
                    if (existing) throw this.errorReporter.reportDuplicateProviders(type, [existing, provider])
                    dependencyMap.set(propertyType, provider)
                })
            }
        })
        return dependencyMap
    }

    private getRootDependencies(componentType: ts.Type): Iterable<Dependency> {
        return this.propertyExtractor.getDeclaredPropertiesForType(componentType)
            .filter(property => property.initializer === undefined)
            .map(property => {
                if (!property.modifiers || !property.modifiers.some(it => it.kind === ts.SyntaxKind.ReadonlyKeyword)) {
                    this.errorReporter.reportComponentPropertyMustBeReadOnly(property)
                }
                return {
                    type: this.propertyExtractor.typeFromPropertyDeclaration(property),
                    optional: property.questionToken !== undefined
                }
            })
    }

    private getFactoriesAndBindings(
        componentDecorator: ts.Decorator,
        componentScope?: ts.Symbol
    ): ModuleProviders {
        const installedModules = this.moduleLocator.getInstalledModules(componentDecorator)
        const factories = new Map<QualifiedType, ProvidesMethod>()
        const setMultibindings = new Map<QualifiedType, SetMultibinding>()
        const mapMultibindings = new TupleMap<[QualifiedType, ts.Type], MapMultibinding>()
        installedModules.flatMap(module => module.factories).forEach(providesMethod => {
            if (providesMethod.scope && !this.nodeDetector.isReusableScope(providesMethod.scope) && providesMethod.scope != componentScope) {
                this.errorReporter.reportInvalidScope(providesMethod, componentScope)
            }
            if (providesMethod.declaration.modifiers?.some(this.nodeDetector.isIntoSetDecorator)) {
                const existing: SetMultibinding = setMultibindings.get(providesMethod.type) ?? {
                    providerType: ProviderType.SET_MULTIBINDING,
                    type: providesMethod.type,
                    elementBindings: [],
                    elementProviders: []
                }
                existing.elementProviders.push({...providesMethod, type: createQualifiedType({...providesMethod.type, discriminator: Symbol("element")})})
                setMultibindings.set(providesMethod.type, existing)
            } else if (providesMethod.declaration.modifiers?.some(this.nodeDetector.isIntoMapDecorator)) {
                const keyInfo = this.nodeDetector.getMapKey(providesMethod.declaration)
                if (!keyInfo) this.errorReporter.reportParseFailed("@IntoMap provider must have @MapKey")

                const existing: MapMultibinding = mapMultibindings.get([providesMethod.type, keyInfo.keyType]) ?? {
                    providerType: ProviderType.MAP_MULTIBINDING,
                    type: providesMethod.type,
                    entryProviders: [],
                    entryBindings: []
                }
                existing.entryProviders.push({...providesMethod, type: createQualifiedType({...providesMethod.type, discriminator: keyInfo.expression}), key: keyInfo.expression})
                mapMultibindings.set([providesMethod.type, keyInfo.keyType], existing)
            } else {
                const existing = factories.get(providesMethod.type)
                if (existing) throw this.errorReporter.reportDuplicateProviders(providesMethod.type, [existing, providesMethod])
                factories.set(providesMethod.type, providesMethod)
            }
        })
        const bindings: Binding[] = []
        installedModules.flatMap(it => it.bindings).forEach(binding => {
            if (binding.declaration.modifiers?.some(this.nodeDetector.isIntoSetDecorator)) {
                const existing: SetMultibinding = setMultibindings.get(binding.returnType) ?? {
                    providerType: ProviderType.SET_MULTIBINDING,
                    type: binding.returnType,
                    elementBindings: [],
                    elementProviders: []
                }
                existing.elementBindings.push(binding.paramType)
                setMultibindings.set(binding.returnType, existing)
            } else {
                bindings.push(binding)
            }
        })
        return {factories, bindings, setMultibindings, mapMultibindings}
    }

    updateComponent(): ts.ClassDeclaration {
        const component = this.component
        const componentDecorator = component.modifiers?.find(this.nodeDetector.isComponentDecorator)!
        const componentScope = this.nodeDetector.getScope(component)
        const {factories, bindings, setMultibindings, mapMultibindings} = this.getFactoriesAndBindings(componentDecorator, componentScope)
        const dependencyMap = this.getDependencyMap(this.component)

        const componentType = this.typeChecker.getTypeAtLocation(component)

        const rootDependencies = this.getRootDependencies(componentType)

        const typeResolver = new TypeResolver(this.errorReporter, bindings)
        const subcomponentFactoryLocator = new SubcomponentFactoryLocator(
            this.typeChecker,
            this.nodeDetector,
            this.constructorHelper,
            new Set(this.moduleLocator.getInstalledSubcomponents(componentDecorator))
        )
        const graphBuilder = new DependencyGraphBuilder(
            typeResolver,
            this.nodeDetector,
            dependencyMap,
            factories,
            setMultibindings,
            mapMultibindings,
            subcomponentFactoryLocator,
            this.propertyExtractor,
            this.constructorHelper,
            this.errorReporter,
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
        const canBind = (type: QualifiedType) => {
            return graphBuilder.buildDependencyGraph(new Set([{type, optional: false}])).missing.size === 0
        }
        const generatedSubcomponents = subcomponents.map(it =>
            this.generateSubcomponent(it, typeResolver, componentScope ? new Map([[componentScope, componentType.symbol.name]]) : new Map(), canBind)
        )

        const missingSubcomponentDependencies = generatedSubcomponents.flatMap(it => Array.from(it.graph.missing.keys()))
        const mergedGraph = graphBuilder.buildDependencyGraph(new Set([...rootDependencies, ...missingSubcomponentDependencies]))
        generatedSubcomponents.forEach(it => {
            Array.from(it.graph.resolved.entries()).forEach(([type, provider]) => {
                const duplicate = graph.resolved.get(type) ?? dependencyMap.get(type) ?? factories.get(type)
                if (duplicate && !(provider.providerType === ProviderType.SET_MULTIBINDING && duplicate.providerType === ProviderType.SET_MULTIBINDING)) {
                    this.errorReporter.reportDuplicateProviders(type, [duplicate, provider])
                }
            })
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

        const builder = new ComponentDeclarationBuilder(
            this.typeChecker,
            this.sourceFile,
            this.nodeDetector,
            this.nameGenerator,
            this.importer,
            this.errorReporter,
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
        return ts.factory.updateClassDeclaration(
            component,
            component.modifiers,
            component.name,
            component.typeParameters,
            component.heritageClauses,
            [
                ...ts.visitNodes(component.members, builder.updateComponentMember),
                ...Array.from(generatedDeps.values()).flatMap(it => builder.getProviderDeclaration(it, componentScope)),
                ...generatedSubcomponents.map(it => it.classElement),
            ]
        )
    }

    private generateSubcomponent(
        factory: SubcomponentFactory,
        resolver: TypeResolver,
        ancestorScopes: ReadonlyMap<ts.Symbol, string>,
        parentCanBind: (type: QualifiedType) => boolean,
    ): GeneratedSubcomponent {
        const dependencyMap = this.getDependencyMap(factory.declaration)
        const subcomponentScope = this.nodeDetector.getScope(factory.declaration)
        const {factories, bindings, setMultibindings, mapMultibindings} = this.getFactoriesAndBindings(factory.decorator, subcomponentScope)
        const typeResolver = TypeResolver.merge(resolver, bindings)
        const rootDependencies = this.getRootDependencies(factory.subcomponentType.type)
        const subcomponentFactoryLocator = new SubcomponentFactoryLocator(
            this.typeChecker,
            this.nodeDetector,
            this.constructorHelper,
            new Set(this.moduleLocator.getInstalledSubcomponents(factory.decorator)),
        )
        const scope = this.nodeDetector.getScope(factory.declaration)
        const graphBuilder: DependencyGraphBuilder = new DependencyGraphBuilder(
            typeResolver,
            this.nodeDetector,
            dependencyMap,
            factories,
            setMultibindings,
            mapMultibindings,
            subcomponentFactoryLocator,
            this.propertyExtractor,
            this.constructorHelper,
            this.errorReporter,
            {filterOnly: scope},
            parentCanBind,
        )
        const graph = graphBuilder.buildDependencyGraph(new Set(rootDependencies))

        const subcomponents = Array.from(graph.resolved.keys()).map(it => it.type)
            .map(subcomponentFactoryLocator.asSubcomponentFactory)
            .filterNotNull()
            .distinctBy(it => it.subcomponentType)
        const subcomponentName = factory.subcomponentType.type.symbol.name
        const duplicateScope = scope && ancestorScopes.get(scope)
        if (duplicateScope) {
            this.errorReporter.reportDuplicateScope(subcomponentName, duplicateScope)
        }
        const graphResolver = (type: QualifiedType) => {
            return parentCanBind(type) || graphBuilder.buildDependencyGraph(new Set([{type, optional: false}])).missing.size === 0
        }
        const generatedSubcomponents = subcomponents.map(it =>
            this.generateSubcomponent(it, typeResolver, scope ? new Map([...ancestorScopes.entries(), [scope, subcomponentName]]) : ancestorScopes, graphResolver)
        )
        const missingSubcomponentDependencies = generatedSubcomponents.flatMap(it => Array.from(it.graph.missing.keys()))

        generatedSubcomponents.forEach(it => {
            Array.from(it.graph.resolved.entries()).forEach(([type, provider]) => {
                const duplicate = graph.resolved.get(type) ?? dependencyMap.get(type) ?? factories.get(type)
                if (duplicate) this.errorReporter.reportDuplicateProviders(type, [duplicate, provider])
            })
        })

        const mergedGraph = graphBuilder.buildDependencyGraph(new Set([...rootDependencies, ...missingSubcomponentDependencies]))

        const subcomponentBuilder = new ComponentDeclarationBuilder(
            this.typeChecker,
            this.sourceFile,
            this.nodeDetector,
            this.nameGenerator,
            this.importer,
            this.errorReporter,
            typeResolver,
            mergedGraph.resolved,
        )

        const missing = Array.from(mergedGraph.missing.keys())
        const missingRequired = missing.filter(it => !it.optional && !parentCanBind(it.type))
            .map(it => it.type)

        if (missingRequired.length > 0) {
            this.errorReporter.reportMissingProviders(missingRequired, {type: factory.subcomponentType, rootDependencies}, mergedGraph.resolved)
        }

        const missingOptionals: [QualifiedType, ParentProvider][] = missing.map(it => {
            return [it.type, {providerType: ProviderType.PARENT, type: it.type}]
        })
        const generatedDeps = new Map(
            Array.from<[QualifiedType, InstanceProvider]>(mergedGraph.resolved.entries()).concat(missingOptionals)
                .distinctBy(([type, provider]) => isSubcomponentFactory(provider) ? provider.subcomponentType : type)
        )
        const members = [
            ...ts.visitNodes(factory.declaration.members, subcomponentBuilder.updateSubcomponentMember).filter(it => it !== null && it !== undefined),
            ...Array.from(generatedDeps.values()).flatMap(it => subcomponentBuilder.getProviderDeclaration(it, scope)),
            ...generatedSubcomponents.map(it => it.classElement),
        ]
        return {
            classElement: subcomponentBuilder.declareSubcomponent(factory, members),
            type: factory.subcomponentType,
            graph: mergedGraph,
            name: subcomponentName,
            rootDependencies,
        }
    }
}
