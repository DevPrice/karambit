import * as ts from "typescript"
import * as Path from "path"
import {Inject} from "karambit-inject"
import {SourceFileScope} from "./Scopes"

@Inject
@SourceFileScope
export class Importer {

    #newImports: Map<string, ts.ImportDeclaration> = new Map()

    constructor(
        private readonly sourceFile: ts.SourceFile,
    ) {
        this.addImportsToSourceFile = this.addImportsToSourceFile.bind(this)
    }

    getImportForSymbol(symbol: ts.Symbol): ts.ImportDeclaration {
        const importPath = symbol.getDeclarations()![0].getSourceFile().fileName
        const existingImport = this.#newImports.get(importPath)
        if (existingImport) return existingImport
        const newImport = this.createImportForSymbol(symbol, importPath)
        this.#newImports.set(importPath, newImport)
        return newImport
    }

    addImportsToSourceFile(sourceFile: ts.SourceFile): ts.SourceFile {
        return ts.factory.updateSourceFile(
            sourceFile,
            [...Array.from(this.#newImports.values()), ...sourceFile.statements]
        )
    }

    private createImportForSymbol(symbol: ts.Symbol, importPath: string): ts.ImportDeclaration {
        const myPath = this.sourceFile.fileName.replace(/[^/]+$/, "")
        const relativePath = Path.relative(myPath, importPath).replace(/\.ts$/, "")
        const importLiteral = relativePath.match(/^[./]/) ? relativePath : "./" + relativePath
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
}
