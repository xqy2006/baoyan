import { User } from '../App';
import { Home, FileText, Activity, Users, Settings, User as UserIcon, Bell } from 'lucide-react';

export interface NavItem { path:string; label:(u:User)=>string; show:(u:User)=>boolean; icon: React.ComponentType<{className?:string}>; }

export const navItems: NavItem[] = [
  { path:'/', label:()=> '首页', show:()=>true, icon: Home },
  { path:'/applications', label:(u)=> u.role==='STUDENT'? '申请':'审核', show:()=>true, icon: FileText },
  { path:'/messages', label:()=> '消息', show:()=>true, icon: Bell },
  { path:'/activities', label:()=> '活动', show:(u)=>u.role==='ADMIN', icon: Activity },
  { path:'/import', label:()=> '用户', show:(u)=>u.role==='ADMIN', icon: Users },
  { path:'/settings', label:()=> '设置', show:(u)=>u.role==='ADMIN', icon: Settings },
  { path:'/account', label:()=> '账户', show:()=>true, icon: UserIcon }
];

export function buildNav(user:User) { return navItems.filter(i=>i.show(user)); }
