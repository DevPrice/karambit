import {findCycles} from "./Util"
import {ErrorReporter} from "./ErrorReporter"

export class Resolver<T> {

    constructor(
        private readonly errorReporter: ErrorReporter,
        private readonly bindings: ReadonlyMap<T, T>,
        private readonly toString?: (binding: T) => string
    ) {
        this.resolveBoundType = this.resolveBoundType.bind(this)
        for (const binding of bindings.keys()) {
            const cycle = findCycles(binding, (b) => [bindings.get(b)].filterNotNull())
            if (cycle.length > 0) {
                throw this.errorReporter.reportGenericBindingCycle(cycle[cycle.length - 1], cycle, toString)
            }
        }
    }

    resolveBoundType(type: T): T {
        const binding = this.bindings.get(type)
        if (!binding) return type
        return this.resolveBoundType(binding)
    }

    static merge<T>(original: Resolver<T>, additionalBindings: ReadonlyMap<T, T>): Resolver<T> {
        const duplicateBindings = Array.from(original.bindings.keys()).filter(it => additionalBindings.has(it))
        if (duplicateBindings.length > 0) {
            throw original.errorReporter.reportGenericDuplicateBindings(duplicateBindings)
        }
        return new Resolver(original.errorReporter, new Map([...original.bindings, ...additionalBindings]), original.toString)
    }
}
