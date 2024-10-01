import {Inject, Reusable} from "karambit-decorators"
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
        this.replaceCreateComponent = this.replaceCreateComponent.bind(this)
        this.replaceGetConstructor = this.replaceGetConstructor.bind(this)
    }

    replaceCreateComponent(sourceFile: ts.SourceFile): ts.SourceFile
    replaceCreateComponent(node: ts.Node): ts.Node {
        const componentType = ts.isCallExpression(node) && this.nodeDetector.isCreateComponentCall(node)
        if (componentType) {
            return ts.factory.createNewExpression(
                this.getComponentConstructorExpression(componentType, node),
                undefined,
                node.arguments.map(it => ts.visitNode(it, this.replaceCreateComponent))
            )
        } else {
            return ts.visitEachChild(node, this.replaceCreateComponent, this.context)
        }
    }

    replaceGetConstructor(sourceFile: ts.SourceFile): ts.SourceFile
    replaceGetConstructor(node: ts.Node): ts.Node {
        const componentType = ts.isCallExpression(node) && this.nodeDetector.isGetConstructorCall(node)
        if (componentType) {
            return this.getComponentConstructorExpression(componentType, node)
        } else {
            return ts.visitEachChild(node, this.replaceGetConstructor, this.context)
        }
    }

    private getComponentConstructorExpression(componentType: ts.Type, contextNode: ts.Node): ts.Expression {
        const identifier = this.componentIdentifiers.get(componentType)
        if (!identifier) this.errorReporter.reportParseFailed(`Cannot create instance of ${this.typeChecker.typeToString(componentType)}! Is the type decorated with @Component?`, contextNode)
        const symbol = componentType.getSymbol()
        if (!symbol) this.errorReporter.reportParseFailed(`Couldn't find symbol of type ${this.typeChecker.typeToString(componentType)}!`, contextNode)
        return this.importer.getExpressionForSymbol(componentType.symbol, ts.SymbolFlags.Constructor)
    }
}
