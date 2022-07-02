import * as ts from "typescript"
import {NameGenerator} from "./NameGenerator"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {filterNotNull} from "./Util"
import {Importer} from "./Importer"
import {Bindings, ModuleLocator} from "./ModuleLocator"
import {ComponentDeclarationBuilder} from "./ComponentDeclarationBuilder"
import {Dependency, DependencyGraph, DependencyGraphBuilder} from "./DependencyGraphBuilder"
import {ConstructorHelper} from "./ConstructorHelper"
import {Resolver} from "./Resolver"
import {QualifiedType, qualifiedTypeToString} from "./QualifiedType"
import {SubcomponentFactoryLocator} from "./SubcomponentFactoryLocator"
import {PropertyExtractor} from "./PropertyExtractor"
import {Inject, Reusable} from "karambit-inject"
import {
    ParentProvider,
    PropertyProvider,
    ProviderType,
    ProvidesMethod,
    SubcomponentFactory,
    UndefinedProvider
} from "./Providers"

interface GeneratedSubcomponent {
    readonly name: string
    readonly classElement: ts.ClassElement
    readonly graph: DependencyGraph
}

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
    ) {
        this.generateComponents = this.generateComponents.bind(this)
    }

    private getDependencyMap(component: ts.ClassLikeDeclaration): ReadonlyMap<QualifiedType, PropertyProvider> {
        const dependencyParams = this.constructorHelper.getConstructorParamsForDeclaration(component) ?? []
        const dependencyMap = new Map<QualifiedType, PropertyProvider>()
        function getDuplicateBindingError (type: QualifiedType): Error {
            return new Error(`Duplicate component dependency binding for ${qualifiedTypeToString(type)}!`)
        }
        dependencyParams.forEach(param => {
            const name = this.nameGenerator.getPropertyIdentifierForParameter(param.declaration)
            const type = param.type
            const isInstanceBinding = param.decorators.some(this.nodeDetector.isBindsInstanceDecorator)
            if (isInstanceBinding) {
                if (dependencyMap.has(type)) throw getDuplicateBindingError(type)
                dependencyMap.set(type, {providerType: ProviderType.PROPERTY, name, type})
            } else {
                this.propertyExtractor.getDeclaredPropertiesForType(type.type).forEach(property => {
                    const propertyType = this.propertyExtractor.typeFromPropertyDeclaration(property)
                    const propertyName = property.name.getText()
                    if (dependencyMap.has(propertyType)) throw getDuplicateBindingError(type)
                    dependencyMap.set(propertyType, {
                        providerType: ProviderType.PROPERTY,
                        type: propertyType,
                        name,
                        propertyName
                    })
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
                    throw new Error("Generated component properties must be read-only!")
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
    ): {factories: ReadonlyMap<QualifiedType, ProvidesMethod>, bindings: Bindings} {
        const installedModules = this.moduleLocator.getInstalledModules(componentDecorator)
        const factories = new Map<QualifiedType, ProvidesMethod>()
        installedModules.flatMap(module => module.factories).forEach(factory => {
            if (factory.scope && !this.nodeDetector.isReusableScope(factory.scope) && factory.scope != componentScope) {
                throw new Error(`Invalid scope for ${factory.module.name?.getText()}.${factory.method.name.getText()}! Got: ${factory.scope.getName()}, expected: ${componentScope?.getName()}`)
            }
            if (factories.has(factory.returnType)) throw new Error(`Duplicate provider for ${this.typeChecker.typeToString(factory.returnType.type)}`)
            factories.set(factory.returnType, factory)
        })
        const bindings = new Map<QualifiedType, QualifiedType>()
        installedModules.forEach(module => {
            module.bindings.forEach((value, key) => {
                if (bindings.has(key)) throw new Error(`Found multiple bindings for ${this.typeChecker.typeToString(key.type)}!`)
                bindings.set(key, value)
            })
        })
        return {factories, bindings}
    }

    private updateComponent(component: ts.ClassLikeDeclaration): ts.ClassDeclaration {
        const componentDecorator = component.decorators!.find(this.nodeDetector.isComponentDecorator)!
        const componentScope = this.nodeDetector.getScope(component)
        const {factories, bindings} = this.getFactoriesAndBindings(componentDecorator, componentScope)
        const dependencyMap = this.getDependencyMap(component)

        const componentType = this.typeChecker.getTypeAtLocation(component)

        const rootDependencies = this.getRootDependencies(componentType)

        const typeResolver = new Resolver<QualifiedType>(bindings, qualifiedTypeToString)
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
            subcomponentFactoryLocator,
            this.propertyExtractor,
            this.constructorHelper,
        )
        const graph = graphBuilder.buildDependencyGraph(new Set(rootDependencies))
        const missingDependencies = Array.from(graph.missing.keys()).filter(it => !it.optional)
        if (missingDependencies.length > 0) {
            throw new Error(`No provider in ${componentType.symbol.name} for required types: ${missingDependencies.map(it => qualifiedTypeToString(it.type))}`)
        }

        const dependencies = graph.resolved

        const subcomponents = filterNotNull(
            Array.from(dependencies.keys()).map(it => it.type)
                .map(subcomponentFactoryLocator.asSubcomponentFactory)
        )
        const canBind = (type: QualifiedType) => {
            return graphBuilder.buildDependencyGraph(new Set([{type, optional: false}])).missing.size === 0
        }
        const generatedSubcomponents = subcomponents.map(it =>
            this.generateSubcomponent(it, typeResolver, componentScope ? new Map([[componentScope, componentType.symbol.name]]) : new Map(), canBind)
        )

        const missingSubcomponentDependencies = generatedSubcomponents.flatMap(it => Array.from(it.graph.missing.keys()))
        const mergedGraph = graphBuilder.buildDependencyGraph(new Set([...rootDependencies, ...missingSubcomponentDependencies]))
        generatedSubcomponents.forEach(it => {
            const duplicateProviders = Array.from(it.graph.resolved.keys()).filter(it => dependencies.has(it))
            if (duplicateProviders.length > 0) {
                throw new Error(`Provider(s) of ${it.name} already bound in parent (${componentType.symbol.name}) for: ${duplicateProviders.map(qualifiedTypeToString).join(", ")}`)
            }
            const missingSubcomponentDependencies = Array.from(it.graph.missing.keys()).filter(it => !it.optional && !mergedGraph.resolved.has(it.type))
            if (missingSubcomponentDependencies.length > 0) {
                throw new Error(`No provider in ${componentType.symbol.name} for required types of subcomponent ${it.name}: ${missingSubcomponentDependencies.map(it => qualifiedTypeToString(it.type))}`)
            }
        })

        const missing = Array.from(mergedGraph.missing.keys())
        const missingRequired = missing.filter(it => !it.optional)
        if (missingRequired.length > 0) {
            throw new Error(`Missing required binding(s) in ${componentType.symbol.name}: ${missingRequired.map(it => qualifiedTypeToString(it.type)).join(", ")}`)
        }

        const missingOptionals: [QualifiedType, UndefinedProvider][] = Array.from(mergedGraph.missing.keys()).map(it => {
            return [it.type, {providerType: ProviderType.UNDEFINED, type: it.type}]
        })
        const generatedDeps = new Map(
            Array.from(mergedGraph.resolved.entries()).concat(missingOptionals)
        )

        const builder = new ComponentDeclarationBuilder(
            this.typeChecker,
            this.context,
            this.sourceFile,
            this.nodeDetector,
            this.nameGenerator,
            this.importer,
            typeResolver,
            mergedGraph.resolved,
        )

        return ts.factory.createClassDeclaration(
            component.decorators,
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
        resolver: Resolver<QualifiedType>,
        ancestorScopes: ReadonlyMap<ts.Symbol, string>,
        parentCanBind: (type: QualifiedType) => boolean,
    ): GeneratedSubcomponent {
        const dependencyMap = this.getDependencyMap(factory.declaration)
        const subcomponentScope = this.nodeDetector.getScope(factory.declaration)
        const {factories, bindings} = this.getFactoriesAndBindings(factory.decorator, subcomponentScope)
        const typeResolver = Resolver.merge(resolver, bindings)
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
            subcomponentFactoryLocator,
            this.propertyExtractor,
            this.constructorHelper,
            {filterOnly: scope},
            parentCanBind,
        )
        const graph = graphBuilder.buildDependencyGraph(new Set(rootDependencies))
        const dependencies = graph.resolved

        const subcomponents = filterNotNull(
            Array.from(dependencies.keys()).map(it => it.type)
                .map(subcomponentFactoryLocator.asSubcomponentFactory)
        )
        const subcomponentName = factory.subcomponentType.type.symbol.name
        if (scope && ancestorScopes.has(scope)) {
            throw new Error(`Subcomponent may not share a scope with an ancestor! ${subcomponentName} has the same scope as its ancestor ${ancestorScopes.get(scope)}`)
        }
        const graphResolver = (type: QualifiedType) => {
            return parentCanBind(type) || graphBuilder.buildDependencyGraph(new Set([{type, optional: false}])).missing.size === 0
        }
        const generatedSubcomponents = subcomponents.map(it =>
            this.generateSubcomponent(it, typeResolver, scope ? new Map([...ancestorScopes.entries(), [scope, subcomponentName]]) : ancestorScopes, graphResolver)
        )
        const resolvedSubcomponentDependencies = generatedSubcomponents.flatMap(it => Array.from(it.graph.resolved.keys()))
        const missingSubcomponentDependencies = generatedSubcomponents.flatMap(it => Array.from(it.graph.missing.keys()))

        const duplicateProviders = Array.from(resolvedSubcomponentDependencies).filter(it => graph.resolved.has(it))
        if (duplicateProviders.length > 0) {
            throw new Error(`Provider(s) of ${subcomponentName} already bound in parent (${subcomponentName}): ${duplicateProviders.map(qualifiedTypeToString).join(", ")}`)
        }

        const mergedGraph = graphBuilder.buildDependencyGraph(new Set([...rootDependencies, ...missingSubcomponentDependencies]))
        const missingOptionals: [QualifiedType, ParentProvider][] = Array.from(mergedGraph.missing.keys()).map(it => {
            return [it.type, {providerType: ProviderType.PARENT, type: it.type}]
        })
        const generatedDeps = new Map(
            Array.from(mergedGraph.resolved.entries()).concat(missingOptionals)
        )

        const subcomponentBuilder = new ComponentDeclarationBuilder(
            this.typeChecker,
            this.context,
            this.sourceFile,
            this.nodeDetector,
            this.nameGenerator,
            this.importer,
            typeResolver,
            mergedGraph.resolved,
        )

        const members = [
            ...ts.visitNodes(factory.declaration.members, subcomponentBuilder.updateComponentMember),
            ...Array.from(generatedDeps.values()).flatMap(it => subcomponentBuilder.getProviderDeclaration(it, scope)),
            ...generatedSubcomponents.map(it => it.classElement),
        ]
        return {
            classElement: subcomponentBuilder.declareSubcomponent(factory, members),
            graph: mergedGraph,
            name: subcomponentName
        }
    }

    generateComponents(sourceFile: ts.SourceFile): ts.SourceFile
    generateComponents(node: ts.Node): ts.Node {
        if (ts.isClassDeclaration(node) && node.decorators?.some(this.nodeDetector.isComponentDecorator)) {
            return this.updateComponent(node)
        } else {
            return ts.visitEachChild(node, this.generateComponents, this.context)
        }
    }
}
