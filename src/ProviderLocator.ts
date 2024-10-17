import {Inject, Reusable} from "karambit-decorators"
import * as ts from "typescript"
import {createQualifiedType, QualifiedType} from "./QualifiedType"
import {MapMultibinding, PropertyProvider, ProviderType, ProvidesMethod, SetMultibinding} from "./Providers"
import {TupleMap} from "./Util"
import {Binding, ModuleLocator} from "./ModuleLocator"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {ErrorReporter} from "./ErrorReporter"
import {ConstructorHelper} from "./ConstructorHelper"
import {NameGenerator} from "./NameGenerator"
import {PropertyExtractor} from "./PropertyExtractor"

export interface ModuleProviders {
    factories: ReadonlyMap<QualifiedType, ProvidesMethod>
    bindings: Iterable<Binding>
    setMultibindings: ReadonlyMap<QualifiedType, SetMultibinding>
    mapMultibindings: ReadonlyMap<[QualifiedType, ts.Type], MapMultibinding>
}

@Inject
@Reusable
export class ProviderLocator {

    constructor(
        private readonly constructorHelper: ConstructorHelper,
        private readonly nameGenerator: NameGenerator,
        private readonly propertyExtractor: PropertyExtractor,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly moduleLocator: ModuleLocator,
        private readonly errorReporter: ErrorReporter,
    ) { }

