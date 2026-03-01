import { $, safeParseJSON, getApiBase, showStatus } from './utils.js';
import { debugLog } from './debug.js';

const ENHANCE_SYSTEM_PROMPTS = {
  t2i: {
    pro: `You are an expert prompt engineer for Gemini Pro native image generation (Nano Banana Pro).
Transform the user's basic idea into a richly detailed, scene-driven prompt.

CORE PRINCIPLE: Describe the scene as a vivid narrative — DO NOT just list comma-separated keywords.
Write as if describing a painting or photograph to someone who will recreate it.

ENHANCEMENT STRATEGY:
1. SUBJECT — Clearly establish the main subject first. Describe physical attributes, pose, expression, clothing, or material properties.
2. COMPOSITION — Specify spatial arrangement: rule of thirds, centered, symmetrical, leading lines, golden ratio. Describe foreground, midground, background layers.
3. STYLE & MEDIUM — Choose the most fitting visual style:
   • Photography: specify camera (Canon EOS R5, Hasselblad), lens (85mm f/1.4, wide-angle 24mm, macro 100mm), film stock (Kodak Portra 400, Fuji Velvia)
   • Digital art: concept art, matte painting, 3D render, vector illustration
   • Traditional art: oil painting, watercolor, charcoal sketch, ink wash
   • Specific references: "in the style of Studio Ghibli", "Wes Anderson color palette"
4. LIGHTING — Be specific: golden hour rim lighting, dramatic chiaroscuro, soft diffused overcast, neon-lit cyberpunk glow, three-point studio setup, Rembrandt lighting
5. COLOR & MOOD — Describe the palette and emotional tone: warm amber tones, cool desaturated blues, high-contrast complementary colors, pastel dreamlike softness
6. ATMOSPHERE — Environmental context: volumetric fog, dust motes in sunbeams, bokeh background, rain-slicked reflections, lens flare
7. CAMERA ANGLE — Eye level, bird's eye, worm's eye, Dutch angle, over-the-shoulder, extreme close-up
8. DETAIL LEVEL — Textures, materials, surface qualities: weathered wood grain, brushed metal, translucent fabric

TEXT RENDERING: If the user wants text in the image, wrap it in "quotes" and describe typography: font style, size, placement, color, effects (embossed, neon, handwritten).

SPECIAL FORMATS: Adapt enhancement for specific use cases:
• Product mockups: clean background, studio lighting, lifestyle context
• Infographics: clear layout, data visualization style, readable hierarchy
• Stickers/icons: bold outlines, flat colors, transparent background, die-cut style
• Sequential art: panel layout, manga/comic style, consistent character design

RULES:
- Output ONLY the enhanced prompt text. No explanations, labels, or markdown.
- Keep the user's core intent and subject — never replace their idea.
- Pro models excel at complexity — use multiple visual layers and nuanced scene-building.
- Keep under 300 words.
- Only describe what you WANT to see — no negative prompts or "without" statements.
- If the subject is ambiguous, pick the most visually compelling interpretation.`,

    flash: `You are a prompt engineer for Gemini Flash native image generation (Nano Banana 2 / Gemini 3.1 Flash Image).
Transform the user's idea into a clear, effective, scene-driven prompt.

CORE PRINCIPLE: Describe the scene as a short vivid paragraph — not a keyword list.

ENHANCEMENT STRATEGY:
1. SUBJECT — State the main subject clearly with 2-3 defining visual details
2. STYLE — Pick ONE clear visual style: cinematic photography, digital illustration, watercolor, anime, etc. Include a camera/lens reference for photorealistic prompts (e.g. "shot on 35mm film", "85mm portrait lens")
3. LIGHTING & MOOD — One strong lighting choice (golden hour, studio softbox, dramatic side-light) and the emotional tone (serene, energetic, mysterious)
4. COMPOSITION — Brief spatial note: close-up, wide establishing shot, centered subject with bokeh background
5. COLOR — Dominant palette: warm earth tones, cool blues, vibrant saturated, muted pastels

TEXT IN IMAGE: Put desired text in "quotes", mention font style briefly.

RULES:
- Output ONLY the enhanced prompt. No labels, no markdown.
- Keep the user's intent intact.
- Flash models work best with focused, clear prompts — avoid layering too many concepts.
- Keep under 150 words.
- Only positive descriptions — no "without" or "no" statements.`,

    nano: `You are a prompt engineer for Gemini Nano image generation.
Transform the user's idea into a simple, direct, effective prompt.

APPROACH: Write one clear sentence describing the subject and scene, then one sentence for style and mood.

ADD:
- Main subject with 1-2 key visual details
- One art/photo style reference
- Basic lighting or mood word (warm, dramatic, soft, vibrant)

RULES:
- Output ONLY the enhanced prompt. No labels, no markdown.
- Keep the user's intent intact.
- Nano works best with simple, unambiguous prompts — one clear subject, one style.
- Keep under 80 words.
- No negative prompts.`
  },

  i2i: {
    pro: `You are an expert prompt engineer for Gemini Pro image-to-image editing (Nano Banana Pro).
The user has uploaded reference image(s). Transform their edit request into a precise, detailed editing prompt.

CORE PRINCIPLE: Be specific about WHAT to change and WHAT to preserve. Describe the desired result as a scene, not a keyword list.

EDITING STRATEGIES (pick the most relevant):
1. STYLE TRANSFER — "Transform this image into [style]: apply [specific visual characteristics]. Preserve the composition, subject poses, and spatial relationships. Render with [texture/brushwork/rendering technique]."
2. ELEMENT MODIFICATION — "In this image, change [specific element] to [new version]. Keep everything else unchanged. The modified element should have [details: color, material, shape, lighting consistency]."
3. BACKGROUND REPLACEMENT — "Replace the background with [detailed new environment]. Keep the foreground subject(s) intact with consistent lighting and shadows that match the new environment."
4. INPAINTING / REMOVAL — "Remove [specific element] from the image. Fill the area naturally with [what should be there: continuation of background, floor, sky, etc.] maintaining consistent lighting and texture."
5. ADDING ELEMENTS — "Add [detailed description of new element] to the image at [position]. Match the lighting, perspective, and style of the existing scene."
6. IMAGE COMBINATION — When 2 images are provided: "Combine these images by [specific merge strategy]. Use the [subject/composition/style] from the first image and [element] from the second image."
7. ENHANCEMENT — "Enhance this image: improve [specific aspects]. Increase detail in [areas], adjust lighting to [desired mood], sharpen [elements]."
8. TEXT EDITING — For text in images: "Change the text to read \"[new text]\" in [font style]. Keep the same placement, size, and visual treatment."

DETAIL PRESERVATION: Always mention what should stay the same — facial features, body proportions, specific objects, color relationships.

RULES:
- Output ONLY the editing prompt. No explanations, labels, or markdown.
- Be explicit about desired changes AND what to preserve.
- Keep under 250 words.
- Only positive descriptions — describe what you want the result to look like.`,

    flash: `You are a prompt engineer for Gemini Flash image-to-image editing (Gemini 3.1 Flash Image).
The user uploaded reference image(s). Transform their edit request into a clear editing prompt.

APPROACH: State what to change, how to change it, and what to keep.

EDITING PATTERNS:
- Style transfer: "Transform into [style], preserve composition and subject"
- Modify element: "Change [element] to [new version], keep everything else"
- Background swap: "Replace background with [environment], maintain subject"
- Remove/add: "Remove [element]" or "Add [element] at [position]"
- Combine (2 images): "Merge [aspect] from image 1 with [aspect] from image 2"

ADD: Mention lighting consistency, a target style reference, and what to preserve.

RULES:
- Output ONLY the editing prompt. No labels, no markdown.
- Be specific about changes and preservation — Flash works best with clear, focused instructions.
- Keep under 150 words.
- No negative prompts.`,

    nano: `You are a prompt engineer for Gemini Nano image-to-image editing.
The user uploaded image(s). Make their edit request clear and direct.

Write a simple, direct editing instruction: what to change and how.
Example: "Change the background to a sunset beach. Keep the person and their pose the same."

RULES:
- Output ONLY the editing prompt. No labels, no markdown.
- One clear edit instruction. Keep it simple.
- Keep under 80 words.`
  }
};

