import * as k from "karambit-decorators"
import {
    Binds,
    ElementsIntoMap,
    ElementsIntoSet,
    IntoMap,
    IntoSet,
    MapKey,
    Module,
    Provides,
    Reusable,
} from "karambit-decorators"
import {MultibindingType, MultibindingTypeImpl, ThreeHolder} from "./TestComponents"

export let multibindingScopedProvidedCount = 0

@Module
export abstract class MultibindingSetSubcomponentModule {

    @Provides
    @IntoSet
    static provideFour(): number {
        return 4
    }

    @Provides
    @MapKey("four")
    @IntoMap({optional: false})
    static provideFourIntoMap(): number {
        return 4
    }
}

@Module
export abstract class MultibindingSetModule {

    @k.Binds
    @k.IntoSet
    abstract bindMultibindingType: (impl: MultibindingTypeImpl) => MultibindingType

    /**
     * @provides
     * @intoSet
     */
    static provideOne(): number {
        return 1
    }

    @Provides
    static provideTwo(): number {
        return 2
    }

    @Provides
    @IntoSet
    static provideTwoIntoSet(two: number): number {
        return two
    }

    /**
     * @provides
     * @elementsIntoSet
     */
    static provideIterableIntoSet(): number[] {
        return [10, 11, 12]
    }

    @Provides
    @Reusable
    @IntoSet
    static provideThree(holder: ThreeHolder): number {
        multibindingScopedProvidedCount++
        return holder.three
    }

    @Provides
    static provideThreeHolder(): ThreeHolder {
        return {three: 3}
    }

    @Provides
    @IntoSet
    static provideMultibindingType(): MultibindingType {
        return {property: "provided"}
    }
}

@Module
export abstract class MultibindingMapModule {

    @Binds
    @MapKey("impl")
    @IntoMap
    abstract bindMultibindingType: (impl: MultibindingTypeImpl) => MultibindingType

    @Provides
    @MapKey("one")
    @IntoMap
    static provideOne(): number {
        return 1
    }

    @Provides
    @IntoMap
    static provideTwo(): [string, number] {
        return ["two", 2]
    }

    @Provides
    @MapKey("three")
    @IntoMap
    static provideThree(holder: ThreeHolder): number {
        return holder.three
    }

    @Provides
    @ElementsIntoMap
    static provideIterableIntoSet(): [string, number][] {
        return [["ten", 10], ["eleven", 11], ["twelve", 12]]
    }

    @Provides
    @k.MapKey("provided")
    @k.IntoMap
    static provideMultibindingType(): MultibindingType {
        return {property: "provided"}
    }
}