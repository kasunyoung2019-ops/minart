/* 알림 — 홈페이지에서 들어온 문의·교육 신청·행사 신청을 텔레그램으로 전달한다.
 *
 * 예전에는 텔레그램 봇 토큰이 홈페이지 파일(index.html)에 들어 있어서
 * 누구나 소스 보기로 볼 수 있었다. 이제 토큰은 버셀 서버 안에만 있고
 * 브라우저로 내려가지 않는다. 홈페이지는 이 주소(/api/notify)로 내용만 보낸다.
 *
 * 받는 종류 (body.kind)
 *   (없음)   일반 문의        { name, tel, type, msg }
 *   academy  교육 신청서      { course, option, price, name, tel, birth, area, career, want }
 *   event    행사 신청(팝업)  { event, options[], name, tel, msg }
 *
 * 버셀에 넣어 둘 값 (Settings → Environment Variables)
 *   TELEGRAM_BOT_TOKEN  @BotFather 에서 받은 봇 토큰
 *   TELEGRAM_CHAT_ID    알림을 받을 내 텔레그램 아이디(숫자)
 * 값을 넣거나 바꾼 뒤에는 Redeploy 를 한 번 해야 적용된다.
 */

function clean(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

function buildText(b, when) {
  const name = clean(b.name, 40);
  const tel = clean(b.tel, 30);
  const foot = `\n\n${when}\n민아트속눈썹연구소 홈페이지`;

  if (b.kind === 'academy') {
    const course = clean(b.course, 80);
    const option = clean(b.option, 60);
    return (
      '🎓 교육 신청이 들어왔습니다\n\n' +
      `과정 : ${course}${option ? ' (' + option + ')' : ''}\n교육비 : ${clean(b.price, 40) || '-'}\n\n` +
      `이름 : ${name}\n연락처 : ${tel}\n생년월일 : ${clean(b.birth, 30) || '-'}\n지역 : ${clean(b.area, 60) || '-'}\n\n` +
      `[경력]\n${clean(b.career, 800) || '-'}\n\n[배우고 싶은 부분 · 하고 싶은 말]\n${clean(b.want, 1000) || '-'}` +
      foot
    );
  }

  if (b.kind === 'event') {
    const opts = (Array.isArray(b.options) ? b.options : []).slice(0, 5).map(o => clean(o, 60)).filter(Boolean);
    return (
      '🎟 행사 신청이 들어왔습니다\n\n' +
      `행사 : ${clean(b.event, 80)}\n신청 : ${opts.join(' / ') || '-'}\n\n` +
      `이름 : ${name}\n연락처 : ${tel}\n\n[남기신 말씀]\n${clean(b.msg, 800) || '(없음)'}` +
      foot
    );
  }

  return (
    '🔔 새 문의가 들어왔습니다\n\n' +
    `문의 유형 : ${clean(b.type, 40)}\n이름 : ${name}\n연락처 : ${tel}\n내용 : ${clean(b.msg, 1000) || '(없음)'}` +
    foot
  );
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
    if (!clean(b.name, 40) || clean(b.tel, 30).replace(/\D/g, '').length < 8) {
      res.status(400).json({ ok: false, error: '이름과 연락처를 확인해 주세요.' });
      return;
    }

    const when = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
    const text = buildText(b, when).slice(0, 3900);

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
