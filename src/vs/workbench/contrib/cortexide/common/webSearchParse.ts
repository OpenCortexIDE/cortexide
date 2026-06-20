/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Pure parser for DuckDuckGo search results.
 *
 * The renderer cannot fetch html.duckduckgo.com directly (CORS), so web_search routes the
 * fetch through the main-process webContentExtractorService, which returns the page as
 * accessibility-tree markdown (NOT raw HTML). For a DuckDuckGo SERP that markdown is very
 * regular -- each organic result looks like:
 *
 *     ## [<title>](<ddg redirect>)
 *        [](<ddg redirect>)                                   <- favicon link (empty text)
 *     [<displayed url>](<ddg redirect>)                       <- the green displayed URL
 *     [<snippet prose, may contain [12] footnote markers>](<ddg redirect>)   <- description
 *
 * Each result begins with a `## ` heading. Within a result the SNIPPET is simply the longest
 * PROSE link-text (the favicon link is empty, the displayed-url has no spaces, the title is
 * medium, the description is long prose).
 *
 * This was extracted from toolsService so the (regex-heavy, easy-to-break) parsing can be unit
 * tested in node. Earlier in-place versions walked raw character ranges and broke on the
 * redirect URLs / footnote markers, yielding "No snippet available" or URL-encoded garbage --
 * which left the model with no facts and it then hallucinated.
 */

export interface WebSearchResult {
	title: string;
	snippet: string;
	url: string;
}

const decodeEntities = (s: string): string => s
	.replace(/&amp;/g, '&')
	.replace(/&lt;/g, '<')
	.replace(/&gt;/g, '>')
	.replace(/&quot;/g, '"')
	.replace(/&#x27;|&#39;/g, '\'')
	.replace(/&#x2F;|&#47;/g, '/')
	.replace(/&nbsp;/g, ' ');

const cleanText = (s: string): string => decodeEntities(s)
	.replace(/\[\d+\]/g, ' ')   // drop wiki footnote markers like [12]
	.replace(/\s+/g, ' ')
	.trim();

// DDG result hrefs are redirects: //duckduckgo.com/l/?uddg=<encoded real url>&rut=...
const extractRealUrl = (url: string): string | null => {
	if (!url) { return null; }
	const u = decodeEntities(url.trim());
	const uddg = u.match(/[?&]uddg=([^&]+)/);
	if (uddg) {
		try { return decodeURIComponent(uddg[1]); } catch { return null; }
	}
	return u.startsWith('http') ? u : null;
};

// A markdown link whose TEXT may itself contain [12]-style footnote markers (group 1 = text,
// group 2 = url). [^\[\]] also matches newlines, so multi-line snippets are captured.
const makeLinkRe = () => /\[([^\[\]]*(?:\[\d+\][^\[\]]*)*)\]\(([^)]*)\)/g;

/**
 * Parse the accessibility-tree markdown of a DuckDuckGo SERP into clean {title, snippet, url}
 * results. Returns at most `maxResults`. Returns [] if nothing parseable was found (the caller
 * treats that as a failed search method).
 */
export function parseDuckDuckGoMarkdown(content: string, maxResults: number): WebSearchResult[] {
	const results: WebSearchResult[] = [];
	if (!content) { return results; }

	const linkRe = makeLinkRe();

	// Split into per-result blocks on the `## ` headings (the first chunk is page chrome).
	const blocks = content.split(/\n#{1,6}\s+/);
	for (const block of blocks) {
		if (results.length >= maxResults) { break; }

		// Collect every markdown link in the block.
		const links: Array<{ text: string; url: string }> = [];
		linkRe.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = linkRe.exec(block)) !== null) {
			links.push({ text: m[1], url: m[2] });
		}
		if (links.length === 0) { continue; }

		// The first link in a block is the heading link -> title + canonical url.
		const url = extractRealUrl(links[0].url);
		const title = cleanText(links[0].text);
		if (!title || !url) { continue; }
		if (url.includes('duckduckgo.com') || url.includes('duck.com') || url.startsWith('#') || url.length >= 500) { continue; }

		// The snippet is the longest PROSE link-text in the block: skip empty texts, bare
		// domains/URLs (no whitespace) and an exact repeat of the title.
		let snippet = '';
		for (const l of links) {
			const t = cleanText(l.text);
			if (!t || t === title || !/\s/.test(t) || /^https?:\/\//i.test(t)) { continue; }
			if (t.length > snippet.length) { snippet = t; }
		}
		snippet = snippet.substring(0, 500).trim();

		results.push({
			title: title.substring(0, 200),
			snippet: snippet || 'No snippet available',
			url,
		});
	}

	return results;
}
