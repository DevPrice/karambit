import {createQualifiedType, QualifiedType} from "./QualifiedType"
import {TypeResolver} from "./TypeResolver"
import {ConstructorHelper} from "./ConstructorHelper"
import {Container, findCycles, isNotNull, memoized} from "./Util"
import * as ts from "typescript"
import {SubcomponentFactoryLocator} from "./SubcomponentFactoryLocator"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {
    InjectableConstructor,
    InstanceProvider,
    MapMultibinding,
    PropertyProvider,
    ProviderType,
    ProvidesMethod,
    SetMultibinding,
} from "./Providers"
import {ErrorReporter} from "./ErrorReporter"
import {AssistedFactoryLocator} from "./AssistedFactoryLocator"
import {Assisted, AssistedInject} from "karambit-decorators"

export interface Dependency {
    readonly type: QualifiedType
    readonly optional: boolean
}

export interface DependencyGraph {
    readonly resolved: ReadonlyMap<QualifiedType, DependencyProvider>
    readonly missing: Container<Dependency>
}

export type DependencyProvider = InstanceProvider & { dependencies: ReadonlySet<QualifiedType> }

interface ScopeFilter {
    filterOnly?: ts.Symbol
}

type CanBind = (type: QualifiedType) => boolean

export type DependencyGraphBuilderFactory = (
    typeResolver: TypeResolver,
    dependencyMap:  ReadonlyMap<QualifiedType, PropertyProvider>,
    factoryMap: ReadonlyMap<QualifiedType, ProvidesMethod>,
    setMultibindings: ReadonlyMap<QualifiedType, SetMultibinding>,
    mapMultibindings: ReadonlyMap<[QualifiedType, ts.Type], MapMultibinding>,
    subcomponentFactoryLocator: SubcomponentFactoryLocator,
    scopeFilter?: ScopeFilter,
    parentGraph?: CanBind,
) => DependencyGraphBuilder

@AssistedInject
export class DependencyGraphBuilder {

    constructor(
        @Assisted private readonly typeResolver: TypeResolver,
        private readonly nodeDetector: InjectNodeDetector,
        @Assisted private readonly dependencyMap:  ReadonlyMap<QualifiedType, PropertyProvider>,
        @Assisted private readonly factoryMap: ReadonlyMap<QualifiedType, ProvidesMethod>,
        @Assisted private readonly setMultibindings: ReadonlyMap<QualifiedType, SetMultibinding>,
        @Assisted private readonly mapMultibindings: ReadonlyMap<[QualifiedType, ts.Type], MapMultibinding>,
        @Assisted private readonly subcomponentFactoryLocator: SubcomponentFactoryLocator,
        private readonly assistedFactoryLocator: AssistedFactoryLocator,
        private readonly constructorHelper: ConstructorHelper,
        private readonly errorReporter: ErrorReporter,
        @Assisted private readonly scopeFilter?: ScopeFilter,
        @Assisted private readonly parentGraph?: CanBind,
    ) {
        this.assertNoDuplicateBindings()
    }

    buildDependencyGraph(
        dependencies: ReadonlySet<Dependency>,
        given: ReadonlySet<QualifiedType> = new Set(),
    ): DependencyGraph {
        const missing = new Set<Dependency>()
        const resolved: Map<QualifiedType, DependencyProvider> = new Map()

        const todo: Dependency[] = Array.from(dependencies)

        let next: Dependency | undefined
        while (next = todo.shift()) { // eslint-disable-line
            const boundType = this.typeResolver.resolveBoundType(next.type)
            if (given.has(boundType) || resolved.has(boundType)) continue

            if (next.optional) {
                const optionalGraph = this.buildDependencyGraph(
                    new Set([{...next, optional: false}]),
                    new Set(resolved.keys()),
                )
                if (Array.from(optionalGraph.missing.keys()).every(it => it.optional)) {
                    for (const [type, optional] of optionalGraph.resolved) {
                        resolved.set(type, optional)
                    }
                    for (const dep of optionalGraph.missing.keys()) {
                        missing.add(dep)
                    }
                } else {
                    missing.add(next)
                }
            } else {
                const providerResult = this.getProvider(boundType)
                if (providerResult) {
                    const {provider, dependencies} = providerResult
                    if (provider !== undefined) resolved.set(boundType, provider)
                    if (dependencies !== undefined) todo.push(...dependencies)
                } else {
                    missing.add(next)
                }
            }
        }

        for (const dep of dependencies) {
            this.assertNoCycles(dep.type, resolved)
        }

        for (const dep of dependencies) {
            if (!dep.optional) {
                const provider = resolved.get(dep.type)
                if (provider) {
                    const missing = Array.from(provider.dependencies)
                        .map(it => resolved.get(it))
                        .filter(isNotNull)
                        .filter(it => it.providerType === ProviderType.PROPERTY && it.optional)
                    if (missing.length > 0) {
                        this.errorReporter.reportMissingRequiredProviders(provider, missing)
                    }
                }
            }
        }

        return {
            resolved,
            missing,
        }
    }

