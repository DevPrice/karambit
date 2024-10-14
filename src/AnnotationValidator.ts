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
        const componentAnnotations = annotations.filter(this.nodeDetector.isComponentDecorator)
        const moduleAnnotations = annotations.filter(this.nodeDetector.isModuleDecorator)
        const injectAnnotations = annotations.filter(this.nodeDetector.isInjectDecorator)

        componentAnnotations.forEach(this.requireClassExported)
        componentAnnotations.forEach(this.requireAbstractClass)

        moduleAnnotations.forEach(this.requireClassExported)

        injectAnnotations.forEach(this.requireClassExported)
        injectAnnotations.forEach(this.requireConcreteClass)
    }

    @bound
    private requireClassExported(decorator: ts.Decorator): void {
        if (ts.isClassDeclaration(decorator.parent)) {
            if (!decorator.parent.modifiers?.some(it => it.kind === ts.SyntaxKind.ExportKeyword)) {
                this.errorReporter.reportParseFailed(`${this.getDecoratorName(decorator)} annotated class must be exported!`, decorator.parent)
            }
        }
    }

    @bound
    private requireAbstractClass(decorator: ts.Decorator): void {
        if (ts.isClassDeclaration(decorator.parent)) {
            if (!decorator.parent.modifiers?.some(it => it.kind === ts.SyntaxKind.AbstractKeyword)) {
                this.errorReporter.reportParseFailed(`${this.getDecoratorName(decorator)} annotated class must be abstract!`, decorator.parent)
            }
        }
    }

    @bound
    private requireConcreteClass(decorator: ts.Decorator): void {
        if (ts.isClassDeclaration(decorator.parent)) {
            if (decorator.parent.modifiers?.some(it => it.kind === ts.SyntaxKind.AbstractKeyword)) {
                this.errorReporter.reportParseFailed(`${this.getDecoratorName(decorator)} annotated class must not be abstract!`, decorator.parent)
            }
        }
    }

    private getDecoratorName(decorator: ts.Decorator): string {
        const text = decorator.getText()
        const regex = /^(@[^()]*)(?:\(.*\))?$/
        const matches = text.match(regex)
        if (matches) return matches[1]
        return text
    }
}
