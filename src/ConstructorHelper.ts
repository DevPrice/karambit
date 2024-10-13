import * as ts from "typescript"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {createQualifiedType} from "./QualifiedType"
import {Inject, Reusable} from "karambit-decorators"
import {ConstructorParameter} from "./Providers"

@Inject
@Reusable
export class ConstructorHelper {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly nodeDetector: InjectNodeDetector,
    ) { }

    getConstructorParamsForDeclaration(declaration: ts.ClassLikeDeclaration): ConstructorParameter[] {
        const constructor = declaration.getChildren().flatMap(it => it.getChildren())
            .find(it => ts.isConstructorDeclaration(it) && it.body !== undefined)
        if (!constructor) return []
        return constructor.getChildren()
            .flatMap(it => it.kind == ts.SyntaxKind.SyntaxList ? it.getChildren() : [it])
            .filter(ts.isParameter)
            .map((param, index) => {
                return {
                    type: createQualifiedType({
                        type: this.typeChecker.getTypeAtLocation(param.type ?? param),
                        qualifier: this.nodeDetector.getQualifier(param)
                    }),
                    index,
                    name: param.name.getText(),
                    declaration: param,
                    decorators: Array.from(ts.getDecorators(param) ?? []),
                    optional: param.questionToken !== undefined || param.initializer !== undefined
                }
            })
    }
}
