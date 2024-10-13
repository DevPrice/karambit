import chalk = require("chalk")

declare global {
    export interface Array<T> {
        distinctBy(predicate: (item: T) => unknown): T[]
    }
}

Array.prototype.distinctBy = function <T> (this: Array<T>, predicate: (item: T) => unknown) { return distinctBy(this, predicate) }

export function identity<T>(value: T): T {
    return value
}

export function isNotNull<T>(value: T): value is NonNullable<T> {
    return value !== null && value !== undefined
}

export function memoize<This, Args extends Array<unknown>, T>(f: (this: This, ...args: Args) => T): (this: This, ...args: Args) => T {
    const cache: TupleMap<unknown[], {value: T}> = new TupleMap()
    return function (this: This, ...args: Args) {
        const key = args.slice(0, f.length)
        const cachedResult = cache.get(key)
        if (cachedResult !== undefined) return cachedResult.value
        const newResult = f.apply(this, args)
        cache.set(key, {value: newResult})
        return newResult
    }
}

export const memoized: MethodDecorator = (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    return {
        get: function() {
            const original = descriptor.value ?? descriptor.get?.()
            const memo = memoize(original)
            Object.defineProperty(this, propertyKey, {
                configurable: true,
                value: memo,
            })
            return memo
        }
    }
}

export const bound: MethodDecorator = (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    return {
        get: function () {
            const original = descriptor.value ?? descriptor.get?.()
            const bound = original.bind(this)
            Object.defineProperty(this, propertyKey, {
                configurable: true,
                value: bound,
            })
            return bound
        }
    }
}

export function distinct<T>(items: Iterable<T>): T[] {
    return distinctBy(items, identity)
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
): ReadonlyMap<T, T[]> {
    const result = new Map<T, T[]>()
    if (predicate(root)) {
        result.set(root, [])
    } else {
        const children = Array.from(getChildren(root))
        const filteredChildren: [T, ReadonlyMap<T, T[]>][] = children.map(it => [it, filterTree(it, getChildren, predicate, toString)])
        const entries = filteredChildren.flatMap(it => Array.from(it[1].entries()))
        if (entries.length > 0) {
            return new Map([...entries, [root, distinct(filteredChildren.filter(it => it[1].size > 0).map(it => it[0]))]])
        }
    }
    return result
}

export function filterTreeMap<T>(
    root: T,
    map: ReadonlyMap<T, Iterable<T>>,
    predicate: (item: T) => boolean,
    toString: (item: T) => string = defaultToString,
): ReadonlyMap<T, T[]> {
    return filterTree(root, item => map.get(item) ?? [], predicate, toString)
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
    return printTreeInternal(root, getChildren, toString, false).result.trimEnd()
}

function printTreeInternal<T>(
    root: T,
    getChildren: (item: T) => Iterable<T>,
    toString: (item: T) => string = defaultToString,
    prefix: boolean = true,
    visited: Container<T> = new Set(),
): { result: string, visited: Container<T> } {
    const children = Array.from(getChildren(root))

    if (visited.has(root) && children.length > 0) {
        return {result: `─ ${toString(root)} ${chalk.bgYellow("de-duped")}\n`, visited: new Set()}
    }

    const prefixStr = children.length > 0 ? "┬ " : "─ "

    let result = `${prefix ? prefixStr : ""}${toString(root)}\n`
    const alsoVisited = new Set<T>([root])
    children.forEach((next, index) => {
        const childTree = printTreeInternal(next, getChildren, toString, true, new Set([...visited.keys(), ...alsoVisited]))
        for (const v of childTree.visited.keys()) {
            alsoVisited.add(v)
        }
        const last = index >= children.length - 1
        result += prefixLines(childTree.result, last ? "└─" : "├─", last ? "  " : "│ ")
    })
    return {result, visited: alsoVisited}
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

export function time<T>(fun: () => T): { durationMs: number, result: T } {
    const startTime = Date.now()
    const result = fun()
    return {durationMs: Date.now() - startTime, result}
}

type NestedMap<K, V> = Map<K, { next?: NestedMap<K, V>, value?: V }>

export class TupleMap<K extends ReadonlyArray<unknown>, V> implements Map<K, V> {

    private backingMap: NestedMap<unknown, V> = new Map()
    get size(): number {
        return this.backingMap.size
    }

    clear(): void {
        this.backingMap.clear()
    }

    delete(key: K): boolean {
        let current = this.backingMap
        for (let i = 0; i < key.length - 1; i++) {
            const k = key[i]
            const next = current.get(k)
            if (next === undefined || next.next === undefined) {
                return false
            } else {
                current = next.next
            }
        }
        return current.delete(key[key.length - 1])
    }

    forEach(callback: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void {
        throw new Error("Not implemented")
    }

    get(key: K): V | undefined {
        let current = this.backingMap
        for (let i = 0; i < key.length - 1; i++) {
            const k = key[i]
            const next = current.get(k)
            if (next === undefined || next.next === undefined) {
                return undefined
            } else {
                current = next.next
            }
        }
        return current.get(key[key.length - 1])?.value
    }

    has(key: K): boolean {
        let current = this.backingMap
        for (let i = 0; i < key.length - 1; i++) {
            const k = key[i]
            const next = current.get(k)
            if (next === undefined || next.next === undefined) {
                return next?.value !== undefined
            } else {
                current = next.next
            }
        }
        return current.has(key[key.length - 1])
    }

    set(key: K, value: V): this {
        let current = this.backingMap
        for (let i = 0; i < key.length - 1; i++) {
            const k = key[i]
            const next = current.get(k)
            if (next === undefined) {
                const newMap = new Map()
                current.set(k, {next: newMap})
                current = newMap
            } else if (next.next === undefined) {
                const newMap = new Map()
                next.next = newMap
                current = newMap
            } else {
                current = next.next
            }
        }
        current.set(key[key.length - 1], {value})
        return this
    }

    [Symbol.iterator](): IterableIterator<[K, V]> {
        throw new Error("Not implemented")
    }

    entries(): IterableIterator<[K, V]> {
        throw new Error("Not implemented")
    }

    keys(): IterableIterator<K> {
        throw new Error("Not implemented")
    }

    values(): IterableIterator<V> {
        throw new Error("Not implemented")
    }

    readonly [Symbol.toStringTag]: string
}
