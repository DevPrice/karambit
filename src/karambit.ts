import {time} from "./Util"
import * as ts from "typescript"
import * as Path from "path"
import * as fs from "fs"
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
    printTransformDuration: boolean
    sourceRoot: string
    outDir: string
}

export function generateComponentFiles(program: ts.Program, options?: Partial<KarambitOptions>) {
    const karambitOptions = {...defaultOptions, ...options}
    // TODO: fix injection and remove this hack
    Importer.karambitOptions = karambitOptions
    Importer.typeChecker = program.getTypeChecker()
    const programComponent = new KarambitProgramComponent(program, karambitOptions)
    for (const sourceFile of program.getSourceFiles()) {
        const {result, durationMs} = time(() => {
            const sourceFileComponent = programComponent.sourceFileSubcomponentFactory(sourceFile)
            return runTransformers(sourceFile, ...sourceFileComponent.transformers)
        })

        const outputFilename = Path.basename(sourceFile.fileName)
        if (karambitOptions.printTransformDuration) {
            const durationString = durationMs < 1 ? "<1" : durationMs.toString()
            const relativePath = Path.relative(karambitOptions.sourceRoot, Path.join(Path.dirname(sourceFile.fileName), `Karambit${outputFilename}`))
            console.info(`Transformed ${relativePath} in ${durationString}ms.`)
        }

        const resultText = programComponent.printer.printFile(result)
        if (resultText) {
            const p = Path.join(
                karambitOptions.outDir,
                Path.relative(
                    karambitOptions.sourceRoot,
                    Path.join(
                        Path.dirname(sourceFile.fileName),
                        outputFilename,
                    )
                )
            )
            if (!fs.existsSync(Path.dirname(p))) fs.mkdirSync(Path.dirname(p), {recursive: true})
            fs.writeFileSync(p, resultText)
        }
    }
}

function runTransformers<T extends ts.Node>(
    node: T,
    ...transformers: ts.Transformer<T>[]
): T {
    return transformers.reduce((n, transformer) => transformer(n), node)
}

const defaultOptions: KarambitOptions = {
    printTransformDuration: false,
    sourceRoot: ".",
    outDir: "karambit-generated",
}
