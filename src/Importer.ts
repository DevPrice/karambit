import * as ts from "typescript"
import * as Path from "path"
import {Inject} from "karambit-decorators"
import {SourceFileScope} from "./Scopes"

@Inject
@SourceFileScope
export class Importer {

    #newImports: Map<ts.Symbol, ts.ImportDeclaration> = new Map()

    constructor(
        private readonly sourceFile: ts.SourceFile,
    ) {
        this.addImportsToSourceFile = this.addImportsToSourceFile.bind(this)
    }

    getImportForSymbol(symbol: ts.Symbol): ts.ImportDeclaration | undefined {
        const declarations = symbol.getDeclarations()
        if (!declarations || declarations.length === 0) return undefined

        const sourcePath = `${Importer.outDir}/${Path.relative(".", this.sourceFile.fileName)}`.replace(/[^/]+$/, "")
        const importSourceFile = declarations[0].getSourceFile()
        const importSpecifier = this.getImportSpecifier(sourcePath, importSourceFile)
        if (Path.basename(importSourceFile.fileName) !== "typescript.d.ts" && importSpecifier === "typescript") {
            return undefined
        }

        const existingImport = this.#newImports.get(symbol)
        if (existingImport) return existingImport
        const newImport = this.createImportForSymbol(symbol, importSpecifier)
        this.#newImports.set(symbol, newImport)
        return newImport
    }

    addImportsToSourceFile(sourceFile: ts.SourceFile): ts.SourceFile {
        return ts.factory.updateSourceFile(
            sourceFile,
            [...Array.from(this.#newImports.values()), ...sourceFile.statements.filter(it => it.kind !== ts.SyntaxKind.ImportDeclaration && it.kind !== ts.SyntaxKind.ImportEqualsDeclaration)]
        )
    }

    getExpressionForDeclaration(node: ts.Declaration): ts.Expression {
        const type = Importer.typeChecker.getTypeAtLocation(node)!
        const symbol = this.symbolForType(type)
        return this.getExpressionForSymbol(symbol)
    }

    getExpressionForSymbol(symbol: ts.Symbol): ts.Expression {
        this.getImportForSymbol(symbol)
        return ts.factory.createIdentifier(symbol.getName())
    }

    getTypeNode(type: ts.Type): ts.TypeNode | undefined {
        const symbol = this.symbolForType(type)
        if (symbol && symbol.getName && symbol.getName() === "__type") {
            // no import needed
        } else if (symbol) {
            if (this.#newImports.has(symbol)) {
                return Importer.typeChecker.typeToTypeNode(type, undefined, undefined)
            }
            this.getImportForSymbol(symbol)
            this.importTypeArguments(type)
        }
        if (type.isUnionOrIntersection()) {
            type.types.forEach(it => this.getTypeNode(it))
        }
        return Importer.typeChecker.typeToTypeNode(type, undefined, undefined)
    }

    private symbolForType(type: ts.Type) {
        return type.aliasSymbol ?? type.symbol
    }

    private importTypeArguments(type: ts.Type) {
        const withTypeArguments = type as any as {typeArguments?: ts.Type[]}
        if (withTypeArguments.typeArguments) {
            withTypeArguments.typeArguments
                .forEach(it => it && this.getTypeNode(it))
        }
    }

    private createImportForSymbol(symbol: ts.Symbol, importSpecifier: string): ts.ImportDeclaration {
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
            ts.factory.createStringLiteral(importSpecifier),
            undefined
        )
    }

    private getImportSpecifier(sourcePath: string, importFile: ts.SourceFile): string {
        const nodeModuleRegex = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/
        const match = nodeModuleRegex.exec(importFile.fileName)
        if (match) return match[1]
        return Path.relative(sourcePath, importFile.fileName).replace(/\.ts$/, "")
    }

    static outDir: string = "karambit-generated"
    static typeChecker: ts.TypeChecker
}
