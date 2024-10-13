import * as ts from "typescript"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {Inject, Reusable} from "karambit-decorators"
import {ErrorReporter} from "./ErrorReporter"
import {bound} from "./Util"
import {findAllChildren} from "./Visitor"

@Inject
@Reusable
export class AnnotationValidator {

    constructor(
        private readonly nodeDetector: InjectNodeDetector,
        private readonly errorReporter: ErrorReporter,
    ) { }

    @bound
    validateAnnotations(node: ts.Node): void {
        const annotations = findAllChildren(node, this.nodeDetector.isKarambitDecorator)
        annotations.filter(this.nodeDetector.isComponentDecorator)
            .forEach(this.requireClassExported)
        annotations.filter(this.nodeDetector.isModuleDecorator)
            .forEach(this.requireClassExported)
        annotations.filter(this.nodeDetector.isInjectDecorator)
            .forEach(this.requireClassExported)
    }

    @bound
    private requireClassExported(decorator: ts.Decorator): void {
        if (ts.isClassDeclaration(decorator.parent)) {
            if (!decorator.parent.modifiers?.some(it => it.kind === ts.SyntaxKind.ExportKeyword)) {
                this.errorReporter.reportParseFailed("Annotated class must be exported!", decorator.parent)
            }
        }
    }
}
