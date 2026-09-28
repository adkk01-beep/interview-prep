export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        error: { message: 'POST 요청만 허용됩니다.' }
      }),
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
            message:
              '서버에 API 키가 설정되지 않았습니다. Vercel 환경변수를 확인해주세요.'
          }
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 기존 방식 그대로: 등록된 API 키 중 하나 선택
    const randomKey =
      keys[Math.floor(Math.random() * keys.length)];

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    };

    // Gemini 모델을 한 번 호출하는 함수
    async function callGemini(model) {
      const controller = new AbortController();

      // Vercel이 강제 종료하기 전에 자체적으로 중단
      const timeoutId = setTimeout(
        () => controller.abort(),
        12000
      );

      try {
        const url =
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${randomKey}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        let data;

        try {
          data = await response.json();
        } catch {
          data = {
            error: {
              message: 'Gemini API 응답을 해석할 수 없습니다.'
            }
          };
        }

        return {
          response,
          data
        };

      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    }

    try {
      // 1차: Gemini 3.8 Flash
      let result = await callGemini('gemini-3.8-flash');

      // 성공
      if (result.response.ok) {
        return new Response(
          JSON.stringify(result.data),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // 503일 때만 Gemini 3.7 Flash로 한 번 대체 시도
      if (result.response.status === 503) {

        result = await callGemini('gemini-3.7-flash');

        if (result.response.ok) {
          return new Response(
            JSON.stringify(result.data),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
      }

      // 429: 재시도하지 않음
      if (result.response.status === 429) {
        return new Response(
          JSON.stringify({
            error: {
              message:
                '현재 무료 API의 호출 한도에 도달했습니다(429). 잠시 후 다시 시도해주세요.'
            }
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // 503: 3.8과 3.7 모두 사용 불가능
      if (result.response.status === 503) {
        return new Response(
          JSON.stringify({
            error: {
              message:
                '현재 구글 AI 서버 사용량이 많아 피드백을 생성하지 못했습니다(503). 잠시 후 다시 시도해주세요.'
            }
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // 그 밖의 API 오류
      const errMsg =
        result.data?.error?.message ||
        'Gemini API 호출 중 오류가 발생했습니다.';

      return new Response(
        JSON.stringify({
          error: { message: errMsg }
        }),
        {
          status: result.response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );

    } catch (error) {

      // 12초 이상 응답이 없으면 추가 재시도하지 않음
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

      throw error;
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
