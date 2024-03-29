import * as ts from "typescript"
import {Inject, Reusable} from "karambit-inject"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {ComponentGeneratorDependenciesFactory} from "./ComponentGenerator"
import {ErrorReporter} from "./ErrorReporter"

@Inject
@Reusable
export class ComponentVisitor {

    constructor(
        private readonly context: ts.TransformationContext,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly errorReporter: ErrorReporter,
        private readonly componentGeneratorDependenciesFactory: ComponentGeneratorDependenciesFactory,
    ) {
        this.visitComponents = this.visitComponents.bind(this)
    }

    visitComponents(sourceFile: ts.SourceFile): ts.SourceFile
    visitComponents(node: ts.Node): ts.Node | ts.Node[] {
        if (ts.isClassDeclaration(node) && node.modifiers?.some(this.nodeDetector.isComponentDecorator)) {
            if (!node.modifiers?.some(it => it.kind === ts.SyntaxKind.AbstractKeyword)) {
                this.errorReporter.reportParseFailed("Component must be abstract!", node)
            }
            const generatorDeps = this.componentGeneratorDependenciesFactory(node)
            return generatorDeps.generator.updateComponent()
        } else {
            return ts.visitEachChild(node, this.visitComponents, this.context)
        }
    }
}
