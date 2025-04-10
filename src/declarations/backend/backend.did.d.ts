import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface _SERVICE {
  'checkFileExists' : ActorMethod<[string], boolean>,
  'deleteFile' : ActorMethod<[string], boolean>,
  'getFileChunk' : ActorMethod<[string, bigint], [] | [Uint8Array | number[]]>,
  'getFileType' : ActorMethod<[string], [] | [string]>,
  'getFiles' : ActorMethod<
    [],
    Array<
      {
        'owner' : Principal,
        'name' : string,
        'size' : bigint,
        'fileType' : string,
        'employeeId' : string,
      }
    >
  >,
  'getFilesByEmployeeId' : ActorMethod<
    [string],
    Array<
      {
        'owner' : Principal,
        'name' : string,
        'size' : bigint,
        'fileType' : string,
        'employeeId' : string,
      }
    >
  >,
  'getTotalChunks' : ActorMethod<[string], bigint>,
  'uploadFileChunk' : ActorMethod<
    [string, Uint8Array | number[], bigint, string, string],
    undefined
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
