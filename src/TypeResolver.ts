import {bound, findCycles, isNotNull} from "./Util"
import {ErrorReporter} from "./ErrorReporter"
import {QualifiedType} from "./QualifiedType"
import {Binding} from "./ModuleLocator"
import {Assisted, AssistedInject} from "karambit-decorators"

export type TypeResolverFactory = (bindings: Iterable<Binding>) => TypeResolver

@AssistedInject
export class TypeResolver {

    #bindingMap: Map<QualifiedType, QualifiedType>

    constructor(
        private readonly errorReporter: ErrorReporter,
        @Assisted private readonly bindings: Iterable<Binding>,
    ) {
        const bindingMap = new Map<QualifiedType, Binding>()
        for (const binding of bindings) {
            const duplicate = bindingMap.get(binding.returnType)
            if (duplicate) this.errorReporter.reportDuplicateBindings(binding.returnType, [binding, duplicate])
            bindingMap.set(binding.returnType, binding)
        }
        this.#bindingMap = new Map(Array.from(bindingMap.entries()).map(([type, binding]) => [type, binding.paramType]))
        for (const binding of this.#bindingMap.keys()) {
            const cycle = findCycles(binding, (b) => [this.#bindingMap.get(b)].filter(isNotNull))
            if (cycle.length > 0) {
                throw this.errorReporter.reportBindingCycle(cycle[cycle.length - 1], cycle)
            }
        }
    }

    @bound
    resolveBoundType(type: QualifiedType): QualifiedType {
        const binding = this.#bindingMap.get(type)
        if (!binding) return type
        return this.resolveBoundType(binding)
    }

    static merge(original: TypeResolver, additionalBindings: Iterable<Binding>): TypeResolver {
        return new TypeResolver(original.errorReporter, [...original.bindings, ...additionalBindings])
    }
}
