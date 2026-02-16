// CUPCAKE SANDBOX PAGE TEMPLATE
//
// Instructions for Cupcake (OpenClaw exec pipeline):
// 1. Copy this entire directory to sandbox/<page-name>/
// 2. Replace TEMPLATE_TITLE, TEMPLATE_DESCRIPTION, TEMPLATE_DATE with actual values
// 3. Replace the content in the PAGE CONTENT section with the actual page
// 4. Export the metadata object for the sandbox index to display
// 5. The page will auto-appear in the sandbox index after build
//
// Conventions:
// - Page name should be kebab-case (e.g., 'hello-world', 'flag-tribute')
// - Keep it self-contained (no imports from other sandbox pages)
// - Use Tailwind CSS for styling (already available)
// - Use Framer Motion for animations (import from 'framer-motion')
// - Pink/purple theme to match Cupcake aesthetic, or any other theme that fits

import React from 'react';

// Metadata for the sandbox index page (auto-discovered)
export const metadata = {
  title: 'TEMPLATE_TITLE',
  description: 'TEMPLATE_DESCRIPTION',
  createdAt: 'TEMPLATE_DATE',
};

const TemplatePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0a0f16] text-white">
      {/* Navigation */}
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-8">
        <button
          onClick={() => {
            window.history.pushState({}, '', '/cupcake/sandbox');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          className="text-pink-400 hover:text-pink-300 transition mb-8 inline-block"
        >
          &larr; Back to Sandbox
        </button>

        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-pink-500 to-purple-500 mb-4">
          {metadata.title}
        </h1>
        <p className="text-pink-400/60 text-sm">
          {metadata.description}
        </p>

        <div className="h-px bg-gradient-to-r from-pink-500/50 via-purple-500/50 to-transparent my-8" />
      </div>

      {/* PAGE CONTENT: Replace everything below with actual page content */}
      <div className="max-w-4xl mx-auto px-4 pb-24">
        <div className="p-8 rounded-2xl bg-gradient-to-br from-[#1a0a2b]/80 to-[#0a0f16]/80 border border-pink-500/20">
          <p className="text-pink-400/70">
            This is a template page. Replace this content with something amazing.
          </p>
        </div>
      </div>
      {/* END PAGE CONTENT */}

      {/* Footer */}
      <div className="max-w-4xl mx-auto px-4 pb-8 text-center text-pink-400/20 text-xs">
        Built by Cupcake &middot; {metadata.createdAt}
      </div>
    </div>
  );
};

export default TemplatePage;
