import {Inject} from "karambit-decorators"
import * as ts from "typescript"
import * as Path from "path"
import * as fs from "fs"

@Inject
export class FileWriter {

    constructor(
        private readonly printer: ts.Printer,
    ) { }

    writeComponentFile(sourceFile: ts.SourceFile, outputFilename: string) {
        const resultText: string = this.printer.printFile(sourceFile)
        if (resultText) {
            const outputDir = Path.dirname(outputFilename)
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, {recursive: true})
            }
            fs.writeFileSync(outputFilename, resultText)
        }
    }
}