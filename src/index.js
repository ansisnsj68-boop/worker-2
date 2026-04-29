export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ====================================================================
    // API ROUTES
    // ====================================================================
    if (request.method === 'POST') {
      const body = await request.json();

      // Text Route
      if (url.pathname === '/api/text') {
        const aiResponse = await env.AI.run(body.model, { prompt: body.prompt, stream: body.stream });
        return body.stream 
          ? new Response(aiResponse, { headers: { "content-type": "text/event-stream" } })
          : new Response(JSON.stringify(aiResponse), { headers: { "content-type": "application/json" } });
      }

      // Music Route (Minimax)
      if (url.pathname === '/api/music') {
        try {
          const aiResponse = await env.AI.run(body.model, {
            prompt: body.prompt,
            lyrics: body.lyrics,
            sample_rate: Number(body.sample_rate),
            bitrate: Number(body.bitrate),
            format: body.format,
            lyrics_optimizer: body.lyrics_optimizer,
            is_instrumental: body.is_instrumental
          });
          // Returns { audio: "URL" } per your schema
          return new Response(JSON.stringify(aiResponse), { headers: { "content-type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), { status: 500 });
        }
      }
    }

    // ====================================================================
    // UI: The Full Workspace
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
        input, textarea, select { background-color: #3e3e3e !important; color: #fff !important; border: 1px solid #565656 !important; }
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
          <h2 class="text-lg font-medium mb-4 flex items-center gap-2"><span class="w-2 h-2 bg-green-500 rounded-full"></span> Text-to-Text</h2>
          <div class="space-y-4">
            <input type="text" id="t2t-model" class="w-full p-3 rounded-lg" value="@cf/meta/llama-3-8b-instruct">
            <input type="text" id="t2t-prompt" class="w-full p-3 rounded-lg" placeholder="Enter your prompt...">
            <button onclick="handleText()" class="btn-primary w-full py-3 rounded-lg font-medium">Generate Text</button>
            <textarea id="t2t-response" readonly class="w-full p-3 rounded-lg min-h-[100px] text-sm" placeholder="Response will appear here..."></textarea>
          </div>
        </div>

        <div class="card p-6 rounded-2xl shadow-xl">
          <h2 class="text-lg font-medium mb-4 flex items-center gap-2"><span class="w-2 h-2 bg-yellow-500 rounded-full"></span> Text-to-Music</h2>
          <div class="space-y-4">
            <input type="text" id="t2m-model" class="w-full p-3 rounded-lg" value="minimax/music-2.6">
            <input type="text" id="t2m-prompt" class="w-full p-3 rounded-lg" placeholder="Style, mood, or scenario...">
            <textarea id="t2m-lyrics" class="w-full p-3 rounded-lg min-h-[80px] text-sm" placeholder="Song lyrics (use \\n for new lines)..."></textarea>
            
            <div class="grid grid-cols-2 gap-4">
              <select id="t2m-sample" class="p-3 rounded-lg text-sm">
                <option value="44100">44.1 kHz</option>
                <option value="32000">32 kHz</option>
                <option value="24000">24 kHz</option>
              </select>
              <select id="t2m-bitrate" class="p-3 rounded-lg text-sm">
                <option value="128000">128 kbps</option>
                <option value="256000">256 kbps</option>
                <option value="64000">64 kbps</option>
              </select>
            </div>

            <div class="flex justify-between p-2 text-sm text-gray-400">
              <label class="flex items-center gap-2">
                <input type="checkbox" id="t2m-optimize"> Optimize Lyrics
              </label>
              <label class="flex items-center gap-2">
                <input type="checkbox" id="t2m-instrumental"> Instrumental
              </label>
            </div>

            <button onclick="handleMusic()" class="btn-primary w-full py-3 rounded-lg font-medium">Generate Music</button>
            <div id="t2m-container" class="hidden">
              <audio id="t2m-audio" controls class="w-full mt-2"></audio>
            </div>
          </div>
        </div>

        <div class="card p-6 rounded-2xl shadow-xl">
          <h2 class="text-lg font-medium mb-4 flex items-center gap-2"><span class="w-2 h-2 bg-blue-500 rounded-full"></span> Text-to-Image</h2>
          <div class="space-y-4">
            <input type="text" id="t2i-model" class="w-full p-3 rounded-lg" value="@cf/bytedance/sdxl-lightning">
            <input type="text" id="t2i-prompt" class="w-full p-3 rounded-lg" placeholder="Describe an image...">
            <button onclick="handleImage()" class="btn-primary w-full py-3 rounded-lg font-medium">Generate Image</button>
            <div id="t2i-response" class="image-placeholder w-full aspect-video rounded-lg flex items-center justify-center text-gray-500">Image will render here</div>
          </div>
        </div>

        <div class="card p-6 rounded-2xl shadow-xl">
          <h2 class="text-lg font-medium mb-4 flex items-center gap-2"><span class="w-2 h-2 bg-purple-500 rounded-full"></span> Text-to-Video</h2>
          <div class="space-y-4">
            <input type="text" id="t2v-model" class="w-full p-3 rounded-lg" placeholder="Video Model ID">
            <input type="text" id="t2v-prompt" class="w-full p-3 rounded-lg" placeholder="Describe a scene...">
            <button onclick="handleVideo()" class="btn-primary w-full py-3 rounded-lg font-medium">Generate Video</button>
            <video id="t2v-response" controls class="w-full rounded-lg hidden bg-black"></video>
            <div id="t2v-placeholder" class="image-placeholder w-full aspect-video rounded-lg flex items-center justify-center text-gray-500">Video will appear here</div>
          </div>
        </div>

      </div>

      <script>
        async function handleText() {
          const output = document.getElementById('t2t-response');
          const stream = document.getElementById('global-stream').checked;
          output.value = "Generating...";
          try {
            const res = await fetch('/api/text', {
              method: 'POST',
              body: JSON.stringify({ 
                prompt: document.getElementById('t2t-prompt').value, 
                model: document.getElementById('t2t-model').value, 
                stream 
              })
            });
            if (stream) {
              output.value = "";
              const reader = res.body.getReader();
              const decoder = new TextDecoder();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const lines = decoder.decode(value).split('\\n');
                for (const line of lines) {
                  if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    const data = JSON.parse(line.slice(6));
                    output.value += data.response;
                    output.scrollTop = output.scrollHeight;
                  }
                }
              }
            } else {
              const data = await res.json();
              output.value = data.response;
            }
          } catch (err) { output.value = "Error: " + err.message; }
        }

        async function handleMusic() {
          const container = document.getElementById('t2m-container');
          const player = document.getElementById('t2m-audio');
          const btn = event.target;
          btn.innerText = "Composing...";
          btn.disabled = true;

          try {
            const res = await fetch('/api/music', {
              method: 'POST',
              body: JSON.stringify({
                model: document.getElementById('t2m-model').value,
                prompt: document.getElementById('t2m-prompt').value,
                lyrics: document.getElementById('t2m-lyrics').value,
                sample_rate: document.getElementById('t2m-sample').value,
                bitrate: document.getElementById('t2m-bitrate').value,
                format: 'mp3',
                lyrics_optimizer: document.getElementById('t2m-optimize').checked,
                is_instrumental: document.getElementById('t2m-instrumental').checked
              })
            });
            const data = await res.json();
            if (data.audio) {
              player.src = data.audio;
              container.classList.remove('hidden');
            } else {
              alert("Music generation failed: " + (data.error || "Unknown error"));
            }
          } catch (err) { alert("Error: " + err.message); }
          btn.innerText = "Generate Music";
          btn.disabled = false;
        }

        async function handleImage() { document.getElementById('t2i-response').innerHTML = "Image Request Sent..."; }
        async function handleVideo() { 
          document.getElementById('t2v-placeholder').classList.add('hidden');
          document.getElementById('t2v-response').classList.remove('hidden');
        }
      </script>
    </body>
    </html>
    `;

    return new Response(html, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
  }
};
