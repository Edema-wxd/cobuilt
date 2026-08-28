import { maskEmail, maskPhone, truncateIp } from '@/lib/privacy';

describe('NDPA data minimisation', () => {
  describe('truncateIp', () => {
    it('zeroes the final IPv4 octet', () => {
      expect(truncateIp('102.89.44.187')).toBe('102.89.44.0');
    });

    it('strips the IPv4-mapped IPv6 prefix before truncating', () => {
      expect(truncateIp('::ffff:102.89.44.187')).toBe('102.89.44.0');
    });

    it('keeps only the /48 prefix of an IPv6 address', () => {
      expect(truncateIp('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe('2001:db8:85a3::');
    });

    it('returns null for absent or unparseable input', () => {
      expect(truncateIp(null)).toBeNull();
      expect(truncateIp('')).toBeNull();
      expect(truncateIp('not-an-address')).toBeNull();
    });
  });

  describe('maskEmail', () => {
    it('keeps the first and last local character and the domain', () => {
      expect(maskEmail('folasade@cobuilt.com')).toBe('f******e@cobuilt.com');
    });

    it('handles very short local parts', () => {
      expect(maskEmail('ab@cobuilt.com')).toBe('a***@cobuilt.com');
    });

    it('does not leak anything for malformed input', () => {
      expect(maskEmail('no-at-sign')).toBe('***');
      expect(maskEmail(null)).toBeNull();
    });
  });

  describe('maskPhone', () => {
    it('keeps only the last four digits', () => {
      // 13 digits in, so nine masked characters precede the last four.
      expect(maskPhone('+234 801 234 5678')).toBe('*********5678');
    });

    it('masks a very short number entirely', () => {
      expect(maskPhone('123')).toBe('****');
    });
  });
});
