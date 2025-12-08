

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

    get [Symbol.toStringTag](): string {
        return this.backingMap.toString()
    }
}
