import * as ts from "./compiler/index.js"
import {ErrorReporter} from "./ErrorReporter.js"

export type PropertyLike = ts.PropertyDeclaration | ts.PropertySignature
export type ElementLike = ts.ClassElement | ts.TypeElement
export interface ComponentProperty {
    declaration?: ts.Declaration
    symbol: ts.Symbol
    parameters?: readonly unknown[]
    optional: boolean
    returnType: ts.Type
}

/**
 * @inject
 * @reusable
 */
export class PropertyExtractor {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly errorReporter: ErrorReporter,
    ) { }

    extractProperties(type: ts.Type): ComponentProperty[] {
        return type.getApparentProperties()
            .map(symbol => {
                const symbolType = this.typeChecker.getTypeOfSymbol(symbol)
                if (symbol.flags & ts.SymbolFlags.Method) {
                    const declaration = ts.getValueDeclaration(symbol)
                    if (declaration && ts.isMethodDeclaration(declaration)) {
                        return {
                            symbol,
                            returnType: this.typeChecker.getTypeAtLocation(declaration.type ?? declaration),
                            parameters: declaration.parameters,
                            optional: false,
                        }
                    } else {
                        this.errorReporter.reportParseFailed(`Failed to get method declaration for property '${symbol.name}'!`, ts.getValueDeclaration(symbol))
                    }
                }
                const optional = !!(symbol.flags & ts.SymbolFlags.Optional)
                const returnType = ts.getValueDeclaration(symbol) && ts.isPropertyDeclaration(ts.getValueDeclaration(symbol))
                    ? this.typeChecker.getTypeAtLocation(ts.getValueDeclaration(symbol).type ?? ts.getValueDeclaration(symbol))
                    : symbolType
                return {
                    symbol,
                    returnType,
                    optional,
                    declaration: ts.getValueDeclaration(symbol),
                }
            })
    }
}

export function needsImplementation(declaration: ts.Declaration): boolean {
    if (ts.isPropertyLikeDeclaration(declaration)) {
        return declaration.initializer === undefined
    }
    if (ts.isMethodDeclaration(declaration) || ts.isGetAccessorDeclaration(declaration) || ts.isSetAccessorDeclaration(declaration)) {
        return declaration.body === undefined
    }
    return !ts.isParameterProperty(declaration)
}
