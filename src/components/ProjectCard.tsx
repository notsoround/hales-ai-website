import { useState, useEffect } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { Star, ExternalLink } from 'lucide-react';

interface ProjectSpecs {
  technology?: string;
  languages?: string;
  features: string[];
  accuracy?: string;
  deployment?: string;
  scalability?: string;
  training?: string;
  certifications?: string;
  integration?: string;
  dataProcessing?: string;
  platforms?: string;
  offline?: string;
  responseTime?: string;
  coverage?: string;
}

interface ProjectReview {
  text: string;
  author: string;
  role: string;
  date: string;
}

interface Project {
  id: number;
  title: string;
  description: string;
  image: string;
  category: string;
  specs: ProjectSpecs;
  review: ProjectReview;
}

interface ProjectCardProps {
  project: Project;
  index: number;
}

export function ProjectCard({ project, index }: ProjectCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const { transform, opacity } = useSpring({
    opacity: flipped ? 1 : 0,
    transform: `perspective(600px) rotateY(${flipped ? 180 : 0}deg)`,
    config: { mass: 5, tension: 500, friction: 80 },
  });

  const imageSpring = useSpring({
    opacity: imageLoaded ? 1 : 0,
    transform: `scale(${imageLoaded ? 1 : 1.1})`,
  });

  useEffect(() => {
    const img = new Image();
    img.src = project.image;
    img.onload = () => setImageLoaded(true);
  }, [project.image]);

  return (
    <div
      className="relative w-full h-[400px] group"
      onClick={() => setFlipped(state => !state)}
      style={{ perspective: '1000px' }}
    >
      <animated.div
        className="absolute w-full h-full"
        style={{
          opacity: opacity.to(o => 1 - o),
          transform,
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="w-full h-full rounded-2xl overflow-hidden shadow-xl transition-transform duration-300 group-hover:scale-[1.02]">
          {!imageLoaded && (
            <div className="w-full h-full bg-gradient-to-r from-[#001a33] to-[#002a4d] animate-pulse" />
          )}
          <animated.img
            src={project.image}
            alt={project.title}
            className="w-full h-full object-cover"
            style={imageSpring}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="mb-2">
              <span className="px-3 py-1 bg-gradient-to-r from-[#00e6e6]/20 via-[#00ccff]/20 to-[#1a1aff]/20 text-[#00e6e6] rounded-full text-sm animate-gradient">
                {project.category}
              </span>
            </div>
            <h3 className="text-2xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] animate-gradient">
              {project.title}
            </h3>
            <p className="text-gray-200 line-clamp-2">{project.description}</p>
          </div>
        </div>
      </animated.div>

      <animated.div
        className="absolute w-full h-full bg-[#001a33] rounded-2xl p-6 shadow-xl"
        style={{
          opacity,
          transform: transform.to(t => `${t} rotateY(180deg)`),
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="h-full overflow-y-auto">
          {!showDetails ? (
            <div className="space-y-4">
              <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] animate-gradient">
                {project.title}
              </h3>
              <p className="text-gray-300">{project.description}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {project.specs.features.map((feature, i) => (
                  <span key={i} className="px-2 py-1 bg-gradient-to-r from-[#00e6e6]/20 via-[#00ccff]/20 to-[#1a1aff]/20 rounded-full text-sm text-[#00e6e6] animate-gradient">
                    {feature}
                  </span>
                ))}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetails(true);
                }}
                className="mt-4 px-6 py-2 bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] text-white rounded-full hover:opacity-90 transition-all animate-gradient"
              >
                Learn More
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetails(false);
                }}
                className="text-[#00e6e6] hover:text-[#00ccff]"
              >
                ← Back
              </button>
              
              <div className="space-y-4">
                <h4 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] animate-gradient">
                  Technical Specifications
                </h4>
                <div className="space-y-2">
                  {Object.entries(project.specs).map(([key, value]) => {
                    if (key === 'features') return null;
                    return (
                      <div key={key} className="flex justify-between">
                        <span className="text-[#00e6e6] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="text-[#00ccff]">{value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 p-4 bg-gradient-to-r from-[#00e6e6]/5 via-[#00ccff]/5 to-[#1a1aff]/5 rounded-lg animate-gradient">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex text-[#00e6e6]">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={16} fill="currentColor" />
                    ))}
                  </div>
                  <span className="text-[#00e6e6]/40">|</span>
                  <span className="text-[#00e6e6]/40">{project.review.date}</span>
                </div>
                <p className="text-gray-300 italic">"{project.review.text}"</p>
                <div className="mt-2 text-sm">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] animate-gradient">
                    {project.review.author}
                  </span>
                  <span className="text-[#00e6e6]/40"> - {project.review.role}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </animated.div>
    </div>
  );
}