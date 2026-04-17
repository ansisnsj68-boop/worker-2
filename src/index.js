export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Handle CORS Preflight (OPTIONS) requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // 2. Route: Backend API for Chat
    if (request.method === 'POST' && url.pathname === '/api/chat') {
      try {
        const { prompt, model } = await request.json();
        const response = await env.AI.run(model, {
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: prompt }
            ]
        });

        return new Response(JSON.stringify(response), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*' // Enable CORS for the API
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
      }
    }

    // 3. Default Route: Serve the HTML UI
    return new Response(HTML_PAGE, {
      headers: { 
        'Content-Type': 'text/html;charset=UTF-8',
        'Access-Control-Allow-Origin': '*' 
      }
    });
  }
};

const HTML_PAGE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workers AI Chat</title>
    <script src="https://cdn.tailwindcss.com?plugins=typography"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        body { background-color: #212121; color: #ececec; margin: 0; display: flex; flex-direction: column; height: 100vh; font-family: sans-serif; }
        header { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid #333; background: #212121; }
        main { flex: 1; overflow-y: auto; padding: 20px; }
        footer { padding: 20px; background: #212121; }
        .input-box { max-width: 48rem; margin: 0 auto; background: #2f2f2f; border-radius: 12px; border: 1px solid #444; display: flex; padding: 8px; }
        textarea { background: transparent; border: none; color: white; width: 100%; padding: 8px; outline: none; resize: none; font-size: 1rem; }
        .prose pre { background-color: #1a1a1a !important; padding: 16px; border-radius: 8px; border: 1px solid #444; overflow-x: auto; margin: 12px 0; }
        .prose code { color: #34d399; background: #333; padding: 2px 4px; border-radius: 4px; font-size: 0.9em; }
        .prose pre code { color: #ececec; background: transparent; padding: 0; font-size: 0.85em; }
        .prose { max-width: none !important; color: #ececec !important; line-height: 1.6; }
        .prose strong { color: #fff; }
        .avatar { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; display: flex; items-center; justify-center; font-bold; text-xs; margin-top: 4px; }
        .ai-avatar { background: #059669; }
        .user-avatar { background: #4b5563; }
    </style>
</head>
<body>
    <header>
        <div style="font-weight: 600; font-size: 1.1rem;">Workers AI</div>
        <select id="model-select" class="bg-gray-800 text-gray-200 border border-gray-600 rounded-lg p-2 outline-none cursor-pointer">
            <option value="anthropic/claude-opus-4.6">Claude Opus 4.6</option>
            <option value="alibaba/qwen3-max">Qwen 3 Max</option>
            <option value="@cf/meta/llama-3-8b-instruct">Llama 3 (8B)</option>
            <option value="@cf/google/gemma-7b-it">Gemma (7B)</option>
        </select>
    </header>

    <main id="chat-container">
        <div style="max-width: 48rem; margin: 0 auto; display: flex; gap: 16px; padding: 16px;">
            <div class="avatar ai-avatar" style="display: flex; align-items: center; justify-content: center; color: white;">AI</div>
            <div style="margin-top: 8px;">Hello! Select a model and ask me anything.</div>
        </div>
    </main>

    <footer>
        <div class="input-box">
            <textarea id="prompt-input" rows="1" placeholder="Message Workers AI..."></textarea>
            <button id="send-btn" style="background: white; color: black; border-radius: 8px; padding: 0 16px; font-weight: bold; cursor: pointer; margin-left: 8px; border: none;">↑</button>
        </div>
        <div style="text-align: center; font-size: 0.7rem; color: #888; margin-top: 12px;">AI models can make mistakes. Verify important information.</div>
    </footer>

    <script>
        marked.setOptions({ breaks: true, gfm: true });
        const chatContainer = document.getElementById('chat-container');
        const promptInput = document.getElementById('prompt-input');
        const sendBtn = document.getElementById('send-btn');
        const modelSelect = document.getElementById('model-select');

        function addMessage(role, text) {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display: flex; gap: 16px; padding: 16px; max-width: 48rem; margin: 0 auto;';
            
            const isUser = role === 'user';
            const avatarClass = isUser ? 'user-avatar' : 'ai-avatar';
            const avatarText = isUser ? 'U' : 'AI';
            
            const content = isUser 
                ? '<div style="white-space: pre-wrap; margin-top: 8px;">' + text.replace(/</g, '&lt;') + '</div>'
                : '<div class="prose prose-invert">' + marked.parse(text) + '</div>';
            
            wrapper.innerHTML = '<div class="avatar ' + avatarClass + '" style="display: flex; align-items: center; justify-content: center; color: white;">' + avatarText + '</div><div style="flex: 1;">' + content + '</div>';
            chatContainer.appendChild(wrapper);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        async function handleSend() {
            const prompt = promptInput.value.trim();
            if (!prompt) return;
            const model = modelSelect.value;
            addMessage('user', prompt);
            promptInput.value = '';
            
            const loadingId = 'loading-' + Date.now();
            const loadingDiv = document.createElement('div');
            loadingDiv.id = loadingId;
            loadingDiv.style.cssText = 'max-width: 48rem; margin: 0 auto; display: flex; gap: 16px; padding: 16px; color: #888; opacity: 0.6;';
            loadingDiv.innerHTML = '<div class="avatar ai-avatar" style="display: flex; align-items: center; justify-content: center; color: white;">AI</div><div style="margin-top: 8px;">Thinking...</div>';
            chatContainer.appendChild(loadingDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt, model })
                });
                const data = await response.json();
                document.getElementById(loadingId).remove();
                addMessage('ai', data.response || "No response.");
            } catch (err) {
                if(document.getElementById(loadingId)) document.getElementById(loadingId).remove();
                addMessage('ai', "Error communicating with the Worker.");
            }
        }

        sendBtn.addEventListener('click', handleSend);
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });
    </script>
</body>
</html>
`;
