export const idlFactory = ({ IDL }) => {
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
              'name' : IDL.Text,
              'size' : IDL.Nat,
              'fileType' : IDL.Text,
              'employeeId' : IDL.Text,
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
              'name' : IDL.Text,
              'size' : IDL.Nat,
              'fileType' : IDL.Text,
              'employeeId' : IDL.Text,
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
