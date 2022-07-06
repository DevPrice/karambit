declare global {
    export interface Array<T> {
        filterNotNull(): NonNullable<T>[]
        distinctBy(predicate: (item: T) => unknown): T[]
    }
}

Array.prototype.filterNotNull = function <T> (this: Array<T>) { return filterNotNull(this) }
Array.prototype.distinctBy = function <T> (this: Array<T>, predicate: (item: T) => unknown) { return distinctBy(this, predicate) }

export function filterNotNull<T>(items: T[]): NonNullable<T>[] {
    return items.filter(it => it !== undefined && it !== null) as NonNullable<T>[]
}

export function distinctBy<T>(items: Iterable<T>, predicate: (item: T) => unknown): T[] {
    const set = new Set<unknown>()
    const result: T[] = []
    for (const item of items) {
        const discriminator = predicate(item)
        if (!set.has(discriminator)) {
            result.push(item)
            set.add(discriminator)
        }
    }
    return result
}

export interface Container<T> {
    keys(): IterableIterator<T>
    has(value: T): boolean
    readonly size: number
}

export function findCycles<T>(
    item: T,
    getChildren: (item: T) => Iterable<T>,
    ancestors: Container<T> = new Set([item]),
): T[] {
    const children = getChildren(item)
    const circularDep = Array.from(children).find(child => ancestors.has(child))
    if (circularDep) return Array.from(ancestors.keys()).concat(circularDep)
    for (const child of children) {
        const cycle = findCycles(child, getChildren, new Set([...ancestors.keys(), child]))
        if (cycle.length > 0) return cycle
    }
    return []
}
