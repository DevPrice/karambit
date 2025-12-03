import * as ts from "typescript"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {Inject, Reusable} from "karambit-decorators"
import {ErrorReporter} from "./ErrorReporter"
import {bound} from "./Util"
import {findAllChildren} from "./Visitor"
import {AnnotationLike} from "./TypescriptUtil"

@Inject
@Reusable
export class AnnotationValidator {

    constructor(
        private readonly nodeDetector: InjectNodeDetector,
        private readonly errorReporter: ErrorReporter,
    ) { }

    @bound
    validateAnnotations(node: ts.Node): void {
        // TODO: Validate JSDoc annotated nodes
        const annotations = findAllChildren(node, this.nodeDetector.isKarambitDecorator)
        const componentAnnotation = this.nodeDetector.getComponentAnnotation(node)
        const moduleAnnotations = annotations.filter(this.nodeDetector.isModuleDecorator)
        const injectAnnotations = annotations.filter(this.nodeDetector.isInjectDecorator)

        // TODO: This validation isn't applied to TSDoc components
        componentAnnotation && this.requireClassExported(componentAnnotation)
        componentAnnotation && this.requireAbstractClass(componentAnnotation)

        moduleAnnotations.forEach(this.requireClassExported)

        injectAnnotations.forEach(this.requireClassExported)
        injectAnnotations.forEach(this.requireConcreteClass)
    }

    @bound
    private requireClassExported(decorator: AnnotationLike): void {
        if (ts.isClassDeclaration(decorator.parent)) {
            if (!decorator.parent.modifiers?.some(it => it.kind === ts.SyntaxKind.ExportKeyword)) {
                this.errorReporter.reportParseFailed(`${this.getAnnotationName(decorator)} annotated class must be exported!`, decorator.parent)
            }
        }
    }

    @bound
    private requireAbstractClass(decorator: AnnotationLike): void {
        if (ts.isClassDeclaration(decorator.parent)) {
            if (!decorator.parent.modifiers?.some(it => it.kind === ts.SyntaxKind.AbstractKeyword)) {
                this.errorReporter.reportParseFailed(`${this.getAnnotationName(decorator)} annotated class must be abstract!`, decorator.parent)
            }
        }
    }

    @bound
    private requireConcreteClass(decorator: ts.Decorator): void {
        if (ts.isClassDeclaration(decorator.parent)) {
            if (decorator.parent.modifiers?.some(it => it.kind === ts.SyntaxKind.AbstractKeyword)) {
                this.errorReporter.reportParseFailed(`${this.getAnnotationName(decorator)} annotated class must not be abstract!`, decorator.parent)
            }
        }
    }

    private getAnnotationName(decorator: {getText(): string}): string {
        const text = decorator.getText()
        const regex = /^(@[^()]*)(?:\(.*\))?$/
        const matches = text.match(regex)
        if (matches) return matches[1]
        return `@${text}`
    }
}
