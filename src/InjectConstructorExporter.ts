import * as ts from "typescript"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {Inject, Reusable} from "karambit-decorators"

@Inject
@Reusable
export class InjectConstructorExporter {

    constructor(
        private readonly context: ts.TransformationContext,
        private readonly nodeDetector: InjectNodeDetector,
    ) {
        this.exportProviders = this.exportProviders.bind(this)
    }

    exportProviders(sourceFile: ts.SourceFile): ts.SourceFile
    exportProviders(node: ts.Node): ts.Node {
        if (ts.isClassDeclaration(node) && this.isModuleOrInjectConstructor(node)) {
            return ts.factory.updateClassDeclaration(
                node,
                [...(node.modifiers ?? []), ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
                node.name,
                node.typeParameters,
                node.heritageClauses,
                node.members,
            )
        } else {
            return ts.visitEachChild(node, this.exportProviders, this.context)
        }
    }

    private isModuleOrInjectConstructor(node: ts.ClassDeclaration): boolean {
        return node.modifiers !== undefined &&
            (
                node.modifiers.some(this.nodeDetector.isInjectDecorator) ||
                node.modifiers.some(this.nodeDetector.isModuleDecorator)
            )
    }
}
