import ts from "typescript"
import * as Path from "path"
import {ProgramScope} from "./Scopes"
import {KarambitOptions} from "./karambit"
import {bound, memoized} from "./Util"
import {getEmittedModuleFileExtension, removeModuleFileExtension} from "./TypescriptUtil"

/**
 * @inject
 * @scope {@link ProgramScope}
 */
export class Importer {

    private newImports = new Map<string, ts.ImportDeclaration>()

    constructor(
        private readonly karambitOptions: KarambitOptions,
        private readonly typeChecker: ts.TypeChecker,
        private readonly compilerOptions: ts.CompilerOptions,
    ) { }

    @memoized
    private getImportForSymbol(symbol: ts.Symbol): ts.Identifier | undefined {
        const declarations = symbol.getDeclarations()
        if (!declarations || declarations.length === 0) return undefined

        const importSourceFile = declarations[0].getSourceFile()
        const importSpecifier = this.getImportSpecifier(importSourceFile)

        const identifier = this.getImportIdentifier(importSpecifier)

        if (this.newImports.has(importSpecifier)) return identifier
        // TODO: This should probably be checking if the symbol is globally accessible instead
        if (importSpecifier !== "typescript" || Path.basename(importSourceFile.fileName) === "typescript.d.ts") {
            this.addImport(importSpecifier)
        }

        return identifier
    }

    getQualifiedNameForSymbol(symbol: ts.Symbol): ts.EntityName {
        const left = this.getImportForSymbol(symbol)
        const right = ts.factory.createIdentifier(symbol.name)
        return left ? ts.factory.createQualifiedName(left, right) : right
    }

    @bound
    addImportsToSourceFile(sourceFile: ts.SourceFile): ts.SourceFile {
        return ts.factory.updateSourceFile(
            sourceFile,
            [
                ...this.newImports.values(),
                ...sourceFile.statements.filter(it => !ts.isImportDeclaration(it)),
            ]
        )
    }

    getImports(): ts.ImportDeclaration[] {
        return Array.from(this.newImports.values())
    }

    getExpressionForDeclaration(node: ts.Declaration): ts.Expression {
        if (ts.isVariableDeclaration(node)) {
            if (ts.isIdentifier(node.name)) {
                // seems like a hack for modules, but I'm not sure what the right way is to get this symbol
                const symbol = this.typeChecker.getSymbolAtLocation(node.name)
                if (symbol) {
                    return this.getExpressionForSymbol(symbol)
                }
            }
        }
        const type = this.typeChecker.getTypeAtLocation(node)!
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

    @memoized
    private getImportIdentifier(specifier: string): ts.Identifier {
        const identifierText = removeModuleFileExtension(Path.basename(specifier)).replaceAll(/[^a-z\d]+/ig, "$")
        return ts.factory.createUniqueName(identifierText)
    }

    private addImport(importSpecifier: string): ts.ImportDeclaration {
        const newImport = ts.factory.createImportDeclaration(
            undefined,
            ts.factory.createImportClause(
                undefined,
                undefined,
                ts.factory.createNamespaceImport(this.getImportIdentifier(importSpecifier)),
            ),
            ts.factory.createStringLiteral(importSpecifier),
            undefined
        )
        this.newImports.set(importSpecifier, newImport)
        return newImport
    }

    private getImportSpecifier(fileToImport: ts.SourceFile): string {
        if (ts.isExternalModule(fileToImport) && fileToImport.moduleName) {
            return fileToImport.moduleName
        }
        const outDir = Path.dirname(this.karambitOptions.outFile)
        const relativePath = Path.relative(outDir, fileToImport.fileName).replaceAll(Path.sep, Path.posix.sep)
        const extension = this.requiresExplicitExtensions()
            ? getEmittedModuleFileExtension(relativePath, this.compilerOptions)
            : ""
        const outputPath = removeModuleFileExtension(relativePath) + extension
        return outputPath.startsWith(".")
            ? outputPath
            : "./" + outputPath
    }

    /**
     * ECMAScript imports are resolved without guessing at extensions, so relative specifiers in an output
     * file that Node loads as ESM have to name the emitted file exactly. Everywhere else - CommonJS output,
     * and the bundler and node10 resolution modes - an extensionless specifier is what resolves.
     */
    @memoized
    private requiresExplicitExtensions(): boolean {
        const outFile = Path.resolve(this.karambitOptions.outFile)
        return ts.getImpliedNodeFormatForFile(outFile, undefined, ts.sys, this.compilerOptions) === ts.ModuleKind.ESNext
    }
}
