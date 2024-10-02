import * as ts from "typescript"
import * as Path from "path"
import {Inject} from "karambit-decorators"
import {SourceFileScope} from "./Scopes"
import {ErrorReporter} from "./ErrorReporter"

@Inject
@SourceFileScope
export class Importer {

    #newImports: Map<ts.Symbol, ts.ImportDeclaration> = new Map()
    #importedSymbols: Set<ts.Symbol> = new Set()

    constructor(
        private readonly sourceFile: ts.SourceFile,
    ) {
        this.addImportsToSourceFile = this.addImportsToSourceFile.bind(this)
        for (const statement of sourceFile.statements) {
            if (ts.isImportDeclaration(statement)) {
                for (const symbol of this.getImportedSymbols(statement)) {
                    if (symbol.flags & ts.SymbolFlags.Alias) {
                        this.#importedSymbols.add(Importer.typeChecker.getAliasedSymbol(symbol))
                    } else {
                        //this.#importedSymbols.add(symbol)
                    }
                }
            }
        }
    }

    private getImportForSymbol(symbol: ts.Symbol): ts.ImportDeclaration | undefined {
        if (this.#importedSymbols.has(symbol)) {
            return undefined
        }

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
            [
                ...this.#newImports.values(),
                ...sourceFile.statements.map(statement => {
                    if (ts.isImportDeclaration(statement)) {
                        return this.updateImport(statement)
                    } else {
                        return statement
                    }
                })
                    .filterNotNull()
            ]
        )
    }

    getExpressionForDeclaration(node: ts.Declaration, flags: ts.SymbolFlags = ts.SymbolFlags.Constructor): ts.Expression {
        const type = Importer.typeChecker.getTypeAtLocation(node)!
        const symbol = this.symbolForType(type)
        return this.getExpressionForSymbol(symbol, flags)
    }

    getExpressionForSymbol(symbol: ts.Symbol, flags: ts.SymbolFlags): ts.Expression {
        this.getImportForSymbol(symbol)
        return Importer.typeChecker.symbolToExpression(symbol, flags, undefined, undefined) ?? ts.factory.createIdentifier(symbol.getName())
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

    private updateImport(statement: ts.ImportDeclaration): ts.ImportDeclaration | undefined {
        return ts.factory.updateImportDeclaration(
            statement,
            statement.modifiers,
            statement.importClause,
            ts.isStringLiteral(statement.moduleSpecifier)
                ? this.updateModuleSpecifier(statement.moduleSpecifier)
                : statement.moduleSpecifier,
            statement.assertClause,
        )
    }

    private updateModuleSpecifier(literal: ts.StringLiteral): ts.StringLiteral {
        const originalImportSpecifier = resolveStringLiteral(literal)
        if (!originalImportSpecifier.startsWith(".")) return literal
        const pathToOriginalSource = Path.join(Path.relative(Path.join(Importer.outDir, originalImportSpecifier), Path.dirname(this.sourceFile.fileName)), originalImportSpecifier)
        return ts.factory.createStringLiteral(pathToOriginalSource)
    }
    
    private getImportedSymbols(statement: ts.ImportDeclaration): Set<ts.Symbol> {
        const result: Set<ts.Symbol> = new Set()
        if (ts.isImportDeclaration(statement)) {
            const importClause = statement.importClause
            if (importClause) {
                if (importClause.name) {
                    const symbol = Importer.typeChecker.getSymbolAtLocation(importClause.name)
                    if (symbol) result.add(symbol)
                }
                const namedBindings = importClause.namedBindings
                if (namedBindings) {
                    if (ts.isNamedImports(namedBindings)) {
                        for (const specifier of namedBindings.elements) {
                            const symbol = Importer.typeChecker.getSymbolAtLocation(specifier.name)
                            if (symbol) result.add(symbol)
                        }
                    } else if (ts.isNamespaceImport(namedBindings)) {
                        const symbol = Importer.typeChecker.getSymbolAtLocation(namedBindings.name)
                        if (symbol) result.add(symbol)
                    }
                }
            }
        }
        return result
    }

    static outDir: string = "karambit-generated"
    static typeChecker: ts.TypeChecker
}

function resolveStringLiteral(literal: ts.StringLiteral): string {
    const match = literal.getText().match(/^['"](.*)['"]$/)
    if (!match || match.length < 2) throw ErrorReporter.reportParseFailed(`Failed to resolve string literal: ${literal.getText()}`)
    return match[1]
}
