import { ConfigService } from "nestjs-config";
import { join } from "path";
import { Clone, Repository, Checkout, CheckoutOptions, Signature, Oid, Commit, Reference, Cred, StatusFile } from "nodegit";
import { Logger } from "@nestjs/common";
import { RepositoryData } from "./repository-data.interface";
import { promises as fsPromises } from "fs";

export function GitRepositoryWorkflow(repositoryData: RepositoryData): MethodDecorator {
    return function(target: Function, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function() {
            const isCloned = await isRepositoryCloned(repositoryData);
            if(!isCloned) {
                await cloneRepository(repositoryData);
            }
            await resetRepoState(repositoryData);

            try {
                await originalMethod.call(this, {repositoryData});
            } catch(e) {
                await resetRepoState(repositoryData);
                Logger.error(`Execution of function failed: ${e}`);
                throw e;
            }

            const isRepositoryChanged = await hasAnyChanges(repositoryData);
            if(isRepositoryChanged) {
                await changeRepositoryState(repositoryData);
                Logger.log(`Repo ${repositoryData.url} state was updated`);
                return true;		
            } else {
                return false;
            }
        }

        return descriptor;
    }
}

const cloneRepository = async(repositoryData: RepositoryData) => {
    const cloneOptions = {
        fetchOpts: {
            callbacks: {
                certificateCheck: skipCertificateCheck
            }
        }
    };

    const pathToRepositoryFolder = getPathToRepositoryFolder(repositoryData);
    try {
        return await Clone.clone(repositoryData.url, pathToRepositoryFolder, cloneOptions);
    } catch(e) {
        Logger.error(`Cannot clone repo ${repositoryData.url} to ${pathToRepositoryFolder}: ${e}`);
        throw e;
    }
}

const skipCertificateCheck = (): number => {
    return 1;
}

const getPathToRepositoryFolder = (repositoryData: RepositoryData): string => {
    return join(ConfigService.get('app.basedir'), process.env.REPOS_FOLDER, repositoryData.directory);
}

const isRepositoryCloned = async (repositoryData: RepositoryData) => {
	try {
		const pathToRepositoryFolder = getPathToRepositoryFolder(repositoryData);
	    await fsPromises.stat(pathToRepositoryFolder);
	} catch(e) {
        if(e.code === 'ENOENT') {
            return false;
        }
        throw e;
	}

	return true;
}

const resetRepoState = async (repositoryData: RepositoryData) => {
    const repository = await openRepository(repositoryData);

    await checkoutRepository(repository);
    await pullRepository(repository, repositoryData);
}

const openRepository = async (repositoryData: RepositoryData): Promise<Repository> => {
    try {
        const pathToRepositoryFolder = getPathToRepositoryFolder(repositoryData);
        return Repository.open(pathToRepositoryFolder);
    } catch(e) {
        Logger.error(`Cannot open repo ${e}`);
        throw e;
    }
}

const checkoutRepository = async (repository: Repository): Promise<void> => {
    let checkoutOptions = new CheckoutOptions();
    checkoutOptions.checkoutStrategy = Checkout.STRATEGY.REMOVE_UNTRACKED | Checkout.STRATEGY.FORCE;
    try {
        return await Checkout.head(repository, checkoutOptions);
    } catch(e) {
        Logger.error(`Cannot checkout repo: ${e}`);
        throw e;
    }
}

const pullRepository = async (repository: Repository, repositoryData: RepositoryData) => {
    const pullOptions = {
        fetchOpts: {
            callbacks: {
                certificateCheck: skipCertificateCheck
            }
        }
    };
    try {
        await repository.fetchAll(pullOptions);
        const branch = repositoryData.branch;
        return await repository.mergeBranches(branch, `origin/${branch}`);
    } catch(e) {
        Logger.error(`Cannot pull repo: ${e}`);
        throw e;
    }
}

const changeRepositoryState = async (repositoryData: RepositoryData): Promise<number> => {
    const repository = await openRepository(repositoryData);
    const author = Signature.now("Clem", "clem@warframeblog.com");
    const message = `Update data: ${new Date().getTime()}`;
    const treeOid = await indexRepositoryChanges(repository);
    const parent = await getLatestHeadCommitOid(repository);

    const commitId = repository.createCommit('HEAD', author, author, message, treeOid, [parent]);

    return await pushRepositoryChanges(repository, repositoryData);
}

const indexRepositoryChanges = async (repository: Repository): Promise<Oid> => {
    try {
        let repositoryIndex = await repository.refreshIndex();

        await repositoryIndex.addAll();
        await repositoryIndex.write();
        return await repositoryIndex.writeTree();
    } catch(e) {
        Logger.error(`Cannot add changed files to index ${e}`);
        throw e;
    }
}

const getLatestHeadCommitOid = async (repository: Repository): Promise<Commit> => {
    try {
        const headRef = await Reference.nameToId(repository, 'HEAD');
        return await repository.getCommit(headRef);
    } catch(e) {
        Logger.error(`Cannot retrieve head commit oid ${e}`);
        throw e;
    }
}

const pushRepositoryChanges = async (repository: Repository, repositoryData: RepositoryData): Promise<number> => {
    const remote = await repository.getRemote('origin');
    const branch = repositoryData.branch;
    const refSpecs = [`refs/heads/${branch}:refs/heads/${branch}`];
    const authenticationCallbacks = {
        certificateCheck: skipCertificateCheck,
        credentials: onCredentialCheck,
        pushUpdateReference: (refname, message) => {
            if(message) {
                Logger.error(`Push was not successfull ${message}`);
            }
        }
    };

    try {
        return await remote.push(refSpecs, { callbacks: authenticationCallbacks });
    } catch(e) {
        Logger.error(`Cannot push changes: ${e}`);
        throw e;
    }
}

const onCredentialCheck = (): Cred => {
    return Cred.userpassPlaintextNew(process.env.GITHUB_TOKEN, 'x-oauth-basic');;
}

const hasAnyChanges = async (repositoryData: RepositoryData): Promise<boolean> => {
    const repository = await openRepository(repositoryData);
    try {
        const changedFiles: StatusFile[] = await repository.getStatus();
        return changedFiles.length > 0;
    } catch(e) {
        Logger.error(`Cannot get status of the repository ${repositoryData.url}: ${e}`);
        throw e;
    }
}