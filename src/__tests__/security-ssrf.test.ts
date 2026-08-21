/**
 * @file security-ssrf.test.ts
 * @description Unit tests for SSRF detection, cloud metadata blocking, and IP parsing.
 */

import { describe, it, expect } from 'vitest';
import { isPrivateHost } from '../utils/urlFetcher';

describe('SSRF & Private Host Defense', () => {
  it('blocks localhost and standard loopback addresses', () => {
    expect(isPrivateHost('localhost')).toBe(true);
    expect(isPrivateHost('127.0.0.1')).toBe(true);
    expect(isPrivateHost('127.10.0.1')).toBe(true);
    expect(isPrivateHost('0.0.0.0')).toBe(true);
    expect(isPrivateHost('::1')).toBe(true);
    expect(isPrivateHost('[::1]')).toBe(true);
  });

  it('blocks RFC 1918 private IPv4 addresses', () => {
    // 10.0.0.0/8
    expect(isPrivateHost('10.0.0.1')).toBe(true);
    expect(isPrivateHost('10.254.1.5')).toBe(true);

    // 172.16.0.0/12
    expect(isPrivateHost('172.16.0.1')).toBe(true);
    expect(isPrivateHost('172.31.255.254')).toBe(true);
    expect(isPrivateHost('172.32.0.1')).toBe(false); // Public range

    // 192.168.0.0/16
    expect(isPrivateHost('192.168.1.1')).toBe(true);
    expect(isPrivateHost('192.168.100.50')).toBe(true);
  });

  it('blocks cloud instance metadata endpoints (AWS, GCP, Azure)', () => {
    expect(isPrivateHost('169.254.169.254')).toBe(true);
    expect(isPrivateHost('metadata.google.internal')).toBe(true);
    expect(isPrivateHost('instance-data')).toBe(true);
  });

  it('blocks internal/private TLDs', () => {
    expect(isPrivateHost('service.internal')).toBe(true);
    expect(isPrivateHost('printer.local')).toBe(true);
    expect(isPrivateHost('router.lan')).toBe(true);
    expect(isPrivateHost('nas.home')).toBe(true);
    expect(isPrivateHost('intranet.corp')).toBe(true);
  });

  it('blocks decimal, hex, and octal obfuscated IP formats', () => {
    // 2130706433 = 127.0.0.1
    expect(isPrivateHost('2130706433')).toBe(true);
    // 0x7f000001 = 127.0.0.1
    expect(isPrivateHost('0x7f000001')).toBe(true);
    // Octal representation: 0177.0.0.1
    expect(isPrivateHost('0177.0.0.1')).toBe(true);
    // Hex dotted representation: 0x7f.0.0.1
    expect(isPrivateHost('0x7f.0.0.1')).toBe(true);
  });

  it('allows public legitimate web hostnames and IPs', () => {
    expect(isPrivateHost('google.com')).toBe(false);
    expect(isPrivateHost('wikipedia.org')).toBe(false);
    expect(isPrivateHost('github.com')).toBe(false);
    expect(isPrivateHost('8.8.8.8')).toBe(false);
    expect(isPrivateHost('1.1.1.1')).toBe(false);
  });
});
