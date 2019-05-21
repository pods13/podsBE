import { FileData } from "../../content/file-data.interface";
import { ExecutionContext } from "../execution-context.interface";

export interface Task {

    retrieveNewData(context: ExecutionContext): Promise<FileData>;
}