import {Inject, Reusable} from "karambit-decorators"
import * as ts from "typescript"

/**
 * Wraps hacky calls to non-public Typescript APIs.
 */
@Inject
@Reusable
export class Hacks {

    cloneNode<T extends ts.Node>(node: T): T {
        return (ts.factory as any).cloneNode(node)
    }
}