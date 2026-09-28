export default async function handler(req, res) {
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

    // 어느 키를 사용했는지 번호만 기록
    // 실제 API 키 값은 절대 로그에 남기지 않음
    const keyIndex = Math.floor(Math.random() * keys.length);
    const randomKey = keys[keyIndex];

    console.log("===== AI FEEDBACK START =====");
    console.log("사용 API KEY 번호:", keyIndex + 1);
    console.log("프롬프트 글자 수:", prompt.length);

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
      generationConfig: {
        thinkingConfig: {
          thinkingLevel: "low"
        }
      }
    };

    async function callGemini(model) {
      const startTime = Date.now();

      console.log(`[${model}] 요청 시작`);

      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${randomKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const elapsed = Date.now() - startTime;

      let data;

      try {
        data = await response.json();
      } catch (e) {
        data = null;
      }

      console.log(`[${model}] HTTP 상태:`, response.status);
      console.log(`[${model}] 응답 시간:`, elapsed, "ms");

      // 오류일 때만 Google이 보낸 오류 내용을 기록
      if (!response.ok) {
        console.log(
          `[${model}] 오류 내용:`,
          JSON.stringify(data)
        );
      }

      return {
        status: response.status,
        ok: response.ok,
        data,
        elapsed
      };
    }

    // ① Gemini 3.8 Flash
    let result = await callGemini("gemini-3.8-flash");

    if (result.ok) {
      console.log("Gemini 3.8 Flash 성공");
      console.log("===== AI FEEDBACK END =====");

      return res.status(200).json(result.data);
    }

    if (result.status === 429) {
      console.log("Gemini 3.8 Flash → 429");
      console.log("===== AI FEEDBACK END =====");

      return res.status(429).json({
        error:
          "현재 Gemini API 사용량 제한에 도달했습니다(429). 잠시 후 다시 시도해주세요."
      });
    }

    // ② 3.8이 503일 때만 3.7로 재시도
    if (result.status === 503) {
      console.log(
        "Gemini 3.8 Flash → 503. Gemini 3.7 Flash로 재시도합니다."
      );

      result = await callGemini("gemini-3.7-flash");

      if (result.ok) {
        console.log("Gemini 3.7 Flash 성공");
        console.log("===== AI FEEDBACK END =====");

        return res.status(200).json(result.data);
      }

      if (result.status === 429) {
        console.log("Gemini 3.7 Flash → 429");
        console.log("===== AI FEEDBACK END =====");

        return res.status(429).json({
          error:
            "현재 Gemini API 사용량 제한에 도달했습니다(429). 잠시 후 다시 시도해주세요."
        });
      }

      if (result.status === 503) {
        console.log("Gemini 3.7 Flash → 503");
        console.log("===== AI FEEDBACK END =====");

        return res.status(503).json({
          error:
            "현재 구글 AI 서버 사용량이 많아 피드백을 생성하지 못했습니다(503). 잠시 후 다시 시도해주세요."
        });
      }
    }

    const apiMessage =
      result.data?.error?.message ||
      `Gemini API 오류가 발생했습니다 (${result.status}).`;

    console.log("기타 Gemini API 오류:", result.status);
    console.log("===== AI FEEDBACK END =====");

    return res.status(result.status || 500).json({
      error: apiMessage
    });

  } catch (error) {
    console.error("===== FEEDBACK FUNCTION ERROR =====");
    console.error(error);

    return res.status(500).json({
      error:
        "피드백 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
    });
  }
}
