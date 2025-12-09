import ts from "typescript"

export type SourceFileVisitor = (sourceFile: ts.SourceFile) => void

export function findChild<T extends ts.Node>(node: ts.Node | ReadonlyArray<ts.Node>, predicate: (node: ts.Node) => node is T): T | undefined
export function findChild(node: ts.Node | ReadonlyArray<ts.Node>, predicate: (node: ts.Node) => boolean): ts.Node | undefined {
    const nodes: ts.Node[] = Array.isArray(node) ? Array.from(node) : [node]
    let current: ts.Node | undefined
    while (current = nodes.shift()) { // eslint-disable-line
        if (predicate(current)) {
            return current
        }
        nodes.push(...current.getChildren())
    }
    return undefined
}

export function findAllChildren<T extends ts.Node>(node: ts.Node | ReadonlyArray<ts.Node>, predicate: (node: ts.Node) => node is T): T[]
export function findAllChildren(node: ts.Node | ReadonlyArray<ts.Node>, predicate: (node: ts.Node) => boolean): ts.Node[] {
    const nodes: ts.Node[] = Array.isArray(node) ? Array.from(node) : [node]
    const matchingNodes: ts.Node[] = []
    let current: ts.Node | undefined
    while (current = nodes.shift()) { // eslint-disable-line
        if (predicate(current)) {
            matchingNodes.push(current)
        }
        nodes.push(...current.getChildren())
    }
    return matchingNodes
}

export function findAncestor<T extends ts.Node>(node: ts.Node, predicate: (node: ts.Node) => node is T): T {
    let current: ts.Node | undefined = node.parent
    while (current && !predicate(current)) {
        current = current.parent
    }
    return current
}
