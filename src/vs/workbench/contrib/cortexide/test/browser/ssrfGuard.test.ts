/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { assertNotSSRF } from '../../browser/toolsService.js';

suite('SSRF guard for browse_url', () => {

	const expectBlocked = (url: string) => {
		assert.throws(() => assertNotSSRF(url), /Blocked:/, `expected ${url} to be blocked`);
	};

	const expectAllowed = (url: string) => {
		assert.doesNotThrow(() => assertNotSSRF(url), `expected ${url} to be allowed`);
	};

	test('blocks localhost variants', () => {
		expectBlocked('http://localhost');
		expectBlocked('http://localhost:8080/foo');
		expectBlocked('https://api.localhost/v1');
	});

	test('blocks IPv4 loopback', () => {
		expectBlocked('http://127.0.0.1');
		expectBlocked('http://127.1.2.3:9000/path');
		expectBlocked('http://0.0.0.0');
	});

	test('blocks IPv4 private ranges', () => {
		expectBlocked('http://10.0.0.1');
		expectBlocked('http://10.255.255.255');
		expectBlocked('http://192.168.1.1');
		expectBlocked('http://172.16.0.1');
		expectBlocked('http://172.31.255.255');
	});

	test('blocks IPv4 link-local including cloud metadata service', () => {
		expectBlocked('http://169.254.169.254/latest/meta-data/'); // AWS / GCP metadata
		expectBlocked('http://169.254.0.1');
	});

	test('blocks IPv6 loopback and unspecified', () => {
		expectBlocked('http://[::1]/');
		expectBlocked('http://[::]/');
	});

	test('blocks IPv6 link-local and unique-local', () => {
		expectBlocked('http://[fe80::1]/');
		expectBlocked('http://[fc00::1]/');
		expectBlocked('http://[fd12:3456:789a::1]/');
	});

	test('blocks IPv4-mapped IPv6 forms of loopback / private', () => {
		expectBlocked('http://[::ffff:127.0.0.1]/');
		expectBlocked('http://[::ffff:10.0.0.1]/');
		expectBlocked('http://[::ffff:169.254.169.254]/');
	});

	test('allows ordinary public IPv4 / IPv6 / hostnames', () => {
		expectAllowed('https://example.com');
		expectAllowed('https://api.github.com/repos/foo/bar');
		expectAllowed('http://8.8.8.8');
		expectAllowed('http://172.15.0.1');     // just outside 172.16/12
		expectAllowed('http://172.32.0.1');     // just outside 172.16/12
		expectAllowed('http://192.169.0.1');    // just outside 192.168/16
		expectAllowed('https://[2606:4700:4700::1111]/'); // Cloudflare DNS
	});

	test('passes through malformed URLs (handled by the URL-format check elsewhere)', () => {
		// assertNotSSRF returns silently on URL.parse failure; the existing
		// "URL must start with http(s)://" check rejects these earlier.
		expectAllowed('not a url');
	});
});
