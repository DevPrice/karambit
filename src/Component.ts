import * as ts from "typescript"
import {BindsInstance, Component, Module, Provides, Reusable, Subcomponent} from "karambit-inject"
import {InjectNodeDetector} from "./InjectNodeDetector"
import {InjectConstructorExporter} from "./InjectConstructorExporter"
import {ComponentGenerator} from "./ComponentGenerator"
import {Importer} from "./Importer"
import {SourceFileScope} from "./Scopes"

@Subcomponent
@SourceFileScope
abstract class SourceFileSubcomponent {

    protected constructor(@BindsInstance sourceFile: ts.SourceFile) { }

    readonly componentGenerator: ComponentGenerator
    readonly importer: Importer
}

@Subcomponent({subcomponents: [SourceFileSubcomponent]})
abstract class TransformationContextSubcomponent {

    protected constructor(@BindsInstance transformationContext: ts.TransformationContext) { }

    readonly injectConstructorExporter: InjectConstructorExporter
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

    readonly nodeDetector: InjectNodeDetector
    readonly transformationContextSubcomponentFactory: (transformationContext: ts.TransformationContext) => TransformationContextSubcomponent
}
