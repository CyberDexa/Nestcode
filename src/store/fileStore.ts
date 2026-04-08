import { create } from 'zustand';

export type FileEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
  isExpanded?: boolean;
};

type FileStore = {
  rootPath: string | null;
  rootName: string;
  tree: FileEntry[];
  loading: boolean;

  setRootPath: (path: string) => void;
  setTree: (tree: FileEntry[]) => void;
  setLoading: (loading: boolean) => void;
  toggleExpanded: (path: string) => void;
  updateChildren: (parentPath: string, children: FileEntry[]) => void;
};

export const useFileStore = create<FileStore>((set) => ({
  rootPath: null,
  rootName: '',
  tree: [],
  loading: false,

  setRootPath: (path) => {
    const name = path.split('/').pop() || path;
    set({ rootPath: path, rootName: name });
  },

  setTree: (tree) => set({ tree }),
  setLoading: (loading) => set({ loading }),

  toggleExpanded: (path) => {
    set((s) => ({
      tree: toggleInTree(s.tree, path),
    }));
  },

  updateChildren: (parentPath, children) => {
    set((s) => ({
      tree: updateChildrenInTree(s.tree, parentPath, children),
    }));
  },
}));

function toggleInTree(tree: FileEntry[], targetPath: string): FileEntry[] {
  return tree.map((entry) => {
    if (entry.path === targetPath) {
      return { ...entry, isExpanded: !entry.isExpanded };
    }
    if (entry.children) {
      return { ...entry, children: toggleInTree(entry.children, targetPath) };
    }
    return entry;
  });
}

function updateChildrenInTree(
  tree: FileEntry[],
  parentPath: string,
  children: FileEntry[]
): FileEntry[] {
  return tree.map((entry) => {
    if (entry.path === parentPath) {
      return { ...entry, children, isExpanded: true };
    }
    if (entry.children) {
      return {
        ...entry,
        children: updateChildrenInTree(entry.children, parentPath, children),
      };
    }
    return entry;
  });
}
