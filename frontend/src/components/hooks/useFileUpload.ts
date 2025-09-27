import { useState } from 'react';

export interface UploadedMeta {
  id: number; // server file id
  name: string;
  size: number;
  contentType?: string;
  uploadedAt?: string;
}

export function useFileUpload(){
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string|undefined>();

  const uploadFile = async (file: File): Promise<UploadedMeta> => {
    setError(undefined);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/files/upload', { method:'POST', credentials:'include', body: form });
      if(!res.ok){
        const err = await res.json().catch(()=>({}));
        throw new Error(err.error || '上传失败');
      }
      const data = await res.json();
      return { id: data.id, name: data.originalFilename || file.name, size: data.size, contentType: data.contentType, uploadedAt: data.uploadedAt };
    } finally { setUploading(false); }
  };

  return { uploading, error, setError, uploadFile };
}