    findPropertyProviders(component: ts.ClassLikeDeclaration): ReadonlyMap<QualifiedType, PropertyProvider> {
        const dependencyParams = this.constructorHelper.getConstructorParamsForDeclaration(component) ?? []
        const dependencyMap = new Map<QualifiedType, PropertyProvider>()
        dependencyParams.forEach(param => {
            const name = this.nameGenerator.getPropertyIdentifierForParameter(param.declaration)
            const type = param.type
            if (this.nodeDetector.getBindsInstanceAnnotation(param.declaration)) {
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

    findFactoriesAndBindings(componentDecorator: ts.Decorator, componentScope?: ts.Symbol): ModuleProviders {
        const installedModules = this.moduleLocator.getInstalledModules(componentDecorator)
        const factories = new Map<QualifiedType, ProvidesMethod>()
        const setMultibindings = new Map<QualifiedType, SetMultibinding>()
        const mapMultibindings = new TupleMap<[QualifiedType, ts.Type], MapMultibinding>()
        installedModules.flatMap(module => module.factories).forEach(providesMethod => {
            if (providesMethod.scope && !this.nodeDetector.isReusableScope(providesMethod.scope) && providesMethod.scope != componentScope) {
                this.errorReporter.reportInvalidScope(providesMethod, componentScope)
            }
            const intoSetAnnotation = this.nodeDetector.getIntoSetAnnotation(providesMethod.declaration)
            const intoMapAnnotation = this.nodeDetector.getIntoMapAnnotation(providesMethod.declaration)
            if (intoSetAnnotation) {
                const existing: SetMultibinding = setMultibindings.get(providesMethod.type) ?? {
                    providerType: ProviderType.SET_MULTIBINDING,
                    type: providesMethod.type,
                    elementProviders: [],
                }
                const optional = ts.isDecorator(intoSetAnnotation) && !!this.nodeDetector.getBooleanPropertyNode(intoSetAnnotation, "optional")
                if (optional) this.errorReporter.reportParseFailed("Optional multibindings not currently supported!", intoSetAnnotation)
                const elementProviderType = createQualifiedType({...providesMethod.type, discriminator: Symbol("element")})
                existing.elementProviders.push({
                    type: elementProviderType,
                    optional,
                    isIterableProvider: false,
                })
                setMultibindings.set(providesMethod.type, existing)
                const existingFactory = factories.get(elementProviderType)
                if (existingFactory) throw this.errorReporter.reportDuplicateProviders(elementProviderType, [existingFactory, providesMethod])
                factories.set(elementProviderType, {...providesMethod, type: elementProviderType})
            } else if (this.nodeDetector.getElementsIntoSetAnnotation(providesMethod.declaration)) {
                const iterableType = this.nodeDetector.isIterable(providesMethod.type.type)
                if (!iterableType) this.errorReporter.reportParseFailed("@ElementsIntoSet provider must return an iterable!", providesMethod.declaration)
                const qualifiedType = createQualifiedType({...providesMethod.type, type: iterableType})
                const existing: SetMultibinding = setMultibindings.get(qualifiedType) ?? {
                    providerType: ProviderType.SET_MULTIBINDING,
                    type: providesMethod.type,
                    elementProviders: [],
                }
                const elementsProviderType = createQualifiedType({...qualifiedType, discriminator: Symbol("element")})
                existing.elementProviders.push({
                    type: elementsProviderType,
                    optional: false,
                    isIterableProvider: true,
                })
                setMultibindings.set(providesMethod.type, existing)
                const existingFactory = factories.get(elementsProviderType)
                if (existingFactory) throw this.errorReporter.reportDuplicateProviders(elementsProviderType, [existingFactory, providesMethod])
                factories.set(elementsProviderType, {...providesMethod, type: elementsProviderType})
            } else if (this.nodeDetector.getElementsIntoMapAnnotation(providesMethod.declaration)) {
                const iterableType = this.nodeDetector.isIterable(providesMethod.type.type)
                if (!iterableType) this.errorReporter.reportParseFailed("@ElementsIntoMap provider must return an iterable!", providesMethod.declaration)

                const qualifiedType = createQualifiedType({...providesMethod.type, type: iterableType})
                const info = this.nodeDetector.getMapTupleBindingInfo(qualifiedType)
                if (!info) this.errorReporter.reportParseFailed("@ElementsIntoMap provider must return an iterable of a tuple of size 2.", providesMethod.declaration)

                const existing: MapMultibinding = mapMultibindings.get([info.valueType, info.keyType]) ?? {
                    providerType: ProviderType.MAP_MULTIBINDING,
                    type: info.valueType,
                    entryProviders: [],
                }
                const entriesProviderType = createQualifiedType({...qualifiedType, discriminator: Symbol("entry")})
                existing.entryProviders.push({
                    type: entriesProviderType,
                    optional: false,
                    isIterableProvider: true,
                })
                mapMultibindings.set([info.valueType, info.keyType], existing)
                const existingFactory = factories.get(entriesProviderType)
                if (existingFactory) throw this.errorReporter.reportDuplicateProviders(entriesProviderType, [existingFactory, providesMethod])
                factories.set(entriesProviderType, {...providesMethod, type: entriesProviderType})
            } else if (intoMapAnnotation) {
                const info = this.nodeDetector.getMapBindingInfo(providesMethod.type, providesMethod.declaration)
                if (!info) this.errorReporter.reportParseFailed("@IntoMap provider must have @MapKey or return tuple of size 2.", providesMethod.declaration)

                const existing: MapMultibinding = mapMultibindings.get([info.valueType, info.keyType]) ?? {
                    providerType: ProviderType.MAP_MULTIBINDING,
                    type: info.valueType,
                    entryProviders: [],
                }
                const optional = ts.isDecorator(intoMapAnnotation) && !!this.nodeDetector.getBooleanPropertyNode(intoMapAnnotation, "optional")
                if (optional) this.errorReporter.reportParseFailed("Optional multibindings not currently supported!", intoMapAnnotation)
                const entryProviderType = createQualifiedType({...providesMethod.type, discriminator: Symbol("entry")})
                existing.entryProviders.push({
                    type: entryProviderType,
                    key: info.expression,
                    optional,
                    isIterableProvider: false,
                })
                mapMultibindings.set([info.valueType, info.keyType], existing)
                const existingFactory = factories.get(entryProviderType)
                if (existingFactory) throw this.errorReporter.reportDuplicateProviders(entryProviderType, [existingFactory, providesMethod])
                factories.set(entryProviderType, {...providesMethod, type: entryProviderType})
            } else {
                const existing = factories.get(providesMethod.type)
                if (existing) throw this.errorReporter.reportDuplicateProviders(providesMethod.type, [existing, providesMethod])
                factories.set(providesMethod.type, providesMethod)
            }
        })
        const bindings: Binding[] = []
        installedModules.flatMap(it => it.bindings).forEach(binding => {
            if (this.nodeDetector.getIntoSetAnnotation(binding.declaration)) {
                const existing: SetMultibinding = setMultibindings.get(binding.returnType) ?? {
                    providerType: ProviderType.SET_MULTIBINDING,
                    type: binding.returnType,
                    elementProviders: [],
                }
                const elementProviderType = createQualifiedType({...binding.returnType, discriminator: Symbol("element")})
                existing.elementProviders.push({
                    type: binding.paramType,
                    optional: false,
                    isIterableProvider: false,
                })
                setMultibindings.set(binding.returnType, existing)

                const entryBinding: Binding = {...binding, returnType: elementProviderType}
                bindings.push(entryBinding)
            } else if (this.nodeDetector.getIntoMapAnnotation(binding.declaration)) {
                const info = this.nodeDetector.getMapBindingInfo(binding.returnType, binding.declaration)
                if (!info) this.errorReporter.reportParseFailed("@IntoMap binding must have @MapKey or return tuple of size 2.", binding.declaration)
                const existing: MapMultibinding = mapMultibindings.get([info.valueType, info.keyType]) ?? {
                    providerType: ProviderType.MAP_MULTIBINDING,
                    type: info.valueType,
                    entryProviders: [],
                }
                const entryProviderType = createQualifiedType({...binding.returnType, discriminator: Symbol("entry")})
                existing.entryProviders.push({
                    type: binding.paramType,
                    optional: false,
                    isIterableProvider: false,
                    key: info.expression,
                })
                mapMultibindings.set([info.valueType, info.keyType], existing)

                const entryBinding: Binding = {...binding, returnType: entryProviderType}
                bindings.push(entryBinding)
            } else {
                bindings.push(binding)
            }
        })
        return {factories, bindings, setMultibindings, mapMultibindings}
    }
}