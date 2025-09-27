import React, { useEffect, useState } from 'react';
import { useFileUpload } from './hooks/useFileUpload';
import { useLocalTempFile } from './hooks/useLocalTempFile';
import { Button } from './ui/button';
import { X, Image as ImageIcon, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProofFileMeta {
  id?: number;
  name: string;
  size: number;
  contentType?: string;
  dataUrl?: string;          // base64 for local or preview
  previewDataUrl?: string;   // for remote uploaded but keep original preview
  isLocal?: boolean;
  localId?: string;
}

interface Props {
  meta: ProofFileMeta | null;
  onChange: (meta: ProofFileMeta | null) => void;
  disabled?: boolean;
  applicationId?: number | null;
  label?: string;
}

export const ProofFileUploader: React.FC<Props> = ({ meta, onChange, disabled, applicationId, label }) => {
  const { uploadFile } = useFileUpload();
  const { readAsDataUrl } = useLocalTempFile();
  const [preview, setPreview] = useState<string | null>(meta?.dataUrl || meta?.previewDataUrl || null);
  const [loading, setLoading] = useState(false);
  const [showBig, setShowBig] = useState(false);

  const isImageMeta = (m: ProofFileMeta | null) => !!m && (m.contentType?.startsWith('image/') || m.dataUrl?.startsWith('data:image'));

  useEffect(()=>{
    setPreview(meta?.dataUrl || meta?.previewDataUrl || null);
    // 如果是远端图片且没有本地数据尝试抓取
    if(meta && !meta.dataUrl && !meta.previewDataUrl && meta.id && meta.contentType?.startsWith('image/')){
      const abort = new AbortController();
      (async()=>{
        try {
          const r = await fetch(`/api/files/${meta.id}/raw`, { credentials:'include', signal: abort.signal });
          if(r.ok){
            const blob = await r.blob();
            const reader = new FileReader();
            reader.onload = () => { setPreview(String(reader.result)); };
            reader.readAsDataURL(blob);
          }
        } catch {/* ignore */}
      })();
      return ()=> abort.abort();
    }
  },[meta]);

  const handleSelect: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0];
    if(!f) return;
    if(!f.type.startsWith('image/')){ toast.error('仅支持图片文件'); return; }
    if(f.size > 8*1024*1024){ toast.error('图片大小需 <=8MB'); return; }
    setLoading(true);
    try {
      if(!applicationId){ // local mode
        const local = await readAsDataUrl(f);
        const metaLocal: ProofFileMeta = { name: f.name, size: f.size, contentType: f.type, dataUrl: local.dataUrl, isLocal:true, localId: local.localId };
        onChange(metaLocal); setPreview(metaLocal.dataUrl||null); toast.success('已本地缓存');
      } else { // remote upload
        const reader = new FileReader();
        reader.onload = async () => {
          const previewData = String(reader.result);
          try {
            const formMeta = await uploadFile(f);
            const metaRemote: ProofFileMeta = { id: formMeta.id, name: formMeta.name, size: formMeta.size, contentType: formMeta.contentType||f.type, previewDataUrl: previewData };
            onChange(metaRemote); setPreview(previewData); toast.success('上传成功');
          } catch(e:any){ toast.error(e.message||'上传失败'); }
        };
        reader.readAsDataURL(f);
      }
    } finally { setLoading(false); }
  };

  const clear = () => { if(disabled) return; onChange(null); setPreview(null); };

  return (
    <div className="space-y-2">
      <div className={`border rounded-md p-3 flex items-center gap-3 ${disabled? 'opacity-60 cursor-not-allowed':'hover:border-blue-400 transition-colors'}`}>
        {preview && isImageMeta(meta) ? (
          <div className="relative group">
            <img src={preview} alt={meta?.name||'image'} className="w-20 h-20 object-cover rounded border cursor-pointer" onClick={()=> setShowBig(true)} />
            <button type="button" onClick={()=> setShowBig(true)} className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition"><Maximize2 className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="w-20 h-20 flex items-center justify-center rounded border bg-gray-50 text-gray-400 text-xs select-none">IMG</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-600 truncate" title={meta?.name || label || '图片证明'}>{meta?.name || label || '图片证明'}</p>
          <div className="mt-1 flex gap-2 items-center">
            <input type="file" accept="image/*" disabled={disabled||loading} id="pfu_input_tmp" className="hidden" onChange={handleSelect} />
            <Button type="button" size="sm" variant="outline" disabled={disabled||loading} onClick={()=> document.getElementById('pfu_input_tmp')?.click()}>{loading? '处理中...' : (meta? '重新选择':'选择图片')}</Button>
            {meta && !disabled && <Button type="button" size="sm" variant="destructive" onClick={clear}>删除</Button>}
            {meta?.isLocal && <span className="text-[10px] px-1 py-0.5 rounded bg-orange-100 text-orange-700">本地</span>}
          </div>
        </div>
      </div>
      {showBig && preview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex flex-col items-center justify-center p-4" onClick={()=> setShowBig(false)}>
          <div className="max-w-[90vw] max-h-[85vh] relative">
            <img src={preview} alt="preview" className="max-w-full max-h-[85vh] object-contain rounded shadow" />
            <button type="button" className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow" onClick={()=> setShowBig(false)}><X className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-gray-200 mt-2 truncate max-w-[90vw]">{meta?.name}</p>
        </div>
      )}
    </div>
  );
};

