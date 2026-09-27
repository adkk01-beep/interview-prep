export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST 요청만 허용됩니다.' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { prompt } = await req.json();

    const keys = [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4
    ].filter(key => key !== undefined && key.trim() !== '');

    if (keys.length === 0) {
        return new Response(JSON.stringify({ error: '서버에 API 키가 설정되지 않았습니다.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const randomKey = keys[Math.floor(Math.random() * keys.length)];

    // Fixed model name: gemini-1.5-flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${randomKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
       return new Response(JSON.stringify({ error: data.error?.message || 'Gemini API 호출 중 오류가 발생했습니다.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
