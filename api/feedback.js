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
    ];

    console.log("====================================");
    console.log("API KEY 4개 진단 시작");
    console.log("프롬프트 글자 수:", prompt.length);
    console.log("====================================");

    const payload = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    };

    async function testKey(key, keyNumber) {
      // 환경변수가 비어 있는 경우
      if (!key) {
        console.log(`KEY ${keyNumber} → 환경변수 없음`);

        return {
          keyNumber,
          status: "NO_KEY",
          message: "환경변수가 설정되어 있지 않음"
        };
      }

      const model = "gemini-3.8-flash";

      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

      const startTime = Date.now();

      console.log("------------------------------------");
      console.log(`KEY ${keyNumber} → ${model} 요청 시작`);

      try {
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

        console.log(
          `KEY ${keyNumber} → HTTP 상태: ${response.status}`
        );

        console.log(
          `KEY ${keyNumber} → 응답 시간: ${elapsed} ms`
        );

        if (!response.ok) {
          console.log(
            `KEY ${keyNumber} → 오류 메시지:`,
            data?.error?.message || "오류 메시지 없음"
          );

          console.log(
            `KEY ${keyNumber} → 오류 상태:`,
            data?.error?.status || "상태 정보 없음"
          );
        } else {
          console.log(`KEY ${keyNumber} → 성공`);
        }

        return {
          keyNumber,
          status: response.status,
          elapsed,
          message:
            data?.error?.message ||
            (response.ok ? "SUCCESS" : "UNKNOWN ERROR")
        };

      } catch (error) {
        const elapsed = Date.now() - startTime;

        console.log(
          `KEY ${keyNumber} → 호출 자체에서 오류 발생`
        );

        console.log(
          `KEY ${keyNumber} →`,
          error?.message || String(error)
        );

        return {
          keyNumber,
          status: "FETCH_ERROR",
          elapsed,
          message: error?.message || String(error)
        };
      }
    }

    // ==========================================
    // API KEY 1~4를 각각 한 번씩 검사
    // ==========================================

    const results = [];

    for (let i = 0; i < keys.length; i++) {
      const result = await testKey(keys[i], i + 1);
      results.push(result);
    }

    console.log("====================================");
    console.log("API KEY 진단 결과 요약");

    for (const result of results) {
      console.log(
        `KEY ${result.keyNumber} → ${result.status} / ${result.elapsed ?? "-"} ms`
      );
    }

    console.log("====================================");
    console.log("API KEY 진단 종료");
    console.log("====================================");

    // 진단 결과를 브라우저에도 표시
    const summary = results
      .map((r) => {
        return (
          `KEY ${r.keyNumber}: ` +
          `${r.status}` +
          (r.elapsed !== undefined
            ? ` (${r.elapsed}ms)`
            : "")
        );
      })
      .join("\n");

    return res.status(503).json({
      error:
        "API 키 진단이 완료되었습니다.\n\n" +
        summary +
        "\n\nVercel Logs에서 상세 결과를 확인해주세요."
    });

  } catch (error) {
    console.error("===== 진단 코드 자체 오류 =====");
    console.error(error);

    return res.status(500).json({
      error:
        "API 키 진단 중 오류가 발생했습니다."
    });
  }
}
