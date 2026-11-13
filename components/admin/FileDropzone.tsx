"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { cn } from "@/lib/cn";

const DEFAULT_MAX_BYTES = 7 * 1024 * 1024; // matches 7 MB company upload cap

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseAcceptedExtensions(accept: string): string[] {
  return accept
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.startsWith("."));
}

function formatAcceptBadge(accept: string): string {
  const exts = parseAcceptedExtensions(accept).map((ext) => ext.slice(1).toUpperCase());
  return exts.length ? exts.join(" / ") : "FILE";
}

export function FileDropzone({
  name = "file",
  accept,
  multiple = false,
  required = true,
  disabled = false,
  maxBytes = DEFAULT_MAX_BYTES,
  ariaLabel,
  resetToken,
  className,
}: {
  name?: string;
  accept: string;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  maxBytes?: number;
  ariaLabel?: string;
  resetToken?: unknown;
  className?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const clearSelection = () => {
    if (inputRef.current) inputRef.current.value = "";
    setFiles([]);
  };

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const handleReset = () => {
      setFiles([]);
      setClientError(null);
    };
    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, []);

  useEffect(() => {
    if (!resetToken) return;
    if (inputRef.current) inputRef.current.value = "";
    setFiles([]);
    setClientError(null);
  }, [resetToken]);

  const validateAndApply = (incomingList: FileList | File[], syncInputFiles: boolean) => {
    const list = Array.from(incomingList);
    if (!list.length) {
      setFiles([]);
      return;
    }

    const selected = multiple ? list : [list[0]];
    const allowedExts = parseAcceptedExtensions(accept);

    for (const file of selected) {
      const lower = file.name.toLowerCase();
      if (allowedExts.length > 0 && !allowedExts.some((ext) => lower.endsWith(ext))) {
        clearSelection();
        setClientError(`Unsupported format "${file.name}". Expected ${formatAcceptBadge(accept)}.`);
        return;
      }
      if (file.size === 0) {
        clearSelection();
        setClientError(`"${file.name}" is empty.`);
        return;
      }
      if (file.size > maxBytes) {
        clearSelection();
        setClientError(`"${file.name}" exceeds the ${formatBytes(maxBytes)} upload limit.`);
        return;
      }
    }

    if (syncInputFiles && inputRef.current && typeof DataTransfer !== "undefined") {
      const transfer = new DataTransfer();
      for (const file of selected) transfer.items.add(file);
      inputRef.current.files = transfer.files;
    }

    setClientError(null);
    setFiles(selected);
  };

  const totalBytes = files.reduce((acc, file) => acc + file.size, 0);
  const badgeText = formatAcceptBadge(accept);

  return (
    <div className={cn("inline-flex flex-col gap-1", className)}>
      <label
        htmlFor={inputId}
        onDragEnter={(e) => {
          e.preventDefault();
          if (disabled) return;
          dragDepthRef.current += 1;
          setDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepthRef.current = 0;
          setDragActive(false);
          if (disabled) return;
          if (e.dataTransfer.files?.length) {
            validateAndApply(e.dataTransfer.files, true);
          }
        }}
        className={cn(
          "group relative inline-flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg border border-dashed px-3 py-1.5 text-sm transition-colors",
          "has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
          disabled && "pointer-events-none opacity-50",
          dragActive
            ? "border-primary bg-info-soft/70 text-foreground ring-2 ring-ring/30"
            : files.length > 0
              ? "border-primary/40 bg-info-soft/35 text-foreground hover:border-primary/60"
              : "border-border bg-muted/40 text-muted-foreground hover:border-primary/50 hover:bg-muted/70 hover:text-foreground",
          clientError && "border-destructive/60 bg-danger-soft/30",
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          name={name}
          accept={accept}
          multiple={multiple}
          required={required}
          disabled={disabled}
          aria-label={ariaLabel ?? (multiple ? "Choose files to upload" : "Choose file to upload")}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) validateAndApply(e.target.files, false);
          }}
          onInvalid={(e) => {
            e.preventDefault();
            setClientError(multiple ? "Choose at least one file first." : "Choose a file first.");
            inputRef.current?.focus();
          }}
        />

        {files.length === 0 ? (
          <>
            <Upload className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            <span className="font-medium text-foreground">
              {dragActive ? (multiple ? "Drop files here" : "Drop file here") : multiple ? "Drop files or browse" : "Drop file or browse"}
            </span>
            <span className="rounded border bg-background px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-muted-foreground">
              {badgeText}
            </span>
          </>
        ) : (
          <>
            <FileSpreadsheet className="size-4 shrink-0 text-primary" />
            <span
              className="max-w-52 truncate font-medium text-foreground"
              title={files.map((file) => file.name).join(", ")}
            >
              {files.length === 1 ? files[0].name : `${files.length} files (${files[0].name} +${files.length - 1})`}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatBytes(totalBytes)}</span>
            <button
              type="button"
              aria-label="Clear selected file"
              title="Clear selection"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clearSelection();
                setClientError(null);
              }}
              className="ml-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X className="size-3.5" />
            </button>
          </>
        )}
      </label>
      {clientError && (
        <span role="alert" className="text-xs text-destructive">
          {clientError}
        </span>
      )}
    </div>
  );
}
