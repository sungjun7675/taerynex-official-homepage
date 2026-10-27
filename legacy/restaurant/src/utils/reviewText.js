const noiseTerms = [
  "방문자리뷰",
  "블로그리뷰",
  "리뷰",
  "사진",
  "더보기",
  "네이버",
  "영수증",
  "예약",
  "저장",
  "공유",
  "길찾기",
  "전화",
  "홈",
  "메뉴",
  "소식",
  "쿠폰",
];

const noisePatterns = [
  /을왕리\s*동해회조개구이/,
  /방문자리뷰|블로그리뷰|리뷰\s*\d+|사진\s*\d+/,
  /쿠폰|소식|메뉴|지도|주변|팔로우|반응\s*남기기/,
  /더보기|음식이\s*맛있어요|친절해요|뷰가\s*좋아요/,
  /예약\s*없이|대기\s*시간|바로\s*입장|나들이|데이트/,
  /번째\s*방문|영수증|점심에\s*방문|저녁에\s*방문/,
  /팔로우|만족도\s*\d+|서비스\s*\d+|조개구이\s*\d+|칼국수\s*\d+/,
];

const brokenOcrPatterns = [
  /[+*＊]\s*\d+/,
  /[A-Za-z]\s+[A-Za-z]/,
  /(^|\s)[A-Za-z]{1,2}(\s|$)/,
  /모측|모축|모드\s+바|시인들|바조|모착|모축하여/,
];

const sentenceStartNoisePattern = /^(에|로|랑|와|과|은|는|이|가|을|를|도|만)\s/;
const maskedAuthorPattern = /[A-Za-z0-9가-힣]{2,}[*＊]{2,}[A-Za-z0-9가-힣]*/;

const normalizeLine = (line) =>
  line
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/^[^가-힣A-Za-z0-9]+/, "")
    .trim();

const isLikelyReviewLine = (line) => {
  if (line.length <= 1) {
    return false;
  }

  if (noiseTerms.some((term) => line.includes(term))) {
    return false;
  }

  if (noisePatterns.some((pattern) => pattern.test(line))) {
    return false;
  }

  if (brokenOcrPatterns.some((pattern) => pattern.test(line))) {
    return false;
  }

  if (sentenceStartNoisePattern.test(line)) {
    return false;
  }

  const compact = line.replace(/\s/g, "");
  const hangulCount = (compact.match(/[가-힣]/g) ?? []).length;
  const latinCount = (compact.match(/[A-Za-z]/g) ?? []).length;
  const digitCount = (compact.match(/\d/g) ?? []).length;
  const symbolCount = (compact.match(/[^가-힣A-Za-z0-9.,!?~ㅋㅎㅠㅜ]/g) ?? []).length;

  if (hangulCount < 8) {
    return false;
  }

  if (latinCount > 0 && hangulCount > 5) {
    return false;
  }

  if (latinCount > 2 && latinCount > hangulCount * 0.18) {
    return false;
  }

  if (digitCount > hangulCount * 0.4) {
    return false;
  }

  if (symbolCount > hangulCount * 0.3) {
    return false;
  }

  return hangulCount / compact.length >= 0.5;
};

export const normalizeOcrReviewText = (value, maxLength = 900) =>
  String(value ?? "")
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(isLikelyReviewLine)
    .join("\n")
    .replace(/[.·]{4,}/g, "...")
    .slice(0, maxLength);

const getCandidateLines = (value) =>
  String(value ?? "")
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter((line) => line.length > 1);

const cleanAuthorCandidate = (line) =>
  line
    .replace(/^[A-Za-z]\s+(?=[가-힣])/u, "")
    .replace(/[^\p{L}\p{N}_*＊-]+/gu, "")
    .replace(/＊/g, "*")
    .trim();

