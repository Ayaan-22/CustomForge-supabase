/**
 * Quote values embedded in PostgREST logical filters. The SDK handles URL encoding;
 * commas, parentheses, quotes and backslashes must stay inside one filter value.
 * See https://docs.postgrest.org/en/v14/references/api/url_grammar.html#reserved-characters
 */
export const quotePostgrestFilterValue = (value) =>
  `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
