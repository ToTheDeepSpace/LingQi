import test from 'node:test';
import assert from 'node:assert/strict';
import { detectSocialPlatform, extractSharedUrl } from '../src/lib/socialLinks.js';

test('extracts a Douyin URL from copied share text', () => {
  const text = '2.88 复制打开抖音，看看【泡泡的作品】 https://v.douyin.com/AbCd123/ 03/22';
  assert.equal(extractSharedUrl(text), 'https://v.douyin.com/AbCd123/');
  assert.equal(detectSocialPlatform(extractSharedUrl(text)), 'douyin');
});

test('extracts a Xiaohongshu short link and removes trailing punctuation', () => {
  const text = '打开小红书看看这篇笔记 http://xhslink.com/a/xyz123 ，复制本条信息';
  assert.equal(extractSharedUrl(text), 'http://xhslink.com/a/xyz123');
  assert.equal(detectSocialPlatform(extractSharedUrl(text)), 'xiaohongshu');
});

test('accepts a bare social domain and rejects ordinary prose', () => {
  assert.equal(extractSharedUrl('v.douyin.com/abc123'), 'https://v.douyin.com/abc123');
  assert.equal(extractSharedUrl('这是没有链接的分享文字'), '');
});
