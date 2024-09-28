export const internalQualifier = Symbol("internal-qualifier");
const typesWeakMap = new WeakMap();
export function createQualifiedType(args) {
    var _a;
    const existing = (_a = typesWeakMap.get(args.type)) !== null && _a !== void 0 ? _a : [];
    for (const item of existing) {
        if (item.type === args.type && item.qualifier === args.qualifier && item.discriminator === args.discriminator) {
            return item;
        }
    }
    existing.push(args);
    typesWeakMap.set(args.type, existing);
    return args;
}
export function qualifiedTypeToString(qualifiedType) {
    var _a, _b;
    const checker = qualifiedType.type.checker;
    const qualifierString = typeof qualifiedType.qualifier === "string" ?
        `named "${qualifiedType.qualifier}"` :
        typeof qualifiedType.qualifier === "object" ? (_a = qualifiedType.qualifier) === null || _a === void 0 ? void 0 : _a.getName() : undefined;
    const qualifierInfo = qualifierString ? ` with qualifier ${qualifierString}` : "";
    return ((_b = checker === null || checker === void 0 ? void 0 : checker.typeToString(qualifiedType.type)) !== null && _b !== void 0 ? _b : "unknown type") + qualifierInfo;
}
