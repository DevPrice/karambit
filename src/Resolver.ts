import {findCycles} from "./Util"

export class Resolver<T> {

    constructor(private readonly bindings: ReadonlyMap<T, T>, private readonly toString?: (binding: T) => string) {
        this.resolveBoundType = this.resolveBoundType.bind(this)
        for (const binding of bindings.keys()) {
            const cycle = findCycles(binding, (b) => [bindings.get(b)].filterNotNull())
            if (cycle.length > 0) {
                throw new Error(`Binding cycle detected! ${cycle.map(it => (toString && toString(it)) ?? it).join(" -> ")}`)
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
            throw new Error(`Duplicate binding(s) found when merging bindings: ${duplicateBindings.map(it => (original.toString && original.toString(it)) ?? it).join(", ")}`)
        }
        return new Resolver(new Map([...original.bindings, ...additionalBindings]), original.toString)
    }
}
