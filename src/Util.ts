export function filterNotNull<T>(items: T[]): NonNullable<T>[] {
    return items.filter(it => it !== undefined && it !== null) as NonNullable<T>[]
}

export function distinctBy<T>(items: T[], predicate: (item: T) => any): T[] {
    const set = new Set<T>()
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
