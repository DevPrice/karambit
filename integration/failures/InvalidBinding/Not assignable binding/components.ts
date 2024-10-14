import {Binds, Component, Module, Provides} from "karambit-decorators"

interface ParentInterface {
    x: number
}

interface BadChildInterface {
    y: number
}

@Module
export abstract class BadBindingModule {

    @Binds
    abstract bindInterface: (x: BadChildInterface) => ParentInterface

    @Provides
    static provideChild(): BadChildInterface {
        return {y: 2}
    }
}

@Component({modules: [BadBindingModule]})
export abstract class BadBindingComponent {
    abstract readonly interfaceType: ParentInterface
}
