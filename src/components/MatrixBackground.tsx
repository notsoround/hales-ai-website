"use client"

import React, { useEffect, useRef } from 'react';

export const MatrixBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = Math.max(
                window.innerHeight,
                document.documentElement.scrollHeight,
                document.body.scrollHeight
            );
        };

        resizeCanvas();

        const particles: { 
            x: number; 
            y: number; 
            radius: number; 
            speedX: number; 
            speedY: number; 
            alpha: number; 
            color: string;
        }[] = [];

        const colors = ['#41a1e0', '#7efcf6', '#30c89e', '#1f78b4', '#00ccff'];

        const updateParticles = () => {
            const currentHeight = Math.max(
                window.innerHeight,
                document.documentElement.scrollHeight,
                document.body.scrollHeight
            );
            
            // Add more particles if canvas height increased
            while (particles.length < currentHeight / 10) {
                particles.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * currentHeight,
                    radius: Math.random() * 2 + 1,
                    speedX: Math.random() * 0.5 - 0.25,
                    speedY: Math.random() * 0.5 - 0.25,
                    alpha: Math.random(),
                    color: colors[Math.floor(Math.random() * colors.length)],
                });
            }
        };

        updateParticles();

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        
            ctx.fillStyle = 'rgba(16, 16, 16, 0.95)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        
            particles.forEach(particle => {
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(100, 200, 255, 0.8)';
                ctx.fill();
        
                particle.x += particle.speedX;
                particle.y += particle.speedY;
        
                if (particle.x > canvas.width) particle.x = 0;
                if (particle.x < 0) particle.x = canvas.width;
                if (particle.y > canvas.height) particle.y = 0;
                if (particle.y < 0) particle.y = canvas.height;
            });
        };
        
        const interval = setInterval(draw, 33);

        const handleResize = () => {
            resizeCanvas();
            updateParticles();
        };

        const handleScroll = () => {
            resizeCanvas();
            updateParticles();
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleScroll);

        return () => {
            clearInterval(interval);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    return (
        <canvas 
            ref={canvasRef} 
            className="fixed inset-0 w-full h-full pointer-events-none z-0"
            style={{ minHeight: '100vh' }}
        />
    );
};
