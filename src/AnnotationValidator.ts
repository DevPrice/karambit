import ts from "typescript"
import {InjectNodeDetector, KarambitAnnotationTag} from "./InjectNodeDetector"
import {ErrorReporter} from "./ErrorReporter"
import {bound} from "./Util"
import {findAllChildren, findAncestor} from "./Visitor"
import {AnnotationLike, ComponentLikeDeclaration, isComponentLikeDeclaration, isJSDocTag} from "./TypescriptUtil"

/**
 * @inject
 * @reusable
 */
export class AnnotationValidator {

    constructor(
        private readonly nodeDetector: InjectNodeDetector,
        private readonly errorReporter: ErrorReporter,
    ) { }

    @bound
    validateAnnotations(node: ts.Node): void {
        const annotations = findAllChildren(node, this.nodeDetector.isKarambitAnnotation)
        const componentAnnotations = annotations.filter(this.nodeDetector.isComponentAnnotation)
        const subcomponentAnnotations = annotations.filter(this.nodeDetector.isSubcomponentAnnotation)
        const injectAnnotations = annotations.filter(this.nodeDetector.isInjectAnnotation)
        const assistedInjectAnnotations = annotations.filter(this.nodeDetector.isAssistedInjectAnnotation)
        const assistedAnnotations = annotations.filter(this.nodeDetector.isAssistedAnnotation)
        const factoryTags = annotations.filter(tag => this.nodeDetector.isKarambitDocTag(tag, KarambitAnnotationTag.factory))
        const moduleDecorators = annotations.filter(this.nodeDetector.isModuleDecorator)

        componentAnnotations.forEach(this.requireDeclarationExported)
        componentAnnotations.forEach(this.requireAbstractClassOrInterface)

        subcomponentAnnotations.forEach(this.requireDeclarationExported)
        subcomponentAnnotations.forEach(this.requireAbstractClassOrInterface)

        injectAnnotations.forEach(this.requireDeclarationExported)
        injectAnnotations.forEach(this.requireConcreteClass)
        injectAnnotations.forEach(this.requirePublicConstructor)

        assistedInjectAnnotations.forEach(this.requireDeclarationExported)
        assistedInjectAnnotations.forEach(this.requireConcreteClass)
        assistedInjectAnnotations.forEach(this.requirePublicConstructor)

        assistedAnnotations.forEach(this.requireConstructorParameter)
        assistedAnnotations.forEach(tag => {
            const classAncestor = findAncestor(tag, ts.isClassLike)
            if (!classAncestor || !this.nodeDetector.getAssistedInjectAnnotation(classAncestor)) {
                this.errorReporter.reportParseFailed(`${getAnnotationName(tag)} must be used in the constructor an @assistedInject class!`, getAnnotationParent(tag))
            }
        })

        factoryTags.map(tag => {
            const declaration = getDeclaration(tag)
            if (!declaration || !this.nodeDetector.getComponentAnnotation(declaration) && !this.nodeDetector.getSubcomponentAnnotation(declaration)) {
                this.errorReporter.reportParseFailed(`${getAnnotationName(tag)} must be used with @component or @subcomponent!`, getAnnotationParent(tag))
            }
        })

        moduleDecorators.forEach(this.requireDeclarationExported)
    }

    @bound
    private requireDeclarationExported(annotation: AnnotationLike): void {
        const declaration = getDeclaration(annotation)
        if (declaration && !declaration.modifiers?.some(it => it.kind === ts.SyntaxKind.ExportKeyword)) {
            this.errorReporter.reportParseFailed(`${getAnnotationName(annotation)} annotated declaration must be exported!`, getAnnotationParent(annotation))
        }
    }

    @bound
    private requireAbstractClassOrInterface(annotation: AnnotationLike): void {
        const declaration = getDeclaration(annotation)
        if (!declaration || !(ts.isInterfaceDeclaration(declaration) || ts.isTypeAliasDeclaration(declaration) || declaration.modifiers?.some(it => it.kind === ts.SyntaxKind.AbstractKeyword))) {
            this.errorReporter.reportParseFailed(`${getAnnotationName(annotation)} annotated must be applied to an interface or abstract class!`, getAnnotationParent(annotation))
        }
    }

    @bound
    private requireConcreteClass(annotation: AnnotationLike): void {
        const declaration = getDeclaration(annotation)
        if (!declaration || !ts.isClassDeclaration(declaration) || declaration.modifiers?.some(it => it.kind === ts.SyntaxKind.AbstractKeyword)) {
            this.errorReporter.reportParseFailed(`${getAnnotationName(annotation)} annotated class must not be abstract!`, getAnnotationParent(annotation))
        }
    }

    @bound
    private requirePublicConstructor(annotation: AnnotationLike): void {
        const declaration = getDeclaration(annotation)
        if (declaration && ts.isClassDeclaration(declaration)) {
            for (const constructor of findAllChildren(declaration, ts.isConstructorDeclaration)) {
                if (constructor.body && constructor.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword)) {
                    this.errorReporter.reportParseFailed(`${getAnnotationName(annotation)} annotated class must have a public constructor!`, declaration)
                }
            }
        }
    }

    @bound
    private requireConstructorParameter(annotation: AnnotationLike): void {
        const parent = getAnnotationParent(annotation)
        if (!parent || !ts.isParameter(parent) || !ts.isConstructorDeclaration(parent.parent)) {
            this.errorReporter.reportParseFailed(`${getAnnotationName(annotation)} must be applied to a constructor parameter!`, parent)
        }
    }
}

function getDeclaration(annotation: AnnotationLike): ComponentLikeDeclaration | undefined {
    if (isComponentLikeDeclaration(annotation.parent)) {
        return annotation.parent
    }
    let current: ts.Node = annotation.parent
    while (ts.isJSDoc(current)) {
        current = current.parent
    }
    return isComponentLikeDeclaration(current) ? current : undefined
}

function getAnnotationParent(annotation: AnnotationLike): ts.Node {
    let current: ts.Node = annotation
    while (ts.isJSDoc(current) || isJSDocTag(current) || ts.isDecorator(current)) {
        current = current.parent
    }
    return current
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
