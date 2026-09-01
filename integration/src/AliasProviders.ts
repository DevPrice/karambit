import {Provides} from "karambit-decorators"
import {ProvidedOnly, ProviderModule} from "./TestComponents.js"

export class UnscopedAliasTarget { }

export class ScopedAliasTarget { }

export function provideAliasedNumber(): number {
    return 1337
}

/** @reusable */
export function provideUnscopedTarget(): UnscopedAliasTarget {
    return new UnscopedAliasTarget()
}

function provideDescription(value: number, missingSymbol?: symbol): string {
    return `${value}${missingSymbol ? "!" : "?"}`
}

export const aliasProviderModule = {
    /** @provides */
    provideAliasedNumber,
    /** @provides */
    provideDescription: provideDescription,
    /** @provides */
    provideTarget: provideUnscopedTarget,
    /**
     * @provides
     * @reusable
     */
    provideScopedTarget: () => new ScopedAliasTarget(),
}

export abstract class AliasProviderClassModule {

    @Provides
    static provideFlag = () => true
}

/**
 * @component
 * @includeModule {@link aliasProviderModule} {@link AliasProviderClassModule} {@link ProviderModule}
 */
export abstract class AliasProviderComponent {
    abstract readonly aliasedNumber: number
    abstract readonly description: string
    abstract readonly unscopedTarget: UnscopedAliasTarget
    abstract readonly scopedTarget: ScopedAliasTarget
    abstract readonly flag: boolean
    abstract readonly importedModuleType: ProvidedOnly
}
