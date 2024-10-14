import * as fs from "fs"
import * as Path from "path"
import * as assert from "assert"
import {generateComponentFiles, KarambitError} from "karambit-inject"
import * as ts from "typescript"

const failuresDir = "failures"

describe("Validation", () => {
    fs.readdirSync(failuresDir, {withFileTypes: true})
        .filter(it => it.isDirectory())
        .forEach(dir => {
            describe(dir.name, () => {
                fs.readdirSync(Path.join(failuresDir, dir.name), {withFileTypes: true})
                    .forEach(unit => {
                        it(unit.name, () => {
                            runKarambitForError(Path.join(failuresDir, dir.name, unit.name), dir.name)
                        })
                    })
            })
        })
})

function runKarambitForError(dirName: string, errorScope: string) {
    const configFile = ts.readConfigFile(Path.join(dirName, "tsconfig.json"), ts.sys.readFile)
    if (configFile.error) {
        throw configFile.error
    }

    const parsedCommandLine = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirName)
    if (parsedCommandLine.errors.length > 0) {
        throw parsedCommandLine.errors
    }
    const program = ts.createProgram(parsedCommandLine.fileNames, parsedCommandLine.options)

    expectKarambitError(errorScope, () => {
        generateComponentFiles(program, {sourceRoot: dirName, dryRun: true})
    })
}

function expectKarambitError(scope: string, block: () => void) {
    try {
        block()
        assert.fail(`Expected validation to fail with reason '${scope}'!`)
    } catch (e) {
        if (e instanceof KarambitError) {
            expect(e).toBeInstanceOf(KarambitError)
            expect(e).toHaveProperty("scope", scope)
        } else {
            throw e
        }
    }
}
