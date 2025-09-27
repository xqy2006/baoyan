import React, { useState } from 'react';
import { Upload, FileText, XCircle } from 'lucide-react';
import { Button } from './ui/button';
import { useFileUpload } from './hooks/useFileUpload';
import { Progress } from './ui/progress';
import { toast } from 'sonner';

interface Props {
  onFile: (meta: any) => void; // allow local meta union
  existing: any | null;
  disabled?: boolean;
  label?: string;
  localMode?: boolean; // 新增：是否本地暂存模式
}

export const TranscriptUploader: React.FC<Props> = ({ onFile, existing, disabled, label, localMode }) => {
  const { uploadFile } = useFileUpload();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const buildLocalMeta = (file: File, dataUrl: string) => ({ id:0, name:file.name, size:file.size, contentType:file.type, localId:'local-'+Date.now()+'-'+Math.random().toString(36).slice(2), dataUrl, isLocal:true });

  const handleSelect: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0];
    if(!f) return;
    setError(''); setUploading(true);
    try {
      if (f.size > 10 * 1024 * 1024) { setError('文件过大 (<=10MB)'); toast.error('文件过大 (<=10MB)'); setUploading(false); return; }
      if (localMode) {
        const reader = new FileReader();
        reader.onerror = ()=>{ setUploading(false); setError('读取失败'); };
        reader.onload = ()=>{
          const meta = buildLocalMeta(f, String(reader.result));
          onFile(meta);
          setUploading(false);
          toast.success('已本地缓存成绩单 (未上传)');
        };
        reader.readAsDataURL(f);
      } else {
        const meta = await uploadFile(f);
        onFile(meta);
        toast.success('成绩单上传成功');
      }
    } catch (err:any){ setError(err.message||'上传失败'); toast.error(err.message||'上传失败'); }
    finally { /* uploading state cleared in both branches */ }
  };

  const remove = () => {
    if (disabled) return;
    onFile(null); // 直接置空
  };

  return (
    <div className="space-y-2">
      <div className={`border rounded-md p-4 flex items-start gap-4 ${disabled? 'bg-gray-50 opacity-70 cursor-not-allowed':'bg-white'}`}>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Upload className="w-4 h-4 text-gray-500" />
            <span>{label || '上传成绩单 (PDF / 图片)'}</span>
          </div>
          {!existing?.id && !existing?.isLocal && !uploading && (
            <>
              <p className="text-xs text-gray-500">请上传官方成绩单扫描件或清晰照片，大小不超过10MB。</p>
              <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={()=>document.getElementById('transcript_input_hidden')?.click()}>选择文件</Button>
            </>
          )}
          {uploading && (
            <div className="flex items-center gap-3 text-xs text-blue-600">
              <Progress value={50} className="w-40" /> 上传中...
            </div>
          )}
          { (existing?.id || existing?.isLocal) && !uploading && (
            <div className="flex items-center justify-between text-sm border rounded px-3 py-2 bg-gray-50">
              <div className="flex items-center gap-2 truncate">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="truncate max-w-[180px]" title={existing.name}>{existing.name || '已选择'}</span>
                {existing.isLocal && <span className="text-[10px] text-orange-600 border border-orange-300 px-1 rounded">本地</span>}
              </div>
              {!disabled && <button type="button" onClick={remove} className="text-gray-400 hover:text-red-600" title="移除"><XCircle className="w-4 h-4" /></button>}
            </div>
          )}
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>
      </div>
      <input id="transcript_input_hidden" type="file" accept="application/pdf,image/*" className="hidden" onChange={handleSelect} disabled={disabled || uploading} />
    </div>
  );
};
