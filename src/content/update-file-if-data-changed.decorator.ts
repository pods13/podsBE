import { isEqual} from "lodash";
import { join } from "path";
import { Logger } from "@nestjs/common";
import { promises as fsPromises } from "fs";
import * as matter from "gray-matter";
import { ConfigService } from "nestjs-config";
import { FileData } from "./file-data.interface";

export function UpdateFileIfDataChanged(): MethodDecorator {
    return function(target: Function, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function(...args: any[]) {
            const newFileData = await originalMethod.apply(this, args);
            const fileContent = await getFileContent(newFileData);
			const frontMatter = fileContent.data;
            let isChanged = false;
            const watchedObject = onChange(frontMatter, () => {
                frontMatter.date = new Date();
                isChanged = true;
            });
            Object.assign(watchedObject, newFileData.data);

            if(isChanged) {
                await writeNewContent(newFileData, fileContent);
            }
        }

        return descriptor;
    }
}

const getFileContent = async (fileData: FileData): Promise<matter.GrayMatterFile<matter.Input>> => {
	const pathToFile = getPathToFile(fileData);
	try {
		const fileContent: Buffer = await fsPromises.readFile(pathToFile);
		return matter(fileContent, {});
	} catch(e) {
		Logger.error(`Cannot read file ${pathToFile} content: ${e}`);
		throw e;
	}
}

const getPathToFile = (fileData: FileData) => {
	const pathToContentFolder = join(ConfigService.get('app.basedir'), process.env.REPOS_FOLDER, 
		fileData.repoFolder, fileData.type);
	const relativePathToFile = fileData.type === fileData.folder ? fileData.file : join(fileData.folder, fileData.file);
	return join(pathToContentFolder, relativePathToFile);
}

const writeNewContent = async (fileData: FileData, matterFile: matter.GrayMatterFile<matter.Input>) => {
	const pathToFile = getPathToFile(fileData);
	try {
		const fileContent = matter.stringify(matterFile.content, matterFile.data);
		return await fsPromises.writeFile(pathToFile, fileContent);
	} catch(e) {
		Logger.error(`Cannot write new content to ${pathToFile}: ${e}`);
		throw e;
	}
}

const proxyTarget = Symbol('ProxyTarget');
const onChange = (object: any, onChange: any) => {
	const handler = {
		set(target, property, value, receiver) {
			if (value && value[proxyTarget] !== undefined) {
				value = value[proxyTarget];
			}

			const previous = Reflect.get(target, property, receiver);
			const result = Reflect.set(target, property, value);
			if (!isEqual(previous,value)) {
				onChange.call();
			}

			return result;
		}
	};

	return new Proxy(object, handler);
};