import * as ts from "typescript"

export type SourceFileVisitor = (sourceFile: ts.SourceFile) => void

export function findAllChildren<T extends ts.Node>(node: ts.Node | ReadonlyArray<ts.Node>, predicate: (node: ts.Node) => node is T): T[]
export function findAllChildren(node: ts.Node | ReadonlyArray<ts.Node>, predicate: (node: ts.Node) => boolean): ts.Node[]
export function findAllChildren<T extends ts.Node>(node: ts.Node | ReadonlyArray<ts.Node>, predicate: (node: ts.Node) => node is T): T[] {
    const nodes: ts.Node[] = Array.isArray(node) ? Array.from(node) : [node]
    const matchingNodes: T[] = []
    let current: ts.Node | undefined
    while (current = nodes.shift()) { // eslint-disable-line
        if (predicate(current)) {
            matchingNodes.push(current)
        }
        nodes.push(...current.getChildren())
    }
    return matchingNodes
}
