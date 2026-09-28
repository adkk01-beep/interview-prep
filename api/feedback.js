export default async function handler(req, res) {
  // POST 요청만 허용
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST 요청만 허용됩니다."
    });
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: "프롬프트가 없습니다."
      });
    }

    // Vercel 환경변수에 등록된 Gemini API 키
    const keys = [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4
    ].filter(Boolean);

    if (keys.length === 0) {
      return res.status(500).json({
        error: "Gemini API 키가 설정되어 있지 않습니다."
      });
    }

    // 등록된 키 중 하나를 무작위로 선택
    const randomKey =
      keys[Math.floor(Math.random() * keys.length)];

    // Gemini에 보낼 내용
    const payload = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],

      // Gemini 3.8 Flash의 사고 수준을 낮춰
      // 응답 지연 시간을 줄임
      generationConfig: {
        thinkingConfig: {
          thinkingLevel: "low"
        }
      }
    };

    // Gemini API 호출 함수
    async function callGemini(model) {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${randomKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      let data;

      try {
        data = await response.json();
      } catch (e) {
        data = null;
      }

      return {
        status: response.status,
        ok: response.ok,
        data
      };
    }

    // 1차: Gemini 3.8 Flash
    let result = await callGemini("gemini-3.8-flash");

    // 정상 응답
    if (result.ok) {
      return res.status(200).json(result.data);
    }

    // 사용량 제한인 경우
    if (result.status === 429) {
      return res.status(429).json({
        error:
          "현재 Gemini API 사용량 제한에 도달했습니다(429). 잠시 후 다시 시도해주세요."
      });
    }

    // 3.8 Flash가 503이면 3.7 Flash로 한 번만 재시도
    if (result.status === 503) {
      result = await callGemini("gemini-3.7-flash");

      if (result.ok) {
        return res.status(200).json(result.data);
      }

      if (result.status === 429) {
        return res.status(429).json({
          error:
            "현재 Gemini API 사용량 제한에 도달했습니다(429). 잠시 후 다시 시도해주세요."
        });
      }

      if (result.status === 503) {
        return res.status(503).json({
          error:
            "현재 구글 AI 서버 사용량이 많아 피드백을 생성하지 못했습니다(503). 잠시 후 다시 시도해주세요."
        });
      }
    }

    // 그 밖의 Gemini API 오류
    const apiMessage =
      result.data?.error?.message ||
      `Gemini API 오류가 발생했습니다 (${result.status}).`;

    return res.status(result.status || 500).json({
      error: apiMessage
    });

  } catch (error) {
    console.error("Feedback API error:", error);

    return res.status(500).json({
      error:
        "피드백 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
    });
  }
}
