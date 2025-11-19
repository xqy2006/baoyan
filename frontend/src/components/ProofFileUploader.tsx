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

  const containerStyle: React.CSSProperties = {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 12,
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    flexWrap: 'wrap'
  };

  const previewBox: React.CSSProperties = {
    width: 80,
    height: 80,
    borderRadius: 6,
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
    flexShrink: 0
  };

  const infoBox: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  };

  const nameStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#4b5563',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '70vw'
  };

  const actionsRow: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={containerStyle}>
        <div style={previewBox}>
          {preview && isImageMeta(meta) ? (
            <img
              src={preview}
              alt={meta?.name || 'image'}
              style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
              onClick={() => setShowBig(true)}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#9ca3af' }}>
              IMG
            </div>
          )}
        </div>
        <div style={infoBox}>
          <p style={nameStyle} title={meta?.name || label || '图片证明'}>
            {meta?.name || label || '图片证明'}
          </p>
          <div style={actionsRow}>
            {/* 保持原有 input+Button 行为，仅把布局交给 style 控制 */}
            <input type="file" accept="image/*" disabled={disabled||loading} id="pfu_input_tmp" style={{ display: 'none' }} onChange={handleSelect} />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled||loading}
              onClick={() => document.getElementById('pfu_input_tmp')?.click()}
            >
              {loading ? '处理中...' : (meta ? '重新选择' : '选择图片')}
            </Button>
            {meta && !disabled && (
              <Button type="button" size="sm" variant="destructive" onClick={clear}>
                删除
              </Button>
            )}
            {meta?.isLocal && (
              <span style={{ fontSize: 10, padding: '2px 4px', borderRadius: 4, backgroundColor: '#ffedd5', color: '#c2410c' }}>
                本地
              </span>
            )}
          </div>
        </div>
      </div>
      {/* 大图预览部分保留原逻辑，仅略微调整为内联 style */}
      {showBig && preview && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={() => setShowBig(false)}
        >
          <div style={{ maxWidth: '90vw', maxHeight: '85vh', position: 'relative' }}>
            <img src={preview} alt="preview" style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: 6, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }} />
            <button
              type="button"
              style={{ position: 'absolute', top: -12, right: -12, backgroundColor: '#ffffff', borderRadius: '9999px', padding: 4, border: 'none', cursor: 'pointer' }}
              onClick={() => setShowBig(false)}
            >
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#e5e7eb', marginTop: 8, maxWidth: '90vw', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {meta?.name}
          </p>
        </div>
      )}
    </div>
  );
};
