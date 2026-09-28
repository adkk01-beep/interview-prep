export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: { message: 'POST 요청만 허용됩니다.' } }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    );
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
      return new Response(
        JSON.stringify({
          error: {
            message: '서버에 API 키가 설정되지 않았습니다. Vercel 환경변수를 확인해주세요.'
          }
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const randomKey = keys[Math.floor(Math.random() * keys.length)];

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${randomKey}`;

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.3
      }
    };

    let attempt = 0;
    const maxRetries = 1;

    while (attempt <= maxRetries) {

      // 재시도할 때마다 새로운 AbortController 생성
      const controller = new AbortController();

      // Vercel이 강제로 종료하기 전에 Gemini 요청을 중단
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 12000);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        // 정상 응답
        if (response.ok) {
          return new Response(
            JSON.stringify(data),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }

        // 503 또는 429일 때만 최대 1회 재시도
        if (
          (response.status === 503 || response.status === 429) &&
          attempt < maxRetries
        ) {
          attempt++;

          // 짧게 기다린 뒤 한 번만 재시도
          await new Promise(resolve => setTimeout(resolve, 1000));

          continue;
        }

        // 재시도 후에도 실패한 경우
        let errMsg =
          data.error?.message ||
          'Gemini API 호출 중 오류가 발생했습니다.';

        if (response.status === 503) {
          errMsg =
            '현재 구글 AI 서버 사용량이 많아 처리 지연(503)이 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else if (response.status === 429) {
          errMsg =
            '무료 제공 한도에 도달했습니다(429). 잠시 후 다시 시도해주세요.';
        }

        return new Response(
          JSON.stringify({
            error: { message: errMsg }
          }),
          {
            status: response.status,
            headers: { 'Content-Type': 'application/json' }
          }
        );

      } catch (error) {

        clearTimeout(timeoutId);

        // ★ 12초 타임아웃은 재시도하지 않음
        if (error.name === 'AbortError') {
          return new Response(
            JSON.stringify({
              error: {
                message:
                  'AI 서버 응답이 지연되어 요청을 중단했습니다. 잠시 후 다시 시도해주세요.'
              }
            }),
            {
              status: 504,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }

        // 그 외 예상하지 못한 오류
        throw error;
      }
    }

  } catch (error) {

    return new Response(
      JSON.stringify({
        error: {
          message: error.message
        }
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
