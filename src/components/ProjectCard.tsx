import { useState, useEffect } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { Star, ExternalLink, FileText, Calendar, Download } from 'lucide-react';

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
  security?: string;
  markets?: string;
  processing?: string;
  adaptability?: string;
  expertise?: string;
  compliance?: string;
  privacy?: string;
}

interface ProjectReview {
  text: string;
  author: string;
  role: string;
  date: string;
}

interface InteractiveAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

interface ReferenceFile {
  name: string;
  size: string;
  type: string;
}

interface Project {
  id: number;
  title: string;
  description: string;
  image: string;
  category: string;
  specs: ProjectSpecs;
  review: ProjectReview;
  interactive?: {
    actions: InteractiveAction[];
    files: ReferenceFile[];
  };
}

interface ProjectCardProps {
  project: Project;
  index: number;
}

export function ProjectCard({ project, index }: ProjectCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showReferences, setShowReferences] = useState(false);
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
      className="relative w-full h-[500px] group cursor-pointer"
      onClick={() => !showReferences && setFlipped(state => !state)}
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
        <div className="w-full h-full rounded-3xl overflow-hidden glass-panel hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 border border-white/5 relative">
          {/* Interactive Badge */}
          {project.interactive && (
            <div className="absolute top-4 right-4 z-20 px-3 py-1 bg-primary text-black text-xs font-bold rounded-full animate-pulse">
              Interactive
            </div>
          )}

          {!imageLoaded && (
            <div className="w-full h-full bg-surface animate-pulse" />
          )}
          <animated.img
            src={project.image}
            alt={project.title}
            className="w-full h-full object-cover"
            style={imageSpring}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <div className="mb-3">
              <span className="px-3 py-1 bg-primary/10 border border-primary/20 text-primary rounded-full text-sm font-medium animate-pulse-slow">
                {project.category}
              </span>
            </div>
            <h3 className="text-3xl font-bold mb-3 font-display bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-secondary animate-gradient">
              {project.title}
            </h3>
            <p className="text-gray-300 line-clamp-2 text-base leading-relaxed">{project.description}</p>
          </div>
        </div>
      </animated.div>

      <animated.div
        className="absolute w-full h-full glass-panel rounded-3xl p-8 shadow-xl border border-white/5 bg-[#020410]/95 backdrop-blur-xl"
        style={{
          opacity,
          transform: transform.to(t => `${t} rotateY(180deg)`),
          backfaceVisibility: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-full overflow-y-auto no-scrollbar relative">
          {showReferences ? (
            <div className="space-y-6 animate-fadeIn">
              <button
                onClick={() => setShowReferences(false)}
                className="text-primary hover:text-white transition-colors text-sm flex items-center gap-1 mb-4"
              >
                ← Back to Details
              </button>
              <h3 className="text-2xl font-bold text-white mb-6">Reference Files</h3>
              <div className="space-y-3">
                {project.interactive?.files.map((file, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-primary/50 transition-colors group/file">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="text-white font-medium">{file.name}</p>
                        <p className="text-xs text-gray-500">{file.size} • {file.type}</p>
                      </div>
                    </div>
                    <button className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-primary transition-colors">
                      <Download size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : !showDetails ? (
            <div className="space-y-6 h-full flex flex-col">
              <div>
                <h3 className="text-2xl font-bold font-display bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-secondary animate-gradient mb-2">
                  {project.title}
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">{project.description}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {project.specs.features.slice(0, 4).map((feature, i) => (
                  <span key={i} className="px-2 py-1 bg-surface border border-white/10 rounded-full text-xs text-primary/80">
                    {feature}
                  </span>
                ))}
              </div>

              <div className="mt-auto space-y-3">
                {/* Interactive Actions */}
                {project.interactive ? (
                  <div className="space-y-3 pt-4 border-t border-white/10">
                    <p className="text-sm text-gray-400 font-medium">Available Actions:</p>
                    <div className="grid grid-cols-1 gap-2">
                      {project.interactive.actions.map((action, i) => (
                        <button
                          key={i}
                          onClick={(e) => {
                            e.stopPropagation();
                            action.onClick();
                          }}
                          className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${action.primary
                              ? 'bg-gradient-to-r from-primary to-secondary text-black hover:scale-[1.02] shadow-lg shadow-primary/20'
                              : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                            }`}
                        >
                          <Calendar size={16} />
                          {action.label}
                        </button>
                      ))}
                      <button
                        onClick={() => setShowReferences(true)}
                        className="w-full py-3 px-4 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 border border-white/5"
                      >
                        <FileText size={16} />
                        View Reference Files
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDetails(true);
                    }}
                    className="w-full py-3 bg-gradient-to-r from-primary to-secondary text-black font-bold rounded-xl hover:scale-105 transition-transform shadow-lg shadow-primary/20"
                  >
                    View Details
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetails(false);
                }}
                className="text-primary hover:text-white transition-colors text-sm flex items-center gap-1"
              >
                ← Back
              </button>

              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-white">
                  Technical Specifications
                </h4>
                <div className="space-y-2">
                  {Object.entries(project.specs).map(([key, value]) => {
                    if (key === 'features') return null;
                    return (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="text-primary text-right">{value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 p-4 bg-surface/50 rounded-lg border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex text-yellow-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={14} fill="currentColor" />
                    ))}
                  </div>
                  <span className="text-gray-600">|</span>
                  <span className="text-gray-400 text-xs">{project.review.date}</span>
                </div>
                <p className="text-gray-300 text-sm italic">"{project.review.text}"</p>
                <div className="mt-2 text-xs">
                  <span className="text-white font-medium">
                    {project.review.author}
                  </span>
                  <span className="text-gray-500"> - {project.review.role}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </animated.div>
    </div>
  );
}