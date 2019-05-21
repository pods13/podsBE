import { Module, Provider } from "@nestjs/common";
import { ScheduleModule } from "nest-schedule";
import { ScheduleService } from "./schedule.service";
import { BalorFomorianEventTask } from "./tasks/events/balor-fomorian-event.task";
import { ThermiaFracturesEventTask } from "./tasks/events/thermia-fractures-event.task";
import { WarframestatDataProvider } from "./providers/warframestat-data.provider";

const eventDataTasks: Provider = {
    provide: 'EVENT_DATA_TASKS',
    useFactory: (...providers) => {
        return providers;
    },
    inject: [BalorFomorianEventTask, ThermiaFracturesEventTask]
}

@Module({
    imports: [
        ScheduleModule.register()
    ],
    providers: [
        ScheduleService,
        WarframestatDataProvider,
        BalorFomorianEventTask,
        ThermiaFracturesEventTask,
        eventDataTasks
    ]
})
export class DynamicDataModule {

}