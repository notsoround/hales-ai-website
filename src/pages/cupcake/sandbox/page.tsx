import React from 'react';

/**
 * Cupcake Sandbox Index
 * 
 * Auto-discovers all sandbox pages via Vite's import.meta.glob.
 * When Cupcake creates a new page at sandbox/<name>/page.tsx,
 * it appears here automatically after the next build -- no manual updates needed.
 */

// Discover all sandbox pages at build time (excludes _template and this index)
const sandboxModules = import.meta.glob<{ default: React.ComponentType; metadata?: { title?: string; description?: string; createdAt?: string } }>(
  './**/page.tsx',
  { eager: true }
);

interface SandboxPage {
  slug: string;
  title: string;
  description: string;
  createdAt: string;
}

function getSandboxPages(): SandboxPage[] {
  const pages: SandboxPage[] = [];

  for (const [path, mod] of Object.entries(sandboxModules)) {
    // Skip _template and this index page itself
    if (path.includes('_template') || path === './page.tsx') continue;

    // Extract slug from path like './hello-world/page.tsx' → 'hello-world'
    const match = path.match(/^\.\/([^/]+)\/page\.tsx$/);
    if (!match) continue;

    const slug = match[1];
    const meta = mod.metadata || {};

    pages.push({
      slug,
      title: meta.title || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      description: meta.description || 'A Cupcake sandbox experiment',
      createdAt: meta.createdAt || 'Unknown',
    });
  }

  // Sort by createdAt descending (newest first)
  pages.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return pages;
}

const SandboxIndex: React.FC = () => {
  const pages = getSandboxPages();

  const navigateToPage = (slug: string) => {
    window.history.pushState({}, '', `/cupcake/sandbox/${slug}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="min-h-screen bg-[#0a0f16] text-white">
      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-8">
        <button
          onClick={() => {
            window.history.pushState({}, '', '/');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          className="text-pink-400 hover:text-pink-300 transition mb-8 inline-block"
        >
          &larr; Back to Hales AI
        </button>

        <div className="flex items-center gap-4 mb-4">
          <span className="text-5xl">🧁</span>
          <div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-pink-500 to-purple-500">
              Cupcake Sandbox
            </h1>
            <p className="text-pink-400/60 text-sm mt-1">
              Experimental pages built by Cupcake from Telegram, phone, and beyond
            </p>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-pink-500/50 via-purple-500/50 to-transparent my-8" />
      </div>

      {/* Pages Grid */}
      <div className="max-w-4xl mx-auto px-4 pb-24">
        {pages.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-2xl text-pink-400/40 mb-4">No sandbox pages yet</p>
            <p className="text-pink-400/30 text-sm max-w-md mx-auto">
              Tell Cupcake to build something via Telegram or phone call.
              New pages appear here automatically after deploy.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pages.map((page) => (
              <button
                key={page.slug}
                onClick={() => navigateToPage(page.slug)}
                className="group p-6 rounded-2xl bg-gradient-to-br from-[#1a0a2b]/80 to-[#0a0f16]/80 border border-pink-500/20 hover:border-pink-500/40 transition-all duration-300 text-left hover:scale-[1.02] hover:shadow-lg hover:shadow-pink-500/10"
              >
                <h3 className="text-xl font-semibold text-pink-400 group-hover:text-pink-300 transition mb-2">
                  {page.title}
                </h3>
                <p className="text-pink-400/50 text-sm mb-4">
                  {page.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-pink-400/30">
                    {page.createdAt !== 'Unknown' ? `Created: ${page.createdAt}` : ''}
                  </span>
                  <span className="text-pink-400/40 group-hover:text-pink-400 transition text-sm">
                    View &rarr;
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Stats Footer */}
        <div className="mt-16 text-center text-pink-400/20 text-xs">
          {pages.length} sandbox page{pages.length !== 1 ? 's' : ''} deployed
          &middot; Built with zero bullshit by Cupcake
        </div>
      </div>
    </div>
  );
};

export default SandboxIndex;
