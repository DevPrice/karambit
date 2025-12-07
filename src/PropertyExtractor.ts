import * as ts from "typescript"
import {createQualifiedType, QualifiedType} from "./QualifiedType"

export type PropertyLike = ts.PropertyDeclaration | ts.PropertySignature
export type ElementLike = ts.ClassElement | ts.TypeElement
export interface ComponentProperty {
    symbol: ts.Symbol
    parameters?: ts.Symbol[]
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
    ) { }

    getDeclaredPropertiesForType(type: ts.Type): PropertyLike[] {
        const baseTypes = type.getBaseTypes() ?? []
        const baseProperties = baseTypes.flatMap(it => this.getDeclaredPropertiesForType(it))

        const declarations = type.getSymbol()?.getDeclarations() ?? []
        return declarations
            .filter(it => ts.isClassLike(it) || ts.isInterfaceDeclaration(it) || ts.isTypeLiteralNode(it))
            .flatMap(declaration => declaration.members as ts.NodeArray<ElementLike>)
            .filter((it: ElementLike) => ts.isPropertyDeclaration(it) || ts.isPropertySignature(it))
            .concat(baseProperties)
    }

    getUnimplementedProperties(type: ts.Type): ComponentProperty[] {
        return type.getApparentProperties()
            .filter(symbol => symbol.declarations?.every(needsImplementation))
            .map(symbol => {
                const symbolType = this.typeChecker.getTypeOfSymbol(symbol)
                if (symbol.flags & ts.SymbolFlags.Method) {
                    const callSignatures = symbolType.getCallSignatures()
                    if (callSignatures.length !== 1) {
                        throw Error("TODO")
                    }
                    const callSignature = callSignatures[0]
                    return {
                        symbol,
                        returnType: callSignature.getReturnType(),
                        parameters: callSignature.getParameters(),
                        optional: false,
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

    typeFromPropertyDeclaration(property: PropertyLike): QualifiedType {
        return createQualifiedType({
            type: this.typeChecker.getTypeAtLocation(property.type ?? property)!,
        })
    }
}

function needsImplementation(declaration: ts.Declaration): boolean {
    if (ts.isPropertyDeclaration(declaration) || ts.isAutoAccessorPropertyDeclaration(declaration)) {
        return declaration.initializer === undefined
    }
    if (ts.isMethodDeclaration(declaration) || ts.isGetAccessorDeclaration(declaration) || ts.isSetAccessorDeclaration(declaration)) {
        return declaration.body === undefined
    }
    return !ts.isParameterPropertyDeclaration(declaration, declaration.parent)
}
