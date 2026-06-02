import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadIcon } from "./Icons.jsx";

export default function UploadZone({ onUpload, uploading, progress }) {
  const onDrop = useCallback(
    (files) => {
      if (files.length) onUpload(files[0]);
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    disabled: uploading,
  });

  return (
    <div
      {...getRootProps()}
      className={`rounded-lg border border-dashed p-6 text-center cursor-pointer transition-colors
        ${isDragActive ? "border-neutral-500 bg-neutral-900" : "border-border hover:border-neutral-700"}
        ${uploading ? "cursor-wait" : ""}`}
    >
      <input {...getInputProps()} />
      {uploading ? (
        <div className="space-y-3">
          <div className="mx-auto w-5 h-5 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
          <p className="text-sm text-neutral-300">Indexing… {progress}%</p>
          <div className="w-full bg-neutral-900 rounded-full h-1 overflow-hidden">
            <div
              className="h-1 rounded-full bg-white transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] font-mono text-neutral-600">
            extract · chunk · embed · store
          </p>
        </div>
      ) : (
        <>
          <UploadIcon size={20} className="mx-auto mb-2.5 text-neutral-500" />
          <p className="text-sm text-neutral-200">
            {isDragActive ? "Drop to upload" : "Drag & drop a PDF"}
          </p>
          <p className="text-[11px] font-mono text-neutral-600 mt-1">
            or click to browse · max 10MB
          </p>
        </>
      )}
    </div>
  );
}
