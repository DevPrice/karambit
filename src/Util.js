Array.prototype.filterNotNull = function () { return filterNotNull(this); };
Array.prototype.distinct = function () { return distinctBy(this, it => it); };
Array.prototype.distinctBy = function (predicate) { return distinctBy(this, predicate); };
export function filterNotNull(items) {
    return items.filter(it => it !== undefined && it !== null);
}
export function distinctBy(items, predicate) {
    const set = new Set();
    const result = [];
    for (const item of items) {
        const discriminator = predicate(item);
        if (!set.has(discriminator)) {
            result.push(item);
            set.add(discriminator);
        }
    }
    return result;
}
export function findCycles(item, getChildren, ancestors = new Set([item])) {
    const children = getChildren(item);
    const circularDep = Array.from(children).find(child => ancestors.has(child));
    if (circularDep)
        return Array.from(ancestors.keys()).concat(circularDep);
    for (const child of children) {
        const cycle = findCycles(child, getChildren, new Set([...ancestors.keys(), child]));
        if (cycle.length > 0)
            return cycle;
    }
    return [];
}
export function filterTree(root, getChildren, predicate, toString = defaultToString) {
    const result = new Map();
    if (predicate(root)) {
        result.set(root, []);
    }
    else {
        const children = Array.from(getChildren(root));
        const filteredChildren = children.map(it => [it, filterTree(it, getChildren, predicate, toString)]);
        const entries = filteredChildren.flatMap(it => Array.from(it[1].entries()));
        if (entries.length > 0) {
            return new Map([...entries, [root, filteredChildren.filter(it => it[1].size > 0).map(it => it[0]).distinct()]]);
        }
    }
    return result;
}
export function filterTreeMap(root, map, predicate, toString = defaultToString) {
    return filterTree(root, item => { var _a; return (_a = map.get(item)) !== null && _a !== void 0 ? _a : []; }, predicate, toString);
}
export function printTreeMap(root, map, toString = defaultToString) {
    return printTree(root, item => { var _a; return (_a = map.get(item)) !== null && _a !== void 0 ? _a : []; }, toString);
}
export function printTree(root, getChildren, toString = defaultToString) {
    return printTreeInternal(root, getChildren, toString, false).result.trimEnd();
}
function printTreeInternal(root, getChildren, toString = defaultToString, prefix = true, visited = new Set()) {
    const children = Array.from(getChildren(root));
    if (visited.has(root) && children.length > 0) {
        return { result: `─ ${toString(root)} ${chalk.bgYellow("de-duped")}\n`, visited: new Set() };
    }
    const prefixStr = children.length > 0 ? "┬ " : "─ ";
    let result = `${prefix ? prefixStr : ""}${toString(root)}\n`;
    const alsoVisited = new Set([root]);
    children.forEach((next, index) => {
        const childTree = printTreeInternal(next, getChildren, toString, true, new Set([...visited.keys(), ...alsoVisited]));
        for (const v of childTree.visited.keys()) {
            alsoVisited.add(v);
        }
        const last = index >= children.length - 1;
        result += prefixLines(childTree.result, last ? "└─" : "├─", last ? "  " : "│ ");
    });
    return { result, visited: alsoVisited };
}
function prefixLines(str, first, rest) {
    const lines = str.split("\n");
    if (lines.length > 1) {
        return first + lines[0] + "\n" + lines.slice(1).map(it => it.length > 0 ? rest + it : it).join("\n");
    }
    return "└─" + str;
}
function defaultToString(item) {
    if (item.toString && typeof item.toString === "function") {
        return item.toString();
    }
    return "";
}
export function time(fun) {
    const startTime = Date.now();
    const result = fun();
    return { durationMs: Date.now() - startTime, result };
}
export class TupleMap {
    constructor() {
        this.backingMap = new Map();
    }
    clear() {
        this.backingMap.clear();
    }
    delete(key) {
        let current = this.backingMap;
        for (let i = 0; i < key.length - 1; i++) {
            const k = key[i];
            const next = current.get(k);
            if (next === undefined) {
                return false;
            }
            else {
                current = next;
            }
        }
        return current.delete(key[key.length - 1]);
    }
    forEach(callback, thisArg) {
        throw new Error("Not implemented");
    }
    get(key) {
        let current = this.backingMap;
        for (let i = 0; i < key.length - 1; i++) {
            const k = key[i];
            const next = current.get(k);
            if (next === undefined) {
                return undefined;
            }
            else {
                current = next;
            }
        }
        return current.get(key[key.length - 1]);
    }
    has(key) {
        let current = this.backingMap;
        for (let i = 0; i < key.length - 1; i++) {
            const k = key[i];
            const next = current.get(k);
            if (next === undefined) {
                return false;
            }
            else {
                current = next;
            }
        }
        return current.has(key[key.length - 1]);
    }
    set(key, value) {
        let current = this.backingMap;
        for (let i = 0; i < key.length - 1; i++) {
            const k = key[i];
            const next = current.get(k);
            if (next === undefined) {
                const newMap = new Map();
                current.set(k, newMap);
                current = newMap;
            }
            else {
                current = next;
            }
        }
        current.set(key[key.length - 1], value);
        return this;
    }
    [Symbol.iterator]() {
        throw new Error("Not implemented");
    }
    entries() {
        throw new Error("Not implemented");
    }
    keys() {
        throw new Error("Not implemented");
    }
    values() {
        throw new Error("Not implemented");
    }
}
Symbol.toStringTag;
