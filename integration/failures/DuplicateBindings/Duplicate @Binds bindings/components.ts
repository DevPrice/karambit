import {Binds, Component, Module, Provides} from "karambit-decorators"

interface ParentInterface {
    x: number
}

interface ChildInterface1 {
    x: number
    y: number
}

interface ChildInterface2 extends ParentInterface {
    z: number
}

@Module
export abstract class DuplicateBindingsModule {

    @Binds
    abstract bindInterface1: (x: ChildInterface1) => ParentInterface

    @Binds
    abstract bindInterface2: (x: ChildInterface2) => ParentInterface

    @Provides
    static provideChild1(): ChildInterface1 {
        return {x: 1, y: 2}
    }

    @Provides
    static provideChild2(): ChildInterface2 {
        return {x: 2, z: 0}
    }
}

@Component({modules: [DuplicateBindingsModule]})
export abstract class DuplicateBindingsComponent {
    abstract readonly interfaceType: ParentInterface
}
