/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { parseDuckDuckGoMarkdown } from '../../common/webSearchParse.js';

// A realistic DuckDuckGo SERP as accessibility-tree markdown, modelled byte-for-byte on the
// real output captured from webContentExtractorService (the redirect URLs, the empty favicon
// link, the displayed-url link, footnote markers like [12], parentheses inside the snippet,
// multi-line snippet text, and HTML entities). This is exactly the shape that the earlier
// naive parser mangled into "No snippet available" / URL-encoded garbage.
const WIKI_REDIRECT = 'https://duckduckgo.com/l/?uddg=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FInitial_public_offering_of_SpaceX&amp;rut=b1bb6a417a571b0d4998baa440df35c06b6bb5d89b0051f28fb6a2708dd61599';
const CNN_REDIRECT = 'https://duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.cnn.com%2F2026%2F06%2F12%2Fbusiness%2Flive-news%2Fspacex-goes-public-ipo&amp;rut=43128c99181d3b98700bd2faf527fdf3654039663967d03e4cf43a43d95af787';

const SERP = `   DuckDuckGo   when did SpaceX IPO happen
## [Initial public offering of SpaceX - Wikipedia](${WIKI_REDIRECT})

   [](${WIKI_REDIRECT})[en.wikipedia.org/wiki/Initial_public_offering_of_SpaceX](${WIKI_REDIRECT})[SpaceX, an American aerospace and artificial intelligence company founded in
2002 by Elon Musk, had its initial public offering (IPO) on June 12, 2026. [12][13]
The SpaceX IPO was initially valued at US$1.77 trillion, [14] making it the
largest public offering in history.](${WIKI_REDIRECT})
## [SpaceX shares debut after biggest IPO in history - CNN](${CNN_REDIRECT})

   [](${CNN_REDIRECT})[www.cnn.com/2026/06/12/business/live-news/spacex-goes-public-ipo ](${CNN_REDIRECT})[SpaceX soared Friday in its blockbuster stock market debut, with shares gaining 19% after Wall Street&#x27;s biggest-ever IPO.](${CNN_REDIRECT})
`;

suite('webSearchParse - parseDuckDuckGoMarkdown', () => {

	test('parses clean title/url/snippet for each result', () => {
		const out = parseDuckDuckGoMarkdown(SERP, 5);
		assert.strictEqual(out.length, 2);

		assert.strictEqual(out[0].title, 'Initial public offering of SpaceX - Wikipedia');
		assert.strictEqual(out[0].url, 'https://en.wikipedia.org/wiki/Initial_public_offering_of_SpaceX');
		assert.ok(out[0].snippet.includes('had its initial public offering (IPO) on June 12, 2026'), out[0].snippet);

		assert.strictEqual(out[1].title, 'SpaceX shares debut after biggest IPO in history - CNN');
		assert.strictEqual(out[1].url, 'https://www.cnn.com/2026/06/12/business/live-news/spacex-goes-public-ipo');
		assert.ok(out[1].snippet.includes('blockbuster stock market debut'), out[1].snippet);
	});

	test('snippets contain NO redirect/encoded/footnote/markdown garbage', () => {
		const out = parseDuckDuckGoMarkdown(SERP, 5);
		for (const r of out) {
			for (const field of [r.snippet, r.title]) {
				assert.ok(!field.includes('duckduckgo.com/l'), `redirect leaked: ${field}`);
				assert.ok(!field.includes('uddg='), `uddg leaked: ${field}`);
				assert.ok(!field.includes('%2F'), `percent-encoding leaked: ${field}`);
				assert.ok(!field.includes('rut='), `rut token leaked: ${field}`);
				assert.ok(!/\[\d+\]/.test(field), `footnote marker leaked: ${field}`);
				assert.ok(!/\]\(/.test(field), `markdown link syntax leaked: ${field}`);
				assert.ok(!field.includes('&amp;') && !field.includes('&#x27;'), `entity leaked: ${field}`);
			}
		}
	});

	test('decodes HTML entities in snippet text', () => {
		const out = parseDuckDuckGoMarkdown(SERP, 5);
		assert.ok(out[1].snippet.includes('Wall Street\'s'), out[1].snippet);
	});

	test('does NOT pick the bare displayed-URL as the snippet', () => {
		const out = parseDuckDuckGoMarkdown(SERP, 5);
		// the displayed-url link text 'en.wikipedia.org/wiki/...' has no whitespace and must be rejected
		assert.ok(!out[0].snippet.startsWith('en.wikipedia.org'), out[0].snippet);
	});

	test('respects maxResults', () => {
		assert.strictEqual(parseDuckDuckGoMarkdown(SERP, 1).length, 1);
		assert.strictEqual(parseDuckDuckGoMarkdown(SERP, 1)[0].title, 'Initial public offering of SpaceX - Wikipedia');
	});

	test('result with no snippet prose yields a placeholder, not garbage', () => {
		const noSnippet = `## [Example Domain](https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F&amp;rut=abc)

   [](https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F&amp;rut=abc)[example.com](https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F&amp;rut=abc)
`;
		const out = parseDuckDuckGoMarkdown(noSnippet, 5);
		assert.strictEqual(out.length, 1);
		assert.strictEqual(out[0].title, 'Example Domain');
		assert.strictEqual(out[0].url, 'https://example.com/');
		assert.strictEqual(out[0].snippet, 'No snippet available');
	});

	test('filters out duckduckgo-internal / ad result blocks', () => {
		const withAd = `## [Buy SpaceX Stock Now](https://duckduckgo.com/y.js?ad_provider=foo&rut=zzz)

   [](https://duckduckgo.com/y.js?ad_provider=foo)[An ad with no real target.](https://duckduckgo.com/y.js?ad_provider=foo)
${SERP}`;
		const out = parseDuckDuckGoMarkdown(withAd, 5);
		assert.ok(out.every(r => !r.url.includes('duckduckgo.com')), JSON.stringify(out));
		assert.ok(out.some(r => r.url.includes('en.wikipedia.org')), JSON.stringify(out));
	});

	test('empty / link-free content returns []', () => {
		assert.deepStrictEqual(parseDuckDuckGoMarkdown('', 5), []);
		assert.deepStrictEqual(parseDuckDuckGoMarkdown('   DuckDuckGo   no results here   ', 5), []);
	});
});
