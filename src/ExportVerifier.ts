import * as ts from "typescript"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {Inject, Reusable} from "karambit-decorators"
import {ErrorReporter} from "./ErrorReporter"
import {bound} from "./Util"
import {visitEachChild} from "./Visitor"

@Inject
@Reusable
export class ExportVerifier {

    constructor(
        private readonly nodeDetector: InjectNodeDetector,
        private readonly errorReporter: ErrorReporter,
    ) { }

    verifyExports(sourceFile: ts.SourceFile): ts.SourceFile
    @bound
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
        visitEachChild(node, this.verifyExports)
        return node
    }
}
