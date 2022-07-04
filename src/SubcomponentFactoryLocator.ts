import * as ts from "typescript"
import {createQualifiedType} from "./QualifiedType"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {ConstructorHelper} from "./ConstructorHelper"
import {Container} from "./Util"
import {ProviderType, SubcomponentFactory} from "./Providers"

export class SubcomponentFactoryLocator {

    #cache = new Map<ts.Type, SubcomponentFactory | undefined>()

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly constructorHelper: ConstructorHelper,
        private readonly installedSubcomponents: Container<ts.Symbol>
    ) {
        this.asSubcomponentFactory = this.asSubcomponentFactory.bind(this)
    }

    asSubcomponentFactory(type: ts.Type): SubcomponentFactory | undefined {
        const cached = this.#cache.get(type)
        if (cached) return cached
        const located = this.locateSubcomponentFactory(type)
        this.#cache.set(type, located)
        return located
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

        const decorator = declaration.decorators?.find(this.nodeDetector.isSubcomponentDecorator)
        if (!decorator) return undefined

        const constructorParams = this.constructorHelper.getConstructorParamsForDeclaration(declaration)
        if (!constructorParams) return undefined

        const factoryParamTypes = signatureDeclaration.parameters
            .map(it => this.typeChecker.getTypeAtLocation(it.type ?? it))
        if (factoryParamTypes.length != constructorParams.length) return undefined

        if (!constructorParams.map(it => it.type.type).every((it, index) => it === factoryParamTypes[index])) return undefined

        return {
            providerType: ProviderType.SUBCOMPONENT_FACTORY,
            subcomponentType: createQualifiedType({type: returnType, qualifier: returnType.symbol}),
            type: createQualifiedType({type}),
            constructorParams,
            declaration,
            decorator
        }
    }
}
