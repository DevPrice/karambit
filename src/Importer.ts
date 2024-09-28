import * as ts from "typescript"
import * as Path from "path"
import {Inject} from "karambit-inject"
import {SourceFileScope} from "./Scopes"

@Inject
@SourceFileScope
export class Importer {

    #newImports: Map<ts.Symbol, ts.ImportDeclaration> = new Map()

    constructor(
        private readonly sourceFile: ts.SourceFile,
        //private readonly options: KarambitTransformOptions,
    ) {
        this.addImportsToSourceFile = this.addImportsToSourceFile.bind(this)
    }

    getImportForSymbol(symbol: ts.Symbol): ts.ImportDeclaration | undefined {
        const sourcePath = `${"karambit-out"}/${this.sourceFile.fileName}`.replace(/[^/]+$/, "")
        const importPath = symbol.getDeclarations()![0].getSourceFile().fileName
        if (Path.basename(importPath) !== "typescript.d.ts" && this.getImportSpecifier(sourcePath, importPath) === "typescript") {
            return undefined
        }

        const existingImport = this.#newImports.get(symbol)
        if (existingImport) return existingImport
        const newImport = this.createImportForSymbol(symbol, sourcePath, importPath)
        this.#newImports.set(symbol, newImport)
        return newImport
    }

    addImportsToSourceFile(sourceFile: ts.SourceFile): ts.SourceFile {
        return ts.factory.updateSourceFile(
            sourceFile,
            [...Array.from(this.#newImports.values()), ...sourceFile.statements.filter(it => it.kind !== ts.SyntaxKind.ImportDeclaration)]
        )
    }

    getExpressionForDeclaration(symbol: ts.Symbol, sourceFile: ts.SourceFile, identifier?: ts.Identifier): ts.Expression {
        //if (this.sourceFile === sourceFile) return identifier ?? ts.factory.createIdentifier(symbol.getName())

        this.getImportForSymbol(symbol)
        return ts.factory.createIdentifier(symbol.getName())

        return ts.factory.createPropertyAccessExpression(
            ts.factory.getGeneratedNameForNode(this.getImportForSymbol(symbol)),
            identifier ?? ts.factory.createIdentifier(symbol.getName())
        )
    }

    private createImportForSymbol(symbol: ts.Symbol, sourcePath: string, importPath: string): ts.ImportDeclaration {
        const importLiteral = this.getImportSpecifier(sourcePath, importPath)
        return ts.factory.createImportDeclaration(
            undefined,
            ts.factory.createImportClause(
                false,
                undefined,
                ts.factory.createNamedImports([
                    ts.factory.createImportSpecifier(
                        false,
                        undefined,
                        ts.factory.createIdentifier(symbol.getName())
                    ),
                ])
            ),
            ts.factory.createStringLiteral(importLiteral),
            undefined
        )
    }

    private getImportSpecifier(sourcePath: string, importPath: string): string {
        const nodeModuleRegex = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/
        const match = nodeModuleRegex.exec(importPath)
        if (match) return match[1]
        return Path.relative(sourcePath, importPath).replace(/\.ts$/, "")
    }
}
