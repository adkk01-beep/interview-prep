export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'POST 요청만 허용됩니다.' } });
  }

  try {
    const { prompt } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: { message: '피드백 요청 내용이 없습니다.' } });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: { message: '서버에 OPENAI_API_KEY가 설정되지 않았습니다. Vercel 환경변수를 확인해주세요.' }
      });
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-6-luna',
        reasoning: { effort: 'none' },
        input: prompt
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || `OpenAI API 호출 중 오류가 발생했습니다. (${response.status})`;
      console.error('OpenAI API error:', response.status, errMsg);
      return res.status(response.status).json({ error: { message: errMsg } });
    }

    const text = (data.output || [])
      .filter(item => item?.type === 'message')
      .flatMap(item => item.content || [])
      .filter(part => part?.type === 'output_text' && typeof part.text === 'string')
      .map(part => part.text)
      .join('\n')
      .trim();

    if (!text) {
      console.error('OpenAI response did not contain output_text.');
      return res.status(500).json({
        error: { message: 'AI 응답에서 피드백 문장을 찾지 못했습니다. 다시 시도해주세요.' }
      });
    }

    return res.status(200).json({ text });
  } catch (error) {
    console.error('Feedback API error:', error);
    return res.status(500).json({
      error: { message: error?.message || '서버에서 알 수 없는 오류가 발생했습니다.' }
    });
  }
}
