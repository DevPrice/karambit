import {createQualifiedType, QualifiedType, qualifiedTypeToString} from "./QualifiedType"
import {Resolver} from "./Resolver"
import {ConstructorHelper} from "./ConstructorHelper"
import {Container, findCycles} from "./Util"
import * as ts from "typescript"
import {SubcomponentFactoryLocator} from "./SubcomponentFactoryLocator"
import {PropertyExtractor} from "./PropertyExtractor"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {
    InjectableConstructor,
    InstanceProvider,
    PropertyProvider,
    ProviderType,
    ProvidesMethod
} from "./Providers"

export interface Dependency {
    readonly type: QualifiedType
    readonly optional: boolean
}

export interface DependencyGraph {
    readonly resolved: ReadonlyMap<QualifiedType, InstanceProvider>
    readonly missing: Container<Dependency>
}

type DependencyProvider = InstanceProvider & { children: ReadonlySet<QualifiedType> }

export class DependencyGraphBuilder {

    constructor(
        private readonly typeResolver: Resolver<QualifiedType>,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly dependencyMap:  ReadonlyMap<QualifiedType, PropertyProvider>,
        private readonly factoryMap: ReadonlyMap<QualifiedType, ProvidesMethod>,
        private readonly subcomponentFactoryLocator: SubcomponentFactoryLocator,
        private readonly propertyExtractor: PropertyExtractor,
        private readonly constructorHelper: ConstructorHelper,
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

            const providedType = this.nodeDetector.isProvider(boundType.type)
            if (providedType) {
                const qualifiedProvidedType = createQualifiedType({
                    ...boundType,
                    type: providedType
                })
                todo.push({type: qualifiedProvidedType, optional: false})
                continue
            }

            const propertyProvider = this.dependencyMap.get(boundType)
            if (propertyProvider) {
                result.set(boundType, {...propertyProvider, children: new Set()})
                continue
            }

            const providesMethod: ProvidesMethod | undefined = this.factoryMap.get(boundType)
            if (providesMethod) {
                const children = providesMethod.parameters
                result.set(boundType, {...providesMethod, children: new Set(children.map(it => it.type))})
                todo.push(...children)
                continue
            }

            const injectableConstructor = this.getInjectableConstructor(boundType.type)
            if (injectableConstructor) {
                const children = injectableConstructor.parameters
                result.set(boundType, {...injectableConstructor, children: new Set(children.map(it => it.type))})
                todo.push(...children)
                continue
            }

            const factory = this.subcomponentFactoryLocator.asSubcomponentFactory(boundType.type)
            if (factory) {
                result.set(boundType, {...factory, children: new Set()})
            } else {
                missing.add(next)
            }
        }

        dependencies.forEach(dep => this.assertNoCycles(dep.type, result))

        return {
            resolved: result,
            missing,
        }
    }

    private getInjectableConstructor(type: ts.Type): InjectableConstructor | undefined {
        const symbol = type.getSymbol()
        const declarations = symbol?.getDeclarations()?.filter(ts.isClassDeclaration)
        const declaration = declarations && declarations.length > 0 ? declarations[0] : undefined
        if (!declaration) return undefined
        if (!declaration.decorators?.some(this.nodeDetector.isInjectDecorator)) return undefined
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
            return map.get(boundType)?.children ?? []
        })
        if (cycle.length > 0) {
            throw new Error(`Found circular dependency! ${cycle.map(it => qualifiedTypeToString(it)).join(" -> ")}`)
        }
    }

    private assertNoDuplicateBindings() {
        const allBoundTypes = [...this.dependencyMap.keys(), ...this.factoryMap.keys()]
        const boundTypeSet = new Set(allBoundTypes)
        if (allBoundTypes.length !== boundTypeSet.size) {
            const duplicates: QualifiedType[] = []
            for (const type of boundTypeSet) {
                if (this.dependencyMap.has(type) && this.factoryMap.has(type)) {
                    duplicates.push(type)
                }
            }
            throw new Error(`Duplicate providers for type(s): ${duplicates.map(qualifiedTypeToString).join(", ")}`)
        }
    }
}
