import fileDirectory, { Contents } from '../shared/fileDirectory';

const getFileContents = (path: string[], fileName: string): Contents => {
  let root = fileDirectory['/']?.contents;

  for (let i = 0; i < path.length; i++) {
    const current = path[i] || '/';
    if (typeof root !== 'string') {
      // @ts-ignore
      const f = root?.[current]?.contents?.[fileName];
      if (f?.fileType === 'file') {
        // @ts-ignore
        return root?.[current]?.contents?.[fileName]?.contents as string;
      }
      root = root?.[current]?.contents;
    }
  }

  return root;
};

export default getFileContents;
