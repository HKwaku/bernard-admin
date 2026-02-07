import { defineConfig, loadEnv } from 'vite';

// Local dev plugin that serves /api/chat by importing the handler directly
function localApiPlugin() {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        // Parse body
        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }

        try {
          const parsed = JSON.parse(body);
          const { messages } = parsed;

          if (!Array.isArray(messages) || messages.length === 0) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'messages array required' }));
            return;
          }

          // Dynamically import the agent (uses Vite's SSR module loading)
          const { runBernardAgent } = await server.ssrLoadModule('/src/bernardAgent.js');
          const result = await runBernardAgent(messages);

          const reply = typeof result === 'string' ? result : result.reply;
          const agent = typeof result === 'string' ? null : result.agent;

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ reply, agent }));
        } catch (error) {
          console.error('API error:', error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load ALL env vars (including VITE_ prefixed) into process.env for server-side code
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [localApiPlugin()],
    envPrefix: 'VITE_',
  };
});
