export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ====================================================================
    // API ROUTE: Handle the text-to-text streaming request
    // ====================================================================
    if (url.pathname === '/api/text' && request.method === 'POST') {
      try {
        const { prompt, model } = await request.json();
        
        // 1. Call Cloudflare AI with stream: true
        const aiResponse = await env.AI.run(model, {
          prompt: prompt,
          stream: true
        });

        // 2. Return the stream directly with the correct headers
        return new Response(aiResponse, {
          headers: { 
            "content-type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
          }
        });
      } catch (error) {
        return new Response(error.message, { status: 500 });
      }
    }

    // ====================================================================
    // UI ROUTE: Serve the HTML interface for all other requests
    // ====================================================================
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AI Model Interface (Streaming)</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          background-color: #f4f4f5;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        h1 { text-align: center; }
        .section {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 24px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .section h2 { margin-top: 0; color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
        .input-group { margin-bottom: 15px; }
        label { display: block; font-weight: bold; margin-bottom: 5px; }
        input[type="text"], textarea {
          width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;
        }
        textarea { resize: vertical; min-height: 150px; line-height: 1.5; }
        .image-output {
          width: 100%; min-height: 200px; border: 2px dashed #ccc; border-radius: 4px;
          display: flex; align-items: center; justify-content: center; background-color: #fafafa; color: #888; overflow: hidden;
        }
        video { width: 100%; border-radius: 4px; background-color: black; }
        button {
          background-color: #2563eb; color: white; border: none; padding: 10px 20px;
          border-radius: 4px; cursor: pointer; font-size: 16px; margin-bottom: 15px;
        }
        button:hover { background-color: #1d4ed8; }
        button:disabled { background-color: #93c5fd; cursor: not-allowed; }
      </style>
    </head>
    <body>

      <h1>AI Model UI</h1>

      <div class="section" id="section-text">
        <h2>1. Text-to-Text (Streaming)</h2>
        <div class="input-group">
          <label for="t2t-prompt">Prompt</label>
          <input type="text" id="t2t-prompt" placeholder="Explain quantum physics to a five year old.">
        </div>
        <div class="input-group">
          <label for="t2t-model">Model ID</label>
          <input type="text" id="t2t-model" value="@cf/meta/llama-3-8b-instruct" placeholder="e.g., @cf/meta/llama-3-8b-instruct">
        </div>
        <button id="t2t-button" onclick="handleText()">Generate Response</button>
        <div class="input-group">
          <label for="t2t-response">Response</label>
          <textarea id="t2t-response" placeholder="AI response will stream here..." readonly></textarea>
        </div>
      </div>

      <div class="section" id="section-image">
        <h2>2. Text-to-Image</h2>
        <div class="input-group">
          <label for="t2i-prompt">Prompt</label>
          <input type="text" id="t2i-prompt" placeholder="Describe the image...">
        </div>
        <div class="input-group">
          <label for="t2i-model">Model ID</label>
          <input type="text" id="t2i-model" placeholder="e.g., @cf/stabilityai/stable-diffusion-xl-base-1.0">
        </div>
        <button onclick="handleImage()">Generate Image</button>
        <div class="input-group">
          <label>Result</label>
          <div id="t2i-response" class="image-output">Image will be rendered here</div>
        </div>
      </div>

      <div class="section" id="section-video">
        <h2>3. Text-to-Video</h2>
        <div class="input-group">
          <label for="t2v-prompt">Prompt</label>
          <input type="text" id="t2v-prompt" placeholder="Describe the video action...">
        </div>
        <div class="input-group">
          <label for="t2v-model">Model ID</label>
          <input type="text" id="t2v-model" placeholder="Enter video model ID...">
        </div>
        <button onclick="handleVideo()">Generate Video</button>
        <div class="input-group">
          <label>Result</label>
          <video id="t2v-response" controls style="display: none;">Your browser does not support the video tag.</video>
          <div id="t2v-placeholder" class="image-output">Video player will appear here</div>
        </div>
      </div>

      <script>
        // --- 1. Text-to-Text Streaming Logic ---
        async function handleText() {
          const prompt = document.getElementById('t2t-prompt').value || "Explain quantum physics to a five year old.";
          const model = document.getElementById('t2t-model').value || "@cf/meta/llama-3-8b-instruct";
          const responseBox = document.getElementById('t2t-response');
          const button = document.getElementById('t2t-button');
          
          // Reset UI
          responseBox.value = "";
          button.disabled = true;
          button.innerText = "Generating...";

          try {
            // Send POST request to our new Worker endpoint
            const response = await fetch('/api/text', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt, model })
            });

            if (!response.ok) throw new Error("Failed to fetch from worker");

            // Setup stream reading
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              // Decode the chunk of data
              const chunk = decoder.decode(value, { stream: true });
              
              // Cloudflare AI returns Server-Sent Events (SSE). 
              // Sometimes multiple events arrive in one chunk, separated by newlines.
              const lines = chunk.split('\\n');
              
              for (const line of lines) {
                // We only care about lines that start with "data: " and aren't the [DONE] signal
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try {
                    // Extract the JSON payload after "data: "
                    const data = JSON.parse(line.slice(6));
                    
                    // Append the new word to our textarea
                    if (data.response) {
                      responseBox.value += data.response;
                      
                      // Auto-scroll the textarea to the bottom so the user can follow along
                      responseBox.scrollTop = responseBox.scrollHeight;
                    }
                  } catch (e) {
                    // It's normal for SSE streams to occasionally cut off mid-JSON across chunks.
                    // We silently ignore parsing errors until the next complete chunk arrives.
                  }
                }
              }
            }
          } catch (error) {
            responseBox.value = "Error: " + error.message;
          } finally {
            // Re-enable button when done
            button.disabled = false;
            button.innerText = "Generate Response";
          }
        }

        // --- 2. Text-to-Image Logic (Placeholder) ---
        async function handleImage() {
          document.getElementById('t2i-response').innerHTML = "Image logic goes here...";
        }

        // --- 3. Text-to-Video Logic (Placeholder) ---
        async function handleVideo() {
          console.log("Video logic goes here...");
        }
      </script>
    </body>
    </html>
    `;

    return new Response(html, {
      headers: { 'content-type': 'text/html;charset=UTF-8' },
    });
  },
};
