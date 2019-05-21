import { NestSchedule, Interval } from "nest-schedule";
import { Injectable, Inject } from "@nestjs/common";
import { GitRepositoryWorkflow } from "../repositories/git-repository-workflow.decorator";
import { Task } from "./tasks/task.interface";
import { ExecutionContext } from "./execution-context.interface";

@Injectable()
export class ScheduleService extends NestSchedule {

    constructor(@Inject('EVENT_DATA_TASKS') private readonly eventDataTasks: Task[]) {
        super();
        this.eventDataTasks = eventDataTasks;
    }

    @Interval(5000)
    @GitRepositoryWorkflow({
        url: process.env.WARFRAMEBLOG_REPO_URL, 
        directory: 'warframeblog', 
        branch: 'develop'
    })
    async updateWarframeBlogData(context: ExecutionContext) {
        const tasks = this.eventDataTasks;

        return await Promise.all(tasks.map(task => task.retrieveNewData(context)));
    }
}