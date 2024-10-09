import {filterNotNull} from "./Util"
import * as ts from "typescript"
import * as Path from "path"
import {Importer} from "./Importer"
import {KarambitProgramComponent} from "./karambit-generated/src/Component"

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
    outDir: string
}

export function generateComponentFiles(program: ts.Program, options?: Partial<KarambitOptions>) {
    const karambitOptions = {...defaultOptions, ...options}
    // TODO: fix injection and remove this hack
    Importer.karambitOptions = karambitOptions
    Importer.typeChecker = program.getTypeChecker()
    const programComponent = new KarambitProgramComponent(program, karambitOptions)
    const generatedFiles = filterNotNull(
        program.getSourceFiles().map(sourceFile => {
            const sourceFileComponent = programComponent.sourceFileSubcomponentFactory(sourceFile)
            for (const visitor of sourceFileComponent.sourceFileVisitors) {
                visitor(sourceFile)
            }
            return sourceFileComponent.sourceFileGenerator.generateSourceFile(sourceFile)
        })
    )
    for (const file of generatedFiles) {
        const outputFilename = Path.basename(file.fileName)
        programComponent.fileWriter.writeComponentFile(file, outputFilename)
    }
}


const defaultOptions: KarambitOptions = {
    sourceRoot: ".",
    outDir: "karambit-generated",
}
