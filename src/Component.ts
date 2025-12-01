import * as ts from "typescript"
import {Binds, BindsInstance, Component, IntoSet, Module, Provides, Reusable, Subcomponent} from "karambit-decorators"
import {Provider, SubcomponentFactory} from "karambit-inject"
import {ComponentGenerationScope, ProgramScope, SourceFileScope} from "./Scopes"
import type {SourceFileGenerator} from "./SourceFileGenerator"
import {
    ComponentGenerator,
    ComponentGeneratorDependencies,
    ComponentGeneratorDependenciesFactory,
    GeneratedComponent,
} from "./ComponentGenerator"
import type {KarambitOptions} from "./karambit"
import {AnnotationValidator} from "./AnnotationValidator"
import {ComponentWriter, DryRunWriter, FileWriter} from "./FileWriter"
import {SourceFileVisitor} from "./Visitor"
import {ignore, Logger} from "./Util"
import {InjectNodeDetector} from "./InjectNodeDetector"

@Module
export abstract class ComponentGenerationModule {

    @Provides
    @Reusable
    static provideGeneratedComponent(generator: ComponentGenerator): GeneratedComponent {
        return generator.generateComponent()
    }
}

@Subcomponent({modules: [ComponentGenerationModule]})
@ComponentGenerationScope
export abstract class ComponentGenerationSubcomponent implements ComponentGeneratorDependencies {

    constructor(@BindsInstance componentDeclaration: ts.ClassDeclaration) { }

    abstract readonly generatedComponent: GeneratedComponent
}

@Module
export abstract class SourceFileModule {

    @Binds
    abstract bindComponentGeneratorDependenciesFactory: (
        factory: SubcomponentFactory<typeof ComponentGenerationSubcomponent>
    ) => ComponentGeneratorDependenciesFactory

    @Provides
    @IntoSet
    static provideExportVerifierVisitor(annotationValidator: AnnotationValidator): SourceFileVisitor {
        return annotationValidator.validateAnnotations
    }
}

@Subcomponent({modules: [SourceFileModule], subcomponents: [ComponentGenerationSubcomponent]})
@SourceFileScope
export abstract class SourceFileSubcomponent {

    constructor(@BindsInstance sourceFile: ts.SourceFile) { }

    abstract readonly sourceFileVisitors: ReadonlySet<SourceFileVisitor>
    abstract readonly componentGeneratorDependenciesFactory: ComponentGeneratorDependenciesFactory
    abstract readonly nodeDetector: InjectNodeDetector
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
    @Reusable
    static provideLogger(options: KarambitOptions): Logger {
        if (options.verbose) {
            return console
        } else {
            return {
                debug: ignore,
                info: console.info,
                warn: console.warn,
                error: console.error,
            }
        }
    }

    @Provides
    @Reusable
    static provideComponentWriter(
        options: KarambitOptions,
        fileWriterProvider: Provider<FileWriter>,
        dryRunWriterProvider: Provider<DryRunWriter>,
    ): ComponentWriter {
        if (options.dryRun) {
            return dryRunWriterProvider()
        }
        return fileWriterProvider()
    }
}

@Component({modules: [ProgramModule], subcomponents: [SourceFileSubcomponent]})
@ProgramScope
export abstract class ProgramComponent {

    constructor(@BindsInstance program: ts.Program, @BindsInstance options: KarambitOptions) { }

    abstract readonly logger: Logger
    abstract readonly fileWriter: ComponentWriter
    abstract readonly sourceFileSubcomponentFactory: SubcomponentFactory<typeof SourceFileSubcomponent>
    abstract readonly sourceFileGenerator: SourceFileGenerator
}
