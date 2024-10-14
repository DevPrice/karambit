import {Binds, Component, Module} from "karambit-decorators"

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
}

@Component({modules: [DuplicateBindingsModule]})
export abstract class DuplicateBindingsComponent {
    abstract readonly interfaceType: ParentInterface
}
