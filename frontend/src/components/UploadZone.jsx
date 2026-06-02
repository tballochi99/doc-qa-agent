import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

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
      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition
        ${isDragActive ? "border-navy bg-blue-50" : "border-slate-300 bg-white hover:border-navy/60"}
        ${uploading ? "opacity-70 cursor-wait" : ""}`}
    >
      <input {...getInputProps()} />
      {uploading ? (
        <div className="space-y-2">
          <div className="animate-spin mx-auto w-6 h-6 border-2 border-navy border-t-transparent rounded-full" />
          <p className="text-sm text-slate-600">Indexing document… {progress}%</p>
          <div className="w-full bg-slate-200 rounded-full h-1.5">
            <div
              className="bg-navy h-1.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="text-3xl mb-1">📄</div>
          <p className="text-sm font-medium text-navy">
            {isDragActive ? "Drop your PDF here" : "Drag & drop a PDF"}
          </p>
          <p className="text-xs text-slate-400 mt-1">or click to browse · max 10MB</p>
        </>
      )}
    </div>
  );
}
