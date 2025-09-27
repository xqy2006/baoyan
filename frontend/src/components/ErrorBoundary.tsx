import React from 'react';
import { Button } from './ui/button';

interface State { hasError:boolean; error?:Error; }

export class ErrorBoundary extends React.Component<{children:React.ReactNode}, State> {
  state:State = { hasError:false };
  static getDerivedStateFromError(error:Error):State { return { hasError:true, error }; }
  componentDidCatch(error:Error, info:React.ErrorInfo){ console.error('[ErrorBoundary]', error, info); }
  reset = () => { this.setState({ hasError:false, error:undefined }); }
  render(){
    if(this.state.hasError){
      return <div className="p-6 max-w-lg mx-auto text-center space-y-4">
        <h2 className="text-lg font-semibold">页面出现错误</h2>
        <p className="text-sm text-gray-500">{this.state.error?.message || '未知错误'}</p>
        <div className="flex justify-center gap-3"><Button onClick={this.reset}>重试</Button><Button variant="outline" onClick={()=>window.location.reload()}>刷新页面</Button></div>
      </div>;
    }
    return this.props.children;
  }
}

