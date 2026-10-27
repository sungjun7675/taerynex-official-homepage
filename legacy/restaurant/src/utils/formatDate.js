export function formatDate(value, locale = "ko-KR") {
  return new Intl.DateTimeFormat(locale).format(new Date(value));
}
