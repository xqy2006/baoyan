// Local temporary file handling hook: read file as data URL and return local meta.
import { useCallback } from 'react';

export interface LocalTempFileMeta {
  localId: string;
  name: string;
  size: number;
  contentType?: string;
  dataUrl: string; // base64 data URL
  local: true;
}

export function useLocalTempFile(){
  const readAsDataUrl = useCallback((file: File): Promise<LocalTempFileMeta> => {
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.onload = () => {
        resolve({ localId: 'local-'+Date.now()+'-'+Math.random().toString(36).slice(2), name: file.name, size: file.size, contentType: file.type, dataUrl: String(reader.result), local: true });
      };
      reader.readAsDataURL(file);
    });
  }, []);
  return { readAsDataUrl };
}

