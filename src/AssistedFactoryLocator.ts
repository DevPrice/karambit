import * as ts from "./compiler/index.js"
import {createQualifiedType, internalQualifier} from "./QualifiedType.js"
import {InjectNodeDetector} from "./InjectNodeDetector.js"
import {ConstructorHelper} from "./ConstructorHelper.js"
import {AssistedFactory, ProviderType} from "./Providers.js"
import {ErrorReporter} from "./ErrorReporter.js"
import {bound, memoized} from "./Util.js"

/**
 * @inject
 * @reusable
 */
export class AssistedFactoryLocator {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly constructorHelper: ConstructorHelper,
    ) { }

    @bound
    @memoized
    asAssistedFactory(type: ts.Type): AssistedFactory | undefined {
        const signatures = this.typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call)
        if (signatures.length === 0) return undefined
        const signature = signatures[0]
        const signatureDeclaration = ts.getSignatureDeclaration(signature)
        if (!signatureDeclaration || ts.isJSDocSignature(signatureDeclaration)) return undefined

        const returnType = this.typeChecker.getReturnTypeOfSignature(signature)
        const returnSymbol = ts.getTypeSymbol(returnType)
        const declarations = returnSymbol && ts.getDeclarations(returnSymbol)
        if (!declarations || declarations.length === 0) return undefined

        const declaration = declarations[0]
        if (!ts.isClassDeclaration(declaration)) return undefined

        const decorator = this.nodeDetector.getAssistedInjectAnnotation(declaration)
        if (!decorator) return undefined

        const constructorParams = this.constructorHelper.getConstructorParamsForDeclaration(declaration)

        const assistedParams = constructorParams.filter(param => this.nodeDetector.getAssistedAnnotation(param.declaration))
        if (assistedParams.length < 1) return undefined

        const assistedParamTypes = new Set(assistedParams.map(it => it.type))
        const factoryParamTypes = new Set(
            signatureDeclaration.parameters
                .map(it => createQualifiedType({
                    type: this.typeChecker.getTypeAtLocation(it.type ?? it),
                    qualifier: this.nodeDetector.getQualifier(it),
                }))
        )

        if (assistedParamTypes.size !== factoryParamTypes.size) return undefined
        if (assistedParams.some(it => !factoryParamTypes.has(it.type))) return undefined

        return {
            providerType: ProviderType.ASSISTED_FACTORY,
            resultType: createQualifiedType({type: returnType, qualifier: internalQualifier}),
            type: createQualifiedType({type}),
            factoryParams: signatureDeclaration.parameters.map(param => {
                const constructorParamIndex = constructorParams.findIndex(it =>
                    !!this.nodeDetector.getAssistedAnnotation(it.declaration) && it.type.type === this.typeChecker.getTypeAtLocation(param.type ?? param)
                )
                if (constructorParamIndex < 0) {
                    ErrorReporter.reportParseFailed(`Error parsing assisted factory: ${declaration.name?.getText()}`)
                }
                return {
                    name: param.name.getText(),
                    constructorParamIndex,
                    type: createQualifiedType({
                        type: this.typeChecker.getTypeAtLocation(param.type ?? param),
                        qualifier: this.nodeDetector.getQualifier(param),
                    })
                }
            }),
            constructorParams,
            declaration,
        }
    }
}
