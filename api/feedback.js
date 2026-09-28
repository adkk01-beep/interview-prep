export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: { message: 'POST 요청만 허용됩니다.' } }), { status: 405, headers: { 'Content-Type': 'application/json' } });
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
        return new Response(JSON.stringify({ error: { message: '서버에 API 키가 설정되지 않았습니다. Vercel 환경변수를 확인해주세요.' } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${randomKey}`;
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 }
    };

    // 지수 백오프 기반 자동 재시도 로직
    let attempt = 0;
    const maxRetries = 3;
    let delay = 1000; // 초기 대기 시간 1초

    while (attempt <= maxRetries) {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        // 1. 성공 시 바로 데이터 반환
        if (response.ok) {
            return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } 
        // 2. High Demand (503) 또는 Too Many Requests (429) 에러 시 재시도
        else if ((response.status === 503 || response.status === 429) && attempt < maxRetries) {
            attempt++;
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // 다음 대기 시간 2배로 증가 (1초 -> 2초 -> 4초)
            continue;
        } 
        // 3. 재시도 한도를 초과하거나 다른 종류의 에러일 경우 실패 반환
        else {
            const errMsg = data.error?.message || 'Gemini API 호출 중 오류가 발생했습니다.';
            return new Response(JSON.stringify({ error: { message: errMsg } }), { status: response.status, headers: { 'Content-Type': 'application/json' } });
        }
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: { message: error.message } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
