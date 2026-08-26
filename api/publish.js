/* 「웹에 반영하기」 — 관리자가 만든 index.html 을 깃허브에 저장한다.
 *
 * 이 홈페이지의 관리자 페이지는 고친 내용을 담은 index.html 을 통째로 만들어 낸다.
 * 예전에는 그걸 내려받아 사람이 다시 올렸다. 이 파일이 그 수고를 대신한다.
 *
 * 깃허브 열쇠는 버셀 서버 안에만 있고 브라우저로 내려가지 않는다.
 * 사장님은 비밀번호만 아시면 된다.
 *
 * 버셀에 넣어 둘 값 (Settings → Environment Variables)
 *   GITHUB_TOKEN   깃허브 토큰 (Contents: Read and write)
 *   GITHUB_REPO    계정명/저장소명
 *   ADMIN_PIN      관리자 비밀번호
 *   GITHUB_BRANCH  (선택) 기본값 main
 */

const API = 'https://api.github.com';

function envOrDie(name) {
  const v = process.env[name];
  if (!v) throw new Error(`버셀에 ${name} 값이 없습니다. 프로젝트 Settings → Environment Variables 에서 넣어 주세요.`);
  return v;
}

async function gh(path, token, options = {}) {
  const r = await fetch(API + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'minart-admin',
      ...(options.headers || {}),
    },
  });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (e) { body = { raw: text }; }
  if (!r.ok) {
    const err = new Error(`깃허브 응답 ${r.status} — ${(body && body.message) || r.statusText}`);
    err.status = r.status;
    throw err;
  }
  return body;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'POST 로만 받습니다.' });
    return;
  }
  try {
    const token = envOrDie('GITHUB_TOKEN');
    const repo = envOrDie('GITHUB_REPO');
    const pin = envOrDie('ADMIN_PIN');
    const branch = process.env.GITHUB_BRANCH || 'main';
    const [owner, name] = repo.split('/');
    if (!owner || !name) throw new Error('GITHUB_REPO 는 「계정명/저장소명」 모양이어야 합니다.');

    const body = req.body || {};
    if (String(body.pin || '') !== String(pin)) {
      res.status(401).json({ ok: false, error: '비밀번호가 맞지 않습니다.' });
      return;
    }

    const html = String(body.html || '');
    if (html.length < 20000 || html.indexOf('/*SITE_DATA_START*/') < 0) {
      throw new Error('보내온 내용이 홈페이지 파일이 아닌 것 같습니다. 다시 시도해 주세요.');
    }
    /* 열쇠 같은 것이 파일에 섞여 들어가는 것을 서버에서 한 번 더 막는다 */
    if (/\d{9,10}:AA[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9]{20,}/.test(html)) {
      throw new Error('파일 안에 열쇠로 보이는 값이 있습니다. 저장하지 않았습니다.');
    }

    /* 지금 올라가 있는 파일과 같으면 저장하지 않는다 */
    let sha = null;
    try {
      const cur = await gh(`/repos/${owner}/${name}/contents/index.html?ref=${branch}`, token);
      sha = cur.sha;
      const now = Buffer.from(cur.content || '', 'base64').toString('utf8');
      if (now === html) {
        res.status(200).json({ ok: true, 바뀐것없음: true });
        return;
      }
    } catch (e) {
      if (e.status !== 404) throw e;
    }

    const put = await gh(`/repos/${owner}/${name}/contents/index.html`, token, {
      method: 'PUT',
      body: JSON.stringify({
        message: body.message || '관리자 페이지에서 내용 수정',
        content: Buffer.from(html, 'utf8').toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });

    res.status(200).json({ ok: true, 크기: Math.round(html.length / 1024) + ' KB', 기록: put.commit.sha.slice(0, 7) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
};
