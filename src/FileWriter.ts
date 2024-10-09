import {Inject} from "karambit-decorators"
import * as ts from "typescript"
import * as Path from "path"
import * as fs from "fs"
import {KarambitOptions} from "./karambit"

@Inject
export class FileWriter {

    constructor(
        private readonly printer: ts.Printer,
        private readonly karambitOptions: KarambitOptions,
    ) { }

    writeComponentFile(sourceFile: ts.SourceFile, outputFilename: string) {
        const resultText: string = this.printer.printFile(sourceFile)
        if (resultText) {
            const p = Path.join(
                this.karambitOptions.outDir,
                Path.relative(
                    this.karambitOptions.sourceRoot,
                    Path.join(
                        Path.dirname(sourceFile.fileName),
                        outputFilename,
                    )
                )
            )
            const outputDir = Path.dirname(p)
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, {recursive: true})
            }
            fs.writeFileSync(p, resultText)
        }
    }
}