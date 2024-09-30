import * as ts from "typescript"
import {createQualifiedType, QualifiedType} from "./QualifiedType"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {Inject, Reusable} from "karambit-decorators"

export type PropertyLike = ts.PropertyDeclaration | ts.PropertySignature
export type ElementLike = ts.ClassElement | ts.TypeElement
type MethodLike = ts.Node & {name: ts.PropertyName, body?: ts.BlockLike, modifiers?: ts.NodeArray<ts.ModifierLike>}

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

    getUnimplementedAbstractProperties(type: ts.Type): PropertyLike[] {
        const declarations = type.getSymbol()?.getDeclarations() ?? []
        const properties = declarations
            .filter(it => ts.isClassLike(it))
            .map(it => it as ts.ClassLikeDeclaration)
            .flatMap(declaration => declaration.members)
            .filter(it => ts.isPropertyDeclaration(it) || ts.isPropertySignature(it))
            .map(it => it as PropertyLike)

        const implementedProperties = properties.filter(it => it.initializer !== undefined)
            .map(it => it.name.getText())
        const baseTypes = type.getBaseTypes() ?? []
        const baseProperties = baseTypes.flatMap(it => this.getUnimplementedAbstractProperties(it))
            .filter(it => !implementedProperties.includes(it.name.getText()))

        return properties
            .filter(it => it.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AbstractKeyword))
            .map(it => it as PropertyLike)
            .concat(baseProperties)
    }

    getUnimplementedAbstractMethods(type: ts.Type): MethodLike[] {
        const declarations = type.getSymbol()?.getDeclarations() ?? []
        const methods = declarations
            .filter(it => ts.isClassLike(it))
            .map(it => it as ts.ClassLikeDeclaration)
            .flatMap(declaration => declaration.members)
            .filter(it => ts.isMethodDeclaration(it) || ts.isMethodSignature(it))
            .map(it => it as MethodLike)

        const implementedMethods = methods.filter(it => it.body !== undefined)
            .map(it => it.name.getText())
        const baseTypes = type.getBaseTypes() ?? []
        const baseMethods = baseTypes.flatMap(it => this.getUnimplementedAbstractMethods(it))
            .filter(it => !implementedMethods.includes(it.name.getText()))

        return methods
            .filter(it => it.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AbstractKeyword))
            .concat(baseMethods)
    }

    typeFromPropertyDeclaration(property: PropertyLike): QualifiedType {
        return createQualifiedType({
            type: this.typeChecker.getTypeAtLocation(property.type ?? property)!,
            qualifier: this.nodeDetector.getQualifier(property)
        })
    }
}