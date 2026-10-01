export const estimateTokens = (text: string): number => Math.ceil(text.length / 3.5);

export function truncateMiddle(text: string, maxTokens: number): string {
  const maxChars = Math.floor(maxTokens * 3.5);
  if (text.length <= maxChars) return text;
  const half = Math.floor((maxChars - 40) / 2);
  return `${text.slice(0, half)}\n… [${text.length - 2 * half} chars truncated] …\n${text.slice(-half)}`;
}
