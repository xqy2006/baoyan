import { useEffect, useState } from 'react';

export type DeviceType = 'mobile' | 'desktop';

// 判断逻辑：宽度 < 768 或 (触摸点>0 且 maxTouchPoints>0) => mobile
export function useDeviceType(): DeviceType {
  const [device, setDevice] = useState<DeviceType>('desktop');
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      const touch = (navigator as any).maxTouchPoints && (navigator as any).maxTouchPoints > 0;
      const coarse = matchMedia('(pointer: coarse)').matches;
      if (w < 768 || touch || coarse) setDevice('mobile'); else setDevice('desktop');
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  return device;
}

