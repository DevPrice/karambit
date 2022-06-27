import {createQualifiedType, QualifiedType, qualifiedTypeToString} from "./QualifiedType"
import {Resolver} from "./Resolver"
import {ConstructorHelper, ConstructorParameter} from "./ConstructorHelper"
import {ProviderMethod, FactoryParameter} from "./ModuleLocator"
import {Container, findCycles} from "./Util"
import * as ts from "typescript"
import {SubcomponentFactoryLocator} from "./SubcomponentFactoryLocator"
import {PropertyExtractor} from "./PropertyExtractor"
import {InjectNodeDetector} from "./InjectNodeDetector"

export interface PropertyProvider {
    readonly name: ts.Identifier | ts.PrivateIdentifier
    readonly propertyName?: string
    readonly type: QualifiedType
}

export interface Dependency {
    readonly type: QualifiedType
    readonly optional: boolean
}

export interface DependencyGraph {
    readonly resolved: Container<QualifiedType>
    readonly missing: Container<Dependency>
}

export type PropertyLike = ts.PropertyDeclaration | ts.PropertySignature
export type ElementLike = ts.ClassElement | ts.TypeElement

type ProviderParameter = FactoryParameter | ConstructorParameter

export class DependencyGraphBuilder {

    constructor(
        private readonly typeResolver: Resolver<QualifiedType>,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly dependencyMap:  ReadonlyMap<QualifiedType, PropertyProvider>,
        private readonly factoryMap: ReadonlyMap<QualifiedType, ProviderMethod>,
        private readonly subcomponentFactoryLocator: SubcomponentFactoryLocator,
        private readonly propertyExtractor: PropertyExtractor,
        private readonly constructorHelper: ConstructorHelper,
        private readonly scopeFilter?: { filterOnly?: ts.Symbol },
        private readonly parentGraph?: Container<QualifiedType>,
    ) { }

    buildDependencyGraph(
        dependencies: ReadonlySet<Dependency>
    ): DependencyGraph {
        const result = new Map<QualifiedType, ReadonlySet<QualifiedType>>()
        const missing = new Set<Dependency>()

        const todo: Dependency[] = Array.from(dependencies)

        let next: Dependency | undefined
        while (next = todo.shift()) {
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
                result.set(boundType, new Set())
                continue
            }

            const dependsOn: ProviderParameter[] | undefined = this.factoryMap.get(boundType)?.parameters ??
                this.getInjectConstructorParams(boundType.type)
            if (dependsOn !== undefined) {
                result.set(boundType, new Set(dependsOn.map(it => it.type)))
                todo.push(...dependsOn)
            } else if (this.subcomponentFactoryLocator.asSubcomponentFactory(boundType.type)) {
                result.set(boundType, new Set())
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

    private getInjectConstructorParams(type: ts.Type): ConstructorParameter[] | undefined {
        if (this.scopeFilter === undefined) return this.constructorHelper.getInjectConstructorParams(type)

        const symbol = type.getSymbol()
        const declarations = symbol?.getDeclarations()
        const declaration = declarations && declarations.length > 0 ? declarations[0] : undefined
        const scope = declaration && ts.isClassDeclaration(declaration) ? this.nodeDetector.getScope(declaration) : undefined
        if (scope && scope !== this.scopeFilter.filterOnly) return undefined

        const params = this.constructorHelper.getInjectConstructorParams(type)
        const parentGraph = this.parentGraph
        // if the parent can provide this, then let it
        if (params && parentGraph && params.every(it => parentGraph.has(it.type))) return undefined
        return params
    }

    private assertNoCycles(type: QualifiedType, map: ReadonlyMap<QualifiedType, ReadonlySet<QualifiedType>>) {
        const cycle = findCycles(type, (item: QualifiedType) => {
            if (this.nodeDetector.isProvider(type.type)) return []
            const boundType = this.typeResolver.resolveBoundType(item)
            return map.get(boundType) ?? []
        })
        if (cycle.length > 0) {
            throw new Error(`Found circular dependency! ${cycle.map(it => qualifiedTypeToString(it)).join(" -> ")}`)
        }
    }
}