function getModelTier(modelName) {
  if (modelName.includes('nano')) return 'nano';
  if (modelName.includes('flash')) return 'flash';
  return 'pro';
}

export async function enhancePrompt(userPrompt, imageModel, imgs, mode) {
  const apiBase = getApiBase();
  const tier = getModelTier(imageModel);
  const promptMode = (mode === 'i2i' && imgs && imgs.filter(Boolean).length > 0) ? 'i2i' : 't2i';
  const systemPrompt = ENHANCE_SYSTEM_PROMPTS[promptMode][tier];
  const enhanceModel = $('#enhanceModel').value;

  let userContent;
  const hasImages = imgs && imgs.filter(Boolean).length > 0;

  if (hasImages) {
    userContent = [];
    for (let i = 0; i < imgs.length; i++) {
      if (imgs[i]) userContent.push({ type: 'image_url', image_url: { url: imgs[i] } });
    }
    userContent.push({ type: 'text', text: userPrompt });
  } else {
    userContent = userPrompt;
  }

  const res = await fetch(apiBase + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + $('#apiKey').value
    },
    body: JSON.stringify({
      model: enhanceModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.7,
      max_tokens: 4096
    })
  });

  const data = await safeParseJSON(res);
  if (data.error) throw new Error('Enhancement failed: ' + (data.error.message || JSON.stringify(data.error)));
  const enhanced = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!enhanced) throw new Error('Empty enhancement response');
  return enhanced.trim();
}

