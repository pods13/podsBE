import { Injectable } from "@nestjs/common";
import { ConfigService } from "nestjs-config";
import { WarframestatDataProvider } from "../../providers/warframestat-data.provider";
import { UpdateFileIfDataChanged } from "../../../content/update-file-if-data-changed.decorator";
import { Task } from "../task.interface";
import { ExecutionContext } from "../../execution-context.interface";

@Injectable()
export class ThermiaFracturesEventTask implements Task {
    
    constructor(private readonly config: ConfigService, 
                private readonly warframestatDataProvider: WarframestatDataProvider) {
        this.config = config;
        this.warframestatDataProvider = warframestatDataProvider;
    }
    
    @UpdateFileIfDataChanged()
    async retrieveNewData(context: ExecutionContext) {
        const eventData = await this.warframestatDataProvider.getEventData(this.config.get('warframestat.events').THERMIA_FRACTURES);
        const availableOn = eventData.map(data => ({platform: data.platform}))
        return {
            file: 'thermia-fractures-event-guide.md',
            repoFolder: context.repositoryData.directory,
            type: 'content',
            folder: 'content',
            data: {
                availableOn
            }
        }
    }
}