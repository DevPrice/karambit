import * as fs from "fs"
import * as Path from "path"
import * as assert from "assert"
import {createProgram, generateComponentFiles, KarambitError, withProject} from "karambit-inject"

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
    expectKarambitError(errorScope, () => {
        withProject(Path.join(dirName, "tsconfig.json"), project => {
            generateComponentFiles(createProgram(project), {dryRun: true, enableDocTags: true})
        })
    })
}

function expectKarambitError(scope: string, block: () => void) {
    try {
        block()
        assert.fail(`Expected validation to fail with reason '${scope}'!`)
    } catch (e) {
        if (e instanceof KarambitError) {
            assert.strictEqual(e.scope, scope)
        } else {
            throw e
        }
    }
}
