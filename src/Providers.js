export function isPropertyProvider(provider) {
    return provider.providerType === ProviderType.PROPERTY;
}
export function isProvidesMethod(provider) {
    return provider.providerType === ProviderType.PROVIDES_METHOD;
}
export function isInjectableConstructor(provider) {
    return provider.providerType === ProviderType.INJECTABLE_CONSTRUCTOR;
}
export function isSubcomponentFactory(provider) {
    return provider.providerType === ProviderType.SUBCOMPONENT_FACTORY;
}
export var ProviderType;
(function (ProviderType) {
    ProviderType[ProviderType["PROPERTY"] = 0] = "PROPERTY";
    ProviderType[ProviderType["PROVIDES_METHOD"] = 1] = "PROVIDES_METHOD";
    ProviderType[ProviderType["INJECTABLE_CONSTRUCTOR"] = 2] = "INJECTABLE_CONSTRUCTOR";
    ProviderType[ProviderType["SUBCOMPONENT_FACTORY"] = 3] = "SUBCOMPONENT_FACTORY";
    ProviderType[ProviderType["ASSISTED_FACTORY"] = 4] = "ASSISTED_FACTORY";
    ProviderType[ProviderType["UNDEFINED"] = 5] = "UNDEFINED";
    ProviderType[ProviderType["PARENT"] = 6] = "PARENT";
    ProviderType[ProviderType["SET_MULTIBINDING"] = 7] = "SET_MULTIBINDING";
    ProviderType[ProviderType["MAP_MULTIBINDING"] = 8] = "MAP_MULTIBINDING";
})(ProviderType || (ProviderType = {}));
