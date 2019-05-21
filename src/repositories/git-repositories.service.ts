import { Injectable, Inject, Logger } from "@nestjs/common";
import { Clone, Repository, CheckoutOptions, Checkout, Signature, Oid, Reference, Commit, Cred } from "nodegit";
import { RepositoryData } from "./repository-data.interface";
import { join } from "path";
import {ConfigService} from 'nestjs-config';

@Injectable()
export class GitRepositoriesService {

    private readonly logger: Logger;

    constructor(private readonly config: ConfigService) {
        this.logger = new Logger(GitRepositoriesService.name);
        this.config = config;
    }
    
    async cloneRepository(repositoryData: RepositoryData) {
        const cloneOptions = {
            fetchOpts: {
                callbacks: {
                    certificateCheck: this.skipCertificateCheck
                }
            }
        };

        const pathToRepositoryFolder = this.getPathToRepositoryFolder(repositoryData);
        try {
            return await Clone.clone(repositoryData.url, pathToRepositoryFolder, cloneOptions);
        } catch(e) {
            this.logger.error(`Cannot clone repo ${repositoryData.url} to ${pathToRepositoryFolder}: ${e}`);
            throw e;
        }
    }

    private skipCertificateCheck(): number {
        return 1;
    }

    private getPathToRepositoryFolder(repositoryData: RepositoryData): string {
        return join(this.config.get('app.basedir'), process.env.REPOS_FOLDER, repositoryData.directory);
    }

    async resetRepoState(repositoryData: RepositoryData) {
        const repository = await this.openRepository(repositoryData);
    
        await this.checkoutRepository(repository);
        await this.pullRepository(repository, repositoryData);
    }

    private async openRepository(repositoryData: RepositoryData): Promise<Repository> {
        try {
            const pathToRepositoryFolder = this.getPathToRepositoryFolder(repositoryData);
            return Repository.open(pathToRepositoryFolder);
        } catch(e) {
            this.logger.error(`Cannot open repo ${e}`);
            throw e;
        }
    }

    private async checkoutRepository(repository: Repository): Promise<void> {
        let checkoutOptions = new CheckoutOptions();
        checkoutOptions.checkoutStrategy = Checkout.STRATEGY.REMOVE_UNTRACKED | Checkout.STRATEGY.FORCE;
        try {
            return await Checkout.head(repository, checkoutOptions);
        } catch(e) {
            this.logger.error(`Cannot checkout repo: ${e}`);
            throw e;
        }
    }

    private async pullRepository(repository: Repository, repositoryData: RepositoryData) {
        const pullOptions = {
            fetchOpts: {
                callbacks: {
                    certificateCheck: this.skipCertificateCheck
                }
            }
        };
        try {
            await repository.fetchAll(pullOptions);
            const branch = repositoryData.branch;
            return await repository.mergeBranches(branch, `origin/${branch}`);
        } catch(e) {
            this.logger.error(`Cannot pull repo: ${e}`);
            throw e;
        }
    }

    async changeRepositoryState(repositoryData: RepositoryData): Promise<number> {
        const repository = await this.openRepository(repositoryData);
        const author = Signature.now("Clem", "clem@warframeblog.com");
        const message = `Update data: ${new Date().getTime()}`;
        const treeOid = await this.indexRepositoryChanges(repository);
        const parent = await this.getLatestHeadCommitOid(repository);
    
        const commitId = repository.createCommit('HEAD', author, author, message, treeOid, [parent]);

        return await this.pushRepositoryChanges(repository, repositoryData);
    }

    private async indexRepositoryChanges(repository: Repository): Promise<Oid> {
        try {
            let repositoryIndex = await repository.refreshIndex();
    
            await repositoryIndex.addAll();
            await repositoryIndex.write();
            return await repositoryIndex.writeTree();
        } catch(e) {
            this.logger.error(`Cannot add changed files to index ${e}`);
            throw e;
        }
    }

    private async getLatestHeadCommitOid(repository: Repository): Promise<Commit> {
        try {
            const headRef = await Reference.nameToId(repository, 'HEAD');
            return await repository.getCommit(headRef);
        } catch(e) {
            this.logger.error(`Cannot retrieve head commit oid ${e}`);
            throw e;
        }
    }

    private async pushRepositoryChanges(repository: Repository, repositoryData: RepositoryData): Promise<number> {
        const remote = await repository.getRemote('origin');
        const branch = repositoryData.branch;
        const refSpecs = [`refs/heads/${branch}:refs/heads/${branch}`];
        const authenticationCallbacks = {
            certificateCheck: this.skipCertificateCheck,
            credentials: this.onCredentialCheck,
            pushUpdateReference: (refname, message) => {
                if(message) {
                    this.logger.error(`Push was not successfull ${message}`);
                }
            }
        };
    
        try {
            return await remote.push(refSpecs, { callbacks: authenticationCallbacks });
        } catch(e) {
            this.logger.error(`Cannot push changes: ${e}`);
            throw e;
        }
    }
    
    private onCredentialCheck(): Cred {
        return Cred.userpassPlaintextNew(process.env.GITHUB_TOKEN, 'x-oauth-basic');;
    }
}