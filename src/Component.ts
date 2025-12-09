import * as ts from "typescript"
import picomatch from "picomatch"
import {Provider, Qualified} from "karambit-inject"
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

/**
 * @component
 * @includeModule {@link ProgramModule}
 * @includeSubcomponent {@link SourceFileSubcomponent}
 * @scope {@link ProgramScope}
 */
export abstract class ProgramComponent {

    protected constructor(/** @bindsInstance */ program: ts.Program, /** @bindsInstance */ private readonly options: KarambitOptions) { }

    protected abstract readonly fileWriter: ComponentWriter
    protected abstract readonly generatedFile: GeneratedSourceFile

    generateComponentFile() {
        this.fileWriter.writeComponentFile(this.generatedFile, this.options.outFile)
    }
}

/**
 * @subcomponent
 * @includeModule {@link SourceFileModule}
 * @includeSubcomponent {@link ComponentGenerationSubcomponent}
 * @scope {@link SourceFileScope}
 * @factory {@link SourceFileSubcomponentFactory}
 */
export interface SourceFileSubcomponent {
    readonly sourceFileVisitors: ReadonlySet<SourceFileVisitor>
    readonly componentGeneratorDependenciesFactory: ComponentGeneratorDependenciesFactory
    readonly nodeDetector: InjectNodeDetector
}
export type SourceFileSubcomponentFactory = (/** @bindsInstance */ sourceFile: ts.SourceFile) => SourceFileSubcomponent

/**
 * @subcomponent
 * @includeModule {@link ComponentGenerationModule}
 * @scope {@link ComponentGenerationScope}
 * @factory {@link ComponentGenerationSubcomponentFactory}
 */
export type ComponentGenerationSubcomponent = ComponentGeneratorDependencies
export type ComponentGenerationSubcomponentFactory = (/** @bindsInstance */ componentDeclaration: ComponentDeclaration) => ComponentGenerationSubcomponent

export abstract class ProgramModule {

    /**
     * @provides
     * @reusable
     */
    static provideTypeChecker(program: ts.Program): ts.TypeChecker {
        return program.getTypeChecker()
    }

    /**
     * @provides
     * @reusable
     */
    static providePrinter(options: KarambitOptions): ts.Printer {
        return ts.createPrinter(options.printerOptions)
    }

    /**
     * @provides
     * @reusable
     */
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

    /**
     * @provides
     * @reusable
     */
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

    /**
     * @provides
     * @reusable
     */
    static provideGeneratedComponents(
        program: ts.Program,
        logger: Logger,
        sourceFileSubcomponentFactory: SourceFileSubcomponentFactory,
        options: KarambitOptions,
    ) {
        // TODO: Avoid business logic in the module
        const includes = options?.include && picomatch(options.include.map(platformizePath))
        const excludes = options?.exclude && picomatch(options.exclude.map(platformizePath))
        function normalizePath(file: string): string {
            return platformizePath(Path.relative(".", file))
        }
        function platformizePath(file: string): string {
            return file.replaceAll(Path.sep, Path.posix.sep)
        }
        return program.getSourceFiles()
            .filter(sourceFile => !program.isSourceFileFromExternalLibrary(sourceFile) && !program.isSourceFileDefaultLibrary(sourceFile))
            .filter(sourceFile => !includes || includes(normalizePath(sourceFile.fileName)))
            .filter(sourceFile => !excludes || !excludes(normalizePath(sourceFile.fileName)))
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

    /**
     * @provides
     * @reusable
     */
    static provideGeneratedSource(
        sourceFileGenerator: SourceFileGenerator,
        generatedComponents: GeneratedComponent[],
    ): GeneratedSourceFile {
        return sourceFileGenerator.generateSourceFile(generatedComponents)
    }
}

export abstract class SourceFileModule {

    /** @binds */
    abstract bindComponentGeneratorDependenciesFactory: (
        factory: ComponentGenerationSubcomponentFactory
    ) => ComponentGeneratorDependenciesFactory

    /**
     * @provides
     * @intoSet
     */
    static provideAnnotationValidationVisitor(annotationValidator: AnnotationValidator): SourceFileVisitor {
        return annotationValidator.validateAnnotations
    }
}

export abstract class ComponentGenerationModule {

    /**
     * @provides
     * @reusable
     */
    static provideGeneratedComponent(generator: ComponentGenerator): GeneratedComponent {
        return generator.generateComponent()
    }
}
