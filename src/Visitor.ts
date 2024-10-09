import * as ts from "typescript"

export type SourceFileVisitor = (sourceFile: ts.SourceFile) => void

export function visitEachChild<T extends ts.Node>(node: T, visitor: (node: ts.Node) => void): void {
    const children = node.getChildren()
    for (const child of children) {
        visitor(child)
    }
}
