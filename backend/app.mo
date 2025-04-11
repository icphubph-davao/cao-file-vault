import Bool "mo:base/Bool";
import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Error "mo:base/Error";
import HashMap "mo:map/Map";
import { phash; thash } "mo:map/Map";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import Text "mo:base/Text";
import Option "mo:base/Option";
import Time "mo:base/Time";

persistent actor Filevault {

  // Define a data type for a file's chunks.
  type FileChunk = {
    chunk : Blob;
    index : Nat;
  };

  // Define a data type for file metadata
  type FileMetadata = {
    employeeId : Text;
    formNumber : Text;
    year : Text;
    extension : Text;
  };

  // Define a data type for a file's data.
  type File = {
    name : Text;
    chunks : [FileChunk];
    totalSize : Nat;
    fileType : Text;
    owner : Principal;
    metadata : FileMetadata;
    uploadDate : Int; // Timestamp in nanoseconds
  };

  // Define a data type for storing files associated with a user principal.
  type UserFiles = HashMap.Map<Text, File>;

  // HashMap to store the user data
  private var files = HashMap.new<Principal, UserFiles>();

  // Parse structured filename into components
  private func parseFileName(name : Text) : ?FileMetadata {
    let parts = Text.split(name, #char '_');
    let partsArray = Iter.toArray(parts);
    
    if (partsArray.size() < 3) {
      return null;
    };

    // Handle optional counter in the filename
    let yearAndExt = if (partsArray.size() == 4) {
      // If we have 4 parts, the last part is the counter_year.extension
      Text.split(partsArray[3], #char '.');
    } else {
      // If we have 3 parts, the last part is the year.extension
      Text.split(partsArray[2], #char '.');
    };

    let yearExtArray = Iter.toArray(yearAndExt);
    
    if (yearExtArray.size() != 2) {
      return null;
    };

    ?{
      employeeId = partsArray[0];
      formNumber = partsArray[1];
      year = yearExtArray[0];
      extension = yearExtArray[1];
    };
  };

  // Return files associated with a user's principal.
  private func getUserFiles(user : Principal) : UserFiles {
    switch (HashMap.get(files, phash, user)) {
      case null {
        let newFileMap = HashMap.new<Text, File>();
        let _ = HashMap.put(files, phash, user, newFileMap);
        newFileMap;
      };
      case (?existingFiles) existingFiles;
    };
  };

  // Check if a file name already exists for the user.
  public shared (msg) func checkFileExists(name : Text) : async Bool {
    Option.isSome(HashMap.get(getUserFiles(msg.caller), thash, name));
  };

  // Upload a file in chunks.
  public shared (msg) func uploadFileChunk(name : Text, chunk : Blob, index : Nat, fileType : Text, employeeId : Text) : async () {
    let userFiles = getUserFiles(msg.caller);
    let fileChunk = { chunk = chunk; index = index };

    // Parse filename to get metadata
    let metadata = switch (parseFileName(name)) {
      case null {
        // If filename doesn't match expected format, return error
        throw Error.reject("Invalid filename format. Expected: employeeId_formNumber_year.extension");
      };
      case (?meta) meta;
    };

    switch (HashMap.get(userFiles, thash, name)) {
      case null {
        let _ = HashMap.put(userFiles, thash, name, { 
          name = name; 
          chunks = [fileChunk]; 
          totalSize = chunk.size(); 
          fileType = fileType;
          owner = msg.caller;
          metadata = metadata;
          uploadDate = Time.now();
        });
      };
      case (?existingFile) {
        let updatedChunks = Array.append(existingFile.chunks, [fileChunk]);
        let _ = HashMap.put(
          userFiles,
          thash,
          name,
          {
            name = name;
            chunks = updatedChunks;
            totalSize = existingFile.totalSize + chunk.size();
            fileType = fileType;
            owner = msg.caller;
            metadata = metadata;
            uploadDate = existingFile.uploadDate;
          }
        );
      };
    };
  };

  // Return list of files for a user.
  public shared (msg) func getFiles() : async [{ name : Text; size : Nat; fileType : Text; owner : Principal; metadata : FileMetadata; uploadDate : Int }] {
    Iter.toArray(
      Iter.map(
        HashMap.vals(getUserFiles(msg.caller)),
        func(file : File) : { name : Text; size : Nat; fileType : Text; owner : Principal; metadata : FileMetadata; uploadDate : Int } {
          {
            name = file.name;
            size = file.totalSize;
            fileType = file.fileType;
            owner = file.owner;
            metadata = file.metadata;
            uploadDate = file.uploadDate;
          };
        }
      )
    );
  };

  // Get files by employee ID
  public shared (msg) func getFilesByEmployeeId(employeeId : Text) : async [{ name : Text; size : Nat; fileType : Text; owner : Principal; metadata : FileMetadata; uploadDate : Int }] {
    let userFiles = await getFiles();
    Array.filter(userFiles, func(file : { name : Text; size : Nat; fileType : Text; owner : Principal; metadata : FileMetadata; uploadDate : Int }) : Bool {
      file.metadata.employeeId == employeeId;
    });
  };

  // Get files by form number
  public shared (msg) func getFilesByFormNumber(formNumber : Text) : async [{ name : Text; size : Nat; fileType : Text; owner : Principal; metadata : FileMetadata; uploadDate : Int }] {
    let userFiles = await getFiles();
    Array.filter(userFiles, func(file : { name : Text; size : Nat; fileType : Text; owner : Principal; metadata : FileMetadata; uploadDate : Int }) : Bool {
      file.metadata.formNumber == formNumber;
    });
  };

  // Get files by year
  public shared (msg) func getFilesByYear(year : Text) : async [{ name : Text; size : Nat; fileType : Text; owner : Principal; metadata : FileMetadata; uploadDate : Int }] {
    let userFiles = await getFiles();
    Array.filter(userFiles, func(file : { name : Text; size : Nat; fileType : Text; owner : Principal; metadata : FileMetadata; uploadDate : Int }) : Bool {
      file.metadata.year == year;
    });
  };

  // Return total chunks for a file
  public shared (msg) func getTotalChunks(name : Text) : async Nat {
    switch (HashMap.get(getUserFiles(msg.caller), thash, name)) {
      case null 0;
      case (?file) file.chunks.size();
    };
  };

  // Return specific chunk for a file.
  public shared (msg) func getFileChunk(name : Text, index : Nat) : async ?Blob {
    switch (HashMap.get(getUserFiles(msg.caller), thash, name)) {
      case null null;
      case (?file) {
        switch (Array.find(file.chunks, func(chunk : FileChunk) : Bool { chunk.index == index })) {
          case null null;
          case (?foundChunk) ?foundChunk.chunk;
        };
      };
    };
  };

  // Get file's type.
  public shared (msg) func getFileType(name : Text) : async ?Text {
    switch (HashMap.get(getUserFiles(msg.caller), thash, name)) {
      case null null;
      case (?file) ?file.fileType;
    };
  };

  // Delete a file.
  public shared (msg) func deleteFile(name : Text) : async Bool {
    Option.isSome(HashMap.remove(getUserFiles(msg.caller), thash, name));
  };
};
