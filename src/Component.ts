import * as ts from "typescript"
import {
    Binds,
    BindsInstance,
    Component, createComponent,
    Module,
    Provides,
    Reusable,
    Subcomponent,
    SubcomponentFactory
} from "karambit-inject"
import {ComponentGenerationScope, ProgramScope, SourceFileScope} from "./Scopes"
import type {InjectNodeDetector} from "./InjectNodeDetector"
import type {InjectConstructorExporter} from "./InjectConstructorExporter"
import type {ComponentVisitor} from "./ComponentVisitor"
import type {Importer} from "./Importer"
import type {
    ComponentGenerator,
    ComponentGeneratorDependencies,
    ComponentGeneratorDependenciesFactory
} from "./ComponentGenerator"
import type {KarambitTransformOptions} from "./karambit"
import type {CreateComponentTransformer} from "./CreateComponentTransformer"

@Subcomponent
@ComponentGenerationScope
abstract class ComponentGenerationSubcomponent implements ComponentGeneratorDependencies {

    constructor(@BindsInstance componentDeclaration: ts.ClassDeclaration) { }

    abstract readonly generator: ComponentGenerator
}

@Module
abstract class SourceFileModule {

    @Binds
    abstract bindComponentGeneratorDependenciesFactory: (
        factory: SubcomponentFactory<typeof ComponentGenerationSubcomponent>
    ) => ComponentGeneratorDependenciesFactory

    @Provides
    static provideTransformers(
        classExporter: InjectConstructorExporter,
        componentVisitor: ComponentVisitor,
        createComponentTransformer: CreateComponentTransformer,
        nodeDetector: InjectNodeDetector,
        importer: Importer,
        ctx: ts.TransformationContext,
    ): ts.Transformer<ts.SourceFile>[] {
        return [
            classExporter.exportProviders,
            componentVisitor.visitComponents,
            createComponentTransformer.replaceCreateComponent,
            createComponentTransformer.replaceGetConstructor,
            node => nodeDetector.eraseInjectRuntime(node, ctx),
            importer.addImportsToSourceFile,
        ]
    }
}

@Subcomponent({modules: [SourceFileModule], subcomponents: [ComponentGenerationSubcomponent]})
@SourceFileScope
abstract class SourceFileSubcomponent {

    constructor(@BindsInstance sourceFile: ts.SourceFile) { }

    abstract readonly transformers: ts.Transformer<ts.SourceFile>[]
}

@Subcomponent({subcomponents: [SourceFileSubcomponent]})
abstract class TransformationContextSubcomponent {

    constructor(@BindsInstance transformationContext: ts.TransformationContext) { }

    abstract readonly sourceFileSubcomponentFactory: SubcomponentFactory<typeof SourceFileSubcomponent>
}

@Module
abstract class ProgramModule {

    @Provides
    @Reusable
    static provideTypeChecker(program: ts.Program): ts.TypeChecker {
        return program.getTypeChecker()
    }

    @Provides
    @ProgramScope
    static provideComponentIdentifiers(): Map<ts.Type, ts.Identifier> {
        return new Map()
    }
}

@Component({modules: [ProgramModule], subcomponents: [TransformationContextSubcomponent]})
@ProgramScope
abstract class ProgramComponent {

    constructor(@BindsInstance program: ts.Program, @BindsInstance options: KarambitTransformOptions) { }

    abstract readonly transformationContextSubcomponentFactory: SubcomponentFactory<typeof TransformationContextSubcomponent>
}

export function createProgramComponent(program: ts.Program, options: KarambitTransformOptions): ProgramComponent {
    return createComponent<typeof ProgramComponent>(program, options)
}
