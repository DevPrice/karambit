import * as ts from "typescript"
import {ErrorReporter} from "./ErrorReporter"

export type PropertyLike = ts.PropertyDeclaration | ts.PropertySignature
export type ElementLike = ts.ClassElement | ts.TypeElement
export interface ComponentProperty {
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
                    const declaration = symbol.valueDeclaration
                    if (declaration && ts.isMethodDeclaration(declaration)) {
                        return {
                            symbol,
                            returnType: this.typeChecker.getTypeAtLocation(declaration.type ?? declaration),
                            parameters: declaration.parameters,
                            optional: false,
                        }
                    } else {
                        this.errorReporter.reportParseFailed(`Failed to get method declaration for property '${symbol.name}'!`, symbol.valueDeclaration)
                    }
                }
                const optional = !!(symbol.flags & ts.SymbolFlags.Optional)
                const returnType = symbol.valueDeclaration && ts.isPropertyDeclaration(symbol.valueDeclaration)
                    ? this.typeChecker.getTypeAtLocation(symbol.valueDeclaration.type ?? symbol.valueDeclaration)
                    : symbolType
                return {
                    symbol,
                    returnType,
                    optional,
                }
            })
    }
}

export function needsImplementation(declaration: ts.Declaration): boolean {
    if (ts.isPropertyDeclaration(declaration) || ts.isAutoAccessorPropertyDeclaration(declaration)) {
        return declaration.initializer === undefined
    }
    if (ts.isMethodDeclaration(declaration) || ts.isGetAccessorDeclaration(declaration) || ts.isSetAccessorDeclaration(declaration)) {
        return declaration.body === undefined
    }
    return !ts.isParameterPropertyDeclaration(declaration, declaration.parent)
}
