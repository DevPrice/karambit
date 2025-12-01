import {isNotNull} from "./Util"
import * as ts from "typescript"
import * as Path from "path"
import {KarambitProgramComponent} from "./karambit-generated/src/Component"
import {findAllChildren} from "./Visitor"

export {KarambitError, KarambitErrorScope} from "./KarambitError"

type ConstructorType<T extends abstract new (...args: ConstructorParameters<T>) => InstanceType<T>> = abstract new (...args: ConstructorParameters<T>) => InstanceType<T>

export type Qualified<T extends keyof any & symbol> = {
    readonly [key in T]?: unknown
}

type IsStringLiteral<T> = T extends string
    ? string extends T
        ? false
        : true
    : false

export type Named<T extends string> = IsStringLiteral<T> extends false ? never : {
    readonly [key in `__karambitNamed_${T}`]?: unknown;
}

export interface Provider<T> {
    (): T
    __karambitProvider?: unknown
}

export interface SubcomponentFactory<T extends ConstructorType<T>> {
    (...args: ConstructorParameters<T>): InstanceType<T>
    __karambitSubcomponentFactory?: unknown
}

export interface KarambitOptions {
    sourceRoot: string
    outFile: string
    dryRun: boolean
    verbose: boolean
    nameMaxLength: number
    experimentalTags: boolean
}

export function generateComponentFiles(program: ts.Program, options?: Partial<KarambitOptions>) {
    const karambitOptions = {...defaultOptions, ...options}
    const programComponent = new KarambitProgramComponent(program, karambitOptions)
    const generatedComponents = program.getSourceFiles()
        .filter(sourceFile => !program.isSourceFileFromExternalLibrary(sourceFile) && !program.isSourceFileDefaultLibrary(sourceFile))
        .flatMap(sourceFile => {
            programComponent.logger.debug(`Reading ${Path.relative(".", sourceFile.fileName)}...`)
            const sourceFileComponent = programComponent.sourceFileSubcomponentFactory(sourceFile)
            for (const visitor of sourceFileComponent.sourceFileVisitors) {
                visitor(sourceFile)
            }
            const components: ts.ClassDeclaration[] = findAllChildren(sourceFile, (n): n is ts.ClassDeclaration => {
                return ts.isClassDeclaration(n) && !!n.modifiers?.some(sourceFileComponent.nodeDetector.isComponentDecorator)
            })
            return components.map(component => {
                return sourceFileComponent.componentGeneratorDependenciesFactory(component).generatedComponent
            })
        })
        .filter(isNotNull)
    const generatedFile = programComponent.sourceFileGenerator.generateSourceFile(generatedComponents)
    programComponent.fileWriter.writeComponentFile(generatedFile, karambitOptions.outFile)
}

const defaultOptions: KarambitOptions = {
    sourceRoot: ".",
    outFile: "gen/karambit.ts",
    dryRun: false,
    verbose: false,
    nameMaxLength: 30,
    experimentalTags: false,
}
