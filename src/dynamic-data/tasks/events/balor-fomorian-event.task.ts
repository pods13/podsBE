import { Injectable, Logger, Inject } from "@nestjs/common";
import { UpdateFileIfDataChanged } from "../../../content/update-file-if-data-changed.decorator";
import { ConfigService } from "nestjs-config";
import { WarframestatDataProvider } from "../../providers/warframestat-data.provider";
import { Task } from "../task.interface";
import { ExecutionContext } from "../../execution-context.interface";

@Injectable()
export class BalorFomorianEventTask implements Task {

    constructor(private readonly config: ConfigService, 
                private readonly warframestatDataProvider: WarframestatDataProvider) {
        this.config = config;
        this.warframestatDataProvider = warframestatDataProvider;
    }

    @UpdateFileIfDataChanged()
    async retrieveNewData(context: ExecutionContext) {
        const eventData = await this.warframestatDataProvider.getEventData(this.config.get('warframestat.events').BALOR_FOMORIAN);
        const eventPlace = eventData.map(data => ({platform: data.platform, place: data.victimNode}))
        return {
            file: 'balor-fomorian-event.md',
            repoFolder: context.repositoryData.directory,
            type: 'content',
            folder: 'content',
            data: {
                eventPlace
            }
        }
    }

}