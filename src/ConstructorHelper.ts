import * as ts from "typescript"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {createQualifiedType} from "./QualifiedType"
import {Inject, Reusable} from "karambit-decorators"
import {ConstructorParameter} from "./Providers"
import {findAllChildren} from "./Visitor"

@Inject
@Reusable
export class ConstructorHelper {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly nodeDetector: InjectNodeDetector,
    ) { }

    getConstructorParamsForDeclaration(declaration: ts.ClassLikeDeclaration): ConstructorParameter[] {
        const constructor = findAllChildren(declaration, ts.isConstructorDeclaration)[0]
        if (!constructor) return []
        return constructor.parameters
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
