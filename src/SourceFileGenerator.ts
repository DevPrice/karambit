import * as ts from "./compiler/index.js"
import {GeneratedComponent} from "./ComponentGenerator.js"
import {NameGenerator} from "./NameGenerator.js"
import {isNotNull} from "./Util.js"
import {Importer} from "./Importer.js"
import {KarambitOptions} from "./karambit.js"
import {ErrorReporter} from "./ErrorReporter.js"

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
