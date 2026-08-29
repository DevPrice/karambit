import * as ts from "./compiler"
import {GeneratedComponent} from "./ComponentGenerator"
import {NameGenerator} from "./NameGenerator"
import {isNotNull} from "./Util"
import {Importer} from "./Importer"
import {KarambitOptions} from "./karambit"
import {ErrorReporter} from "./ErrorReporter"

/**
 * @inject
 * @reusable
 */
export class SourceFileGenerator {

    constructor(
        private readonly nameGenerator: NameGenerator,
        private readonly importer: Importer,
        private readonly options: KarambitOptions,
    ) { }

    generateSourceFile(components: GeneratedComponent[]): ts.SourceFile {
        if (components.length === 0 && !this.options.allowEmptyOutput) {
            ErrorReporter.reportNoComponents()
        }
        const classDeclarations = components.map(it => it.classDeclaration)
        const requiresUnsetSymbolDeclaration = components.some(it => it.requiresUnsetSymbolDeclaration)
        const sourceFile = ts.createSourceFile(this.options.outFile, this.options.outputScriptTarget)
        return ts.updateSourceFile(
            sourceFile,
            [
                ...this.importer.getImports(),
                requiresUnsetSymbolDeclaration ? this.unsetSymbolDeclaration() : undefined,
                ...classDeclarations,
            ].filter(isNotNull),
        )
    }

    private unsetSymbolDeclaration() {
        return ts.createVariableStatement(
            undefined,
            ts.createVariableDeclarationList([
                ts.createVariableDeclaration(
                    this.nameGenerator.unsetSymbolName,
                    undefined,
                    ts.createTypeOperatorNode(
                        ts.SyntaxKind.UniqueKeyword,
                        ts.createKeywordTypeNode(ts.SyntaxKind.SymbolKeyword),
                    ),
                    ts.createCallExpression(
                        ts.createIdentifier("Symbol"),
                        undefined,
                        [],
                    ),
                )
            ], ts.NodeFlags.Const))
    }
}
