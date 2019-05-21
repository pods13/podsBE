import { Injectable, Logger } from "@nestjs/common";
import Axios from "axios";
import { ConfigService } from "nestjs-config";
import * as _ from 'lodash';

@Injectable()
export class WarframestatDataProvider {

    private readonly logger: Logger;

    constructor(private readonly config: ConfigService) {
        this.logger = new Logger(WarframestatDataProvider.name);
        this.config = config;
    }

    async getEventData(eventName: string) {
        const platforms = this.config.get('warframestat.platforms');
        const getEventByPlatforms = _.map(platforms, (platform) => this.getEventByPlatform(eventName, platform));

        try {
            const eventData = await Promise.all(getEventByPlatforms);
            return eventData.filter(e => _.keys(e).length !== 0);
        } catch(e) {
            this.logger.error(e)
        }
    }

    private async getEventByPlatform(eventName: string, platform: any) {
        const events = await this.getEventsByPlatform(platform);
        const event = events.find(event => event.description.includes(eventName));
        return event ? Object.assign(event, {platform: platform.name}) : {};
    }

    private async getEventsByPlatform(platform: any): Promise<Array<any>> {
        const eventsUrl = `${process.env.WARFRAMESTAT_API_URL}/${platform.id}/events`;
        try {
            const response = await Axios.get(eventsUrl);
            return response.data;
        } catch(e) {
            this.logger.error(`Cannot retrieve data by url ${eventsUrl}: ${e}`);
        }
    }
}