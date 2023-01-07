import {Inject, Reusable} from "karambit-inject"
import * as ts from "typescript"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {Importer} from "./Importer"
import {ErrorReporter} from "./ErrorReporter"

@Inject
@Reusable
export class CreateComponentTransformer {

    constructor(
        private readonly context: ts.TransformationContext,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly componentIdentifiers: Map<ts.Type, ts.Identifier>,
        private readonly typeChecker: ts.TypeChecker,
        private readonly importer: Importer,
        private readonly errorReporter: ErrorReporter,
    ) {
        this.transform = this.transform.bind(this)
    }

    transform(sourceFile: ts.SourceFile): ts.SourceFile
    transform<T>(node: ts.Node): ts.Node {
        const componentType = ts.isCallExpression(node) && this.nodeDetector.isCreateComponentCall(node)
        if (componentType) {
            const identifier = this.componentIdentifiers.get(componentType)
            if (!identifier) this.errorReporter.reportParseFailed(`Cannot create instance of ${this.typeChecker.typeToString(componentType)}! Is the type decorated with @Component?`, node)
            const symbol = componentType.getSymbol()
            if (!symbol) this.errorReporter.reportParseFailed(`Couldn't find symbol of type ${this.typeChecker.typeToString(componentType)}!`, node)
            const declaration = symbol.valueDeclaration
            if (!declaration) this.errorReporter.reportParseFailed(`Couldn't find declaration of type ${this.typeChecker.typeToString(componentType)}!`, node)
            return ts.factory.createNewExpression(
                this.importer.getExpressionForDeclaration(componentType.symbol, declaration.getSourceFile(), identifier),
                undefined,
                node.arguments.map(it => ts.visitNode(it, this.transform))
            )
        } else {
            return ts.visitEachChild(node, this.transform, this.context)
        }
    }
}