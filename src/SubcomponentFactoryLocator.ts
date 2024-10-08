import * as ts from "typescript"
import {createQualifiedType, internalQualifier} from "./QualifiedType"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {ConstructorHelper} from "./ConstructorHelper"
import {bound, Container, memoized} from "./Util"
import {ProviderType, SubcomponentFactory} from "./Providers"
import {Assisted, AssistedInject} from "karambit-decorators"

export type SubcomponentFactoryLocatorFactory = (installedSubcomponents: Container<ts.Symbol>) => SubcomponentFactoryLocator

@AssistedInject
export class SubcomponentFactoryLocator {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly constructorHelper: ConstructorHelper,
        @Assisted private readonly installedSubcomponents: Container<ts.Symbol>,
    ) { }

    @bound
    @memoized
    asSubcomponentFactory(type: ts.Type): SubcomponentFactory | undefined {
        return this.locateAliasedSubcomponentFactory(type) ?? this.locateSubcomponentFactory(type)
    }

    private locateSubcomponentFactory(type: ts.Type): SubcomponentFactory | undefined {
        const signatures = this.typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call)
        if (signatures.length === 0) return undefined
        const signature = signatures[0]
        const signatureDeclaration = signature.declaration
        if (!signatureDeclaration || ts.isJSDocSignature(signatureDeclaration)) return undefined

        const returnType = signature.getReturnType()
        if (!this.installedSubcomponents.has(returnType.symbol)) return undefined
        const declarations = returnType.symbol.declarations
        if (!declarations || declarations.length === 0) return undefined

        const declaration = declarations[0]
        if (!ts.isClassDeclaration(declaration)) return undefined

        const decorator = declaration.modifiers?.find(this.nodeDetector.isSubcomponentDecorator)
        if (!decorator) return undefined

        const constructorParams = this.constructorHelper.getConstructorParamsForDeclaration(declaration)
        if (!constructorParams) return undefined

        const factoryParamTypes = signatureDeclaration.parameters
            .map(it => this.typeChecker.getTypeAtLocation(it.type ?? it))
        if (factoryParamTypes.length != constructorParams.length) return undefined

        if (!constructorParams.map(it => it.type.type).every((it, index) => it === factoryParamTypes[index])) return undefined

        return {
            providerType: ProviderType.SUBCOMPONENT_FACTORY,
            subcomponentType: createQualifiedType({type: returnType, qualifier: internalQualifier}),
            type: createQualifiedType({type}),
            constructorParams,
            declaration,
            decorator
        }
    }

    private locateAliasedSubcomponentFactory(type: ts.Type): SubcomponentFactory | undefined {
        const aliasedType = this.nodeDetector.isSubcomponentFactory(type)
        if (!aliasedType) return undefined

        const declarations = aliasedType.symbol.declarations
        if (!declarations || declarations.length === 0) return undefined

        const declaration = declarations[0]
        if (!ts.isClassDeclaration(declaration)) return undefined

        const decorator = declaration.modifiers?.find(this.nodeDetector.isSubcomponentDecorator)
        if (!decorator) return undefined

        const constructorParams = this.constructorHelper.getConstructorParamsForDeclaration(declaration)
        if (!constructorParams) return undefined

        const subcomponentType = this.typeChecker.getTypeAtLocation(declaration)

        return {
            providerType: ProviderType.SUBCOMPONENT_FACTORY,
            subcomponentType: createQualifiedType({type: subcomponentType, qualifier: internalQualifier}),
            type: createQualifiedType({type}),
            constructorParams,
            declaration,
            decorator
        }
    }
}
