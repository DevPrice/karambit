import * as assert from "assert"
import {bound, memoized} from "../src/Util"

class Probe {
    calls = 0

    @memoized
    value(): number {
        this.calls++
        return 42
    }

    @bound
    self(): Probe {
        return this
    }
}

describe("Decorators", () => {
    it("memoizes", () => {
        const probe = new Probe()
        assert.strictEqual(probe.value(), 42)
        assert.strictEqual(probe.value(), 42)
        assert.strictEqual(probe.calls, 1)
    })
    it("binds", () => {
        const probe = new Probe()
        const detached = probe.self
        assert.strictEqual(detached(), probe)
    })
})
