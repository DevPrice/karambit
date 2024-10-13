import * as ts from "typescript"
import {Inject, Reusable} from "karambit-decorators"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {ComponentGeneratorDependenciesFactory} from "./ComponentGenerator"
import {ErrorReporter} from "./ErrorReporter"
import {NameGenerator} from "./NameGenerator"
import {filterNotNull} from "./Util"
import {findAllChildren} from "./Visitor"
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
        const components: ts.ClassDeclaration[] = findAllChildren(originalSource, (n): n is ts.ClassDeclaration => {
            return ts.isClassDeclaration(n) && !!n.modifiers?.some(this.nodeDetector.isComponentDecorator)
        })
        if (components.length === 0) return undefined

        const generatedComponents = components.map(component => {
            if (!component.modifiers?.some(it => it.kind === ts.SyntaxKind.AbstractKeyword)) {
                // TODO: Migrate validation to a single place
                this.errorReporter.reportParseFailed("Component must be abstract!", component)
            }
            return this.componentGeneratorDependenciesFactory(component).generatedComponent
        })
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
