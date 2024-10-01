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
export type Named<T extends (string extends T ? never : string)> = {
    readonly [key in `_karambitNamed${T}`]?: unknown
}

export interface Provider<T> {
    (): T
}

export interface SubcomponentFactory<T extends ConstructorType<T>> {
    (...args: ConstructorParameters<T>): InstanceType<T>
}

export interface KarambitTransformOptions {
    stripImports: boolean
    printTransformDuration: boolean
    outDir: string
}

export default function(program: ts.Program, options?: Partial<KarambitTransformOptions>) {
    const transformOptions = {...defaultOptions, ...options}
    // TODO: fix injection and remove this hack
    Importer.outDir = transformOptions.outDir
    Importer.typeChecker = program.getTypeChecker()
    const programComponent = new KarambitProgramComponent(program, transformOptions)
    return (ctx: ts.TransformationContext) => {
        const emitHost = (ctx as any).getEmitHost()
        emitHost.writeFile = () => { }

        const transformationContextComponent = programComponent.transformationContextSubcomponentFactory(ctx)
        return (sourceFile: ts.SourceFile) => {
            const {result, durationMs} = time(() => {
                const sourceFileComponent = transformationContextComponent.sourceFileSubcomponentFactory(sourceFile)
                return runTransformers(sourceFile, ...sourceFileComponent.transformers)
            })
            if (transformOptions.printTransformDuration) {
                const durationString = durationMs < 1 ? "<1" : durationMs.toString()
                const relativePath = Path.relative(".", Path.join(Path.dirname(sourceFile.fileName), "Karambit" + Path.basename(sourceFile.fileName)))
                console.info(`Transformed ${relativePath} in ${durationString}ms.`)
            }

            const resultText = ts.createPrinter().printNode(ts.EmitHint.Unspecified, result, result)
            if (resultText) {
                const p = `${transformOptions.outDir}/${Path.relative(".", sourceFile.fileName)}`
                if (!fs.existsSync(Path.dirname(p))) fs.mkdirSync(Path.dirname(p), {recursive: true})
                fs.writeFileSync(p, ts.createPrinter().printNode(ts.EmitHint.Unspecified, result, sourceFile))
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
    outDir: "karambit-generated",
}
