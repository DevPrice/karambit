import * as ts from "typescript"
import {Binds, BindsInstance, Component, Module, Provides, Reusable, Subcomponent} from "karambit-inject"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {InjectConstructorExporter} from "./InjectConstructorExporter"
import {ComponentVisitor} from "./ComponentVisitor"
import {Importer} from "./Importer"
import {ComponentGenerationScope, ProgramScope, SourceFileScope} from "./Scopes"
import {
    ComponentGenerator,
    ComponentGeneratorDependencies,
    ComponentGeneratorDependenciesFactory
} from "./ComponentGenerator"
import type {KarambitTransformOptions} from "./karambit"

@Subcomponent
@ComponentGenerationScope
abstract class ComponentGenerationSubcomponent implements ComponentGeneratorDependencies {

    protected constructor(@BindsInstance componentDeclaration: ts.ClassDeclaration) { }

    readonly generator: ComponentGenerator
}

@Module
abstract class SourceFileModule {

    @Provides
    static provideTransformers(
        classExporter: InjectConstructorExporter,
        componentVisitor: ComponentVisitor,
        nodeDetector: InjectNodeDetector,
        importer: Importer,
        ctx: ts.TransformationContext,
    ): ts.Transformer<ts.SourceFile>[] {
        return [
            classExporter.exportProviders,
            componentVisitor.visitComponents,
            node => nodeDetector.eraseInjectRuntime(node, ctx),
            importer.addImportsToSourceFile,
        ]
    }

    // @ts-ignore
    @Binds
    abstract bindComponentGeneratorDependenciesFactory(
        factory: (componentDeclaration: ts.ClassDeclaration) => ComponentGenerationSubcomponent
    ): ComponentGeneratorDependenciesFactory
}

@Subcomponent({modules: [SourceFileModule], subcomponents: [ComponentGenerationSubcomponent]})
@SourceFileScope
abstract class SourceFileSubcomponent {

    protected constructor(@BindsInstance sourceFile: ts.SourceFile) { }

    readonly transformers: ts.Transformer<ts.SourceFile>[]
}

@Subcomponent({subcomponents: [SourceFileSubcomponent]})
abstract class TransformationContextSubcomponent {

    protected constructor(@BindsInstance transformationContext: ts.TransformationContext) { }

    readonly sourceFileSubcomponentFactory: (sourceFile: ts.SourceFile) => SourceFileSubcomponent
}

@Module
abstract class ProgramModule {

    @Provides
    @Reusable
    static provideTypeChecker(program: ts.Program): ts.TypeChecker {
        return program.getTypeChecker()
    }
}

@Component({modules: [ProgramModule], subcomponents: [TransformationContextSubcomponent]})
@ProgramScope
export class ProgramComponent {

    constructor(@BindsInstance program: ts.Program, @BindsInstance options: KarambitTransformOptions) { }

    readonly transformationContextSubcomponentFactory: (transformationContext: ts.TransformationContext) => TransformationContextSubcomponent
}
