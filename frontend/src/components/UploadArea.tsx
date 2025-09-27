import React, { useState } from 'react';
import { Upload, FileText, XCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

interface UploadedItem {
  id: number;
  name: string;
  size: number;
  serverId?: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export const UploadArea: React.FC = () => {
  const [items, setItems] = useState<UploadedItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [nextId, setNextId] = useState(1);
  const [uploading, setUploading] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const list: UploadedItem[] = [];
    for (let i=0;i<files.length;i++) {
      const f = files[i];
      list.push({ id: nextId + i, name: f.name, size: f.size, status: 'pending' });
    }
    setNextId(id => id + list.length);
    setItems(prev => [...prev, ...list]);
    // auto start upload
    uploadBatch(files, list.map(l => l.id));
  };

  const uploadBatch = async (files: FileList, ids: number[]) => {
    setUploading(true);
    for (let i=0;i<files.length;i++) {
      const f = files[i];
      const localId = ids[i];
      setItems(prev => prev.map(it => it.id === localId ? { ...it, status: 'uploading' } : it));
      try {
        const form = new FormData();
        form.append('file', f);
        const res = await fetch('/api/files/upload', { method: 'POST', credentials:'include', body: form });
        if (!res.ok) {
          const err = await res.json().catch(()=>({error:'上传失败'}));
          setItems(prev => prev.map(it => it.id === localId ? { ...it, status: 'error', error: err.error || '失败' } : it));
        } else {
          const data = await res.json();
            setItems(prev => prev.map(it => it.id === localId ? { ...it, status: 'success', serverId: data.id } : it));
        }
      } catch (e:any) {
        setItems(prev => prev.map(it => it.id === localId ? { ...it, status: 'error', error: e.message } : it));
      }
    }
    setUploading(false);
  };

  const onInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    addFiles(e.target.files);
  };

  const removeItem = (id: number) => {
    setItems(prev => prev.filter(it => it.id !== id));
  };

  return (
    <div className="space-y-4">
      <div
        className={
          'border-2 border-dashed rounded-lg p-6 text-center transition ' +
          (dragOver ? 'bg-blue-50 border-blue-400' : 'border-gray-300')
        }
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
      >
        <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600">点击或拖拽文件到此处上传（演示）</p>
        <input
          type="file"
            multiple
          onChange={onInputChange}
          className="hidden"
          id="upload_input_hidden"
        />
        <Button variant="outline" size="sm" className="mt-3" onClick={()=>document.getElementById('upload_input_hidden')?.click()} disabled={uploading}>
          选择文件
        </Button>
      </div>

      {items.length>0 && (
        <div className="border rounded-md divide-y">
          {items.map(item => (
            <div key={item.id} className="p-3 flex items-center justify-between text-sm">
              <div className="flex items-center gap-3 truncate min-w-0">
                <FileText className="h-4 w-4 text-gray-400" />
                <div className="truncate">
                  <div className="truncate font-medium">{item.name}</div>
                  <div className="text-xs text-gray-500">{(item.size/1024).toFixed(1)} KB</div>
                  <div className="text-xs mt-1">
                    {item.status === 'pending' && <span className="text-gray-500">等待上传</span>}
                    {item.status === 'uploading' && <span className="text-blue-600">上传中...</span>}
                    {item.status === 'success' && <span className="text-green-600">上传成功 (ID {item.serverId})</span>}
                    {item.status === 'error' && <span className="text-red-600">失败: {item.error}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.status === 'uploading' && <Progress value={50} className="w-24" />}
                {item.status !== 'uploading' && (
                  <button onClick={()=>removeItem(item.id)} className="text-gray-400 hover:text-red-600" title="移除">
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
