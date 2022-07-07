import * as assert from "assert"
import {printTreeMap} from "../src/Util"

import type {Chalk} from "chalk"
const chalk: Chalk = require("chalk")

describe("Util", () => {
    describe("Print trees", () => {
        it("prints a basic tree", () => {
            const tree = new Map<string, Iterable<string>>()
            tree.set("root", ["a", "c"])
            tree.set("a", ["b"])
            assert.strictEqual(printTreeMap("root", tree), basicTree)
        })
        it("prints a sub-tree", () => {
            const tree = new Map<string, Iterable<string>>()
            tree.set("root", ["a", "c"])
            tree.set("a", ["b"])
            assert.strictEqual(printTreeMap("a", tree), subTree)
        })
        it("prints a tree with trailing items", () => {
            const tree = new Map<string, Iterable<string>>()
            tree.set("root", ["a", "c"])
            tree.set("a", ["b"])
            tree.set("c", ["d", "e"])
            assert.strictEqual(printTreeMap("root", tree), treeWithTrailingItems)
        })
        it("prints a tree with duplicates", () => {
            const tree = new Map<string, Iterable<string>>()
            tree.set("root", ["a", "c"])
            tree.set("a", ["b"])
            tree.set("c", ["a"])
            assert.strictEqual(printTreeMap("root", tree), treeWithDuplicates)
        })
    })
})

const expectedDedupedText = chalk.bgYellow("de-duped")

const basicTree =
`root
├─┬ a
│ └── b
└── c`

const subTree =
`a
└── b`

const treeWithTrailingItems =
`root
├─┬ a
│ └── b
└─┬ c
  ├── d
  └── e`

const treeWithDuplicates =
`root
├─┬ a
│ └── b
└─┬ c
  └── a ${expectedDedupedText}`
