import * as ts from "typescript"
import {Inject, Reusable} from "karambit-inject"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {ComponentGeneratorDependenciesFactory} from "./ComponentGenerator"

@Inject
@Reusable
export class ComponentVisitor {

    constructor(
        private readonly context: ts.TransformationContext,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly componentGeneratorDependenciesFactory: ComponentGeneratorDependenciesFactory,
    ) {
        this.visitComponents = this.visitComponents.bind(this)
    }

    visitComponents(sourceFile: ts.SourceFile): ts.SourceFile
    visitComponents(node: ts.Node): ts.Node {
        if (ts.isClassDeclaration(node) && node.modifiers?.some(this.nodeDetector.isComponentDecorator)) {
            const generatorDeps = this.componentGeneratorDependenciesFactory(node)
            return generatorDeps.generator.updateComponent()
        } else {
            return ts.visitEachChild(node, this.visitComponents, this.context)
        }
    }
}
