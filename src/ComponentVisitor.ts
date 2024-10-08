import * as ts from "typescript"
import {Inject, Reusable} from "karambit-decorators"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {ComponentGeneratorDependenciesFactory} from "./ComponentGenerator"
import {ErrorReporter} from "./ErrorReporter"
import {NameGenerator} from "./NameGenerator"
import {bound} from "./Util"

@Inject
@Reusable
export class ComponentVisitor {

    constructor(
        private readonly context: ts.TransformationContext,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly errorReporter: ErrorReporter,
        private readonly nameGenerator: NameGenerator,
        private readonly componentGeneratorDependenciesFactory: ComponentGeneratorDependenciesFactory,
    ) { }

    visitComponents(sourceFile: ts.SourceFile): ts.SourceFile
    @bound
    visitComponents(node: ts.Node): ts.Node | ts.Node[] {
        if (ts.isClassDeclaration(node) && node.modifiers?.some(this.nodeDetector.isComponentDecorator)) {
            if (!node.modifiers?.some(it => it.kind === ts.SyntaxKind.AbstractKeyword)) {
                this.errorReporter.reportParseFailed("Component must be abstract!", node)
            }
            const generatorDeps = this.componentGeneratorDependenciesFactory(node)
            return generatorDeps.generator.updateComponent()
        } else if (ts.isImportDeclaration(node)) {
            return node
        } else if (this.hasComponentChild(node)) {
            // TODO: This is inefficient
            if (ts.isSourceFile(node)) {
                const updatedSource = ts.visitEachChild(node, this.visitComponents, this.context)
                // TODO: Only generate this symbol declaration if it's actually used
                const unsetSymbolDeclaration = ts.factory.createVariableStatement(
                    undefined,
                    ts.factory.createVariableDeclarationList([
                        ts.factory.createVariableDeclaration(
                            this.nameGenerator.unsetSymbolName,
                            undefined,
                            ts.factory.createTypeOperatorNode(
                                ts.SyntaxKind.UniqueKeyword,
                                ts.factory.createKeywordTypeNode(ts.SyntaxKind.SymbolKeyword),
                            ),
                            ts.factory.createCallExpression(
                                ts.factory.createIdentifier("Symbol"),
                                undefined,
                                [],
                            ),
                        )
                    ], ts.NodeFlags.Const))
                const afterImportIndex = updatedSource.statements.findIndex(it => it.kind !== ts.SyntaxKind.ImportDeclaration && it.kind !== ts.SyntaxKind.ImportEqualsDeclaration)
                return ts.factory.updateSourceFile(
                    updatedSource,
                    [...updatedSource.statements.slice(0, afterImportIndex), unsetSymbolDeclaration, ...updatedSource.statements.slice(afterImportIndex)],
                    updatedSource.isDeclarationFile,
                    updatedSource.referencedFiles,
                    updatedSource.typeReferenceDirectives,
                    updatedSource.hasNoDefaultLib,
                    updatedSource.libReferenceDirectives,
                )
            } else {
                return ts.visitEachChild(node, this.visitComponents, this.context)
            }
        } else if (ts.isSourceFile(node)) {
            return ts.createSourceFile(node.fileName, "", ts.ScriptTarget.ES2021)
        }
        return []
    }

    hasComponentChild(node: ts.Node): boolean {
        if (ts.isClassDeclaration(node) && node.modifiers?.some(this.nodeDetector.isComponentDecorator)) return true
        return node.getChildren()
            .flatMap(it => it.kind == ts.SyntaxKind.SyntaxList ? it.getChildren() : [it])
            .some(it => this.hasComponentChild(it))
    }
}
