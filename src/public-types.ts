import * as ts from "typescript"

export type Logger = Pick<typeof console, "debug" | "info" | "warn" | "error">
export type ComponentDeclaration = ts.ClassDeclaration | ts.InterfaceDeclaration
