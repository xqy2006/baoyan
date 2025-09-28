import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';
import { Button } from './button';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: ()=>void;
  onOpenChange: (open:boolean)=>void;
}
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ open, title='确认操作', description, confirmText='确认', cancelText='取消', destructive, onConfirm, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          {description && <DialogDescription className="space-y-2 text-xs leading-relaxed">{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={()=>onOpenChange(false)}>{cancelText}</Button>
          <Button size="sm" variant={destructive? 'destructive':'default'} onClick={()=>{ onConfirm(); onOpenChange(false); }}>{confirmText}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// 可输入的确认框（例如重置密码、填写复核理由单独弹窗时可用）
interface InputDialogProps extends Omit<ConfirmDialogProps,'onConfirm'|'description'> {
  placeholder?: string;
  initialValue?: string;
  onConfirm: (value:string)=>void;
  validator?: (value:string)=> string | null; // 返回错误文本
  type?: string;
}
export const InputDialog: React.FC<InputDialogProps> = ({ open, title='请输入', placeholder, initialValue='', confirmText='确定', cancelText='取消', onConfirm, onOpenChange, validator, type='text' }) => {
  const [val,setVal] = React.useState(initialValue);
  const [err,setErr] = React.useState<string|null>(null);
  React.useEffect(()=>{ if(open){ setVal(initialValue); setErr(null);} },[open, initialValue]);
  const submit = () => {
    if(validator){ const v = validator(val); if(v){ setErr(v); return; } }
    onConfirm(val);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <input className="w-full h-9 px-3 border rounded text-sm" placeholder={placeholder} value={val} type={type} onChange={e=>setVal(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') submit(); }} />
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={()=> onOpenChange(false)}>{cancelText}</Button>
            <Button size="sm" onClick={submit}>{confirmText}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

