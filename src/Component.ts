import * as ts from "typescript"
import {Binds, BindsInstance, Component, IntoSet, Module, Provides, Reusable, Subcomponent} from "karambit-decorators"
import {Provider, Qualified, SubcomponentFactory} from "karambit-inject"
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
import {findAllChildren, SourceFileVisitor} from "./Visitor"
import {ignore, isNotNull, Logger} from "./Util"
import {InjectNodeDetector} from "./InjectNodeDetector"
import * as Path from "path"
import {ComponentDeclaration, isComponentDeclaration} from "./TypescriptUtil"

declare const generatedQualifier: unique symbol
type GeneratedSourceFile = ts.SourceFile & Qualified<typeof generatedQualifier>

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

    constructor(@BindsInstance componentDeclaration: ComponentDeclaration) { }

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
    static provideAnnotationValidationVisitor(annotationValidator: AnnotationValidator): SourceFileVisitor {
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
    static providePrinter(options: KarambitOptions): ts.Printer {
        return ts.createPrinter(options.printerOptions)
    }

    @Provides
    @Reusable
    static provideDefaultLogger(options: KarambitOptions): Logger {
        const logger = options.logger ?? console
        if (options.verbose) {
            return logger
        } else {
            return {
                debug: ignore,
                info: logger.info,
                warn: logger.warn,
                error: logger.error,
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

    @Provides
    @Reusable
    static provideGeneratedComponents(
        program: ts.Program,
        logger: Logger,
        sourceFileSubcomponentFactory: SubcomponentFactory<typeof SourceFileSubcomponent>,
    ) {
        // TODO: Avoid business logic in the module
        return program.getSourceFiles()
            .filter(sourceFile => !program.isSourceFileFromExternalLibrary(sourceFile) && !program.isSourceFileDefaultLibrary(sourceFile))
            .flatMap(sourceFile => {
                logger.debug(`Reading ${Path.relative(".", sourceFile.fileName)}...`)
                const sourceFileComponent = sourceFileSubcomponentFactory(sourceFile)
                for (const visitor of sourceFileComponent.sourceFileVisitors) {
                    visitor(sourceFile)
                }
                const components: ComponentDeclaration[] = findAllChildren(sourceFile, (n): n is ComponentDeclaration => {
                    return (isComponentDeclaration(n)) && !!sourceFileComponent.nodeDetector.getComponentAnnotation(n)
                })
                return components.map(component => {
                    return sourceFileComponent.componentGeneratorDependenciesFactory(component).generatedComponent
                })
            })
            .filter(isNotNull)
    }

    @Provides
    @Reusable
    static provideGeneratedSource(
        sourceFileGenerator: SourceFileGenerator,
        generatedComponents: GeneratedComponent[],
    ): GeneratedSourceFile {
        return sourceFileGenerator.generateSourceFile(generatedComponents)
    }
}

@Component({modules: [ProgramModule], subcomponents: [SourceFileSubcomponent]})
@ProgramScope
export abstract class ProgramComponent {

    protected constructor(@BindsInstance program: ts.Program, @BindsInstance private readonly options: KarambitOptions) { }

    protected abstract readonly fileWriter: ComponentWriter
    protected abstract readonly generatedFile: GeneratedSourceFile

    generateComponentFile() {
        this.fileWriter.writeComponentFile(this.generatedFile, this.options.outFile)
    }
}