    @memoized
    private getProvider(boundType: QualifiedType): { provider?: DependencyProvider, dependencies?: Iterable<Dependency> } | undefined {
        const providedType = this.nodeDetector.isProvider(boundType.type)
        if (providedType) {
            const qualifiedProvidedType = createQualifiedType({
                ...boundType,
                type: providedType
            })
            return {
                dependencies: [{type: qualifiedProvidedType, optional: false}]
            }
        }

        const propertyProvider = this.dependencyMap.get(boundType)
        if (propertyProvider) {
            return {
                provider: {...propertyProvider, dependencies: new Set()}
            }
        }

        const provider: ProvidesMethod | InjectableConstructor | undefined =
            this.factoryMap.get(boundType) ?? this.getInjectableConstructor(boundType.type)
        if (provider) {
            const dependencies = provider.parameters
            return {
                provider: {...provider, dependencies: new Set(dependencies.map(it => it.type))},
                dependencies
            }
        }

        const factory = this.subcomponentFactoryLocator.asSubcomponentFactory(boundType.type)
        if (factory) {
            return {
                provider: {...factory, dependencies: new Set()}
            }
        }

        const assistedFactory = this.assistedFactoryLocator.asAssistedFactory(boundType.type)
        if (assistedFactory) {
            const dependencies = assistedFactory.constructorParams.filter(it => !it.decorators.some(this.nodeDetector.isAssistedDecorator))
            return {
                provider: {...assistedFactory, dependencies: new Set(dependencies.map(it => it.type))},
                dependencies,
            }
        }

        const readonlySetType = this.nodeDetector.isReadonlySet(boundType.type)
        if (readonlySetType) {
            const multibinding = this.setMultibindings.get(createQualifiedType({...boundType, type: readonlySetType}))
            if (multibinding) {
                const dependencies = multibinding.elementProviders
                const parentBinding = this.parentGraph ? this.parentGraph(boundType) : false
                return {
                    provider: {
                        ...multibinding,
                        type: boundType,
                        dependencies: new Set(dependencies.map(it => it.type)),
                        parentBinding,
                    },
                    dependencies,
                }
            }
        }

        const readonlyMapTypes = this.nodeDetector.isReadonlyMap(boundType.type)
        if (readonlyMapTypes) {
            const multibinding = this.mapMultibindings.get([createQualifiedType({...boundType, type: readonlyMapTypes[1]}), readonlyMapTypes[0]])
            if (multibinding) {
                const dependencies = multibinding.entryProviders
                const parentBinding = this.parentGraph ? this.parentGraph(boundType) : false
                return {
                    provider: {
                        ...multibinding,
                        type: boundType,
                        dependencies: new Set(dependencies.map(it => it.type)),
                        parentBinding,
                    },
                    dependencies,
                }
            }
        }

        return undefined
    }

    @memoized
    private getInjectableConstructor(type: ts.Type): InjectableConstructor | undefined {
        const symbol = type.getSymbol()
        const declarations = symbol?.getDeclarations()?.filter(ts.isClassDeclaration)
        const declaration = declarations && declarations.length > 0 ? declarations[0] : undefined
        if (!declaration) return undefined
        if (!declaration.modifiers?.some(this.nodeDetector.isInjectDecorator)) return undefined
        const parameters = this.constructorHelper.getConstructorParamsForDeclaration(declaration)
        if (!parameters) return undefined

        const scope = this.nodeDetector.getScope(declaration)
        const constructor: InjectableConstructor = {
            providerType: ProviderType.INJECTABLE_CONSTRUCTOR,
            declaration,
            type,
            parameters,
            scope,
        }

        if (this.scopeFilter === undefined) return constructor

        const isReusableScope = scope && this.nodeDetector.isReusableScope(scope)

        //  this is another component's scope
        if (scope && !isReusableScope && scope !== this.scopeFilter.filterOnly) return undefined

        // this is our scope
        if (scope === this.scopeFilter.filterOnly && this.scopeFilter.filterOnly) return constructor

        const parentGraph = this.parentGraph
        const parentCanProvide = parentGraph
            && parentGraph(createQualifiedType({type}))
            // TODO: Ideally, we would let the parent provide this if we can't provide the optional param either
            && parameters.every(param => !param.optional || parentGraph(param.type))

        // unscoped, if the parent can provide this, then let it
        if (parentCanProvide) return undefined
        return constructor
    }

    private assertNoCycles(type: QualifiedType, map: ReadonlyMap<QualifiedType, DependencyProvider>) {
        const cycle = findCycles(type, (item: QualifiedType) => {
            if (this.nodeDetector.isProvider(type.type)) return []
            const boundType = this.typeResolver.resolveBoundType(item)
            return map.get(boundType)?.dependencies ?? []
        })
        if (cycle.length > 0) {
            this.errorReporter.reportDependencyCycle(cycle[cycle.length - 1], cycle)
        }
    }

    private assertNoDuplicateBindings() {
        const allBoundTypes = [...this.dependencyMap.keys(), ...this.factoryMap.keys()]
        const boundTypeSet = new Set(allBoundTypes)
        if (allBoundTypes.length !== boundTypeSet.size) {
            for (const type of boundTypeSet) {
                const propertyProvider = this.dependencyMap.get(type)
                const factoryProvider = this.factoryMap.get(type)
                if (propertyProvider && factoryProvider) {
                    this.errorReporter.reportDuplicateProviders(type, [propertyProvider, factoryProvider])
                }
            }
        }
    }
}
