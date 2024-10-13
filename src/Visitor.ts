import * as ts from "typescript"

export type SourceFileVisitor = (sourceFile: ts.SourceFile) => void

export function visitEachChild<T extends ts.Node>(node: T, visitor: (node: ts.Node) => void): void {
    const children = node.getChildren()
    for (const child of children) {
        visitor(child)
    }
}

export function findAllChildren<T extends ts.Node>(node: ts.Node, predicate: (node: ts.Node) => node is T): T[]
export function findAllChildren(node: ts.Node, predicate: (node: ts.Node) => boolean): ts.Node[]
export function findAllChildren<T extends ts.Node>(node: ts.Node, predicate: (node: ts.Node) => node is T): T[] {
    const nodes: ts.Node[] = [node]
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
