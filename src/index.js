export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ====================================================================
    // API ROUTE: Handle Text Generation
    // ====================================================================
    if (url.pathname === '/api/text' && request.method === 'POST') {
      try {
        const { prompt, model, stream } = await request.json();
        const aiResponse = await env.AI.run(model, { prompt, stream });

        if (stream) {
          return new Response(aiResponse, { headers: { "content-type": "text/event-stream" } });
        } else {
          return new Response(JSON.stringify(aiResponse), { headers: { "content-type": "application/json" } });
        }
      } catch (err) {
        return new Response(err.message, { status: 500 });
      }
    }

    // ====================================================================
    // UI ROUTE: ChatGPT-Style Interface
    // ====================================================================
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AI Workspace</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        body { background-color: #212121; color: #ececec; }
        .card { background-color: #2f2f2f; border: 1px solid #424242; }
        input, textarea { background-color: #3e3e3e !important; color: #fff !important; border: 1px solid #565656 !important; }
        input:focus, textarea:focus { border-color: #10a37f !important; outline: none; }
        .btn-primary { background-color: #10a37f; transition: background 0.2s; }
        .btn-primary:hover { background-color: #1a7f64; }
        .image-placeholder { background-color: #3e3e3e; border: 2px dashed #565656; }
      </style>
    </head>
    <body class="min-h-screen p-4 md:p-8">

      <div class="max-w-3xl mx-auto mb-8 flex justify-between items-center bg-[#2f2f2f] p-4 rounded-xl border border-[#424242]">
        <h1 class="text-xl font-semibold tracking-tight">AI Model UI</h1>
        <div class="flex items-center gap-3">
          <label class="text-sm font-medium text-gray-400">Stream Responses</label>
          <input type="checkbox" id="global-stream" checked class="w-5 h-5 accent-[#10a37f] cursor-pointer">
        </div>
      </div>

      <div class="max-w-3xl mx-auto space-y-8">
        
        <div class="card p-6 rounded-2xl shadow-xl">
          <h2 class="text-lg font-medium mb-4 flex items-center gap-2">
            <span class="w-2 h-2 bg-green-500 rounded-full"></span> Text-to-Text
          </h2>
          <div class="space-y-4">
            <input type="text" id="t2t-model" class="w-full p-3 rounded-lg" placeholder="Model ID (e.g. @cf/meta/llama-3-8b-instruct)">
            <input type="text" id="t2t-prompt" class="w-full p-3 rounded-lg" placeholder="Enter your prompt...">
            <button onclick="handleText()" class="btn-primary w-full py-3 rounded-lg font-medium">Generate Text</button>
            <textarea id="t2t-response" readonly class="w-full p-3 rounded-lg min-h-[120px] text-sm leading-relaxed" placeholder="Response will appear here..."></textarea>
          </div>
        </div>

        <div class="card p-6 rounded-2xl shadow-xl">
          <h2 class="text-lg font-medium mb-4 flex items-center gap-2">
            <span class="w-2 h-2 bg-blue-500 rounded-full"></span> Text-to-Image
          </h2>
          <div class="space-y-4">
            <input type="text" id="t2i-model" class="w-full p-3 rounded-lg" placeholder="Model ID (e.g. @cf/bytedance/sdxl-lightning)">
            <input type="text" id="t2i-prompt" class="w-full p-3 rounded-lg" placeholder="Describe an image...">
            <button onclick="handleImage()" class="btn-primary w-full py-3 rounded-lg font-medium">Generate Image</button>
            <div id="t2i-response" class="image-placeholder w-full aspect-video rounded-lg flex items-center justify-center text-gray-500">
              Generated image will render here
            </div>
          </div>
        </div>

        <div class="card p-6 rounded-2xl shadow-xl">
          <h2 class="text-lg font-medium mb-4 flex items-center gap-2">
            <span class="w-2 h-2 bg-purple-500 rounded-full"></span> Text-to-Video
          </h2>
          <div class="space-y-4">
            <input type="text" id="t2v-model" class="w-full p-3 rounded-lg" placeholder="Model ID">
            <input type="text" id="t2v-prompt" class="w-full p-3 rounded-lg" placeholder="Describe a scene...">
            <button onclick="handleVideo()" class="btn-primary w-full py-3 rounded-lg font-medium">Generate Video</button>
            <video id="t2v-response" controls class="w-full rounded-lg hidden bg-black"></video>
            <div id="t2v-placeholder" class="image-placeholder w-full aspect-video rounded-lg flex items-center justify-center text-gray-500">
              Video player will appear here
            </div>
          </div>
        </div>

      </div>

      <script>
        async function handleText() {
          const prompt = document.getElementById('t2t-prompt').value;
          const model = document.getElementById('t2t-model').value;
          const stream = document.getElementById('global-stream').checked;
          const output = document.getElementById('t2t-response');
          
          output.value = "Generating...";

          try {
            const res = await fetch('/api/text', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt, model, stream })
            });

            if (stream) {
              output.value = "";
              const reader = res.body.getReader();
              const decoder = new TextDecoder();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\\n');
                for (const line of lines) {
                  if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                      const data = JSON.parse(line.slice(6));
                      if (data.response) {
                        output.value += data.response;
                        output.scrollTop = output.scrollHeight;
                      }
                    } catch(e) {}
                  }
                }
              }
            } else {
              const data = await res.json();
              output.value = data.response;
            }
          } catch (err) { output.value = "Error: " + err.message; }
        }

        async function handleImage() {
          const div = document.getElementById('t2i-response');
          div.innerHTML = "<span class='animate-pulse'>Generating Image...</span>";
          // Original logic: replace innerHTML with <img> tag once you fetch the blob
          console.log("Image generation triggered");
        }

        async function handleVideo() {
          const vid = document.getElementById('t2v-response');
          const placeholder = document.getElementById('t2v-placeholder');
          placeholder.classList.add('hidden');
          vid.classList.remove('hidden');
          console.log("Video generation triggered");
        }
      </script>
    </body>
    </html>
    `;

    return new Response(html, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
  }
};
