import { ChangeEvent, useRef, useState } from 'react';
import { Paperclip, Upload } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import type { FileAttachment } from '@collab/types';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function FileAttachments({
  documentId,
  files,
  canEdit,
  editor,
  onUploaded,
}: {
  documentId: string;
  files: FileAttachment[];
  canEdit: boolean;
  editor: Editor | null;
  onUploaded: (file: FileAttachment) => void;
}) {
  const { token } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !token) {
      return;
    }

    setUploading(true);

    try {
      const presigned = await api.createUpload(token, documentId, file);
      await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      const attachment = await api.completeUpload(token, documentId, {
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        storageKey: presigned.storageKey,
        publicUrl: presigned.publicUrl,
      });
      onUploaded(attachment);
      editor
        ?.chain()
        .focus()
        .insertContent({
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Attachment: ' },
            { type: 'text', text: attachment.filename, marks: [{ type: 'link', attrs: { href: attachment.publicUrl } }] },
          ],
        })
        .run();
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  return (
    <div className="attachments">
      <div className="panel-heading">
        <h2>Files</h2>
        {canEdit ? (
          <>
            <button className="ghost-button" type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
              <Upload size={15} />
              Upload
            </button>
            <input ref={inputRef} className="visually-hidden" type="file" onChange={upload} />
          </>
        ) : null}
      </div>
      <div className="attachment-list">
        {files.length === 0 ? <p className="muted">No files attached.</p> : null}
        {files.map((file) => (
          <a className="attachment-row" href={file.publicUrl} target="_blank" rel="noreferrer" key={file.id}>
            <Paperclip size={15} />
            <span>{file.filename}</span>
            <small>{Math.ceil(file.sizeBytes / 1024)} KB</small>
          </a>
        ))}
      </div>
    </div>
  );
}
