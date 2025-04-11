import { AuthClient } from '@dfinity/auth-client';
import { createActor } from 'declarations/backend';
import { canisterId } from 'declarations/backend/index.js';
import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Toaster, toast } from 'sonner';
import '../index.css';

const network = process.env.DFX_NETWORK;
const identityProvider =
  network === 'ic'
    ? 'https://identity.ic0.app' // Mainnet
    : 'http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943'; // Local

// Format file size utility function
const formatFileSize = (bytes) => {
  if (bytes === 0n || bytes === 0) return '0 Bytes';

  // Convert BigInt to Number if needed
  const bytesNum = typeof bytes === 'bigint' ? Number(bytes) : bytes;

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytesNum) / Math.log(k));
  return parseFloat((bytesNum / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format date utility function
const formatDate = (nanoseconds) => {
  // Convert nanoseconds to milliseconds
  const milliseconds = Number(nanoseconds) / 1_000_000;
  const date = new Date(milliseconds);
  
  // Format the date
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(date);
};

// File type icons mapping
const fileTypeIcons = {
  'application/pdf': '📄',
  'image/jpeg': '🖼️',
  'image/png': '🖼️',
  'text/plain': '📝',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'application/zip': '📦',
  'default': '📄'
};

const getFileExtension = (filename) => {
  return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
};

const generateStructuredFilename = (employeeId, formNumber, originalFile, counter = null) => {
  const year = new Date().getFullYear();
  const extension = getFileExtension(originalFile.name);
  const counterSuffix = counter !== null ? `_${counter}` : '';
  return `${employeeId}_${formNumber}_${year}${counterSuffix}.${extension}`;
};

const parseStructuredFilename = (filename) => {
  const parts = filename.split('_');
  if (parts.length !== 3) return null;

  const [employeeId, formNumber, yearWithExt] = parts;
  const [year, extension] = yearWithExt.split('.');

  return {
    employeeId,
    formNumber,
    year,
    extension
  };
};

const SearchInput = memo(({ value, onFilterChange }) => {
  const searchInputRef = useRef(null);

  const handleSearchChange = (e) => {
    onFilterChange({
      type: 'text',
      value: e.target.value
    });
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search by Employee ID, Form Number, or Year..."
          value={value.text || ''}
          onChange={handleSearchChange}
          className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pl-10 pr-3 text-sm placeholder-gray-500 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="flex gap-2">
        <select
          className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-3 px-4 text-sm text-gray-500 transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={value.filterBy || 'all'}
          onChange={(e) => onFilterChange({ type: 'filterBy', value: e.target.value })}
        >
          <option value="all">Filter By: All</option>
          <option value="employeeId">Employee ID</option>
          <option value="formNumber">Form Number</option>
          <option value="year">Year</option>
        </select>
      </div>
    </div>
  );
});

const UploadDialog = memo(({ isOpen, onClose, onUpload }) => {
  const [files, setFiles] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [formNumbers, setFormNumbers] = useState({});
  const [commonFormNumber, setCommonFormNumber] = useState('');
  const [useCommonForm, setUseCommonForm] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    // Initialize form numbers for new files
    const newFormNumbers = {};
    selectedFiles.forEach(file => {
      newFormNumbers[file.name] = '';
    });
    setFormNumbers(newFormNumbers);
  };

  const handleFormNumberChange = (fileName, value) => {
    setFormNumbers(prev => ({
      ...prev,
      [fileName]: value
    }));
  };

  const handleCommonFormNumberChange = (value) => {
    setCommonFormNumber(value);
    if (useCommonForm) {
      // Apply to all files
      const newFormNumbers = {};
      files.forEach(file => {
        newFormNumbers[file.name] = value;
      });
      setFormNumbers(newFormNumbers);
    }
  };

  const toggleFormMode = () => {
    setUseCommonForm(prev => !prev);
    if (!useCommonForm && commonFormNumber) {
      // Switching to common form - apply common form number to all
      const newFormNumbers = {};
      files.forEach(file => {
        newFormNumbers[file.name] = commonFormNumber;
      });
      setFormNumbers(newFormNumbers);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0 || !employeeId) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (useCommonForm && !commonFormNumber) {
      toast.error('Please provide a form number');
      return;
    }

    // Check if all files have form numbers when using individual forms
    if (!useCommonForm && files.some(file => !formNumbers[file.name])) {
      toast.error('Please provide form numbers for all files');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Group files by extension to handle counters
      const extensionGroups = {};
      files.forEach(file => {
        const ext = getFileExtension(file.name);
        if (!extensionGroups[ext]) {
          extensionGroups[ext] = [];
        }
        extensionGroups[ext].push(file);
      });

      // Upload files sequentially with proper counters
      for (const extension in extensionGroups) {
        const groupFiles = extensionGroups[extension];
        for (let i = 0; i < groupFiles.length; i++) {
          const file = groupFiles[i];
          const formNumber = useCommonForm ? commonFormNumber : formNumbers[file.name];
          // Only add counter if there are multiple files with same extension
          const counter = groupFiles.length > 1 ? i + 1 : null;
          const structuredFilename = generateStructuredFilename(employeeId, formNumber, file, counter);
          
          await onUpload({
            file,
            employeeId,
            formNumber,
            structuredFilename
          });
        }
      }
      
      onClose();
      // Reset form
      setFiles([]);
      setEmployeeId('');
      setFormNumbers({});
      setCommonFormNumber('');
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Upload Files</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Files</label>
            <div className="mt-1">
              <div className="flex items-center justify-center w-full">
                <label className="w-full flex flex-col items-center px-4 py-6 bg-white rounded-lg border-2 border-dashed border-blue-200 cursor-pointer hover:border-blue-300">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-10 h-10 text-blue-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">Multiple files supported</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    multiple
                  />
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Employee ID
            </label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Enter employee ID"
              required
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Form Number
              </label>
              <button
                type="button"
                onClick={toggleFormMode}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {useCommonForm ? 'Use individual form numbers' : 'Use same form number for all'}
              </button>
            </div>

            {useCommonForm ? (
              <input
                type="text"
                value={commonFormNumber}
                onChange={(e) => handleCommonFormNumberChange(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter form number for all files"
                required
              />
            ) : null}
          </div>

          {files.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Selected Files</h3>
              <div className="max-h-48 overflow-y-auto">
                <div className="space-y-2">
                  {files.map((file) => (
                    <div key={file.name} className="flex items-center space-x-4 bg-gray-50 p-3 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                      {!useCommonForm && (
                        <div className="w-1/3">
                          <input
                            type="text"
                            value={formNumbers[file.name] || ''}
                            onChange={(e) => handleFormNumberChange(file.name, e.target.value)}
                            placeholder="Form Number"
                            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            required
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || files.length === 0 || !employeeId || (useCommonForm && !commonFormNumber)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isSubmitting ? 'Uploading...' : `Upload ${files.length} ${files.length === 1 ? 'File' : 'Files'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

const FileUpload = memo(({ onUpload }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsDialogOpen(true)}
        className="w-full cursor-pointer rounded-lg border-2 border-dashed border-blue-200 bg-blue-50 p-12 text-center text-sm text-gray-500 transition-all hover:border-blue-300 focus:outline-none"
      >
        <div className="pointer-events-none flex items-center justify-center">
          <div>
            <svg className="mx-auto h-12 w-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="mt-2 block text-sm font-medium text-blue-600">
              Click here to upload a file
            </span>
          </div>
        </div>
      </button>

      <UploadDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onUpload={onUpload}
      />
    </div>
  );
});

const ConfirmDialog = memo(({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          <p className="mt-2 text-gray-600">{message}</p>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
});

const FileList = memo(({ files, onDownload, onDelete }) => {
  const [confirmDelete, setConfirmDelete] = useState({ show: false, file: null });

  const handleDeleteClick = (file) => {
    setConfirmDelete({ show: true, file });
  };

  const handleDeleteConfirm = () => {
    if (confirmDelete.file) {
      onDelete(confirmDelete.file.name);
    }
    setConfirmDelete({ show: false, file: null });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-4">
      {files.length === 0 ? (
        <div className="col-span-full rounded-xl bg-white p-8 text-center shadow-lg">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="mt-4 text-gray-600">
            {files === null ? 'No files found for this employee ID.' : 'No files uploaded yet.'}
          </p>
        </div>
      ) : (
        files.map((file) => (
          <div
            key={file.name}
            className="group relative overflow-hidden rounded-xl bg-white p-4 shadow-md transition-all hover:shadow-lg"
          >
            <div className="flex items-start space-x-4">
              <div className="text-2xl">{fileTypeIcons[file.fileType] || fileTypeIcons.default}</div>
              <div className="flex-1 space-y-1">
                <h3 className="font-medium text-gray-900 line-clamp-1" title={file.name}>
                  {file.name}
                </h3>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">
                    Employee ID: {file.metadata.employeeId}
                  </p>
                  <p className="text-sm text-gray-500">
                    Form Number: {file.metadata.formNumber}
                  </p>
                  <p className="text-sm text-gray-500">
                    Size: {formatFileSize(file.size)}
                  </p>
                  <p className="text-sm text-gray-500">
                    Uploaded: {formatDate(file.uploadDate)}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => onDownload(file.name)}
                className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 transition-all hover:bg-blue-100"
              >
                Download
              </button>
              <button
                onClick={() => handleDeleteClick(file)}
                className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition-all hover:bg-red-100"
              >
                Delete
              </button>
            </div>
          </div>
        ))
      )}

      <ConfirmDialog
        isOpen={confirmDelete.show}
        onClose={() => setConfirmDelete({ show: false, file: null })}
        onConfirm={handleDeleteConfirm}
        title="Confirm Delete"
        message={`Are you sure you want to delete "${confirmDelete.file?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
});

const Header = memo(({ isAuthenticated, principalId, onCopyPrincipalId, onLogout, onLogin, isLoading }) => (
  <div className="mb-8 flex flex-row items-center justify-between rounded-xl bg-white p-4 shadow-lg">
    <div className="flex items-center space-x-3">
      <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
      <h1 className="text-2xl font-bold text-gray-800">CAO File Vault</h1>
    </div>

    {isAuthenticated ? (
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 rounded-lg bg-gray-50 px-4 py-2 shadow-sm transition-all hover:shadow">
            <span className="text-sm font-medium text-gray-600">Principal ID: </span>
            <span className="font-mono text-sm text-gray-800">
              {principalId ? `${principalId.slice(0, 10)}...${principalId.slice(-5)}` : ''}
            </span>
            <button
              onClick={onCopyPrincipalId}
              className="rounded-full p-1 text-blue-500 transition-colors hover:bg-blue-50 hover:text-blue-600"
              title="Copy Principal ID"
            >
              📋
            </button>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg"
        >
          <span>Logout</span>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    ) : (
      <button
        onClick={onLogin}
        className="flex items-center space-x-2 rounded-lg bg-blue-600 px-6 py-3 text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg"
        disabled={isLoading}
      >
        <span>Login with Internet Identity</span>
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>
      </button>
    )}
  </div>
));

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authClient, setAuthClient] = useState(null);
  const [actor, setActor] = useState(null);
  const [files, setFiles] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [fileTransferProgress, setFileTransferProgress] = useState(null);
  const [principalId, setPrincipalId] = useState('');
  const [searchFilter, setSearchFilter] = useState({ text: '', filterBy: 'all' });
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState({ show: false, type: null, data: null });

  useEffect(() => {
    const init = async () => {
      const toastId = toast.loading('Initializing application...', {
        duration: 0 // Loading toasts should persist until dismissed
      });
      try {
        setIsLoading(true);
        const client = await AuthClient.create();
        setAuthClient(client);
        
        const authenticated = await client.isAuthenticated();
        setIsAuthenticated(authenticated);
        
        if (authenticated) {
          const identity = client.getIdentity();
          const newActor = createActor(canisterId, {
      agentOptions: {
        identity
      }
    });
          setActor(newActor);
          setPrincipalId(identity.getPrincipal().toString());
        }
      } catch (error) {
        console.error('Authentication initialization failed:', error);
        setErrorMessage('Failed to initialize authentication. Please refresh the page.');
        toast.error('Failed to initialize application', { duration: 3000 });
      } finally {
        setIsLoading(false);
        toast.dismiss(toastId);
      }
    };

    init();
  }, []);

  const loadFiles = useCallback(async () => {
    if (!actor) return;
    
    const toastId = toast.loading('Loading files...', {
      duration: 0
    });
    try {
      setIsLoading(true);
      setErrorMessage(''); // Clear any existing error message
      const fileList = await actor.getFiles();
      setFiles(fileList);
      setFilteredFiles(fileList);
      toast.success('Files loaded successfully', { duration: 2000 });
    } catch (error) {
      console.error('Failed to load files:', error);
      toast.error('Failed to load files', { duration: 3000 });
    } finally {
      setIsLoading(false);
      toast.dismiss(toastId);
    }
  }, [actor]);

  const updateActor = useCallback(async () => {
    if (!authClient) return;

    try {
      setIsLoading(true);
      const identity = authClient.getIdentity();
      const newActor = createActor(canisterId, {
        agentOptions: {
          identity
        }
      });
      setActor(newActor);
      setPrincipalId(identity.getPrincipal().toString());
    } catch (error) {
      console.error('Failed to update actor:', error);
      setErrorMessage('Failed to update authentication. Please try logging in again.');
    } finally {
      setIsLoading(false);
    }
  }, [authClient]);

  useEffect(() => {
    if (isAuthenticated && actor) {
      loadFiles();
    } else {
      // Clear files and error message when not authenticated
      setFiles([]);
      setFilteredFiles([]);
      setErrorMessage('');
    }
  }, [isAuthenticated, actor, loadFiles]);

  useEffect(() => {
    if (searchFilter.text.trim() === "") {
      setFilteredFiles(files);
    } else {
      const filtered = files.filter(file => {
        const fileInfo = parseStructuredFilename(file.name);
        if (!fileInfo) return false;

        const searchText = searchFilter.text.toLowerCase();
        
        switch (searchFilter.filterBy) {
          case 'employeeId':
            return fileInfo.employeeId.toLowerCase().includes(searchText);
          case 'formNumber':
            return fileInfo.formNumber.toLowerCase().includes(searchText);
          case 'year':
            return fileInfo.year.includes(searchText);
          default:
            return (
              fileInfo.employeeId.toLowerCase().includes(searchText) ||
              fileInfo.formNumber.toLowerCase().includes(searchText) ||
              fileInfo.year.includes(searchText)
            );
        }
      });
      setFilteredFiles(filtered);
    }
  }, [searchFilter, files]);

  const login = async () => {
    try {
      setIsLoading(true);
      await authClient?.login({
        identityProvider,
        onSuccess: async () => {
          await updateActor();
          setIsAuthenticated(true);
        },
        onError: () => {
          setErrorMessage('Login failed. Please try again.');
          setIsLoading(false);
        }
      });
    } catch (error) {
      console.error('Login failed:', error);
      setErrorMessage('Login failed. Please try again.');
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await authClient?.logout();
      setIsAuthenticated(false);
      setActor(null);
      setPrincipalId('');
      setFiles([]);
      setFilteredFiles([]);
    } catch (error) {
      console.error('Logout failed:', error);
      setErrorMessage('Logout failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyPrincipalId = useCallback(() => {
    navigator.clipboard.writeText(principalId);
    toast.success('Principal ID copied to clipboard!');
  }, [principalId]);

  const handleFilterChange = useCallback(({ type, value }) => {
    setSearchFilter(prev => ({
      ...prev,
      [type]: value
    }));
  }, []);

  const handleFileUpload = useCallback(async ({ file, employeeId, formNumber, structuredFilename }) => {
    if (!file || !employeeId || !formNumber) {
      toast.error('Please provide all required information', { duration: 3000 });
      return;
    }

    const toastId = toast.loading(`Uploading ${structuredFilename}...`, {
      duration: 0
    });

    try {
      const exists = await actor.checkFileExists(structuredFilename);
      if (exists) {
        toast.error(`File "${structuredFilename}" already exists`, { duration: 3000 });
        toast.dismiss(toastId);
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = new Uint8Array(e.target.result);
        const chunkSize = 1024 * 1024; // 1 MB chunks
        const totalChunks = Math.ceil(content.length / chunkSize);

        try {
          for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, content.length);
            const chunk = content.slice(start, end);

            await actor.uploadFileChunk(structuredFilename, chunk, BigInt(i), file.type, employeeId);
            const progress = Math.floor(((i + 1) / totalChunks) * 100);
            toast.loading(`Uploading ${structuredFilename}... ${progress}%`, { 
              id: toastId,
              duration: 0
            });
          }
          toast.success(`${structuredFilename} uploaded successfully`, { duration: 2000 });
          await loadFiles();
        } catch (error) {
          console.error('Upload failed:', error);
          toast.error(`Failed to upload ${structuredFilename}`, { duration: 3000 });
        } finally {
          toast.dismiss(toastId);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(`Failed to upload ${structuredFilename}`, { duration: 3000 });
      toast.dismiss(toastId);
    }
  }, [actor, loadFiles]);

  const handleFileDownload = useCallback(async (name) => {
    const toastId = toast.loading(`Downloading ${name}...`, {
      duration: 0
    });
    try {
      const totalChunks = Number(await actor.getTotalChunks(name));
      const fileType = await actor.getFileType(name)[0];
      let chunks = [];

      for (let i = 0; i < totalChunks; i++) {
        const chunkBlob = await actor.getFileChunk(name, BigInt(i));
        if (chunkBlob) {
          chunks.push(chunkBlob[0]);
        } else {
          throw new Error(`Failed to retrieve chunk ${i}`);
        }

        const progress = Math.floor(((i + 1) / totalChunks) * 100);
        toast.loading(`Downloading ${name}... ${progress}%`, { 
          id: toastId,
          duration: 0
        });
      }

      const data = new Blob(chunks, { type: fileType });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${name} downloaded successfully`, { duration: 2000 });
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(`Failed to download ${name}`, { duration: 3000 });
    } finally {
      toast.dismiss(toastId);
    }
  }, [actor]);

  const handleFileDelete = useCallback(async (name) => {
    const toastId = toast.loading(`Deleting ${name}...`, {
      duration: 0
    });
      try {
        const success = await actor.deleteFile(name);
        if (success) {
          await loadFiles();
        toast.success(`${name} deleted successfully`, { duration: 2000 });
        } else {
        toast.error('Failed to delete file', { duration: 3000 });
        }
      } catch (error) {
        console.error('Delete failed:', error);
      toast.error(`Failed to delete ${name}`, { duration: 3000 });
    } finally {
      toast.dismiss(toastId);
    }
  }, [actor, loadFiles]);

  // Get icon for file type
  const getFileIcon = (fileType) => {
    return fileTypeIcons[fileType] || fileTypeIcons.default;
  };

  if (!isAuthenticated && !isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="container mx-auto p-4">
          <Header
            isAuthenticated={isAuthenticated}
            onLogin={login}
            isLoading={isLoading}
          />
          <div className="mt-8 rounded-xl bg-white p-8 text-center shadow-lg">
            <svg className="mx-auto h-16 w-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h2 className="mt-4 text-xl font-semibold text-gray-800">Please sign in to access the file vault</h2>
            <p className="mt-2 text-gray-600">Secure file storage and management system</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <Toaster 
        position="bottom-right"
        visibleToasts={1} 
        richColors
      />
      <div className="container mx-auto px-4 pt-4">
        <Header
          isAuthenticated={isAuthenticated}
          principalId={principalId}
          onCopyPrincipalId={copyPrincipalId}
          onLogout={logout}
          onLogin={login}
          isLoading={isLoading}
        />
      </div>
      <div className="container mx-auto px-4 flex flex-col gap-4">
        {!isAuthenticated && !isLoading ? (
          <div className="rounded-xl bg-white p-8 text-center shadow-lg">
            <svg className="mx-auto h-16 w-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h2 className="mt-4 text-xl font-semibold text-gray-800">Please sign in to access the file vault</h2>
            <p className="mt-2 text-gray-600">Secure file storage and management system</p>
        </div>
      ) : (
          <>
            <div className="rounded-xl bg-white p-6 shadow-lg">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className='col-span-2'>
                  <FileUpload onUpload={handleFileUpload} />
                </div>
                <SearchInput
                  value={searchFilter}
                  onFilterChange={handleFilterChange}
            />
          </div>
            </div>

            {errorMessage && (
              <div className="animate-fade-in rounded-lg border-l-4 border-red-500 bg-red-50 p-4 shadow-md">
                <div className="flex items-center space-x-3">
                  <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-red-600">{errorMessage}</span>
                </div>
              </div>
            )}

            <FileList
              files={filteredFiles}
              onDownload={handleFileDownload}
              onDelete={handleFileDelete}
            />
          </>
        )}
        </div>
    </div>
  );
}

export default App;
