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

export function filterTree<T>(
    root: T,
    getChildren: (item: T) => Iterable<T>,
    predicate: (item: T) => boolean,
    toString: (item: T) => string = defaultToString,
): ReadonlyMap<T, Iterable<T>> {
    const result = new Map<T, Iterable<T>>()
    if (predicate(root)) {
        result.set(root, new Set())
    } else {
        const children = Array.from(getChildren(root))
        const filteredChildren = children.flatMap(it => Array.from(filterTree(it, getChildren, predicate, toString).entries()))
        if (filteredChildren.length > 0) {
            return new Map([...filteredChildren, [root, filteredChildren.map(it => it[0])]])
        }
    }
    return result
}

export function printTreeMap<T>(
    root: T,
    map: ReadonlyMap<T, Iterable<T>>,
    toString: (item: T) => string = defaultToString
): string {
    return printTree(root, item => map.get(item) ?? [], toString)
}

export function printTree<T>(
    root: T,
    getChildren: (item: T) => Iterable<T>,
    toString: (item: T) => string = defaultToString
): string {
    return printTreeInternal(root, getChildren, toString, false).trimEnd()
}

function printTreeInternal<T>(
    root: T,
    getChildren: (item: T) => Iterable<T>,
    toString: (item: T) => string = defaultToString,
    prefix: boolean = true,
): string {
    const children = Array.from(getChildren(root))

    const prefixStr = children.length > 0 ? "┬ " : "─ "
    let result = `${prefix ? prefixStr : ""}${toString(root)}\n`

    children.forEach((next, index) => {
        const childTree = printTreeInternal(next, getChildren, toString)
        result += prefixLines(childTree, index < children.length - 1 ? "├─" : "└─", "│ ")
    })

    return result
}

function prefixLines(str: string, first: string, rest: string): string {
    const lines = str.split("\n")
    if (lines.length > 1) {
        return first + lines[0] + "\n" + lines.slice(1).map(it => it.length > 0 ? rest + it : it).join("\n")
    }
    return "└─" + str
}

function defaultToString(item: any): string {
    if (item.toString && typeof item.toString === "function") {
        return item.toString()
    }
    return ""
}
