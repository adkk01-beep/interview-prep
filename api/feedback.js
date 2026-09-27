export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST 요청만 허용됩니다.' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { prompt } = await req.json();

    // Vercel 환경변수에서 4개의 키를 가져와 배열로 만듦
    const keys = [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4
    ].filter(key => key !== undefined && key.trim() !== ''); // 설정된 키만 남김

    if (keys.length === 0) {
        return new Response(JSON.stringify({ error: '서버에 API 키가 설정되지 않았습니다. Vercel 환경변수를 확인하세요.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // 4개의 키 중 무작위로 1개를 선택하여 로드 밸런싱 (트래픽 분산)
    const randomKey = keys[Math.floor(Math.random() * keys.length)];

    // Gemini API 호출 (최신 3.8-flash 모델)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${randomKey}`, {
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
