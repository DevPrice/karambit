import * as ts from "typescript"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {createQualifiedType, QualifiedType} from "./QualifiedType"

export interface ConstructorParameter {
    type: QualifiedType
    name: string
    declaration: ts.ParameterDeclaration
    decorators: ts.Decorator[]
    optional: boolean
}

export class ConstructorHelper {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly nodeDetector: InjectNodeDetector,
    ) { }

    getConstructorParamsForDeclaration(declaration: ts.ClassLikeDeclaration): ConstructorParameter[] | undefined {
        const constructor = declaration.getChildren().flatMap(it => it.getChildren())
            .find(it => ts.isConstructorDeclaration(it))
        if (!constructor) return []
        return constructor.getChildren()
            .flatMap(it => it.kind == ts.SyntaxKind.SyntaxList ? it.getChildren() : [it])
            .filter(ts.isParameter)
            .map(it => it as ts.ParameterDeclaration)
            .map(param => {
                return {
                    type: createQualifiedType({
                        type: this.typeChecker.getTypeAtLocation(param.type ?? param),
                        qualifier: this.nodeDetector.getQualifier(param)
                    }),
                    name: param.name.getText(),
                    declaration: param,
                    decorators: Array.from(param.decorators ?? []),
                    optional: param.questionToken !== undefined || param.initializer !== undefined
                }
            })
    }

    getInjectConstructorParams(type: ts.Type): ConstructorParameter[] | undefined {
        const symbol = type.getSymbol() ?? type.aliasSymbol
        const declaration = symbol?.getDeclarations()![0]
        if (!declaration || !ts.isClassDeclaration(declaration) || !declaration.decorators?.some(this.nodeDetector.isInjectDecorator)) return undefined

        return this.getConstructorParamsForDeclaration(declaration)
    }
}