import * as ts from "./compiler/index.js"
import {QualifiedType} from "./QualifiedType.js"
import {ProgramScope} from "./Scopes.js"
import {memoized} from "./Util.js"
import {KarambitOptions} from "./karambit.js"

/**
 * @inject
 * @scope {@link ProgramScope}
 */
export class NameGenerator {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly nameAllocator: ts.NameAllocator,
        private readonly karambitOptions: KarambitOptions
    ) {
        this.parentName = nameAllocator.allocate("parent")
        this.unsetSymbolName = nameAllocator.allocate("unsetSymbol")
    }

    private getterNames = new Map<QualifiedType, ts.Identifier | ts.PrivateIdentifier>()

    readonly parentName: ts.Identifier
    readonly unsetSymbolName: ts.Identifier

    getComponentIdentifier(type: ts.Type, preferredName?: string): ts.Identifier {
        // exported, so it keeps the name it's declared with rather than an allocated one
        const name = preferredName ?? `Karambit${capitalize(this.getValidIdentifier(type))}`
        return ts.createIdentifier(this.nameAllocator.reserve(name))
    }

    getSubcomponentIdentifier(name: string): ts.Identifier {
        return this.nameAllocator.allocate(name)
    }

    @memoized
    getPropertyIdentifier(type: QualifiedType): ts.Identifier {
        const identifierText = this.getValidIdentifier(type.type)
        return this.nameAllocator.allocate(uncapitalize(identifierText))
    }

    @memoized
    getPropertyIdentifierForParameter(param: ts.ParameterDeclaration): ts.Identifier {
        const type = this.typeChecker.getTypeAtLocation(param.type ?? param)
        const identifierText = this.getValidIdentifier(type)
        return this.nameAllocator.allocate(uncapitalize(identifierText))
    }

    getGetterMethodIdentifier(type: QualifiedType): ts.Identifier | ts.PrivateIdentifier {
        const existingName = this.getterNames.get(type)
        if (existingName) return existingName

        const identifierText = this.getValidIdentifier(type.type)
        const newName = this.nameAllocator.allocate(`get${capitalize(identifierText)}`)
        this.getterNames.set(type, newName)
        return newName
    }

    getSubcomponentFactoryGetterMethodIdentifier(type: QualifiedType): ts.Identifier | ts.PrivateIdentifier {
        const existingName = this.getterNames.get(type)
        if (existingName) return existingName

        const identifierText = this.getValidIdentifier(type.type)
        const newName = this.nameAllocator.allocate(`get${capitalize(identifierText)}_Factory`)
        this.getterNames.set(type, newName)
        return newName
    }

    getAssistedFactoryGetterMethodIdentifier(type: QualifiedType): ts.Identifier | ts.PrivateIdentifier {
        const existingName = this.getterNames.get(type)
        if (existingName) return existingName

        const identifierText = this.getValidIdentifier(type.type)
        const newName = this.nameAllocator.allocate(`get${capitalize(identifierText)}_Factory`)
        this.getterNames.set(type, newName)
        return newName
    }

    getValidIdentifier(type: ts.Type): string {
        return this.typeChecker.typeToString(type).replaceAll(/[^a-z\d]+/ig, "$").substring(0, this.karambitOptions.nameMaxLength)
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
