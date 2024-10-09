import * as ts from "typescript"
import {Inject, Reusable} from "karambit-decorators"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {ComponentGeneratorDependenciesFactory} from "./ComponentGenerator"
import {ErrorReporter} from "./ErrorReporter"
import {NameGenerator} from "./NameGenerator"
import {filterNotNull} from "./Util"
import {visitEachChild} from "./Visitor"
import {Importer} from "./Importer"

@Inject
@Reusable
export class SourceFileGenerator {

    constructor(
        private readonly nodeDetector: InjectNodeDetector,
        private readonly errorReporter: ErrorReporter,
        private readonly nameGenerator: NameGenerator,
        private readonly importer: Importer,
        private readonly componentGeneratorDependenciesFactory: ComponentGeneratorDependenciesFactory,
    ) { }

    generateSourceFile(originalSource: ts.SourceFile): ts.SourceFile | undefined {
        const components: ts.ClassDeclaration[] = this.findComponents(originalSource)
        if (components.length === 0) return undefined

        const generatedComponents = components.map(component =>
            this.componentGeneratorDependenciesFactory(component).generatedComponent
        )
        const classDeclarations = generatedComponents.map(it => it.classDeclaration)
        const requiresUnsetSymbolDeclaration = generatedComponents.some(it => it.requiresUnsetSymbolDeclaration)
        return ts.factory.updateSourceFile(
            originalSource,
            filterNotNull([
                ...this.importer.getImports(),
                requiresUnsetSymbolDeclaration ? this.unsetSymbolDeclaration() : undefined,
                ...classDeclarations,
            ]),
            originalSource.isDeclarationFile,
            originalSource.referencedFiles,
            originalSource.typeReferenceDirectives,
            originalSource.hasNoDefaultLib,
            originalSource.libReferenceDirectives,
        )
    }

    private findComponents(node: ts.Node, outComponents?: ts.ClassDeclaration[]): ts.ClassDeclaration[] {
        if (outComponents === undefined) {
            const components: ts.ClassDeclaration[] = []
            return this.findComponents(node, components)
        }
        if (ts.isClassDeclaration(node) && node.modifiers?.some(this.nodeDetector.isComponentDecorator)) {
            if (!node.modifiers?.some(it => it.kind === ts.SyntaxKind.AbstractKeyword)) {
                // TODO: Migrate this validation to a single place
                this.errorReporter.reportParseFailed("Component must be abstract!", node)
            }
            outComponents.push(node)
        } else {
            visitEachChild(node, child => this.findComponents(child, outComponents))
        }
        return outComponents
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