const extractAuthor = (value) => {
  const lines = getCandidateLines(value)
    .filter((line) => !noiseTerms.some((term) => line.includes(term)))
    .filter((line) => !noisePatterns.some((pattern) => pattern.test(line)));

  const maskedAuthor = lines
    .map((line) => cleanAuthorCandidate(line).match(maskedAuthorPattern)?.[0] ?? "")
    .find((line) => line.length >= 4 && line.length <= 18);

  if (maskedAuthor) {
    return maskedAuthor;
  }

  const candidates = lines
    .map(cleanAuthorCandidate)
    .filter((line) => {
      const hangulCount = (line.match(/[가-힣]/g) ?? []).length;
      const latinCount = (line.match(/[A-Za-z]/g) ?? []).length;
      const digitCount = (line.match(/\d/g) ?? []).length;
      const hasUppercaseNoise = /[A-Z]{3,}/.test(line) && hangulCount > 0;

      return (
        hangulCount >= 2 &&
        line.length >= 3 &&
        line.length <= 18 &&
        latinCount <= Math.max(4, hangulCount) &&
        digitCount <= 6 &&
        !hasUppercaseNoise
      );
    });

  return candidates[0] ?? "";
};

const extractTime = (value) => {
  const lines = getCandidateLines(value).filter(
    (line) => !line.includes("동해회조개구이") && !line.includes("을왕리"),
  );

  for (const line of lines) {
    const fullDateMatch = line.match(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);

    if (fullDateMatch) {
      return `${Number(fullDateMatch[2])}.${Number(fullDateMatch[3])}.`;
    }

    const shortDateMatch = line.match(/(^|[^0-9])(\d{1,2})\s*[.월]\s*(\d{1,2})\s*[.일]?\s*([월화수목금토일])?/);

    if (shortDateMatch) {
      const weekday = shortDateMatch[4] ? shortDateMatch[4] : "";

      return `${Number(shortDateMatch[2])}.${Number(shortDateMatch[3])}.${weekday}`;
    }
  }

  return "";
};

const extractRating = (value) => {
  const text = String(value ?? "");
  const starMatch = text.match(/[★⭐]\s*([1-5])/);
  const labelMatch = text.match(/(?:별점|평점)\s*([1-5])/);

  return Number(starMatch?.[1] ?? labelMatch?.[1] ?? 5);
};

export const maskReviewAuthor = (author) => {
  const cleanAuthor = String(author ?? "").trim();

  if (!cleanAuthor || cleanAuthor.includes("*")) {
    return cleanAuthor;
  }

  const characters = Array.from(cleanAuthor);

  if (characters.length <= 2) {
    return `${characters[0] ?? ""}*`;
  }

  if (characters.length <= 4) {
    return `${characters[0]}**${characters.at(-1)}`;
  }

  return `${characters.slice(0, 2).join("")}**${characters.slice(-2).join("")}`;
};

export const extractReviewMetadata = (value) => {
  const author = extractAuthor(value);

  return {
    author: maskReviewAuthor(author),
    rawAuthor: author,
    rating: extractRating(value),
    text: normalizeOcrReviewText(value),
    time: extractTime(value),
  };
};

export const formatPublicReviewText = (value, maxLength = 180) => {
  const normalizedText = normalizeOcrReviewText(value, maxLength).replace(/\s*\n\s*/g, " ");

  if (normalizedText) {
    return normalizedText;
  }

  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
};

export const formatPublicReviewAuthor = (review) => {
  const currentAuthor = String(review?.author ?? "").trim();
  const shouldExtractAuthor = !currentAuthor || /^방문자\*+/.test(currentAuthor);

  if (!shouldExtractAuthor) {
    return maskReviewAuthor(currentAuthor);
  }

  return extractReviewMetadata(review?.text).author || "작성자 확인";
};

export const formatPublicReviewTime = (review) =>
  extractReviewMetadata(review?.text).time || review?.time || "최근 리뷰";

export const getReviewTextQuality = (value) => {
  const normalizedText = normalizeOcrReviewText(value, 900).replace(/\s+/g, " ").trim();
  const hangulCount = (normalizedText.match(/[가-힣]/g) ?? []).length;
  const brokenScore = brokenOcrPatterns.filter((pattern) => pattern.test(String(value ?? ""))).length;

  return {
    hangulCount,
    isUsable: hangulCount >= 32 && brokenScore === 0,
    normalizedText,
  };
};

export const isPublishableReview = ({ author, text }) => {
  const rawAuthor = String(author ?? "").trim();
  const publicAuthor = maskReviewAuthor(author);
  const quality = getReviewTextQuality(text);

  return Boolean(
    rawAuthor &&
      rawAuthor !== "작성자 확인" &&
      publicAuthor !== "작성자 확인" &&
      !/^방문자\*+/.test(publicAuthor) &&
      quality.isUsable,
  );
};
