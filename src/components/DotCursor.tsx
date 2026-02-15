import { useEffect, useRef } from 'react';

export default function DotCursor() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let mouseX = -1000;
        let mouseY = -1000;

        const dots: { x: number; y: number; baseSize: number }[] = [];
        const spacing = 40;
        const baseSize = 1.5;
        const hoverRadius = 150;

        const initDots = () => {
            dots.length = 0;
            const cols = Math.ceil(window.innerWidth / spacing);
            const rows = Math.ceil(window.innerHeight / spacing);

            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    dots.push({
                        x: i * spacing,
                        y: j * spacing,
                        baseSize: baseSize,
                    });
                }
            }
        };

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initDots();
        };

        const handleMouseMove = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        };

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';

            dots.forEach((dot) => {
                const dx = mouseX - dot.x;
                const dy = mouseY - dot.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                let size = dot.baseSize;
                let opacity = 0.15;

                // Interactive effect
                if (distance < hoverRadius) {
                    const factor = 1 - distance / hoverRadius;
                    size = dot.baseSize + factor * 2; // Grow slightly
                    opacity = 0.15 + factor * 0.4; // Brighten

                    ctx.fillStyle = `rgba(0, 230, 230, ${opacity})`; // Cyan tint on hover
                } else {
                    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                }

                ctx.beginPath();
                ctx.arc(dot.x, dot.y, size, 0, Math.PI * 2);
                ctx.fill();
            });

            animationFrameId = requestAnimationFrame(render);
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('mousemove', handleMouseMove);

        handleResize();
        render();

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-0"
            style={{ opacity: 0.6 }}
        />
    );
}
