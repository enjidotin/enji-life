"use client";

import { useMutation, useQuery } from "convex/react";
import { FormEvent, useRef, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  PageHeader,
  dangerButtonClass,
  formatDate,
  inputClass,
  primaryButtonClass,
} from "@/components/ui";

export default function PhotosPage() {
  const photos = useQuery(api.photos.list);
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const savePhoto = useMutation(api.photos.save);
  const removePhoto = useMutation(api.photos.remove);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [weight, setWeight] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const postUrl = await generateUploadUrl();
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error("Upload failed");
      const { storageId } = (await result.json()) as {
        storageId: string;
      };
      await savePhoto({
        storageId: storageId as never,
        caption: caption.trim() || undefined,
        weight: weight ? Number(weight) : undefined,
      });
      setFile(null);
      setCaption("");
      setWeight("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Progress photos"
        description="Upload photos to see your change over time."
      />

      <Card className="mb-6">
        <form
          onSubmit={onSubmit}
          className="grid grid-cols-2 gap-3 sm:grid-cols-6"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="col-span-2 rounded-md border border-dashed border-neutral-300 p-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white sm:col-span-3 dark:border-neutral-700 dark:file:bg-neutral-100 dark:file:text-neutral-900"
            required
          />
          <input
            className={inputClass}
            placeholder="Weight (optional)"
            type="number"
            inputMode="decimal"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <input
            className={`${inputClass} sm:col-span-1`}
            placeholder="Caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <button
            type="submit"
            disabled={uploading || !file}
            className={`${primaryButtonClass} col-span-2 sm:col-span-1`}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
          {error && (
            <p className="col-span-2 text-sm text-red-600 sm:col-span-6 dark:text-red-400">
              {error}
            </p>
          )}
        </form>
      </Card>

      {photos === undefined ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : photos.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-400">No photos yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {photos.map((p) => (
            <Card key={p._id} className="flex flex-col gap-3 p-0">
              {p.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.url}
                  alt={p.caption ?? "Progress photo"}
                  className="aspect-square w-full rounded-t-2xl object-cover"
                />
              )}
              <div className="flex items-start justify-between gap-2 px-4 pb-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {p.caption ?? formatDate(p.takenAt)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {formatDate(p.takenAt)}
                    {p.weight != null && ` · ${p.weight}`}
                  </div>
                </div>
                <button
                  onClick={() => removePhoto({ id: p._id })}
                  className={dangerButtonClass}
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
