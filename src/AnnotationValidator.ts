import * as ts from "typescript"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {Inject, Reusable} from "karambit-decorators"
import {ErrorReporter} from "./ErrorReporter"
import {bound} from "./Util"
import {findAllChildren} from "./Visitor"
import {AnnotationLike, ComponentLikeDeclaration, isComponentLikeDeclaration, isJSDocTag} from "./TypescriptUtil"

@Inject
@Reusable
export class AnnotationValidator {

    constructor(
        private readonly nodeDetector: InjectNodeDetector,
        private readonly errorReporter: ErrorReporter,
    ) { }

    @bound
    validateAnnotations(node: ts.Node): void {
        const annotations = findAllChildren(node, this.nodeDetector.isKarambitAnnotation)
        const componentAnnotations = annotations.filter(this.nodeDetector.isComponentAnnotation)
        const injectAnnotations = annotations.filter(this.nodeDetector.isInjectAnnotation)
        const moduleDecorators = annotations.filter(this.nodeDetector.isModuleDecorator)

        componentAnnotations.forEach(this.requireDeclarationExported)
        componentAnnotations.forEach(this.requireAbstractClassOrInterface)

        injectAnnotations.forEach(this.requireDeclarationExported)
        injectAnnotations.forEach(this.requireConcreteClass)

        moduleDecorators.forEach(this.requireDeclarationExported)
    }

    @bound
    private requireDeclarationExported(annotation: AnnotationLike): void {
        const declaration = getDeclaration(annotation)
        if (!declaration || !declaration.modifiers?.some(it => it.kind === ts.SyntaxKind.ExportKeyword)) {
            this.errorReporter.reportParseFailed(`${getAnnotationName(annotation)} annotated class must be exported!`, declaration)
        }
    }

    @bound
    private requireAbstractClassOrInterface(annotation: AnnotationLike): void {
        const declaration = getDeclaration(annotation)
        if (!declaration || !(ts.isInterfaceDeclaration(declaration) || declaration.modifiers?.some(it => it.kind === ts.SyntaxKind.AbstractKeyword))) {
            this.errorReporter.reportParseFailed(`${getAnnotationName(annotation)} annotated class must be abstract!`, declaration)
        }
    }

    @bound
    private requireConcreteClass(annotation: AnnotationLike): void {
        const declaration = getDeclaration(annotation)
        if (!declaration || declaration.modifiers?.some(it => it.kind === ts.SyntaxKind.AbstractKeyword)) {
            this.errorReporter.reportParseFailed(`${getAnnotationName(annotation)} annotated class must not be abstract!`, declaration)
        }
    }
}

function getDeclaration(annotation: AnnotationLike): ComponentLikeDeclaration | undefined {
    if (isComponentLikeDeclaration(annotation)) {
        return annotation
    }
    if (isComponentLikeDeclaration(annotation.parent)) {
        return annotation.parent
    }
    let current: ts.Node = annotation.parent
    while (ts.isJSDoc(current)) {
        current = current.parent
    }
    return isComponentLikeDeclaration(current) ? current : undefined
}

function getAnnotationName(decorator: AnnotationLike): string {
    if (isJSDocTag(decorator)) {
        return `@${decorator.tagName.getText()}`
    }
    const text = decorator.getText()
    const regex = /^(@[^()]*)(?:\(.*\))?$/
    const matches = text.match(regex)
    if (matches) return matches[1]
    return `@${text}`
}
