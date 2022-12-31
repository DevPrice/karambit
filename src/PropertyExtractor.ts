import * as ts from "typescript"
import {createQualifiedType, QualifiedType} from "./QualifiedType"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {Inject, Reusable} from "karambit-inject"

export type PropertyLike = ts.PropertyDeclaration | ts.PropertySignature
export type ElementLike = ts.ClassElement | ts.TypeElement

@Inject
@Reusable
export class PropertyExtractor {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly nodeDetector: InjectNodeDetector,
    ) { }

    getDeclaredPropertiesForType(type: ts.Type): PropertyLike[] {
        const baseTypes = type.getBaseTypes() ?? []
        const baseProperties = baseTypes.flatMap(it => this.getDeclaredPropertiesForType(it))

        const declarations = type.getSymbol()?.getDeclarations() ?? []
        return declarations
            .filter(it => ts.isClassDeclaration(it) || ts.isInterfaceDeclaration(it) || ts.isTypeLiteralNode(it))
            .map(it => it as ts.ClassDeclaration | ts.InterfaceDeclaration | ts.TypeLiteralNode)
            .flatMap(declaration => declaration.members as ts.NodeArray<ElementLike>)
            .filter((it: ElementLike) => ts.isPropertyDeclaration(it) || ts.isPropertySignature(it))
            .map(it => it as PropertyLike)
            .concat(baseProperties)
    }

    typeFromPropertyDeclaration(property: PropertyLike): QualifiedType {
        return createQualifiedType({
            type: this.typeChecker.getTypeAtLocation(property.type ?? property)!,
            qualifier: this.nodeDetector.getQualifier(property)
        })
    }
}