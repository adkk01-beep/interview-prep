export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: { message: 'POST 요청만 허용됩니다.' }
    });
  }

  try {
    const { prompt } = req.body;

    const keys = [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4
    ].filter(key => key && key.trim() !== '');

    if (keys.length === 0) {
      return res.status(500).json({
        error: {
          message:
            '서버에 API 키가 설정되지 않았습니다. Vercel 환경변수를 확인해주세요.'
        }
      });
    }

    // 등록된 API 키 중 하나 선택
    const randomKey =
      keys[Math.floor(Math.random() * keys.length)];

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ]
    };

    // Gemini 호출 함수
    async function callGemini(model) {

      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${randomKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

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
    }


    // -------------------------
    // 1차 : Gemini 3.8 Flash
    // -------------------------

    let result =
      await callGemini('gemini-3.8-flash');


    // 성공
    if (result.response.ok) {
      return res.status(200).json(result.data);
    }


    // -------------------------
    // 503일 때만
    // Gemini 3.7 Flash 사용
    // -------------------------

    if (result.response.status === 503) {

      result =
        await callGemini('gemini-3.7-flash');

      if (result.response.ok) {
        return res.status(200).json(result.data);
      }
    }


    // -------------------------
    // 429
    // -------------------------

    if (result.response.status === 429) {

      return res.status(429).json({
        error: {
          message:
            '현재 무료 API의 호출 한도에 도달했습니다(429). 잠시 후 다시 시도해주세요.'
        }
      });
    }


    // -------------------------
    // 503
    // -------------------------

    if (result.response.status === 503) {

      return res.status(503).json({
        error: {
          message:
            '현재 구글 AI 서버 사용량이 많아 피드백을 생성하지 못했습니다(503). 잠시 후 다시 시도해주세요.'
        }
      });
    }


    // -------------------------
    // 그 밖의 Gemini 오류
    // -------------------------

    const errMsg =
      result.data?.error?.message ||
      'Gemini API 호출 중 오류가 발생했습니다.';

    return res.status(result.response.status).json({
      error: {
        message: errMsg
      }
    });


  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: {
        message:
          'AI 피드백 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      }
    });

  }
}
