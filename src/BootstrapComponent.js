"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgramComponent = exports.ProgramModule = exports.SourceFileModule = void 0;
const ComponentGenerator_1 = require("./ComponentGenerator");
const ModuleLocator_1 = require("./ModuleLocator");
const ErrorReporter_1 = require("./ErrorReporter");
const NameGenerator_1 = require("./NameGenerator");
const Importer_1 = require("./Importer");
const InjectConstructorExporter_1 = require("./InjectConstructorExporter");
const ComponentVisitor_1 = require("./ComponentVisitor");
const InjectNodeDetector_1 = require("./InjectNodeDetector");
const ConstructorHelper_1 = require("./ConstructorHelper");
const PropertyExtractor_1 = require("./PropertyExtractor");
const Scopes_1 = require("./Scopes");
class ComponentGenerationSubcomponent {
    constructor(componentDeclaration) { }
}
class SourceFileModule {
    static provideTransformers(classExporter, componentVisitor, nodeDetector, importer, ctx) {
        return [
            classExporter.exportProviders,
            componentVisitor.visitComponents,
            node => nodeDetector.eraseInjectRuntime(node, ctx),
            importer.addImportsToSourceFile,
        ];
    }
}
exports.SourceFileModule = SourceFileModule;
class SourceFileSubcomponent {
    constructor(sourceFile) { }
}
class TransformationContextSubcomponent {
    constructor(transformationContext) { }
}
class ProgramModule {
    static provideTypeChecker(program) {
        return program.getTypeChecker();
    }
}
exports.ProgramModule = ProgramModule;
class ProgramComponent {
    constructor(program, options) {
        this.transformationContextSubcomponent_1 = class extends TransformationContextSubcomponent {
            constructor(parent_1, transformationContext_1) {
                super(transformationContext_1);
                this.parent_1 = parent_1;
                this.transformationContext_1 = transformationContext_1;
                this.sourceFileSubcomponent_1 = class extends SourceFileSubcomponent {
                    constructor(parent_1, sourceFile_1) {
                        super(sourceFile_1);
                        this.parent_1 = parent_1;
                        this.sourceFile_1 = sourceFile_1;
                        this.componentGenerationSubcomponent_1 = class extends ComponentGenerationSubcomponent {
                            constructor(parent_1, classDeclaration_1) {
                                super(classDeclaration_1);
                                this.parent_1 = parent_1;
                                this.classDeclaration_1 = classDeclaration_1;
                            }
                            get generator() { return this.getComponentGenerator_1(); }
                            getComponentGenerator_1() { return this.componentGenerator_1 ?? (this.componentGenerator_1 = new ComponentGenerator_1.ComponentGenerator(this.getTypeChecker_1(), this.getTransformationContext_1(), this.getSourceFile_1(), this.getInjectNodeDetector_1(), this.getNameGenerator_1(), this.getImporter_1(), this.getModuleLocator_1(), this.getConstructorHelper_1(), this.getPropertyExtractor_1(), this.getErrorReporter_1(), this.getClassDeclaration_1())); }
                            getModuleLocator_1() { return this.moduleLocator_1 ?? (this.moduleLocator_1 = new ModuleLocator_1.ModuleLocator(this.getTypeChecker_1(), this.getTransformationContext_1(), this.getInjectNodeDetector_1(), this.getErrorReporter_1())); }
                            getErrorReporter_1() { return this.errorReporter_1 ?? (this.errorReporter_1 = new ErrorReporter_1.ErrorReporter(this.getTypeChecker_1(), this.getClassDeclaration_1())); }
                            getClassDeclaration_1() { return this.classDeclaration_1; }
                            getTypeChecker_1() { return this.parent_1.getTypeChecker_1(); }
                            getTransformationContext_1() { return this.parent_1.getTransformationContext_1(); }
                            getSourceFile_1() { return this.parent_1.getSourceFile_1(); }
                            getInjectNodeDetector_1() { return this.parent_1.getInjectNodeDetector_1(); }
                            getNameGenerator_1() { return this.parent_1.getNameGenerator_1(); }
                            getImporter_1() { return this.parent_1.getImporter_1(); }
                            getConstructorHelper_1() { return this.parent_1.getConstructorHelper_1(); }
                            getPropertyExtractor_1() { return this.parent_1.getPropertyExtractor_1(); }
                        };
                    }
                    get transformers() { return this.getTransformer$SourceFile$_1(); }
                    getTransformer$SourceFile$_1() { return SourceFileModule.provideTransformers(this.getInjectConstructorExporter_1(), this.getComponentVisitor_1(), this.getInjectNodeDetector_1(), this.getImporter_1(), this.getTransformationContext_1()); }
                    getSourceFile_1() { return this.sourceFile_1; }
                    getNameGenerator_1() { return this.nameGenerator_1 ?? (this.nameGenerator_1 = new NameGenerator_1.NameGenerator(this.getTypeChecker_1())); }
                    getImporter_1() { return this.importer_1 ?? (this.importer_1 = new Importer_1.Importer(this.getSourceFile_1())); }
                    getInjectConstructorExporter_1() { return this.injectConstructorExporter_1 ?? (this.injectConstructorExporter_1 = new InjectConstructorExporter_1.InjectConstructorExporter(this.getTransformationContext_1(), this.getInjectNodeDetector_1())); }
                    getComponentVisitor_1() { return this.componentVisitor_1 ?? (this.componentVisitor_1 = new ComponentVisitor_1.ComponentVisitor(this.getTransformationContext_1(), this.getInjectNodeDetector_1(), this.getComponentGenerationSubcomponent_Factory_1())); }
                    getComponentGenerationSubcomponent_Factory_1() {
                        return componentDeclaration => new this.componentGenerationSubcomponent_1(this, componentDeclaration);
                    }
                    getTypeChecker_1() { return this.parent_1.getTypeChecker_1(); }
                    getTransformationContext_1() { return this.parent_1.getTransformationContext_1(); }
                    getInjectNodeDetector_1() { return this.parent_1.getInjectNodeDetector_1(); }
                    getConstructorHelper_1() { return this.parent_1.getConstructorHelper_1(); }
                    getPropertyExtractor_1() { return this.parent_1.getPropertyExtractor_1(); }
                };
            }
            get sourceFileSubcomponentFactory() { return this.getSourceFileSubcomponent_Factory_1(); }
            getSourceFileSubcomponent_Factory_1() {
                return sourceFile => new this.sourceFileSubcomponent_1(this, sourceFile);
            }
            getTransformationContext_1() { return this.transformationContext_1; }
            getTypeChecker_1() { return this.parent_1.getTypeChecker_1(); }
            getInjectNodeDetector_1() { return this.parent_1.getInjectNodeDetector_1(); }
            getConstructorHelper_1() { return this.parent_1.getConstructorHelper_1(); }
            getPropertyExtractor_1() { return this.parent_1.getPropertyExtractor_1(); }
        };
        this.program_1 = program;
        this.karambitTransformOptions_1 = options;
    }
    get transformationContextSubcomponentFactory() { return this.getTransformationContextSubcomponent_Factory_1(); }
    getTransformationContextSubcomponent_Factory_1() {
        return transformationContext => new this.transformationContextSubcomponent_1(this, transformationContext);
    }
    getTypeChecker_1() { return this.typeChecker_1 ?? (this.typeChecker_1 = ProgramModule.provideTypeChecker(this.getProgram_1())); }
    getInjectNodeDetector_1() { return this.injectNodeDetector_1 ?? (this.injectNodeDetector_1 = new InjectNodeDetector_1.InjectNodeDetector(this.getTypeChecker_1(), this.getKarambitTransformOptions_1())); }
    getConstructorHelper_1() { return this.constructorHelper_1 ?? (this.constructorHelper_1 = new ConstructorHelper_1.ConstructorHelper(this.getTypeChecker_1(), this.getInjectNodeDetector_1())); }
    getPropertyExtractor_1() { return this.propertyExtractor_1 ?? (this.propertyExtractor_1 = new PropertyExtractor_1.PropertyExtractor(this.getTypeChecker_1(), this.getInjectNodeDetector_1())); }
    getProgram_1() { return this.program_1; }
    getKarambitTransformOptions_1() { return this.karambitTransformOptions_1; }
}
exports.ProgramComponent = ProgramComponent;