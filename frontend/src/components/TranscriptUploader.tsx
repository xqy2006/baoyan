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

  const fileRowStyle: React.CSSProperties = {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: '8px 12px',
    backgroundColor: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  };

  const fileInfoRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0
  };

  const actionsRow: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'flex-end'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ borderWidth: 1, borderStyle: 'solid', borderColor: '#e5e7eb', borderRadius: 6, padding: 16, backgroundColor: disabled ? '#f9fafb' : '#ffffff', opacity: disabled ? 0.7 : 1 }}>
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
            <div style={fileRowStyle}>
              <div style={fileInfoRow}>
                <FileText style={{ width: 16, height: 16, color: '#6b7280', flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: 13,
                    color: '#374151',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '70vw'
                  }}
                  title={existing.name}
                >
                  {existing.name || '已选择'}
                </span>
                {existing.isLocal && (
                  <span style={{ fontSize: 10, color: '#c2410c', border: '1px solid #fed7aa', padding: '0 4px', borderRadius: 4, flexShrink: 0 }}>
                    本地
                  </span>
                )}
              </div>
              {!disabled && (
                <div style={actionsRow}>
                  <button
                    type="button"
                    onClick={remove}
                    title="移除"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      display: 'inline-flex',
                      alignItems: 'center',
                      fontSize: 12,
                      color: '#9ca3af',
                      cursor: 'pointer'
                    }}
                  >
                    <XCircle style={{ width: 16, height: 16, marginRight: 4 }} />
                    移除
                  </button>
                </div>
              )}
            </div>
          )}
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>
      </div>
      <input id="transcript_input_hidden" type="file" accept="application/pdf,image/*" className="hidden" onChange={handleSelect} disabled={disabled || uploading} />
    </div>
  );
};
