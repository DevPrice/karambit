import * as ts from "typescript"
import {InjectNodeDetector} from "./InjectNodeDetector"

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
                node.decorators,
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
        return node.decorators !== undefined &&
            (
                node.decorators.some(this.nodeDetector.isInjectDecorator) ||
                node.decorators.some(this.nodeDetector.isModuleDecorator)
            )
    }
}