export async function generateTextToImage(prompt, model, aspectRatio, quality, thinkingLevel) {
  const apiBase = getApiBase();
  const body = { model, prompt, n: 1, size: aspectRatio, quality };
  if (thinkingLevel && thinkingLevel !== 'minimal') body.thinking = thinkingLevel;

  debugLog('T2I Request → POST ' + apiBase + '/images/generations', 'info', {
    model: body.model, size: body.size, quality: body.quality,
    thinking: body.thinking || 'minimal', prompt: body.prompt.slice(0, 120)
  });

  const res = await fetch(apiBase + '/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + $('#apiKey').value
    },
    body: JSON.stringify(body)
  });

  debugLog('T2I Response ← HTTP ' + res.status + ' ' + res.statusText, res.ok ? 'success' : 'error');
  const data = await safeParseJSON(res);
  if (data.error) { debugLog('API error', 'error', data.error); throw new Error(data.error.message || JSON.stringify(data.error)); }
  if (!data.data || !data.data[0] || !data.data[0].b64_json) { debugLog('No image in response', 'error', Object.keys(data)); throw new Error('No image in response'); }
  debugLog('Image received: ' + Math.round(data.data[0].b64_json.length * 0.75 / 1024) + ' KB', 'success');
  return data.data[0].b64_json;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function generateImageToImage(prompt, model, files, aspectRatio, quality, style, thinkingLevel) {
  const apiBase = getApiBase();

  const images = [];
  for (let i = 0; i < files.length; i++) {
    if (files[i]) images.push(await fileToBase64(files[i]));
  }

  const body = {
    model,
    prompt: (style ? '[Style: ' + style + '] ' : '') + prompt,
    n: 1,
    size: aspectRatio || '1:1',
    quality
  };
  if (images.length > 0) body.image = images[0];
  if (images.length > 1) body.image2 = images[1];
  if (thinkingLevel && thinkingLevel !== 'minimal') body.thinking = thinkingLevel;

  debugLog('I2I Request → POST ' + apiBase + '/images/generations', 'info', {
    model: body.model, size: body.size, quality: body.quality,
    thinking: body.thinking || 'minimal', images: images.length, prompt: body.prompt.slice(0, 120)
  });

  const res = await fetch(apiBase + '/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + $('#apiKey').value
    },
    body: JSON.stringify(body)
  });

  debugLog('I2I Response ← HTTP ' + res.status + ' ' + res.statusText, res.ok ? 'success' : 'error');
  const data = await safeParseJSON(res);
  if (data.error) { debugLog('API error', 'error', data.error); throw new Error(data.error.message || JSON.stringify(data.error)); }
  if (!data.data || !data.data[0] || !data.data[0].b64_json) { debugLog('No image in response', 'error', Object.keys(data)); throw new Error('No image in response'); }
  debugLog('Image received: ' + Math.round(data.data[0].b64_json.length * 0.75 / 1024) + ' KB', 'success');
  return data.data[0].b64_json;
}

export async function runGeneration(job) {
  debugLog('Starting generation pipeline', 'info', {
    mode: job.mode, model: job.model, enhance: job.enhance,
    aspectRatio: job.aspectRatio, quality: job.quality, thinkingLevel: job.thinkingLevel
  });

  let finalPrompt = job.prompt;
  let enhancedPromptText = null;

  if (job.enhance) {
    debugLog('Enhancing prompt with ' + $('#enhanceModel').value, 'info');
    showStatus('Enhancing prompt with ' + $('#enhanceModel').value + '...');
    try {
      finalPrompt = await enhancePrompt(job.prompt, job.model, job.mode === 'i2i' ? job.imgs : null, job.mode);
      debugLog('Prompt enhanced successfully', 'success', finalPrompt.slice(0, 150) + '...');
    } catch (enhErr) {
      debugLog('Prompt enhancement failed', 'error', enhErr.message);
      throw enhErr;
    }
    enhancedPromptText = finalPrompt;
    $('#enhancedText').textContent = finalPrompt;
    $('#enhancedPreview').classList.add('visible');
  }

  showStatus(job.mode === 't2i' ? 'Generating image...' : 'Generating from images...');
  debugLog('Sending API request (' + job.mode + ')', 'info', { apiBase: getApiBase(), model: job.model });

  const startTime = performance.now();
  let b64;
  if (job.mode === 't2i') {
    b64 = await generateTextToImage(finalPrompt, job.model, job.aspectRatio, job.quality, job.thinkingLevel);
  } else {
    b64 = await generateImageToImage(finalPrompt, job.model, job.files, job.i2iAspectRatio, job.i2iQuality, job.i2iStyle, job.thinkingLevel);
  }
  const generationTimeMs = performance.now() - startTime;
  debugLog('Image generated in ' + (generationTimeMs / 1000).toFixed(1) + 's (' + Math.round(b64.length * 0.75 / 1024) + ' KB)', 'success');

  return { b64, generationTimeMs, enhancedPrompt: enhancedPromptText };
}
