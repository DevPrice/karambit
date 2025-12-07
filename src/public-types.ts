import * as ts from "typescript"
export {KarambitError, KarambitErrorScope} from "./KarambitError"

export type Logger = Pick<typeof console, "debug" | "info" | "warn" | "error">
export type ComponentDeclaration = ts.ClassDeclaration | ts.InterfaceDeclaration
