import { ipcMain } from 'electron';
import simpleGit, { SimpleGit, StatusResult } from 'simple-git';

function getGit(repoPath: string): SimpleGit {
  return simpleGit(repoPath);
}

export function registerGitHandlers() {
  ipcMain.handle('git:status', async (_, repoPath: string) => {
    const git = getGit(repoPath);
    const status: StatusResult = await git.status();
    return {
      modified: status.modified,
      added: status.created,
      deleted: status.deleted,
      renamed: status.renamed.map((r) => r.to),
      untracked: status.not_added,
      staged: status.staged,
      branch: status.current || 'HEAD',
      ahead: status.ahead,
      behind: status.behind,
    };
  });

  ipcMain.handle('git:stage', async (_, repoPath: string, files: string[]) => {
    const git = getGit(repoPath);
    await git.add(files);
  });

  ipcMain.handle('git:unstage', async (_, repoPath: string, files: string[]) => {
    const git = getGit(repoPath);
    await git.reset(['HEAD', '--', ...files]);
  });

  ipcMain.handle('git:commit', async (_, repoPath: string, message: string) => {
    const git = getGit(repoPath);
    await git.commit(message);
  });

  ipcMain.handle('git:diff', async (_, repoPath: string, filePath: string) => {
    const git = getGit(repoPath);
    return git.diff(['--', filePath]);
  });

  ipcMain.handle('git:branches', async (_, repoPath: string) => {
    const git = getGit(repoPath);
    const summary = await git.branch();
    return {
      current: summary.current,
      all: summary.all,
    };
  });

  ipcMain.handle('git:checkout', async (_, repoPath: string, branch: string) => {
    const git = getGit(repoPath);
    await git.checkout(branch);
  });
}
