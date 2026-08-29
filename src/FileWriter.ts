import * as ts from "./compiler"
import * as Path from "path"
import * as fs from "fs"
import {Logger} from "./Util"
import {KarambitOptions} from "./karambit"

export interface ComponentWriter {
    writeComponentFile(sourceFile: ts.SourceFile, outputFilename: string): void
}

/**
 * @inject
 */
export class FileWriter implements ComponentWriter {

    constructor(
        private readonly options: KarambitOptions,
    ) { }

    writeComponentFile(sourceFile: ts.SourceFile, outputFilename: string) {
        const resultText: string = ts.printFile(sourceFile, this.options.printerOptions)
        if (resultText) {
            const outputDir = Path.dirname(outputFilename)
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, {recursive: true})
            }
            fs.writeFileSync(outputFilename, resultText)
        }
    }
}

/**
 * @inject
 */
export class DryRunWriter implements ComponentWriter {

    constructor(
        private readonly logger: Logger,
    ) { }

    writeComponentFile(_: ts.SourceFile, outputFilename: string) {
        this.logger.debug(`Not writing ${outputFilename} (dry-run)`)
    }
}