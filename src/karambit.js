import { time } from "./Util";
import * as ts from "typescript";
import * as Path from "path";
import { createProgramComponent } from "./Component";
import { ErrorReporter } from "./ErrorReporter";
import * as fs from "fs";
export function Component() {
    ErrorReporter.reportCodeNotTransformed();
}
export function Subcomponent() {
    ErrorReporter.reportCodeNotTransformed();
}
export function Module() {
    ErrorReporter.reportCodeNotTransformed();
}
export function Inject() {
    ErrorReporter.reportCodeNotTransformed();
}
export function AssistedInject() {
    ErrorReporter.reportCodeNotTransformed();
}
export function Assisted() {
    ErrorReporter.reportCodeNotTransformed();
}
export function Provides() {
    ErrorReporter.reportCodeNotTransformed();
}
export function Binds() {
    ErrorReporter.reportCodeNotTransformed();
}
export function BindsInstance() {
    ErrorReporter.reportCodeNotTransformed();
}
export function IntoSet() {
    ErrorReporter.reportCodeNotTransformed();
}
export function IntoMap() {
    ErrorReporter.reportCodeNotTransformed();
}
export function ElementsIntoSet() {
    ErrorReporter.reportCodeNotTransformed();
}
export function ElementsIntoMap() {
    ErrorReporter.reportCodeNotTransformed();
}
export function MapKey(key) {
    ErrorReporter.reportCodeNotTransformed();
}
export function Scope() {
    ErrorReporter.reportCodeNotTransformed();
}
export const Reusable = () => {
    ErrorReporter.reportCodeNotTransformed();
};
/**
 * @deprecated Use {@link Qualified} to qualify a type instead.
 */
export function Qualifier() {
    ErrorReporter.reportCodeNotTransformed();
}
// noinspection JSUnusedLocalSymbols
/**
 * @deprecated Use {@link Named} (type) to qualify a type instead.
 */
export function Named(name) {
    ErrorReporter.reportCodeNotTransformed();
}
/**
 * Create a Component instance. Used to access a generated Component from the same compilation unit.
 * @param args the constructor arguments of the component.
 */
// noinspection JSUnusedLocalSymbols
export function createComponent(...args) {
    ErrorReporter.reportCodeNotTransformed();
}
/**
 * Get a reference to the generated Component constructor.
 * Used to access a generated Component from the same compilation unit.
 * @param type the constructor of the type decorated with @{@link Component}
 */
// noinspection JSUnusedLocalSymbols
export function getConstructor(type) {
    ErrorReporter.reportCodeNotTransformed();
}
export default function (program, options) {
    const transformOptions = Object.assign(Object.assign({}, defaultOptions), options);
    const programComponent = createProgramComponent(program, transformOptions);
    let originalWriteFile = undefined;
    return (ctx) => {
        const emitHost = ctx.getEmitHost();
        if (!originalWriteFile)
            originalWriteFile = emitHost.writeFile;
        let write = false;
        emitHost.writeFile = (filename, ...args) => {
            if (write) {
                console.log("writing ", filename);
                originalWriteFile(filename, args);
            }
            else {
                console.log("skipping ", filename);
            }
        };
        const transformationContextComponent = programComponent.transformationContextSubcomponentFactory(ctx);
        return (sourceFile) => {
            const { result, durationMs } = time(() => {
                const sourceFileComponent = transformationContextComponent.sourceFileSubcomponentFactory(sourceFile);
                return runTransformers(sourceFile, ...sourceFileComponent.transformers);
            });
            if (transformOptions.printTransformDuration) {
                const durationString = durationMs < 1 ? "<1" : durationMs.toString();
                const relativePath = Path.relative(".", sourceFile.fileName);
                console.info(`Transformed ${relativePath} in ${durationString}ms.`);
            }
            const resultText = ts.createPrinter().printNode(ts.EmitHint.Unspecified, result, result);
            if (resultText) {
                console.log("manual writing", sourceFile.fileName);
                const p = `${transformOptions.outDir}/${Path.relative(".", sourceFile.fileName)}`;
                if (!fs.existsSync(Path.dirname(p)))
                    fs.mkdirSync(Path.dirname(p), { recursive: true });
                fs.writeFileSync(p, ts.createPrinter().printNode(ts.EmitHint.Unspecified, result, sourceFile));
            }
            write = !!resultText;
            return result;
        };
    };
}
function runTransformers(node, ...transformers) {
    return transformers.reduce((n, transformer) => transformer(n), node);
}
const defaultOptions = {
    stripImports: true,
    printTransformDuration: false,
    outDir: "karambit-out",
};
