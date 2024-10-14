import {Binds, Component, Module} from "karambit-decorators"

interface ParentInterface {
    x: number
}

interface ChildInterface1 {
    x: number
    y: number
}

interface ChildInterface2 extends ChildInterface1 {
    z?: number
}

@Module
export abstract class DuplicateBindingsModule {

    @Binds
    abstract bindInterfaceParent: (x: ChildInterface1) => ParentInterface

    @Binds
    abstract bindInterface1_2: (x: ChildInterface1) => ChildInterface2

    @Binds
    abstract bindInterface2_2: (x: ChildInterface2) => ChildInterface1
}

@Component({modules: [DuplicateBindingsModule]})
export abstract class DuplicateBindingsComponent {
    abstract readonly interfaceType: ParentInterface
}
