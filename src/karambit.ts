import {isNotNull} from "./Util"
import type * as ts from "typescript"
import * as Path from "path"
import {KarambitProgramComponent} from "./karambit-generated/src/Component"

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
    outDir: string
    dryRun: boolean
    verbose: boolean
    nameMaxLength: number
    experimentalTags: boolean
}

export function generateComponentFiles(program: ts.Program, options?: Partial<KarambitOptions>) {
    const karambitOptions = {...defaultOptions, ...options}
    const programComponent = new KarambitProgramComponent(program, karambitOptions)
    const generatedFiles = program.getSourceFiles()
        .filter(sourceFile => !program.isSourceFileFromExternalLibrary(sourceFile) && !program.isSourceFileDefaultLibrary(sourceFile))
        .map(sourceFile => {
            programComponent.logger.debug(`Reading ${Path.relative(".", sourceFile.fileName)}...`)
            const sourceFileComponent = programComponent.sourceFileSubcomponentFactory(sourceFile)
            for (const visitor of sourceFileComponent.sourceFileVisitors) {
                visitor(sourceFile)
            }
            return sourceFileComponent.sourceFileGenerator.generateSourceFile(sourceFile)
        })
        .filter(isNotNull)
    for (const file of generatedFiles) {
        const outputFilename = Path.basename(file.fileName)
        if (!karambitOptions.dryRun) {
            programComponent.fileWriter.writeComponentFile(file, outputFilename)
        } else {
            programComponent.logger.debug(`Not writing ${Path.relative(karambitOptions.outDir, outputFilename)} (dry-run)`)
        }
    }
}

const defaultOptions: KarambitOptions = {
    sourceRoot: ".",
    outDir: "karambit-generated",
    dryRun: false,
    verbose: false,
    nameMaxLength: 30,
    experimentalTags: false,
}
