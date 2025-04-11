export const idlFactory = ({ IDL }) => {
  const FileMetadata = IDL.Record({
    'formNumber' : IDL.Text,
    'year' : IDL.Text,
    'employeeId' : IDL.Text,
    'extension' : IDL.Text,
  });
  return IDL.Service({
    'checkFileExists' : IDL.Func([IDL.Text], [IDL.Bool], []),
    'deleteFile' : IDL.Func([IDL.Text], [IDL.Bool], []),
    'getFileChunk' : IDL.Func(
        [IDL.Text, IDL.Nat],
        [IDL.Opt(IDL.Vec(IDL.Nat8))],
        [],
      ),
    'getFileType' : IDL.Func([IDL.Text], [IDL.Opt(IDL.Text)], []),
    'getFiles' : IDL.Func(
        [],
        [
          IDL.Vec(
            IDL.Record({
              'owner' : IDL.Principal,
              'metadata' : FileMetadata,
              'name' : IDL.Text,
              'size' : IDL.Nat,
              'fileType' : IDL.Text,
              'uploadDate' : IDL.Int,
            })
          ),
        ],
        [],
      ),
    'getFilesByEmployeeId' : IDL.Func(
        [IDL.Text],
        [
          IDL.Vec(
            IDL.Record({
              'owner' : IDL.Principal,
              'metadata' : FileMetadata,
              'name' : IDL.Text,
              'size' : IDL.Nat,
              'fileType' : IDL.Text,
              'uploadDate' : IDL.Int,
            })
          ),
        ],
        [],
      ),
    'getFilesByFormNumber' : IDL.Func(
        [IDL.Text],
        [
          IDL.Vec(
            IDL.Record({
              'owner' : IDL.Principal,
              'metadata' : FileMetadata,
              'name' : IDL.Text,
              'size' : IDL.Nat,
              'fileType' : IDL.Text,
              'uploadDate' : IDL.Int,
            })
          ),
        ],
        [],
      ),
    'getFilesByYear' : IDL.Func(
        [IDL.Text],
        [
          IDL.Vec(
            IDL.Record({
              'owner' : IDL.Principal,
              'metadata' : FileMetadata,
              'name' : IDL.Text,
              'size' : IDL.Nat,
              'fileType' : IDL.Text,
              'uploadDate' : IDL.Int,
            })
          ),
        ],
        [],
      ),
    'getTotalChunks' : IDL.Func([IDL.Text], [IDL.Nat], []),
    'uploadFileChunk' : IDL.Func(
        [IDL.Text, IDL.Vec(IDL.Nat8), IDL.Nat, IDL.Text, IDL.Text],
        [],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
