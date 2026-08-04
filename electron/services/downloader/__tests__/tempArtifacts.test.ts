import { describe, it, expect } from 'vitest'
import { getTempArtifactRegexes } from '../tempArtifacts'

describe('getTempArtifactRegexes', () => {
  const [partRe, partInfoRe, resumeRe] = getTempArtifactRegexes('video.mp4')

  it('matches chunk files .part0 through .partN', () => {
    expect(partRe.test('video.mp4.part0')).toBe(true)
    expect(partRe.test('video.mp4.part3')).toBe(true)
    expect(partRe.test('video.mp4.part15')).toBe(true)
  })

  it('rejects malformed chunk names', () => {
    expect(partRe.test('video.mp4.part')).toBe(false)
    expect(partRe.test('video.mp4.partx')).toBe(false)
    expect(partRe.test('video.mp4.part10x')).toBe(false)
  })

  it('matches .partinfo and .resume', () => {
    expect(partInfoRe.test('video.mp4.partinfo')).toBe(true)
    expect(resumeRe.test('video.mp4.resume')).toBe(true)
  })

  it('never matches the final file itself or unrelated files', () => {
    for (const re of [partRe, partInfoRe, resumeRe]) {
      expect(re.test('video.mp4')).toBe(false)
      expect(re.test('video.mp4.partners.txt')).toBe(false)
      expect(re.test('other.mp4.part0')).toBe(false)
      expect(re.test('video.mp4x.part0')).toBe(false)
      expect(re.test('myvideo.mp4.part0')).toBe(false)
    }
  })

  it('escapes regex-special characters in the base name', () => {
    const [re] = getTempArtifactRegexes('file[1].tar.gz')
    expect(re.test('file[1].tar.gz.part2')).toBe(true)
    expect(re.test('file1.tar.gz.part2')).toBe(false)
  })

  it('handles plain bases with multiple extensions', () => {
    const [partRe, partInfoRe] = getTempArtifactRegexes('archive.tar.gz')
    expect(partRe.test('archive.tar.gz.part4')).toBe(true)
    expect(partInfoRe.test('archive.tar.gz.partinfo')).toBe(true)
    expect(partRe.test('archive.tar.gz.partinfo')).toBe(false)
  })
})
