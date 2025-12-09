import ts from "typescript"
import {createQualifiedType, internalQualifier} from "./QualifiedType"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {ConstructorHelper} from "./ConstructorHelper"
import {AssistedFactory, ProviderType} from "./Providers"
import {ErrorReporter} from "./ErrorReporter"
import {bound, memoized} from "./Util"

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
        const signatureDeclaration = signature.declaration
        if (!signatureDeclaration || ts.isJSDocSignature(signatureDeclaration)) return undefined

        const returnType = signature.getReturnType()
        const declarations = returnType.getSymbol()?.declarations
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
