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

export interface KarambitTransformOptions {
    stripImports: boolean
    printTransformDuration: boolean
    sourceRoot: string
    outDir: string
}

export default function(program: ts.Program, options?: Partial<KarambitTransformOptions>) {
    const transformOptions = {...defaultOptions, ...options}
    // TODO: fix injection and remove this hack
    Importer.transformOptions = transformOptions
    Importer.typeChecker = program.getTypeChecker()
    const programComponent = new KarambitProgramComponent(program, transformOptions)
    return (ctx: ts.TransformationContext) => {
        const emitHost = (ctx as any).getEmitHost()
        emitHost.writeFile = () => { }

        const transformationContextComponent = programComponent.transformationContextSubcomponentFactory()
        return (sourceFile: ts.SourceFile) => {
            const {result, durationMs} = time(() => {
                const sourceFileComponent = transformationContextComponent.sourceFileSubcomponentFactory(sourceFile)
                return runTransformers(sourceFile, ...sourceFileComponent.transformers)
            })

            const outputFilename = Path.basename(sourceFile.fileName)
            if (transformOptions.printTransformDuration) {
                const durationString = durationMs < 1 ? "<1" : durationMs.toString()
                const relativePath = Path.relative(transformOptions.sourceRoot, Path.join(Path.dirname(sourceFile.fileName), `Karambit${outputFilename}`))
                console.info(`Transformed ${relativePath} in ${durationString}ms.`)
            }

            const resultText = programComponent.printer.printFile(result)
            if (resultText) {
                const p = Path.join(
                    transformOptions.outDir,
                    Path.relative(
                        transformOptions.sourceRoot,
                        Path.join(
                            Path.dirname(sourceFile.fileName),
                            outputFilename,
                        )
                    )
                )
                if (!fs.existsSync(Path.dirname(p))) fs.mkdirSync(Path.dirname(p), {recursive: true})
                fs.writeFileSync(p, resultText)
            }
            return result
        }
    }
}

function runTransformers<T extends ts.Node>(
    node: T,
    ...transformers: ts.Transformer<T>[]
): T {
    return transformers.reduce((n, transformer) => transformer(n), node)
}

const defaultOptions: KarambitTransformOptions = {
    stripImports: true,
    printTransformDuration: false,
    sourceRoot: ".",
    outDir: "karambit-generated",
}
