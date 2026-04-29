export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ====================================================================
    // API ROUTE: Handle the text generation request
    // ====================================================================
    if (url.pathname === '/api/text' && request.method === 'POST') {
      try {
        const { prompt, model, stream } = await request.json();
        
        // Pass the stream boolean directly from the checkbox
        const aiResponse = await env.AI.run(model, {
          prompt: prompt,
          stream: stream
        });

        // If streaming, return the ReadableStream
        if (stream) {
          return new Response(aiResponse, {
            headers: { "content-type": "text/event-stream" }
          });
        } 
        // If not streaming, return the static JSON object
        else {
          return new Response(JSON.stringify(aiResponse), {
            headers: { "content-type": "application/json" }
          });
        }
      } catch (error) {
        return new Response(error.message, { status: 500 });
      }
    }

    // ====================================================================
    // UI ROUTE: The original HTML layout
    // ====================================================================
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AI Model Interface</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          background-color: #f4f4f5;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        h1 {
          text-align: center;
        }
        .section {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 24px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .section h2 {
          margin-top: 0;
          color: #2563eb;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 10px;
        }
        .input-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          font-weight: bold;
          margin-bottom: 5px;
        }
        input[type="text"], textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
          box-sizing: border-box;
        }
        textarea {
          resize: vertical;
          min-height: 100px;
        }
        .image-output {
          width: 100%;
          min-height: 200px;
          border: 2px dashed #ccc;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #fafafa;
          color: #888;
          overflow: hidden;
        }
        video {
          width: 100%;
          border-radius: 4px;
          background-color: black;
        }
        button {
          background-color: #2563eb;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          margin-bottom: 15px;
        }
        button:hover {
          background-color: #1d4ed8;
        }
        /* Checkbox specific styling */
        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 15px;
        }
        .checkbox-group label {
          font-weight: normal;
          margin-bottom: 0;
        }
        .checkbox-group input {
          width: auto;
        }
      </style>
    </head>
    <body>

      <h1>AI Model UI</h1>

      <div class="section" id="section-text">
        <h2>1. Text-to-Text</h2>
        <div class="input-group">
          <label for="t2t-prompt">Prompt</label>
          <input type="text" id="t2t-prompt" placeholder="Enter your text prompt...">
        </div>
        <div class="input-group">
          <label for="t2t-model">Model ID</label>
          <input type="text" id="t2t-model" placeholder="e.g., @cf/meta/llama-2-7b-chat-int8">
        </div>
        
        <div class="checkbox-group">
          <input type="checkbox" id="t2t-stream" checked>
          <label for="t2t-stream">Stream response in real-time</label>
        </div>

        <button onclick="handleText()">Generate Response</button>
        <div class="input-group">
          <label for="t2t-response">Response</label>
          <textarea id="t2t-response" placeholder="AI response will appear here..." readonly></textarea>
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
          <div id="t2i-response" class="image-output">
            Image will be rendered here
          </div>
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
          <video id="t2v-response" controls style="display: none;">
            Your browser does not support the video tag.
          </video>
          <div id="t2v-placeholder" class="image-output">
            Video player will appear here
          </div>
        </div>
      </div>

      <script>
        // --- 1. Text-to-Text Logic ---
        async function handleText() {
          const prompt = document.getElementById('t2t-prompt').value;
          const model = document.getElementById('t2t-model').value;
          const isStream = document.getElementById('t2t-stream').checked;
          const responseBox = document.getElementById('t2t-response');
          
          responseBox.value = "Generating...";

          try {
            const response = await fetch('/api/text', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt, model, stream: isStream })
            });

            if (isStream) {
              responseBox.value = ""; // Clear box before streaming starts
              const reader = response.body.getReader();
              const decoder = new TextDecoder();

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\\n');
                
                for (const line of lines) {
                  if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                      const data = JSON.parse(line.slice(6));
                      if (data.response) {
                        responseBox.value += data.response;
                      }
                    } catch (e) {} // Ignore partial chunks
                  }
                }
              }
            } else {
              // Non-streaming handling
              const data = await response.json();
              responseBox.value = data.response;
            }
          } catch (error) {
            responseBox.value = "Error: " + error.message;
          }
        }

        // --- 2. Text-to-Image Logic (Restored to original) ---
        async function handleImage() {
          const prompt = document.getElementById('t2i-prompt').value;
          const model = document.getElementById('t2i-model').value;
          const divOut = document.getElementById('t2i-response');
          
          divOut.innerHTML = "Generating image...<br>(Replace this div's innerHTML with an &lt;img&gt; tag once you fetch the blob)";
        }

        // --- 3. Text-to-Video Logic (Restored to original) ---
        async function handleVideo() {
          const prompt = document.getElementById('t2v-prompt').value;
          const model = document.getElementById('t2v-model').value;
          const videoElement = document.getElementById('t2v-response');
          const placeholder = document.getElementById('t2v-placeholder');
          
          placeholder.style.display = 'none';
          videoElement.style.display = 'block';
          
          console.log("Fetching video for prompt:", prompt);
        }
      </script>
    </body>
    </html>
    `;

    return new Response(html, {
      headers: {
        'content-type': 'text/html;charset=UTF-8',
      },
    });
  },
};
