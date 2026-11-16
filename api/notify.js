/* 문의 알림 — 홈페이지 문의 폼이 보낸 내용을 텔레그램으로 전달한다.
 *
 * 예전에는 텔레그램 봇 토큰이 홈페이지 파일(index.html)에 들어 있어서
 * 누구나 소스 보기로 볼 수 있었다. 이제 토큰은 버셀 서버 안에만 있고
 * 브라우저로 내려가지 않는다. 홈페이지는 이 주소(/api/notify)로 문의 내용만 보낸다.
 *
 * 버셀에 넣어 둘 값 (Settings → Environment Variables)
 *   TELEGRAM_BOT_TOKEN  @BotFather 에서 받은 봇 토큰
 *   TELEGRAM_CHAT_ID    알림을 받을 내 텔레그램 아이디(숫자)
 * 값을 넣거나 바꾼 뒤에는 Redeploy 를 한 번 해야 적용된다.
 */

function clean(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'POST 로만 받습니다.' });
    return;
  }
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      /* 값이 아직 없으면 홈페이지가 이메일 알림으로 넘어간다 */
      res.status(503).json({ ok: false, error: '알림 설정이 아직 없습니다.' });
      return;
    }

    const b = req.body || {};
    const name = clean(b.name, 40);
    const tel = clean(b.tel, 30);
    const type = clean(b.type, 40);
    const msg = clean(b.msg, 1000);
    if (!name || tel.replace(/\D/g, '').length < 8) {
      res.status(400).json({ ok: false, error: '이름과 연락처를 확인해 주세요.' });
      return;
    }

    const when = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
    const text =
      '🔔 새 문의가 들어왔습니다\n\n' +
      `문의 유형 : ${type}\n이름 : ${name}\n연락처 : ${tel}\n내용 : ${msg || '(없음)'}\n\n` +
      `${when}\n민아트속눈썹연구소 홈페이지`;

    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) {
      res.status(502).json({ ok: false, error: '텔레그램 전송에 실패했습니다.' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: '전송 중 오류가 났습니다.' });
  }
};
