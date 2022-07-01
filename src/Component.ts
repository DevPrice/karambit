import * as ts from "typescript"
import {BindsInstance, Component, Module, Provides, Reusable, Subcomponent} from "karambit-inject"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {InjectConstructorExporter} from "./InjectConstructorExporter"
import {ComponentGenerator} from "./ComponentGenerator"
import {Importer} from "./Importer"
import {SourceFileScope} from "./Scopes"

@Module
abstract class SourceFileModule {

    @Provides
    static provideTransformers(
        classExporter: InjectConstructorExporter,
        componentGenerator: ComponentGenerator,
        nodeDetector: InjectNodeDetector,
        importer: Importer,
        ctx: ts.TransformationContext,
    ): ts.Transformer<ts.SourceFile>[] {
        return [
            classExporter.exportProviders,
            componentGenerator.generateComponents,
            node => nodeDetector.eraseInjectRuntime(node, ctx),
            importer.addImportsToSourceFile,
        ]
    }
}

@Subcomponent({modules: [SourceFileModule]})
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
export class ProgramComponent {

    constructor(@BindsInstance program: ts.Program) { }

    readonly transformationContextSubcomponentFactory: (transformationContext: ts.TransformationContext) => TransformationContextSubcomponent
}
