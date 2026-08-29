import * as assert from "assert"
import {NameAllocator} from "../src/compiler"

describe("NameAllocator", () => {
    describe("Allocate", () => {
        it("suffixes the first allocation", () => {
            const allocator = new NameAllocator()
            assert.strictEqual(allocator.allocate("provider").text, "provider_1")
        })
        it("counts allocations of the same base name", () => {
            const allocator = new NameAllocator()
            assert.strictEqual(allocator.allocate("provider").text, "provider_1")
            assert.strictEqual(allocator.allocate("provider").text, "provider_2")
            assert.strictEqual(allocator.allocate("provider").text, "provider_3")
        })
        it("counts base names independently", () => {
            const allocator = new NameAllocator()
            assert.strictEqual(allocator.allocate("provider").text, "provider_1")
            assert.strictEqual(allocator.allocate("factory").text, "factory_1")
            assert.strictEqual(allocator.allocate("provider").text, "provider_2")
        })
    })
    describe("Reserve", () => {
        it("returns the name unchanged", () => {
            const allocator = new NameAllocator()
            assert.strictEqual(allocator.reserve("KarambitComponent"), "KarambitComponent")
        })
        it("skips a suffix that a reserved name already took", () => {
            const allocator = new NameAllocator()
            allocator.reserve("provider_1")
            assert.strictEqual(allocator.allocate("provider").text, "provider_2")
        })
        it("skips a suffix reserved after earlier allocations", () => {
            const allocator = new NameAllocator()
            assert.strictEqual(allocator.allocate("provider").text, "provider_1")
            allocator.reserve("provider_2")
            assert.strictEqual(allocator.allocate("provider").text, "provider_3")
        })
    })
})
