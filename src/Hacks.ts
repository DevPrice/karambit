import * as ts from "typescript"

/**
 * Wraps hacky calls to non-public TypeScript APIs.
 * @inject
 * @reusable
 */
export class Hacks {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
    ) { }

    cloneNode<T extends ts.Node>(node: T): T {
        return (ts.factory as any).cloneNode(node)
    }

    isTupleType(type: ts.Type): type is ts.TupleType {
        return this.typeChecker.isTupleType(type)
    }

    getResolvedTypeArguments(type: ts.Type): ts.Type[] | undefined {
        return (type as any).resolvedTypeArguments
    }

    getTarget(type: ts.Type): ts.Type | undefined {
        return (type as any).target
    }

    static getTypeChecker(type: ts.Type): ts.TypeChecker | undefined {
        return (type as any).checker
    }
}