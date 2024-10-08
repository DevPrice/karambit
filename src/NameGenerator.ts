import * as ts from "typescript"
import {QualifiedType} from "./QualifiedType"
import {Inject} from "karambit-decorators"
import {SourceFileScope} from "./Scopes"
import {memoized} from "./Util"

@Inject
@SourceFileScope
export class NameGenerator {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly componentIdentifiers: Map<ts.Type, ts.Identifier>,
    ) { }

    private getterNames = new Map<QualifiedType, ts.Identifier | ts.PrivateIdentifier>()

    readonly parentName: ts.Identifier = ts.factory.createUniqueName("parent")
    readonly unsetSymbolName: ts.Identifier = ts.factory.createUniqueName("unsetSymbol")

    getComponentIdentifier(type: ts.Type, preferredName?: string): ts.Identifier {
        const existingName = this.componentIdentifiers.get(type)
        if (existingName) return existingName

        // for some reason, createUniqueName doesn't work with the export keyword here...?
        const newName = ts.factory.createIdentifier(preferredName ?? `Karambit${capitalize(this.getValidIdentifier(type))}`)
        this.componentIdentifiers.set(type, newName)
        return newName
    }

    @memoized
    getPropertyIdentifier(type: QualifiedType): ts.Identifier {
        const identifierText = this.getValidIdentifier(type.type)
        return ts.factory.createUniqueName(uncapitalize(identifierText))
    }

    @memoized
    getPropertyIdentifierForParameter(param: ts.ParameterDeclaration): ts.Identifier {
        const type = this.typeChecker.getTypeAtLocation(param.type ?? param)
        const identifierText = this.getValidIdentifier(type)
        return ts.factory.createUniqueName(uncapitalize(identifierText))
    }

    getGetterMethodIdentifier(type: QualifiedType): ts.Identifier | ts.PrivateIdentifier {
        const existingName = this.getterNames.get(type)
        if (existingName) return existingName

        const identifierText = this.getValidIdentifier(type.type)
        const newName = ts.factory.createUniqueName(`get${capitalize(identifierText)}`)
        this.getterNames.set(type, newName)
        return newName
    }

    getSubcomponentFactoryGetterMethodIdentifier(type: QualifiedType): ts.Identifier | ts.PrivateIdentifier {
        const existingName = this.getterNames.get(type)
        if (existingName) return existingName

        const identifierText = this.getValidIdentifier(type.type)
        const newName = ts.factory.createUniqueName(`get${capitalize(identifierText)}_Factory`)
        this.getterNames.set(type, newName)
        return newName
    }

    getAssistedFactoryGetterMethodIdentifier(type: QualifiedType): ts.Identifier | ts.PrivateIdentifier {
        const existingName = this.getterNames.get(type)
        if (existingName) return existingName

        const identifierText = this.getValidIdentifier(type.type)
        const newName = ts.factory.createUniqueName(`get${capitalize(identifierText)}_Factory`)
        this.getterNames.set(type, newName)
        return newName
    }

    getValidIdentifier(type: ts.Type): string {
        return this.typeChecker.typeToString(type).replaceAll(/[^a-z\d]+/ig, "$")
    }

    getUnsetSymbolIdentifier(): ts.Identifier {
        return this.unsetSymbolName
    }
}

function capitalize(str: string): string {
    if (str.length < 1) return str
    return str.charAt(0).toUpperCase() + str.slice(1)
}

function uncapitalize(str: string): string {
    if (str.length < 1) return str
    return str.charAt(0).toLowerCase() + str.slice(1)
}
