import * as ts from "typescript"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {Inject, Reusable} from "karambit-decorators"
import {ErrorReporter} from "./ErrorReporter"

@Inject
@Reusable
export class ExportVerifier {

    constructor(
        private readonly context: ts.TransformationContext,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly errorReporter: ErrorReporter,
    ) {
        this.verifyExports = this.verifyExports.bind(this)
    }

    verifyExports(sourceFile: ts.SourceFile): ts.SourceFile
    verifyExports(node: ts.Node): ts.Node {
        if (ts.isClassDeclaration(node) && node.modifiers && !node.modifiers.some(it => it.kind === ts.SyntaxKind.ExportKeyword)) {
            if (node.modifiers.some(this.nodeDetector.isComponentDecorator)) {
                this.errorReporter.reportParseFailed("Components must be exported!", node)
            }
            if (node.modifiers.some(this.nodeDetector.isModuleDecorator)) {
                this.errorReporter.reportParseFailed("Modules must be exported!", node)
            }
            if (node.modifiers.some(this.nodeDetector.isInjectDecorator)) {
                this.errorReporter.reportParseFailed("Injectable constructors must be exported!", node)
            }
        }
        return ts.visitEachChild(node, this.verifyExports, this.context)
    }
}
