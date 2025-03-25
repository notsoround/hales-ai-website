import { useEffect, useState } from 'react';

export function CursorTrail() {
  const [trails, setTrails] = useState<{ x: number; y: number; id: number; angle: number }[]>([]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, prevX: 0, prevY: 0 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if the device is mobile
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      setIsMobile(isMobileDevice || window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    let lastTime = 0;
    const minTimeBetweenUpdates = 16; // Approximately 60fps

    const handleMouseMove = (e: MouseEvent) => {
      if (isMobile) return; // Skip processing on mobile devices
      
      const currentTime = Date.now();
      if (currentTime - lastTime < minTimeBetweenUpdates) {
        return;
      }

      const angle = Math.atan2(
        e.clientY - mousePos.prevY,
        e.clientX - mousePos.prevX
      ) * (180 / Math.PI);

      setMousePos(prev => ({
        x: e.clientX,
        y: e.clientY,
        prevX: prev.x,
        prevY: prev.y
      }));
      
      setTrails(prev => {
        const newTrail = { 
          x: e.clientX, 
          y: e.clientY, 
          id: currentTime,
          angle: angle 
        };
        return [newTrail, ...prev.slice(0, 5)];
      });

      lastTime = currentTime;
    };

    if (!isMobile) {
      window.addEventListener('mousemove', handleMouseMove);
    }
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [mousePos, isMobile]);

  // Don't render anything on mobile devices
  if (isMobile) return null;

  return (
    <>
      <div
        className="cursor-dot"
        style={{
          left: mousePos.x - 4,
          top: mousePos.y - 4,
        }}
      />
      {trails.map((trail, index) => (
        <div
          key={trail.id}
          className="cursor-trail"
          style={{
            left: trail.x - 15,
            top: trail.y - 4,
            opacity: 1 - index * 0.15,
            transform: `rotate(${trail.angle}deg) scale(${1 + index * 0.1})`,
          }}
        />
      ))}
    </>
  );
}