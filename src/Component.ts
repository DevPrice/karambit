import * as ts from "typescript"
import {
    Binds,
    BindsInstance,
    Component,
    Module,
    Provides,
    Reusable,
    Subcomponent,
} from "karambit-decorators"
import {SubcomponentFactory} from "karambit-inject"
import {ComponentGenerationScope, ProgramScope, SourceFileScope} from "./Scopes"
import type {ComponentVisitor} from "./ComponentVisitor"
import type {Importer} from "./Importer"
import type {
    ComponentGenerator,
    ComponentGeneratorDependencies,
    ComponentGeneratorDependenciesFactory,
} from "./ComponentGenerator"
import type {KarambitTransformOptions} from "./karambit"
import {ExportVerifier} from "./ExportVerifier"

@Subcomponent
@ComponentGenerationScope
export abstract class ComponentGenerationSubcomponent implements ComponentGeneratorDependencies {

    constructor(@BindsInstance componentDeclaration: ts.ClassDeclaration) { }

    abstract readonly generator: ComponentGenerator
}

@Module
export abstract class SourceFileModule {

    @Binds
    abstract bindComponentGeneratorDependenciesFactory: (
        factory: SubcomponentFactory<typeof ComponentGenerationSubcomponent>
    ) => ComponentGeneratorDependenciesFactory

    @Provides
    static provideTransformers(
        exporterChecker: ExportVerifier,
        componentVisitor: ComponentVisitor,
        importer: Importer,
    ): ts.Transformer<ts.SourceFile>[] {
        return [
            exporterChecker.verifyExports,
            componentVisitor.visitComponents,
            importer.addImportsToSourceFile,
        ]
    }
}

@Subcomponent({modules: [SourceFileModule], subcomponents: [ComponentGenerationSubcomponent]})
@SourceFileScope
export abstract class SourceFileSubcomponent {

    constructor(@BindsInstance sourceFile: ts.SourceFile) { }

    abstract readonly transformers: ts.Transformer<ts.SourceFile>[]
}

@Module
export abstract class ProgramModule {

    @Provides
    @Reusable
    static provideTypeChecker(program: ts.Program): ts.TypeChecker {
        return program.getTypeChecker()
    }

    @Provides
    @Reusable
    static providePrinter(): ts.Printer {
        return ts.createPrinter()
    }

    @Provides
    @ProgramScope
    static provideComponentIdentifiers(): Map<ts.Type, ts.Identifier> {
        return new Map()
    }
}

@Component({modules: [ProgramModule], subcomponents: [SourceFileSubcomponent]})
@ProgramScope
export abstract class ProgramComponent {

    constructor(@BindsInstance program: ts.Program, @BindsInstance options: KarambitTransformOptions) { }

    abstract readonly sourceFileSubcomponentFactory: SubcomponentFactory<typeof SourceFileSubcomponent>
    abstract readonly printer: ts.Printer
}
