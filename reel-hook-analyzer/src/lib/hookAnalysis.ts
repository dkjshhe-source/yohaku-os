export type HookScoreLevel = 'good' | 'ok' | 'weak';

export interface HookCriterion {
  id: string;
  label: string;
  level: HookScoreLevel;
  reason: string;
}

export interface HookAnalysisResult {
  criteria: HookCriterion[];
  summary: string;
  suggestions: string[];
  isReference: true;
}

const AUDIENCE_PATTERNS =
  /(あなた|あなたが|向け|悩んで|困って|したい人|してる人|してる方|している人|の人へ|さんへ|初心者|経験者|ママ|パパ|会社員|フリーランス|起業|経営|デザイナー|エンジニア|マーケ|就活|転職|学生)/;

const PROBLEM_PATTERNS =
  /(なぜ|どうして|できない|うまくいかない|失敗|疲れ|不安|迷って|わからない|分からない|つらい|損|ムダ|無駄|続かない|伸びない|見られない|フォロワー|再生数|離脱|時間がない|忙しい)/;

const CURIOSITY_PATTERNS =
  /(実は|意外|知らない|知ってた|秘密|コツ|方法|やり方|理由|本当は|これだけ|たった|見て|続き|後で|最後まで|衝撃|注意|警告|教えて|解説|まとめ)/;

const BENEFIT_PATTERNS =
  /(分かる|わかる|できる|増える|減る|改善|解決|手に入る|身につく|変わる|上がる|下がる|節約|時短|簡単|すぐ|今日から|無料|得する|わかるように)/;

const ABSTRACT_ONLY =
  /^(今日の|毎日|おすすめ|紹介|話題|トレンド|すごい|やばい|神|最高|必見|チェック|リール|投稿).{0,8}$/;

function levelFromBools(good: boolean, ok: boolean): HookScoreLevel {
  if (good) return 'good';
  if (ok) return 'ok';
  return 'weak';
}

export function analyzeHook(hookText: string): HookAnalysisResult {
  const text = hookText.trim();
  if (!text) {
    return {
      criteria: [],
      summary: 'フック文が未入力です。入力するとルールベースの参考評価を表示します。',
      suggestions: [],
      isReference: true,
    };
  }

  const len = text.length;
  const hasAudience = AUDIENCE_PATTERNS.test(text);
  const hasProblem = PROBLEM_PATTERNS.test(text);
  const hasCuriosity = CURIOSITY_PATTERNS.test(text);
  const hasBenefit = BENEFIT_PATTERNS.test(text);
  const tooAbstract = ABSTRACT_ONLY.test(text) || (len < 8 && !hasProblem && !hasBenefit);
  const standaloneOk = len >= 12 && (hasAudience || hasProblem || hasBenefit || hasCuriosity);

  const criteria: HookCriterion[] = [
    {
      id: 'audience',
      label: '誰向けの内容か分かるか',
      level: levelFromBools(hasAudience, /人|方|あなた|向け/.test(text)),
      reason: hasAudience
        ? '対象者を示す表現が含まれています。'
        : '誰に向けた投稿かが一読では分かりにくい可能性があります。',
    },
    {
      id: 'problem',
      label: '見る人の悩みや状況が具体的か',
      level: levelFromBools(hasProblem && len >= 15, hasProblem || len >= 20),
      reason: hasProblem
        ? '悩み・状況に触れる表現があります。'
        : '具体的な悩みや状況が弱いと、スワイプされやすくなります。',
    },
    {
      id: 'reason',
      label: '続きを見る理由があるか',
      level: levelFromBools(hasCuriosity, hasBenefit || hasProblem),
      reason: hasCuriosity
        ? '好奇心や続きを促す要素があります。'
        : '「なぜ見続けるのか」が弱い可能性があります。',
    },
    {
      id: 'benefit',
      label: '得られることが伝わるか',
      level: levelFromBools(hasBenefit, hasCuriosity),
      reason: hasBenefit
        ? '得られる変化や結果に触れています。'
        : '視聴後に何が得られるかが曖昧かもしれません。',
    },
    {
      id: 'concrete',
      label: '抽象的すぎないか',
      level: tooAbstract ? 'weak' : len >= 18 ? 'good' : 'ok',
      reason: tooAbstract
        ? '抽象的・短い表現に寄っており、具体性が不足している可能性があります。'
        : 'ある程度の具体性があります（参考評価）。',
    },
    {
      id: 'standalone',
      label: '冒頭の表示・発話だけで意味が伝わるか',
      level: levelFromBools(standaloneOk && len <= 60, standaloneOk || (len >= 10 && len <= 80)),
      reason:
        len > 80
          ? '長めなので、画面上の冒頭表示では途中で切れる可能性があります。'
          : standaloneOk
            ? '短い文脈でも意味が通りやすい長さ・内容です。'
            : '冒頭だけで完結して伝わらない可能性があります。',
    },
  ];

  const weakCount = criteria.filter((c) => c.level === 'weak').length;
  const goodCount = criteria.filter((c) => c.level === 'good').length;

  let summary: string;
  if (weakCount >= 4) {
    summary =
      '参考評価では改善余地が大きいフックです。「必ず伸びない」という意味ではなく、対象・悩み・続きの理由を明確にすると検証しやすくなります。';
  } else if (goodCount >= 4) {
    summary =
      '参考評価では比較的条件が揃っています。伸びを保証するものではないため、維持率や保存・フォローと合わせて確認してください。';
  } else {
    summary =
      '参考評価は中程度です。弱い観点を1つずつ変えて、次の投稿で検証するのがおすすめです。';
  }

  const suggestions = buildSuggestions(text, criteria);
  return { criteria, summary, suggestions, isReference: true };
}

function buildSuggestions(text: string, criteria: HookCriterion[]): string[] {
  const suggestions: string[] = [];
  const weakIds = new Set(criteria.filter((c) => c.level === 'weak').map((c) => c.id));

  if (weakIds.has('audience') || weakIds.has('problem')) {
    suggestions.push(
      `「${trimHook(text)}」→ 誰の・どんな状況かを一言足す（例：〇〇で悩んでいる人へ／〇〇が続かないとき）。`,
    );
  } else {
    suggestions.push(
      `意図を保ちつつ具体性を上げる：「${trimHook(text)}」のあとに数字や期限を1つ足す（例：3つの理由／今日から）。`,
    );
  }

  if (weakIds.has('reason') || weakIds.has('benefit')) {
    suggestions.push(
      `続きの理由を明示：「${trimHook(text)}」→ 後半で何が分かるか／どう変わるかを鉤括弧や「〜する方法」で示す。`,
    );
  } else {
    suggestions.push(
      `冒頭の切り口を少しずらす：同じ主張のまま「やってはいけない」「意外と知らない」など検証用の言い回しに変更。`,
    );
  }

  if (weakIds.has('concrete') || weakIds.has('standalone')) {
    suggestions.push(
      `短く言い切る版：核心だけ残して20〜40字前後に圧縮し、画面上でも意味が通るか確認する。`,
    );
  } else {
    suggestions.push(
      `CTAとの接続を意識：フックの約束と最後の行動喚起が一致する言い回しに整える（例：保存して後で試す前提のフック）。`,
    );
  }

  return suggestions.slice(0, 3);
}

function trimHook(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 40 ? `${t.slice(0, 40)}…` : t;
}
