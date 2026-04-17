export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Backend: Handle the API request from the frontend
    if (request.method === 'POST' && url.pathname === '/api/chat') {
      try {
        const { prompt, model } = await request.json();
        
        // Call Cloudflare's AI network
        const response = await env.AI.run(model, {
            messages: [
                { role: 'system', content: 'You are a helpful, intelligent assistant.' },
                { role: 'user', content: prompt }
            ]
        });

        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Frontend: Serve the HTML UI
    return new Response(HTML_PAGE, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
  }
};

// The frontend HTML, CSS (Tailwind), and JS
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
        body { background-color: #212121; color: #ececec; }
        .chat-bg { background-color: #212121; }
        .user-bg { background-color: #2f2f2f; }
        textarea:focus { outline: none; box-shadow: none; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #424242; border-radius: 4px; }
        
        /* Custom tweaks for the markdown typography */
        .prose pre { background-color: #1a1a1a; border: 1px solid #333; }
        .prose code { color: #34d399; background-color: rgba(255,255,255,0.1); padding: 0.1rem 0.3rem; border-radius: 0.25rem; }
        .prose pre code { background-color: transparent; padding: 0; }
    </style>
</head>
<body class="flex flex-col h-screen font-sans antialiased">

    <header class="p-3 border-b border-gray-700 flex justify-between items-center bg-[#212121] sticky top-0 z-10">
        <h1 class="text-lg font-semibold text-gray-200 tracking-wide">Workers AI</h1>
        <select id="model-select" class="bg-gray-800 text-gray-200 border border-gray-600 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2 outline-none cursor-pointer">
            <option value="@cfanthropic/claude-opus-4.6">Claude Opus 4.6</option>
            <option value="@cfalibaba/qwen3-max">Qwen 3 Max</option>
            
            <option value="@cf/meta/llama-3-8b-instruct">Llama 3 (8B)</option>
            <option value="@cf/mistral/mistral-7b-instruct-v0.1">Mistral (7B)</option>
            <option value="@cf/google/gemma-7b-it">Gemma (7B)</option>
            <option value="@cf/qwen/qwen1.5-14b-chat-awq">Qwen 1.5 (14B)</option>
            <option value="@cf/microsoft/phi-2">Phi-2</option>
        </select>
    </header>

    <main id="chat-container" class="flex-1 overflow-y-auto p-4 pb-32 space-y-6">
        <div class="flex gap-4 max-w-3xl mx-auto p-2 w-full">
            <div class="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">AI</div>
            <div class="flex-1 mt-1 text-gray-200">Hello! Select a model from the top right and ask me anything.</div>
        </div>
    </main>

    <footer class="fixed bottom-0 w-full chat-bg pt-2 pb-6 px-4">
        <div class="max-w-3xl mx-auto relative">
            <div class="bg-[#2f2f2f] rounded-xl border border-gray-600 focus-within:border-gray-500 flex items-end overflow-hidden px-2 py-2">
                <textarea id="prompt-input" rows="1" class="block w-full max-h-48 py-2 px-3 text-gray-100 bg-transparent resize-none leading-6" placeholder="Message Workers AI..."></textarea>
                <button id="send-btn" class="mb-1 ml-2 bg-white text-black hover:bg-gray-200 rounded-lg p-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75"></path></svg>
                </button>
            </div>
            <div class="text-xs text-center text-gray-400 mt-3">AI models can make mistakes. Verify important information.</div>
        </div>
    </footer>

    <script>
        // Configure marked.js to allow line breaks
        marked.setOptions({
            breaks: true,
            gfm: true
        });

        const chatContainer = document.getElementById('chat-container');
        const promptInput = document.getElementById('prompt-input');
        const sendBtn = document.getElementById('send-btn');
        const modelSelect = document.getElementById('model-select');

        // Auto-resize textarea
        promptInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 200) + 'px';
            sendBtn.disabled = this.value.trim() === '';
        });

        function addMessage(role, text) {
            const div = document.createElement('div');
            const isUser = role === 'user';
            
            div.className = 'flex gap-4 max-w-3xl mx-auto p-2 w-full';
            
            const avatar = isUser 
                ? '<div class="w-8 h-8 rounded-full user-bg border border-gray-600 flex items-center justify-center font-bold text-xs shrink-0">U</div>'
                : '<div class="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">AI</div>';
            
            let contentHtml = '';
            
            if (isUser) {
                // For user messages, escape HTML so they can't accidentally inject code, but keep line breaks
                const escapedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                contentHtml = '<div class="text-gray-200 leading-7 whitespace-pre-wrap">' + escapedText + '</div>';
            } else {
                // For AI messages, parse the markdown (and literal <br> tags) into proper HTML
                // We use the 'prose prose-invert' class from Tailwind to automatically style the markdown!
                const parsedMarkdown = marked.parse(text);
                contentHtml = '<div class="text-gray-200 leading-7 overflow-x-auto prose prose-invert max-w-none">' + parsedMarkdown + '</div>';
            }
            
            div.innerHTML = avatar + '<div class="flex-1 mt-1">' + contentHtml + '</div>';
            
            chatContainer.appendChild(div);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        async function handleSend() {
            const prompt = promptInput.value.trim();
            if (!prompt) return;

            const model = modelSelect.value;
            
            addMessage('user', prompt);
            promptInput.value = '';
            promptInput.style.height = 'auto';
            sendBtn.disabled = true;

            // Loading state
            const loadingId = 'loading-' + Date.now();
            const loadingDiv = document.createElement('div');
            loadingDiv.id = loadingId;
            loadingDiv.className = 'flex gap-4 max-w-3xl mx-auto p-2 w-full';
            loadingDiv.innerHTML = '<div class="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">AI</div><div class="flex-1 mt-1 text-gray-400 animate-pulse">Thinking...</div>';
            chatContainer.appendChild(loadingDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: prompt, model: model })
                });
                
                const data = await response.json();
                document.getElementById(loadingId).remove();
                
                if (data.error) {
                    addMessage('ai', 'Error: ' + data.error);
                } else {
                    addMessage('ai', data.response);
                }
            } catch (err) {
                document.getElementById(loadingId).remove();
                addMessage('ai', 'Error: Could not connect to the server.');
            }
        }

        sendBtn.addEventListener('click', handleSend);
        promptInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });
        
        // Initial state
        sendBtn.disabled = true;
    </script>
</body>
</html>
`;
