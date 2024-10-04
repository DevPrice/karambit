import * as ts from "typescript"
import * as Path from "path"
import {Inject} from "karambit-decorators"
import {SourceFileScope} from "./Scopes"
import {KarambitTransformOptions} from "./karambit"

@Inject
@SourceFileScope
export class Importer {

    private newImports = new Map<string, ts.ImportDeclaration>()
    private symbolMap = new Map<ts.Symbol, ts.Identifier>()
    private importNames = new Map<string, ts.Identifier>()

    constructor(
        private readonly sourceFile: ts.SourceFile,
    ) {
        this.addImportsToSourceFile = this.addImportsToSourceFile.bind(this)
    }

    private getImportForSymbol(symbol: ts.Symbol): ts.Identifier | undefined {
        const cached = this.symbolMap.get(symbol)
        if (cached) return cached

        const declarations = symbol.getDeclarations()
        if (!declarations || declarations.length === 0) return undefined

        const importSourceFile = declarations[0].getSourceFile()
        const importSpecifier = this.getImportSpecifier(importSourceFile)

        const identifier = this.getImportIdentifier(importSpecifier)
        this.symbolMap.set(symbol, identifier)

        if (this.newImports.has(importSpecifier)) return identifier
        if (Path.basename(importSourceFile.fileName) !== "typescript.d.ts" && importSpecifier === "typescript") {
            return identifier
        }

        const newImport = this.createImport(importSpecifier)
        this.newImports.set(importSpecifier, newImport)
        return identifier
    }

    getQualifiedNameForSymbol(symbol: ts.Symbol): ts.EntityName {
        const left = this.getImportForSymbol(symbol)
        const right = ts.factory.createIdentifier(symbol.name)
        return left ? ts.factory.createQualifiedName(left, right) : right
    }

    addImportsToSourceFile(sourceFile: ts.SourceFile): ts.SourceFile {
        return ts.factory.updateSourceFile(
            sourceFile,
            [
                ...this.newImports.values(),
                ...sourceFile.statements.filter(it => !ts.isImportDeclaration(it)),
            ]
        )
    }

    getExpressionForDeclaration(node: ts.Declaration): ts.Expression {
        const type = Importer.typeChecker.getTypeAtLocation(node)!
        const symbol = this.symbolForType(type)
        return this.getExpressionForSymbol(symbol)
    }

    getExpressionForSymbol(symbol: ts.Symbol): ts.Expression {
        const left = this.getImportForSymbol(symbol)
        const right = ts.factory.createIdentifier(symbol.name)
        return left ? ts.factory.createPropertyAccessExpression(left, right) : right
    }

    private symbolForType(type: ts.Type) {
        return type.aliasSymbol ?? type.symbol
    }

    private getImportIdentifier(specifier: string): ts.Identifier {
        const existingName = this.importNames.get(specifier)
        if (existingName) return existingName

        const identifierText = Path.basename(specifier).replaceAll(/[^a-z\d]+/ig, "$")
        const newName = ts.factory.createUniqueName(identifierText)
        this.importNames.set(specifier, newName)
        return newName
    }

    private createImport(importSpecifier: string): ts.ImportDeclaration {
        return ts.factory.createImportDeclaration(
            undefined,
            ts.factory.createImportClause(
                false,
                undefined,
                ts.factory.createNamespaceImport(this.getImportIdentifier(importSpecifier)),
            ),
            ts.factory.createStringLiteral(importSpecifier),
            undefined
        )
    }

    private getImportSpecifier(fileToImport: ts.SourceFile): string {
        const nodeModuleRegex = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/
        const match = nodeModuleRegex.exec(fileToImport.fileName)
        if (match) return match[1]
        const generatedFilePath = Path.join(
            Importer.transformOptions.outDir,
            Path.dirname(
                Path.relative(
                    Importer.transformOptions.sourceRoot,
                    this.sourceFile.fileName,
                )
            )
        )
        return Path.relative(generatedFilePath, fileToImport.fileName).replace(/\.ts$/, "")
    }

    static transformOptions: KarambitTransformOptions
    static typeChecker: ts.TypeChecker
}
