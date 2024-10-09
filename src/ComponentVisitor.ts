import * as ts from "typescript"
import {Inject, Reusable} from "karambit-decorators"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {ComponentGeneratorDependenciesFactory} from "./ComponentGenerator"
import {ErrorReporter} from "./ErrorReporter"
import {NameGenerator} from "./NameGenerator"
import {bound, filterNotNull} from "./Util"
import {visitEachChild} from "./Visitor"

@Inject
@Reusable
export class ComponentVisitor {

    constructor(
        private readonly nodeDetector: InjectNodeDetector,
        private readonly errorReporter: ErrorReporter,
        private readonly nameGenerator: NameGenerator,
        private readonly componentGeneratorDependenciesFactory: ComponentGeneratorDependenciesFactory,
    ) { }

    @bound
    visitComponents(sourceFile: ts.SourceFile): ts.SourceFile {
        const components: ts.ClassDeclaration[] = []
        this.findComponents(sourceFile, components)
        if (components.length === 0) return ts.factory.createSourceFile([], sourceFile.endOfFileToken as any, sourceFile.flags)

        const generatedComponents = components.map(component =>
            this.componentGeneratorDependenciesFactory(component).generatedComponent
        )
        const classDeclarations = generatedComponents.map(it => it.classDeclaration)
        const requiresUnsetSymbolDeclaration = generatedComponents.some(it => it.requiresUnsetSymbolDeclaration)
        return ts.factory.updateSourceFile(
            sourceFile,
            filterNotNull([
                requiresUnsetSymbolDeclaration ? this.unsetSymbolDeclaration() : undefined,
                ...classDeclarations,
            ]),
            sourceFile.isDeclarationFile,
            sourceFile.referencedFiles,
            sourceFile.typeReferenceDirectives,
            sourceFile.hasNoDefaultLib,
            sourceFile.libReferenceDirectives,
        )
    }

    private findComponents(node: ts.Node, outComponents: ts.ClassDeclaration[]): void {
        if (ts.isClassDeclaration(node) && node.modifiers?.some(this.nodeDetector.isComponentDecorator)) {
            if (!node.modifiers?.some(it => it.kind === ts.SyntaxKind.AbstractKeyword)) {
                // TODO: Migrate this validation to a single place
                this.errorReporter.reportParseFailed("Component must be abstract!", node)
            }
            outComponents.push(node)
        } else {
            visitEachChild(node, child => this.findComponents(child, outComponents))
        }
    }


    private unsetSymbolDeclaration() {
        return ts.factory.createVariableStatement(
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
    }
}
