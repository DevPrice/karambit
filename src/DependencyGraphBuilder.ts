import {createQualifiedType, QualifiedType} from "./QualifiedType"
import {TypeResolver} from "./TypeResolver"
import {ConstructorHelper} from "./ConstructorHelper"
import {Container, findCycles} from "./Util"
import * as ts from "typescript"
import {SubcomponentFactoryLocator} from "./SubcomponentFactoryLocator"
import {PropertyExtractor} from "./PropertyExtractor"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {
    InjectableConstructor,
    InstanceProvider,
    MapMultibinding,
    PropertyProvider,
    ProviderType,
    ProvidesMethod,
    SetMultibinding
} from "./Providers"
import {ErrorReporter} from "./ErrorReporter"
import {AssistedFactoryLocator} from "./AssistedFactoryLocator"

export interface Dependency {
    readonly type: QualifiedType
    readonly optional: boolean
}

export interface DependencyGraph {
    readonly resolved: ReadonlyMap<QualifiedType, DependencyProvider>
    readonly missing: Container<Dependency>
}

export type DependencyProvider = InstanceProvider & { dependencies: ReadonlySet<QualifiedType> }

export class DependencyGraphBuilder {

    constructor(
        private readonly typeResolver: TypeResolver,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly dependencyMap:  ReadonlyMap<QualifiedType, PropertyProvider>,
        private readonly factoryMap: ReadonlyMap<QualifiedType, ProvidesMethod>,
        private readonly setMultibindings: ReadonlyMap<QualifiedType, SetMultibinding>,
        private readonly mapMultibindings: ReadonlyMap<[QualifiedType, ts.Type], MapMultibinding>,
        private readonly subcomponentFactoryLocator: SubcomponentFactoryLocator,
        private readonly assistedFactoryLocation: AssistedFactoryLocator,
        private readonly propertyExtractor: PropertyExtractor,
        private readonly constructorHelper: ConstructorHelper,
        private readonly errorReporter: ErrorReporter,
        private readonly scopeFilter?: { filterOnly?: ts.Symbol },
        private readonly parentGraph?: (type: QualifiedType) => boolean,
    ) {
        this.assertNoDuplicateBindings()
    }

    buildDependencyGraph(
        dependencies: ReadonlySet<Dependency>
    ): DependencyGraph {
        const result = new Map<QualifiedType, DependencyProvider>()
        const missing = new Set<Dependency>()

        const todo: Dependency[] = Array.from(dependencies)

        let next: Dependency | undefined
        while (next = todo.shift()) { // eslint-disable-line
            const boundType = this.typeResolver.resolveBoundType(next.type)
            if (result.has(boundType)) continue

            const providerResult = this.getProvider(boundType)
            if (providerResult) {
                const {provider, dependencies} = providerResult
                if (provider !== undefined) result.set(boundType, provider)
                if (dependencies !== undefined) todo.push(...dependencies)
            } else {
                missing.add(next)
            }
        }

        for (const dep of dependencies) {
            this.assertNoCycles(dep.type, result)
        }

        for (const dep of dependencies) {
            if (!dep.optional) {
                const provider = result.get(dep.type)
                if (provider) {
                    const missing = Array.from(provider.dependencies)
                        .map(it => result.get(it))
                        .filterNotNull()
                        .filter(it => it.providerType === ProviderType.PROPERTY && it.optional)
                    if (missing.length > 0) {
                        this.errorReporter.reportMissingRequiredProviders(provider, missing)
                    }
                }
            }
        }

        return {
            resolved: result,
            missing,
        }
    }

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

        const assistedFactory = this.assistedFactoryLocation.asAssistedFactory(boundType.type)
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
                const dependencies = multibinding.elementBindings
                    .map(type => { return {type, optional: false} })
                    .concat(multibinding.elementProviders.flatMap(it => it.parameters))
                const parentBinding = this.parentGraph ? this.parentGraph(boundType) : false
                return {
                    provider: {
                        ...multibinding,
                        type: boundType,
                        dependencies: new Set(dependencies.map(it => it.type)),
                        parentBinding
                    },
                    dependencies,
                }
            }
        }

        const readonlyMapTypes = this.nodeDetector.isReadonlyMap(boundType.type)
        if (readonlyMapTypes) {
            const multibinding = this.mapMultibindings.get([createQualifiedType({...boundType, type: readonlyMapTypes[1]}), readonlyMapTypes[0]])
            if (multibinding) {
                const dependencies = multibinding.entryBindings
                    .map(type => { return {type: type.valueType, optional: false} })
                    .concat(multibinding.entryProviders.flatMap(it => it.parameters))
                const parentBinding = this.parentGraph ? this.parentGraph(boundType) : false
                return {
                    provider: {
                        ...multibinding,
                        type: boundType,
                        dependencies: new Set(dependencies.map(it => it.type)),
                        parentBinding
                    },
                    dependencies,
                }
            }
        }

        return undefined
    }

    private getInjectableConstructor(type: ts.Type): InjectableConstructor | undefined {
        const symbol = type.getSymbol()
        const declarations = symbol?.getDeclarations()?.filter(ts.isClassDeclaration)
        const declaration = declarations && declarations.length > 0 ? declarations[0] : undefined
        if (!declaration) return undefined
        if (!declaration.modifiers?.some(this.nodeDetector.isInjectDecorator)) return undefined
        if (declaration.modifiers?.some(it => it.kind === ts.SyntaxKind.AbstractKeyword)) {
            this.errorReporter.reportParseFailed("@Inject class should not be abstract!", declaration)
        }
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

        //  this is another component's scope
        if (scope && !this.nodeDetector.isReusableScope(scope) && scope !== this.scopeFilter.filterOnly) return undefined

        // this is our scope
        if (scope === this.scopeFilter.filterOnly && this.scopeFilter.filterOnly) return constructor

        const parentGraph = this.parentGraph

        // unscoped, if the parent can provide this, then let it
        if (parentGraph && parentGraph(createQualifiedType({type}))) return undefined
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
