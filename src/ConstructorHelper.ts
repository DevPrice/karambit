import * as ts from "typescript"
import {InjectNodeDetector, KarambitAnnotationTag} from "./InjectNodeDetector"
import {createQualifiedType} from "./QualifiedType"
import {Inject, Reusable} from "karambit-decorators"
import {ComponentFactory, ConstructorParameter} from "./Providers"
import {findAllChildren} from "./Visitor"
import {ComponentLikeDeclaration} from "./TypescriptUtil"
import {ErrorReporter} from "./ErrorReporter"

@Inject
@Reusable
export class ConstructorHelper {

    constructor(
        private readonly typeChecker: ts.TypeChecker,
        private readonly nodeDetector: InjectNodeDetector,
        private readonly errorReporter: ErrorReporter,
    ) { }

    getConstructorParamsForDeclaration(declaration: ts.ClassLikeDeclaration): ConstructorParameter[] {
        const constructor = findAllChildren(declaration, ts.isConstructorDeclaration)
            .find(constructor => constructor.body)
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
                    optional: param.questionToken !== undefined || param.initializer !== undefined,
                }
            })
    }

    getFactoryParamsForComponent(declaration: ComponentLikeDeclaration): ComponentFactory {
        const factoryTag = this.nodeDetector.getJSDocTag(declaration, KarambitAnnotationTag.factory)
        if (factoryTag) {
            const linkTags = factoryTag.getChildren().filter(ts.isJSDocLink)
            if (linkTags.length !== 1) {
                this.errorReporter.reportParseFailed("Expected exactly one @link TSDoc tag for @factory tag!", factoryTag)
            }
            const linkTag = linkTags[0]
            const symbol = linkTag.name && this.typeChecker.getSymbolAtLocation(linkTag.name)
            if (!symbol) {
                this.errorReporter.reportParseFailed("Expected valid symbol!", linkTag)
            }
            const declarations = symbol.declarations ?? []
            if (declarations.length !== 1) {
                this.errorReporter.reportParseFailed("Component factory type must have exactly one signature!", linkTag)
            }
            const declaration = declarations[0]
            if (!ts.isTypeAliasDeclaration(declaration) || !ts.isFunctionTypeNode(declaration.type)) {
                this.errorReporter.reportParseFailed("Component factory type must be a type alias declaration of function type!", linkTag)
            }
            if (!declaration.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
                this.errorReporter.reportParseFailed("Component factory type exported!", declaration)
            }
            const parameters = declaration.type.parameters.map((param, index) => {
                return {
                    type: createQualifiedType({
                        type: this.typeChecker.getTypeAtLocation(param.type ?? param),
                        qualifier: this.nodeDetector.getQualifier(param)
                    }),
                    index,
                    name: param.name.getText(),
                    declaration: param,
                    decorators: Array.from(ts.getDecorators(param) ?? []),
                    optional: param.questionToken !== undefined || param.initializer !== undefined,
                }
            })
            const type = this.typeChecker.getTypeAtLocation(declaration.type)
            return {
                symbol: this.nodeDetector.getOriginalSymbol(type.aliasSymbol ?? type.symbol),
                parameters,
            }
        }
        const parameters = ts.isClassLike(declaration) ? this.getConstructorParamsForDeclaration(declaration) : []
        return {parameters}
    }
}
