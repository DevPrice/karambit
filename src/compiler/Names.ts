import {Identifier} from "./Ast"
import {createIdentifier} from "./Factory"

/**
 * Allocates identifiers that don't collide within a generated file. The compiler's emitter does this
 * for names created by `createUniqueName`, resolving them at print time; a factory without an emitter
 * behind it can't.
 */
export class NameAllocator {

    private readonly counts = new Map<string, number>()
    private readonly used = new Set<string>()

    /** Claims a name verbatim, so nothing allocated later can collide with it. */
    reserve(name: string): string {
        this.used.add(name)
        return name
    }

    allocate(baseName: string): Identifier {
        let count = this.counts.get(baseName) ?? 0
        let name: string
        do {
            name = `${baseName}_${++count}`
        } while (this.used.has(name))
        this.counts.set(baseName, count)
        this.used.add(name)
        return createIdentifier(name)
    }
}
