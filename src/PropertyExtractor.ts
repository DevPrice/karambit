import * as ts from "typescript"
import {createQualifiedType, QualifiedType} from "./QualifiedType"
import {ElementLike, PropertyLike} from "./DependencyGraphBuilder"
import {InjectNodeDetector} from "./InjectNodeDetector"

export class PropertyExtractor {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly nodeDetector: InjectNodeDetector,
    ) { }

    getDeclaredPropertiesForType(type: ts.Type): PropertyLike[] {
        const symbol = type.symbol
        const declarations = symbol.getDeclarations()
        const baseTypes = type.getBaseTypes() ?? []
        const baseProperties = baseTypes.flatMap(it => this.getDeclaredPropertiesForType(it))

        if (declarations === undefined) return baseProperties
        return declarations.filter(it => ts.isClassDeclaration(it) || ts.isInterfaceDeclaration(it) || ts.isTypeLiteralNode(it))
            .map(it => it as ts.ClassDeclaration | ts.InterfaceDeclaration | ts.TypeLiteralNode)
            .flatMap(declaration => {
                const members = declaration.members as ts.NodeArray<ElementLike>
                return members.filter((it: ElementLike) => ts.isPropertyDeclaration(it) || ts.isPropertySignature(it))
                    .map(it => it as PropertyLike)
            }).concat(baseProperties)
    }

    typeFromPropertyDeclaration(property: PropertyLike): QualifiedType {
        return createQualifiedType({
            type: this.typeChecker.getTypeAtLocation(property.type ?? property)!,
            qualifier: this.nodeDetector.getQualifier(property)
        })
    }
}