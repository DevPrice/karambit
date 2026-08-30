import * as Component_1 from "../Component.js";
import * as ComponentGenerator_1 from "../ComponentGenerator.js";
import * as ErrorReporter_1 from "../ErrorReporter.js";
import * as ComponentDeclarationBuilder_1 from "../ComponentDeclarationBuilder.js";
import * as SubcomponentFactoryLocator_1 from "../SubcomponentFactoryLocator.js";
import * as TypeResolver_1 from "../TypeResolver.js";
import * as DependencyGraphBuilder_1 from "../DependencyGraphBuilder.js";
import * as InjectNodeDetector_1 from "../InjectNodeDetector.js";
import * as ModuleLocator_1 from "../ModuleLocator.js";
import * as ConstructorHelper_1 from "../ConstructorHelper.js";
import * as PropertyExtractor_1 from "../PropertyExtractor.js";
import * as ProviderLocator_1 from "../ProviderLocator.js";
import * as AssistedFactoryLocator_1 from "../AssistedFactoryLocator.js";
import * as AnnotationValidator_1 from "../AnnotationValidator.js";
import * as NameGenerator_1 from "../NameGenerator.js";
import * as Importer_1 from "../Importer.js";
import * as SourceFileGenerator_1 from "../SourceFileGenerator.js";
import * as FileWriter_1 from "../FileWriter.js";
export class KarambitProgramComponent extends Component_1.ProgramComponent {
    constructor(private readonly program_1: ConstructorParameters<{
        new (): never;
    } & typeof Component_1.ProgramComponent>[0], private readonly karambitOptions_1: ConstructorParameters<{
        new (): never;
    } & typeof Component_1.ProgramComponent>[1]) {
        super(program_1, karambitOptions_1);
    }
    get fileWriter(): Component_1.ProgramComponent["fileWriter"] { return this.getComponentWriter_1(); }
    get generatedFile(): Component_1.ProgramComponent["generatedFile"] { return this.getGeneratedSourceFile_1(); }
    private componentWriter_1?: ReturnType<typeof Component_1.ProgramModule.provideComponentWriter>;
    private getComponentWriter_1(): ReturnType<typeof Component_1.ProgramModule.provideComponentWriter> { return this.componentWriter_1 ?? (this.componentWriter_1 = Component_1.ProgramModule.provideComponentWriter(this.getKarambitOptions_1(), () => this.getFileWriter_1(), () => this.getDryRunWriter_1())); }
    private generatedSourceFile_1?: ReturnType<typeof Component_1.ProgramModule.provideGeneratedSource>;
    private getGeneratedSourceFile_1(): ReturnType<typeof Component_1.ProgramModule.provideGeneratedSource> { return this.generatedSourceFile_1 ?? (this.generatedSourceFile_1 = Component_1.ProgramModule.provideGeneratedSource(this.getSourceFileGenerator_1(), this.getGeneratedComponent$_1())); }
    private typeChecker_1?: ReturnType<typeof Component_1.ProgramModule.provideTypeChecker>;
    private getTypeChecker_1(): ReturnType<typeof Component_1.ProgramModule.provideTypeChecker> { return this.typeChecker_1 ?? (this.typeChecker_1 = Component_1.ProgramModule.provideTypeChecker(this.getProgram_1())); }
    private nameGenerator_1?: NameGenerator_1.NameGenerator;
    private getNameGenerator_1(): NameGenerator_1.NameGenerator { return this.nameGenerator_1 ?? (this.nameGenerator_1 = new NameGenerator_1.NameGenerator(this.getTypeChecker_1(), this.getNameAllocator_1(), this.getKarambitOptions_1())); }
    private importer_1?: Importer_1.Importer;
    private getImporter_1(): Importer_1.Importer { return this.importer_1 ?? (this.importer_1 = new Importer_1.Importer(this.getKarambitOptions_1(), this.getTypeChecker_1(), this.getNameAllocator_1(), this.getCompilerOptions_1())); }
    private getKarambitOptions_1() { return this.karambitOptions_1; }
    private sourceFileGenerator_1?: SourceFileGenerator_1.SourceFileGenerator;
    private getSourceFileGenerator_1(): SourceFileGenerator_1.SourceFileGenerator { return this.sourceFileGenerator_1 ?? (this.sourceFileGenerator_1 = new SourceFileGenerator_1.SourceFileGenerator(this.getNameGenerator_1(), this.getImporter_1(), this.getKarambitOptions_1())); }
    private generatedComponent$_1?: ReturnType<typeof Component_1.ProgramModule.provideGeneratedComponents>;
    private getGeneratedComponent$_1(): ReturnType<typeof Component_1.ProgramModule.provideGeneratedComponents> { return this.generatedComponent$_1 ?? (this.generatedComponent$_1 = Component_1.ProgramModule.provideGeneratedComponents(this.getProgram_1(), this.getLogger_1(), this.getSourceFileSubcomponent_Factory_1(), this.getKarambitOptions_1())); }
    private getProgram_1() { return this.program_1; }
    private nameAllocator_1?: ReturnType<typeof Component_1.ProgramModule.provideNameAllocator>;
    private getNameAllocator_1(): ReturnType<typeof Component_1.ProgramModule.provideNameAllocator> { return this.nameAllocator_1 ?? (this.nameAllocator_1 = Component_1.ProgramModule.provideNameAllocator()); }
    private compilerOptions_1?: ReturnType<typeof Component_1.ProgramModule.provideCompilerOptions>;
    private getCompilerOptions_1(): ReturnType<typeof Component_1.ProgramModule.provideCompilerOptions> { return this.compilerOptions_1 ?? (this.compilerOptions_1 = Component_1.ProgramModule.provideCompilerOptions(this.getProgram_1())); }
    private getFileWriter_1() { return new FileWriter_1.FileWriter(this.getKarambitOptions_1()); }
    private getDryRunWriter_1() { return new FileWriter_1.DryRunWriter(this.getLogger_1()); }
    private logger_1?: ReturnType<typeof Component_1.ProgramModule.provideDefaultLogger>;
    private getLogger_1(): ReturnType<typeof Component_1.ProgramModule.provideDefaultLogger> { return this.logger_1 ?? (this.logger_1 = Component_1.ProgramModule.provideDefaultLogger(this.getKarambitOptions_1())); }
    private getSourceFileSubcomponent_Factory_1(): Component_1.SourceFileSubcomponentFactory {
        return sourceFile => new this.sourceFileSubcomponent_1(this, sourceFile);
    }
    private getComponentDeclaration_1(): undefined { return void 0; }
    private sourceFileSubcomponent_1 = class SourceFileSubcomponent_1 implements Component_1.SourceFileSubcomponent {
        constructor(private readonly parent_1: KarambitProgramComponent, private readonly sourceFile_1: Parameters<Component_1.SourceFileSubcomponentFactory>[0]) {
        }
        get sourceFileVisitors(): Component_1.SourceFileSubcomponent["sourceFileVisitors"] { return this.getReadonlySet$SourceFileVisitor$_1(); }
        get componentGeneratorDependenciesFactory(): Component_1.SourceFileSubcomponent["componentGeneratorDependenciesFactory"] { return this.getComponentGeneratorDependencies_Factory_1(); }
        get nodeDetector(): Component_1.SourceFileSubcomponent["nodeDetector"] { return this.getInjectNodeDetector_1(); }
        private getReadonlySet$SourceFileVisitor$_1() { return new Set([this.getSourceFileVisitor_1()]); }
        private getComponentGeneratorDependencies_Factory_1(): Component_1.ComponentGenerationSubcomponentFactory {
            return componentDeclaration => new this.componentGeneratorDependencies_1(this, componentDeclaration);
        }
        private injectNodeDetector_1?: InjectNodeDetector_1.InjectNodeDetector;
        private getInjectNodeDetector_1(): InjectNodeDetector_1.InjectNodeDetector { return this.injectNodeDetector_1 ?? (this.injectNodeDetector_1 = new InjectNodeDetector_1.InjectNodeDetector(this.getTypeChecker_1(), this.getErrorReporter_1(), this.getKarambitOptions_1())); }
        private moduleLocator_1?: ModuleLocator_1.ModuleLocator;
        private getModuleLocator_1(): ModuleLocator_1.ModuleLocator { return this.moduleLocator_1 ?? (this.moduleLocator_1 = new ModuleLocator_1.ModuleLocator(this.getKarambitOptions_1(), this.getTypeChecker_1(), this.getInjectNodeDetector_1(), this.getErrorReporter_1())); }
        private constructorHelper_1?: ConstructorHelper_1.ConstructorHelper;
        private getConstructorHelper_1(): ConstructorHelper_1.ConstructorHelper { return this.constructorHelper_1 ?? (this.constructorHelper_1 = new ConstructorHelper_1.ConstructorHelper(this.getTypeChecker_1(), this.getInjectNodeDetector_1(), this.getErrorReporter_1())); }
        private propertyExtractor_1?: PropertyExtractor_1.PropertyExtractor;
        private getPropertyExtractor_1(): PropertyExtractor_1.PropertyExtractor { return this.propertyExtractor_1 ?? (this.propertyExtractor_1 = new PropertyExtractor_1.PropertyExtractor(this.getTypeChecker_1(), this.getErrorReporter_1())); }
        private providerLocator_1?: ProviderLocator_1.ProviderLocator;
        private getProviderLocator_1(): ProviderLocator_1.ProviderLocator { return this.providerLocator_1 ?? (this.providerLocator_1 = new ProviderLocator_1.ProviderLocator(this.getConstructorHelper_1(), this.getNameGenerator_1(), this.getPropertyExtractor_1(), this.getInjectNodeDetector_1(), this.getModuleLocator_1(), this.getErrorReporter_1())); }
        private assistedFactoryLocator_1?: AssistedFactoryLocator_1.AssistedFactoryLocator;
        private getAssistedFactoryLocator_1(): AssistedFactoryLocator_1.AssistedFactoryLocator { return this.assistedFactoryLocator_1 ?? (this.assistedFactoryLocator_1 = new AssistedFactoryLocator_1.AssistedFactoryLocator(this.getTypeChecker_1(), this.getInjectNodeDetector_1(), this.getConstructorHelper_1())); }
        private getSourceFileVisitor_1(): ReturnType<typeof Component_1.SourceFileModule.provideAnnotationValidationVisitor> { return Component_1.SourceFileModule.provideAnnotationValidationVisitor(this.getAnnotationValidator_1()); }
        private errorReporter_1?: ErrorReporter_1.ErrorReporter;
        private getErrorReporter_1(): ErrorReporter_1.ErrorReporter { return this.errorReporter_1 ?? (this.errorReporter_1 = new ErrorReporter_1.ErrorReporter(this.getTypeChecker_1(), this.getComponentDeclaration_1())); }
        private annotationValidator_1?: AnnotationValidator_1.AnnotationValidator;
        private getAnnotationValidator_1(): AnnotationValidator_1.AnnotationValidator { return this.annotationValidator_1 ?? (this.annotationValidator_1 = new AnnotationValidator_1.AnnotationValidator(this.getTypeChecker_1(), this.getInjectNodeDetector_1(), this.getErrorReporter_1())); }
        private getTypeChecker_1() { return this.parent_1.getTypeChecker_1(); }
        private getNameGenerator_1() { return this.parent_1.getNameGenerator_1(); }
        private getImporter_1() { return this.parent_1.getImporter_1(); }
        private getKarambitOptions_1() { return this.parent_1.getKarambitOptions_1(); }
        private getComponentDeclaration_1() { return this.parent_1.getComponentDeclaration_1(); }
        private componentGeneratorDependencies_1 = class ComponentGeneratorDependencies_1 implements ComponentGenerator_1.ComponentGeneratorDependencies {
            constructor(private readonly parent_1: SourceFileSubcomponent_1, private readonly componentDeclaration_1: Parameters<Component_1.ComponentGenerationSubcomponentFactory>[0]) {
            }
            get generatedComponent(): Component_1.ComponentGenerationSubcomponent["generatedComponent"] { return this.getGeneratedComponent_1(); }
            private generatedComponent_1?: ReturnType<typeof Component_1.ComponentGenerationModule.provideGeneratedComponent>;
            private getGeneratedComponent_1(): ReturnType<typeof Component_1.ComponentGenerationModule.provideGeneratedComponent> { return this.generatedComponent_1 ?? (this.generatedComponent_1 = Component_1.ComponentGenerationModule.provideGeneratedComponent(this.getComponentGenerator_1())); }
            private componentGenerator_1?: ComponentGenerator_1.ComponentGenerator;
            private getComponentGenerator_1(): ComponentGenerator_1.ComponentGenerator { return this.componentGenerator_1 ?? (this.componentGenerator_1 = new ComponentGenerator_1.ComponentGenerator(this.getTypeChecker_1(), this.getInjectNodeDetector_1(), this.getNameGenerator_1(), this.getModuleLocator_1(), this.getConstructorHelper_1(), this.getPropertyExtractor_1(), this.getErrorReporter_1(), this.getProviderLocator_1(), this.getComponentDeclaration_1(), this.getComponentDeclarationBuilder_Factory_1(), this.getSubcomponentFactoryLocator_Factory_1(), this.getTypeResolver_Factory_1(), this.getDependencyGraphBuilder_Factory_1())); }
            private errorReporter_1?: ErrorReporter_1.ErrorReporter;
            private getErrorReporter_1(): ErrorReporter_1.ErrorReporter { return this.errorReporter_1 ?? (this.errorReporter_1 = new ErrorReporter_1.ErrorReporter(this.getTypeChecker_1(), this.getComponentDeclaration_1())); }
            private getComponentDeclaration_1() { return this.componentDeclaration_1; }
            private getComponentDeclarationBuilder_Factory_1() {
                return (typeResolver: ConstructorParameters<typeof ComponentDeclarationBuilder_1.ComponentDeclarationBuilder>[6], instanceProviders: ConstructorParameters<typeof ComponentDeclarationBuilder_1.ComponentDeclarationBuilder>[7]) => new ComponentDeclarationBuilder_1.ComponentDeclarationBuilder(this.getTypeChecker_1(), this.getInjectNodeDetector_1(), this.getConstructorHelper_1(), this.getNameGenerator_1(), this.getImporter_1(), this.getErrorReporter_1(), typeResolver, instanceProviders);
            }
            private getSubcomponentFactoryLocator_Factory_1() {
                return (installedSubcomponents: ConstructorParameters<typeof SubcomponentFactoryLocator_1.SubcomponentFactoryLocator>[3]) => new SubcomponentFactoryLocator_1.SubcomponentFactoryLocator(this.getTypeChecker_1(), this.getInjectNodeDetector_1(), this.getConstructorHelper_1(), installedSubcomponents);
            }
            private getTypeResolver_Factory_1() {
                return (bindings: ConstructorParameters<typeof TypeResolver_1.TypeResolver>[1]) => new TypeResolver_1.TypeResolver(this.getErrorReporter_1(), bindings);
            }
            private getDependencyGraphBuilder_Factory_1() {
                return (typeResolver: ConstructorParameters<typeof DependencyGraphBuilder_1.DependencyGraphBuilder>[0], dependencyMap: ConstructorParameters<typeof DependencyGraphBuilder_1.DependencyGraphBuilder>[2], factoryMap: ConstructorParameters<typeof DependencyGraphBuilder_1.DependencyGraphBuilder>[3], setMultibindings: ConstructorParameters<typeof DependencyGraphBuilder_1.DependencyGraphBuilder>[4], mapMultibindings: ConstructorParameters<typeof DependencyGraphBuilder_1.DependencyGraphBuilder>[5], subcomponentFactoryLocator: ConstructorParameters<typeof DependencyGraphBuilder_1.DependencyGraphBuilder>[6], scopeFilter: ConstructorParameters<typeof DependencyGraphBuilder_1.DependencyGraphBuilder>[10], parentGraph: ConstructorParameters<typeof DependencyGraphBuilder_1.DependencyGraphBuilder>[11]) => new DependencyGraphBuilder_1.DependencyGraphBuilder(typeResolver, this.getInjectNodeDetector_1(), dependencyMap, factoryMap, setMultibindings, mapMultibindings, subcomponentFactoryLocator, this.getAssistedFactoryLocator_1(), this.getConstructorHelper_1(), this.getErrorReporter_1(), scopeFilter, parentGraph);
            }
            private getTypeChecker_1() { return this.parent_1.getTypeChecker_1(); }
            private getInjectNodeDetector_1() { return this.parent_1.getInjectNodeDetector_1(); }
            private getNameGenerator_1() { return this.parent_1.getNameGenerator_1(); }
            private getModuleLocator_1() { return this.parent_1.getModuleLocator_1(); }
            private getConstructorHelper_1() { return this.parent_1.getConstructorHelper_1(); }
            private getPropertyExtractor_1() { return this.parent_1.getPropertyExtractor_1(); }
            private getProviderLocator_1() { return this.parent_1.getProviderLocator_1(); }
            private getImporter_1() { return this.parent_1.getImporter_1(); }
            private getAssistedFactoryLocator_1() { return this.parent_1.getAssistedFactoryLocator_1(); }
        };
    };
}
