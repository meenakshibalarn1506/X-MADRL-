import { useRef, useState } from "react";
import { Camera, X, Loader2, Check, TriangleAlert } from "lucide-react";

import { base44 } from "@/api/base44Client";

const MAX_PHOTOS = 5;
const MAX_SIZE_MB = 5;

/**
 * Multi-photo uploader with local preview, sequential private upload, and
 * genuine per-file success/failure status. Calls `onChange(fileUris)` with the
 * array of successfully uploaded private file URIs whenever the set changes.
 *
 * Local previews are clearly marked as "uploading" until the upload succeeds —
 * a preview is never shown as though the file is already permanently stored.
 */
export default function MultiPhotoUpload({ onChange }) {
  const [items, setItems] = useState([]); // {id, file, previewUrl, file_uri, status}
  const [error, setError] = useState(null);
  const idRef = useRef(0);

  const notify = (current) => {
    const uris = current.filter((it) => it.status === "done" && it.file_uri).map((it) => it.file_uri);
    onChange?.(uris);
  };

  const addFiles = async (files) => {
    setError(null);
    const valid = [];
    for (const f of files) {
      if (!f.type.startsWith("image/")) {
        setError(`${f.name} is not an image — only photos are accepted.`);
        continue;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`${f.name} exceeds ${MAX_SIZE_MB} MB.`);
        continue;
      }
      valid.push(f);
    }
    const done = items.filter((it) => it.status === "done").length;
    const remaining = MAX_PHOTOS - done;
    if (valid.length > remaining) {
      setError(`You can attach at most ${remaining} more photo${remaining !== 1 ? "s" : ""} (limit ${MAX_PHOTOS}).`);
      valid.splice(remaining);
    }
    if (valid.length === 0) return;

    const newItems = valid.map((f) => ({
      id: ++idRef.current,
      file: f,
      previewUrl: URL.createObjectURL(f),
      file_uri: null,
      status: "pending",
    }));
    setItems((prev) => [...prev, ...newItems]);

    for (const item of newItems) {
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: "uploading" } : it)));
      try {
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: item.file });
        setItems((prev) => {
          const next = prev.map((it) => (it.id === item.id ? { ...it, file_uri, status: "done" } : it));
          notify(next);
          return next;
        });
      } catch {
        setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: "error" } : it)));
        setError("Upload failed for " + item.file.name);
      }
    }
  };

  const removeItem = (id) => {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((it) => it.id !== id);
      notify(next);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-[12.5px] text-muted-foreground transition-colors hover:border-primary">
        <Camera className="h-4 w-4" />
        {`Attach photos (optional, up to ${MAX_PHOTOS}, ${MAX_SIZE_MB} MB each)`}
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) addFiles(files);
            e.target.value = "";
          }}
        />
      </label>

      {error && (
        <p className="flex items-center gap-1.5 text-[11px] text-risk-severe">
          <TriangleAlert className="h-3 w-3" />
          {error}
        </p>
      )}

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((it) => (
            <div
              key={it.id}
              className={
                "relative h-16 w-16 overflow-hidden rounded-lg border " +
                (it.status === "done" ? "border-risk-low/50" : it.status === "error" ? "border-risk-severe/50" : "border-primary/40")
              }
            >
              <img src={it.previewUrl} alt={it.file.name} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeItem(it.id)}
                className="absolute right-0 top-0 rounded-bl-md bg-background/80 p-0.5"
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
              {it.status === "uploading" && (
                <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </span>
              )}
              {it.status === "done" && (
                <span className="absolute bottom-0 right-0 rounded-tl-md bg-risk-low/80 p-0.5">
                  <Check className="h-3 w-3 text-risk-low-foreground" />
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[10.5px] text-muted-foreground">
        Photos are stored privately. Only signed-in users of this app can open them.
      </p>
    </div>
  );
}